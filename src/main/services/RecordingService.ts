import { ipcMain, globalShortcut, screen, desktopCapturer, BrowserWindow } from 'electron';
import { IpcChannels, KEYBOARD_SHORTCUTS } from '../../shared/constants';
import { RecordingStep, MousePosition } from '../../shared/types';
import ScreenshotService from './ScreenshotService';
import ImageService from './ImageService';
import mouseEvents from 'global-mouse-events';

export class RecordingService {
  private isRecording: boolean = false;
  private stepCount: number = 0;
  private steps: RecordingStep[] = [];

  constructor() {
    this.initializeIpcHandlers();
    this.initializeGlobalMouseListener();
  }

  private initializeIpcHandlers(): void {
    ipcMain.handle(IpcChannels.START_RECORDING, () => this.startRecording());
    ipcMain.handle(IpcChannels.STOP_RECORDING, () => this.stopRecording());
    ipcMain.handle(IpcChannels.PAUSE_RECORDING, () => this.pauseRecording());
  }

  private initializeGlobalMouseListener(): void {
    if (typeof mouseEvents.on === 'function') {
      mouseEvents.on('mousedown', (event: { x: number; y: number; button: number }) => {
        if (event.button === 1 && this.isRecording) {
          console.log(`Mouse down detected: Button ${event.button} at (${event.x}, ${event.y})`);
          const position: MousePosition = { x: event.x, y: event.y };
          this.captureStep(position);
        }
      });
    } else {
        console.error("Failed to attach mouse listener: .on method not found on default import.");
        try {
            const mouseEventsRequire = require('global-mouse-events');
            if(typeof mouseEventsRequire.on === 'function') {
                mouseEventsRequire.on('mousedown', (event: { x: number; y: number; button: number }) => {
                    if (event.button === 1 && this.isRecording) {
                        console.log(`Mouse down detected (via require): Button ${event.button} at (${event.x}, ${event.y})`);
                        const position: MousePosition = { x: event.x, y: event.y };
                        this.captureStep(position);
                    }
                 });
                 console.log("Successfully attached mouse listener via fallback require.");
            } else {
                 console.error("Fallback require also failed to find .on method.");
                 this.emitError("Failed to set up input listener.");
            }
        } catch (e) {
            console.error("Error during fallback require for global-mouse-events:", e);
            this.emitError("Failed to set up input listener.");
        }
    }
  }

  public setupShortcuts(): void {
    globalShortcut.register(KEYBOARD_SHORTCUTS.START_RECORDING, () => {
      this.startRecording();
    });

    globalShortcut.register(KEYBOARD_SHORTCUTS.STOP_RECORDING, () => {
      this.stopRecording();
    });

    globalShortcut.register(KEYBOARD_SHORTCUTS.PAUSE_RECORDING, () => {
      this.pauseRecording();
    });
  }

  public async captureStep(mousePosition: MousePosition): Promise<void> {
    if (!this.isRecording) return;

    try {
      const screenshotPath = await ScreenshotService.captureScreenshot();
      
      await ImageService.drawCircle(screenshotPath, mousePosition, this.stepCount + 1);

      const step: RecordingStep = {
        id: Date.now().toString(),
        number: this.stepCount + 1,
        timestamp: new Date().toISOString(),
        screenshotPath,
        mousePosition,
        windowTitle: await this.getActiveWindowTitle(),
        description: ''
      };

      this.steps.push(step);
      this.stepCount++;

      this.emitStepCreated(step);
    } catch (error) {
      console.error('Error processing step:', error);
      this.emitError('Failed to process step');
    }
  }

  private async getActiveWindowTitle(): Promise<string> {
    try {
      const sources = await desktopCapturer.getSources({ types: ['window'] });
      const activeSource = sources.find(source => {
        return source.id.includes('screen') || source.name !== '';
      });
      return activeSource?.name || 'Active Window';
    } catch (error) {
      console.error('Error getting window title:', error);
      return 'Unknown Window';
    }
  }

  private emitStepCreated(step: RecordingStep): void {
    this.sendToRenderer(IpcChannels.STEP_CREATED, step);
  }

  private emitError(message: string): void {
    this.sendToRenderer(IpcChannels.RECORDING_ERROR, message);
  }

  private sendToRenderer(channel: string, data: unknown): void {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: BrowserWindow) => window.webContents.send(channel, data));
  }

  public startRecording(): boolean {
    try {
      if (this.isRecording) {
        console.log('Recording already in progress.');
        return true;
      }
      console.log('Starting recording...');
      this.isRecording = true;
      this.stepCount = 0;
      this.steps = [];
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      this.emitError('Failed to start recording');
      return false;
    }
  }

  public stopRecording(): boolean {
    try {
      if (!this.isRecording) {
        console.log('Recording not active.');
        return true;
      }
      console.log('Stopping recording...');
      this.isRecording = false;
      return true;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      this.emitError('Failed to stop recording');
      return false;
    }
  }

  public pauseRecording(): boolean {
    if (!this.isRecording) {
      console.log('Recording not active, cannot pause.');
      return true;
    }
    console.log('Pausing recording...');
    this.isRecording = false;
    return true;
  }

  public cleanup(): void {
    globalShortcut.unregisterAll();
    console.log('Attempting to clean up mouse listeners (if possible)...');
    try {
        const mouseEventsRequire = require('global-mouse-events');
        if (typeof mouseEventsRequire.removeAllListeners === 'function') {
            mouseEventsRequire.removeAllListeners();
            console.log('Removed all mouse listeners via removeAllListeners.');
        } else if (typeof mouseEventsRequire.stop === 'function') {
             mouseEventsRequire.stop();
             console.log('Stopped mouse listeners via stop().');
        }
    } catch (e) {
         console.error("Error during cleanup attempt for global-mouse-events:", e);
    }
  }
}

export default RecordingService;
