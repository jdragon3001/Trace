import { /*screen,*/ desktopCapturer, BrowserWindow } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import screenshot from 'screenshot-desktop';
import sharp from 'sharp';
// import { app } from 'electron'; // app is not needed here if dir is passed in

// Interface for region selection
export interface CaptureRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Export the class directly
export class ScreenshotService {
  private screenshotDir: string;
  private lastScreenBuffer: Buffer | null = null;
  private bufferInterval: NodeJS.Timeout | null = null;
  private bufferingActive: boolean = false;
  private bufferIntervalMs: number = 200; // Capture every 200ms
  private captureRegion: CaptureRegion | null = null;
  private captureMode: 'fullScreen' | 'customRegion' = 'fullScreen';
  private regionSelectorWindow: BrowserWindow | null = null;

  // Accept directory path in constructor
  constructor(screenshotDir: string) {
    // Use the provided directory path
    // this.screenshotDir = path.join(app.getPath('userData'), 'screenshots');
    this.screenshotDir = screenshotDir;
    this.ensureScreenshotDir();
  }

  private async ensureScreenshotDir(): Promise<void> {
    try {
      await fs.access(this.screenshotDir);
    } catch {
      await fs.mkdir(this.screenshotDir, { recursive: true });
    }
  }

  // Setter for capture mode
  public setCaptureMode(mode: 'fullScreen' | 'customRegion'): void {
    this.captureMode = mode;
    console.log(`[ScreenshotService] Capture mode set to: ${mode}`);
    // Reset region if mode is set to fullScreen
    if (mode === 'fullScreen') {
      this.captureRegion = null;
    }
  }

  // Get the current capture mode
  public getCaptureMode(): 'fullScreen' | 'customRegion' {
    return this.captureMode;
  }

  // Set the capture region
  public setCaptureRegion(region: CaptureRegion): void {
    this.captureRegion = region;
    console.log(`[ScreenshotService] Capture region set to: ${JSON.stringify(region)}`);
  }

  // Get the current capture region
  public getCaptureRegion(): CaptureRegion | null {
    return this.captureRegion;
  }

  // Open a window to select region
  public async selectCaptureRegion(): Promise<CaptureRegion | null> {
    return new Promise((resolve, reject) => {
      const { BrowserWindow, ipcMain, app } = require('electron');
      
      // Create a transparent window that covers the entire screen
      const displays = require('electron').screen.getAllDisplays();
      const primaryDisplay = displays.find((display: any) => display.bounds.x === 0 && display.bounds.y === 0);
      
      if (!primaryDisplay) {
        reject(new Error('Could not find primary display'));
        return;
      }
      
      // Close any existing selector window
      if (this.regionSelectorWindow) {
        this.regionSelectorWindow.close();
        this.regionSelectorWindow = null;
      }
      
      // Create a new window for region selection
      const selectorWindow = new BrowserWindow({
        width: primaryDisplay.bounds.width,
        height: primaryDisplay.bounds.height,
        x: primaryDisplay.bounds.x,
        y: primaryDisplay.bounds.y,
        transparent: true,
        frame: false,
        fullscreen: true,
        alwaysOnTop: true,
        resizable: false, // Prevent window resizing
        movable: false, // Prevent window movement
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false
        }
      });
      
      this.regionSelectorWindow = selectorWindow;
      
      // Disable window menu to prevent interference
      selectorWindow.setMenuBarVisibility(false);
      
      // Instead of loading from a file, we'll load HTML content directly
      const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Select Capture Region</title>
          <style>
              body {
                  margin: 0;
                  padding: 0;
                  overflow: hidden;
                  background-color: rgba(0, 0, 0, 0.4);
                  font-family: Arial, sans-serif;
                  cursor: crosshair;
                  user-select: none;
                  width: 100vw;
                  height: 100vh;
              }
              
              #instructions {
                  position: absolute;
                  top: 20px;
                  left: 50%;
                  transform: translateX(-50%);
                  background-color: rgba(0, 0, 0, 0.7);
                  color: white;
                  padding: 10px 20px;
                  border-radius: 5px;
                  text-align: center;
                  z-index: 100;
              }
              
              #selection-box {
                  position: absolute;
                  border: 2px solid #39f;
                  background-color: rgba(51, 153, 255, 0.1);
                  display: none;
                  pointer-events: none;
              }
              
