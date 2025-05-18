import { /*screen,*/ desktopCapturer } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import screenshot from 'screenshot-desktop';
// import { app } from 'electron'; // app is not needed here if dir is passed in

// Export the class directly
export class ScreenshotService {
  private screenshotDir: string;
  private lastScreenBuffer: Buffer | null = null;
  private bufferInterval: NodeJS.Timeout | null = null;
  private bufferingActive: boolean = false;
  private bufferIntervalMs: number = 200; // Capture every 200ms

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
      this.lastScreenBuffer = await screenshot();
    } catch (error) {
      console.error('[ScreenshotService] Failed to update screen buffer:', error);
    }
  }

  // Use buffered screenshot instead of capturing new one
  public async captureScreen(filepath: string): Promise<void> {
    try {
      // If we have a buffer, use it
      if (this.lastScreenBuffer) {
        await fs.writeFile(filepath, this.lastScreenBuffer);
        console.log(`Screenshot saved from buffer to: ${filepath}`);
      } else {
        // Fall back to direct capture if no buffer is available
        const buffer = await screenshot();
        await fs.writeFile(filepath, buffer);
        console.log(`Screenshot saved directly to: ${filepath}`);
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
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