              #dimensions {
                  position: absolute;
                  background-color: #39f;
                  color: white;
                  padding: 2px 8px;
                  font-size: 12px;
                  border-radius: 3px;
                  display: none;
                  pointer-events: none;
              }
          </style>
      </head>
      <body>
          <div id="instructions">Click and drag to select a region for capture. Press Escape to cancel.</div>
          <div id="selection-box"></div>
          <div id="dimensions"></div>
          
          <script>
              const { ipcRenderer } = require('electron');
              
              const selectionBox = document.getElementById('selection-box');
              const dimensionsDisplay = document.getElementById('dimensions');
              const instructions = document.getElementById('instructions');
              
              let isSelecting = false;
              let startX = 0;
              let startY = 0;
              let endX = 0;
              let endY = 0;
              
              // Debug helper
              function debug(msg) {
                  console.log(msg);
                  instructions.textContent = msg;
              }
              
              debug("Click and drag to select a region");
              
              // Handle mouse down - start selection
              document.addEventListener('mousedown', (e) => {
                  // Start the selection process
                  isSelecting = true;
                  startX = e.clientX;
                  startY = e.clientY;
                  
                  // Reset the selection box
                  selectionBox.style.display = 'block';
                  selectionBox.style.left = \`\${startX}px\`;
                  selectionBox.style.top = \`\${startY}px\`;
                  selectionBox.style.width = '0';
                  selectionBox.style.height = '0';
                  
                  // Show dimensions display
                  dimensionsDisplay.style.display = 'block';
                  dimensionsDisplay.style.left = \`\${startX + 10}px\`;
                  dimensionsDisplay.style.top = \`\${startY + 10}px\`;
                  dimensionsDisplay.textContent = '0 × 0';
                  
                  // Prevent default behavior and event propagation
                  e.preventDefault();
                  e.stopPropagation();
              });
              
              // Handle mouse move - update selection
              document.addEventListener('mousemove', (e) => {
                  if (!isSelecting) return;
                  
                  endX = e.clientX;
                  endY = e.clientY;
                  
                  // Calculate the width and height
                  const width = Math.abs(endX - startX);
                  const height = Math.abs(endY - startY);
                  
                  // Calculate top-left corner for the box
                  const left = Math.min(startX, endX);
                  const top = Math.min(startY, endY);
                  
                  // Update selection box
                  selectionBox.style.left = \`\${left}px\`;
                  selectionBox.style.top = \`\${top}px\`;
                  selectionBox.style.width = \`\${width}px\`;
                  selectionBox.style.height = \`\${height}px\`;
                  
                  // Update dimensions display
                  dimensionsDisplay.textContent = \`\${width} × \${height}\`;
                  dimensionsDisplay.style.left = \`\${endX + 10}px\`;
                  dimensionsDisplay.style.top = \`\${endY + 10}px\`;
                  
                  // Prevent default behavior and event propagation
                  e.preventDefault();
                  e.stopPropagation();
              });
              
              // Handle mouse up - end selection and auto-confirm
              document.addEventListener('mouseup', (e) => {
                  if (!isSelecting) return;
                  
                  isSelecting = false;
                  endX = e.clientX;
                  endY = e.clientY;
                  
                  // Calculate the dimensions
                  const width = Math.abs(endX - startX);
                  const height = Math.abs(endY - startY);
                  
                  // Auto-confirm the selection (no minimum size check)
                  const x = Math.min(startX, endX);
                  const y = Math.min(startY, endY);
                  const region = { x, y, width, height };
                  
                  debug("Selection complete: " + width + "x" + height + " - Submitting...");
                  
                  // Send region data back to main process
                  try {
                      ipcRenderer.send('region-selected', region);
                  } catch (err) {
                      debug("Error sending region: " + err.toString());
                  }
                  
                  // Prevent default behavior and event propagation
                  e.preventDefault();
                  e.stopPropagation();
              });
              
              // Handle escape key to cancel
              document.addEventListener('keydown', (e) => {
                  if (e.key === 'Escape') {
                      debug("Selection canceled (Escape key)");
                      ipcRenderer.send('region-selection-canceled');
                  }
              });
              
              // Prevent context menu
              document.addEventListener('contextmenu', (e) => {
                  e.preventDefault();
                  return false;
              });
              
              // Stop propagation of all window-level events that could interfere
              window.addEventListener('resize', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  return false;
              });
              
              // Make sure we're always fullscreen
              document.documentElement.requestFullscreen().catch(err => {
                  console.log("Could not enter fullscreen mode:", err);
              });
          </script>
      </body>
      </html>
      `;
      
      // Load the HTML content directly into the window
      selectorWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
        .catch((err: Error) => {
          console.error(`[ScreenshotService] Error loading region selector HTML: ${err}`);
          reject(err);
        });
      
      console.log(`[ScreenshotService] Loading region selector directly from HTML content`);
      
      // Set up direct IPC handlers
      const regionSelectedHandler = (event: Electron.IpcMainEvent, region: CaptureRegion) => {
        console.log(`[ScreenshotService] Region selected via IPC: ${JSON.stringify(region)}`);
        this.captureRegion = region;
        this.captureMode = 'customRegion';
        
        // Clean up
        ipcMain.removeListener('region-selected', regionSelectedHandler);
        ipcMain.removeListener('region-selection-canceled', cancelHandler);
        
        if (this.regionSelectorWindow) {
          this.regionSelectorWindow.close();
          this.regionSelectorWindow = null;
        }
        
        resolve(region);
      };
      
      const cancelHandler = () => {
        console.log('[ScreenshotService] Region selection canceled via IPC');
        
        // Clean up
        ipcMain.removeListener('region-selected', regionSelectedHandler);
        ipcMain.removeListener('region-selection-canceled', cancelHandler);
        
        if (this.regionSelectorWindow) {
          this.regionSelectorWindow.close();
          this.regionSelectorWindow = null;
        }
        
        resolve(null);
      };
      
      // Set up IPC handlers for direct communication
      ipcMain.once('region-selected', regionSelectedHandler);
      ipcMain.once('region-selection-canceled', cancelHandler);
      
      // Handle window closing
      selectorWindow.on('closed', () => {
        console.log('[ScreenshotService] Region selector window closed');
        
        // Clean up IPC handlers if they haven't been already
        ipcMain.removeListener('region-selected', regionSelectedHandler);
        ipcMain.removeListener('region-selection-canceled', cancelHandler);
        
        this.regionSelectorWindow = null;
        
        // If the window is closed without a selection, resolve with null
        if (this.captureRegion) {
          resolve(this.captureRegion);
        } else {
          resolve(null);
        }
      });
    });
  }

  // Start continuous buffering of screenshots
  public startBuffering(): void {
    if (this.bufferingActive) return;
    
    this.bufferingActive = true;
    this.updateBuffer(); // Capture first frame immediately
    
    // Set up interval for continuous capture
    this.bufferInterval = setInterval(() => {
      this.updateBuffer();
    }, this.bufferIntervalMs);
    
    console.log('[ScreenshotService] Screen buffering started');
  }
  
  // Stop buffering when not needed
  public stopBuffering(): void {
    if (!this.bufferingActive) return;
    
    if (this.bufferInterval) {
      clearInterval(this.bufferInterval);
      this.bufferInterval = null;
    }
    
    this.bufferingActive = false;
    this.lastScreenBuffer = null;
    console.log('[ScreenshotService] Screen buffering stopped');
  }
  
  // Update buffer with latest screen
  private async updateBuffer(): Promise<void> {
    try {
      // Capture full screen - we'll crop later if needed
      this.lastScreenBuffer = await screenshot();
    } catch (error) {
      console.error('[ScreenshotService] Failed to update screen buffer:', error);
    }
  }

  // Use buffered screenshot instead of capturing new one
  public async captureScreen(filepath: string): Promise<void> {
    try {
      let buffer: Buffer;
      
      // If we have a buffer, use it
      if (this.lastScreenBuffer) {
        buffer = this.lastScreenBuffer;
        console.log(`[ScreenshotService] Using buffered screenshot`);
      } else {
        // Fall back to direct capture if no buffer is available
        buffer = await screenshot();
        console.log(`[ScreenshotService] Captured new screenshot`);
      }
      
      // If using custom region mode and we have region data, crop the image
      if (this.captureMode === 'customRegion' && this.captureRegion) {
        const { x, y, width, height } = this.captureRegion;
        console.log(`[ScreenshotService] Cropping to region: ${JSON.stringify(this.captureRegion)}`);
        
        // Use sharp to crop the image
        const croppedBuffer = await sharp(buffer)
          .extract({ left: x, top: y, width, height })
          .toBuffer();
        
        // Write the cropped image
        await fs.writeFile(filepath, croppedBuffer);
        console.log(`[ScreenshotService] Cropped screenshot saved to: ${filepath}`);
      } else {
        // Write the full screenshot
        await fs.writeFile(filepath, buffer);
        console.log(`[ScreenshotService] Full screenshot saved to: ${filepath}`);
      }
    } catch (error) {
      console.error('[ScreenshotService] Failed to capture screenshot:', error);
      throw new Error('Screenshot capture failed');
    }
  }

  public async cleanup(): Promise<void> {
    this.stopBuffering();
    
    try {
      const files = await fs.readdir(this.screenshotDir);
      const deletePromises = files.map(file =>
        fs.unlink(path.join(this.screenshotDir, file))
      );
      await Promise.all(deletePromises);
    } catch (error) {
      console.error('Failed to cleanup screenshots:', error);
    }
  }
}

// Remove the default instance export
// export default new ScreenshotService(); 