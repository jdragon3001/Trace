import { ipcMain, globalShortcut, /*screen,*/ desktopCapturer, BrowserWindow, systemPreferences } from 'electron';
import { IpcChannels, KEYBOARD_SHORTCUTS } from '../../shared/constants';
import { /*RecordingStep,*/ MousePosition, RecordingStep } from '../../shared/types';
import { ImageService } from './ImageService';
import { uIOhook, UiohookKey, UiohookMouseEvent } from 'uiohook-napi';
import { EventEmitter } from 'events';
import * as path from 'path';
// import { GlobalKeyboardListener, IGlobalKey } from 'node-global-key-listener';
import * as fs from 'fs';
import { app } from 'electron';
import { ScreenshotService } from './ScreenshotService';
import ProjectService from './ProjectService';

// Helper function to generate a more unique ID
function generateUniqueId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export class RecordingService extends EventEmitter {
    private isRecording: boolean = false;
    private isPaused: boolean = false;
    private isReadyToCapture: boolean = true; // New state to control capturing
    private steps: RecordingStep[] = [];
    private stepCounter: number = 0;
    // private keyboardListener: GlobalKeyboardListener | null = null;
    private screenshotService: ScreenshotService;
    private imageService: ImageService;
    private tempDir: string;
    private hookActive: boolean = false;
    private lastCaptureTime: number = 0;
    private captureDebounceTime: number = 50; // Reduced from 1000ms to 50ms for near-instantaneous capture
    private mouseUpHandler: ((event: UiohookMouseEvent) => void) | null = null;
    private projectService: ProjectService;
    private activeProjectId: string | null = null;
    private activeTutorialId: string | null = null;
    private autoCapture: boolean = true; // Default to true
    private autoCaptureEnter: boolean = false;

    constructor(private mainWindow: BrowserWindow) {
        super();
        this.tempDir = path.join(app.getPath('userData'), 'openscribe_temp');
        this.screenshotService = new ScreenshotService(this.tempDir);
        this.imageService = new ImageService(this.tempDir);
        this.projectService = ProjectService.getInstance();
        this.initialize();
    }

    // Getter for isRecording state - add this
    public get getIsRecording(): boolean {
        return this.isRecording;
    }

    // Allow getting all steps
    public getSteps(): RecordingStep[] {
        return this.steps;
    }
    
    // Allow adding a step externally
    public addStep(step: RecordingStep): void {
        this.steps.push(step);
        console.log(`Added step manually: Step ${step.number}`);
    }

    private initialize(): void {
        this.setupDirectories();
        this.registerIpcHandlers();
        // this.registerKeyboardListener();
        this.initializeGlobalHookListener();
    }

    private setupDirectories(): void {
        fs.promises.mkdir(this.tempDir, { recursive: true })
            .catch(err => console.error('Failed to create temp directory:', err));
    }

    startRecording(): void {
        try {
            if (this.isRecording) {
                console.log('[RecordingService] startRecording called but already recording, ignoring');
                return;
            }
            
            console.log('[RecordingService] Starting recording...');
            
            // Check if screenshot directory is ready
            if (!fs.existsSync(this.tempDir)) {
                console.log(`[RecordingService] Creating temp directory: ${this.tempDir}`);
                fs.mkdirSync(this.tempDir, { recursive: true });
            }

            // Store the current project and tutorial IDs from ProjectService
            this.activeProjectId = this.projectService.getCurrentProjectId();
            this.activeTutorialId = this.projectService.getCurrentTutorialId();

            if (!this.activeProjectId || !this.activeTutorialId) {
                console.error('[RecordingService] Cannot start recording: No active project or tutorial');
                this.sendToRenderer(IpcChannels.RECORDING_ERROR, 'Cannot start recording: No active project or tutorial');
                return;
            }

            console.log(`[RecordingService] Recording for project: ${this.activeProjectId}, tutorial: ${this.activeTutorialId}`);
            
            // Start the screenshot buffering service for pre-click screenshots
            this.screenshotService.startBuffering();
            
            // Set recording state
            this.isRecording = true;
            this.isPaused = false;
            this.stepCounter = 0;
            this.lastCaptureTime = 0; // Reset capture time on start
            
            // Log debug info about current state
            console.log(`[RecordingService] Recording state set: isRecording=${this.isRecording}, isPaused=${this.isPaused}`);
            
            // Update the UI with the new recording state
            this.emitStateUpdate();
            
            // Register keyboard shortcuts for controlling recording
            this.registerShortcuts();
            
            console.log('[RecordingService] Recording started successfully');
        } catch (error) {
            console.error('[RecordingService] Error starting recording:', error);
            this.sendToRenderer(IpcChannels.RECORDING_ERROR, `Failed to start recording: ${error}`);
            // Reset state in case of error
            this.isRecording = false;
            this.isPaused = false;
            throw error;
        }
    }

    stopRecording(): void {
        if (!this.isRecording) return;
        console.log('[RecordingService] Stopping recording...');
        this.isRecording = false;
        this.isPaused = false;
        
        // Stop the screenshot buffering service
        this.screenshotService.stopBuffering();
        
        // Clear active project/tutorial IDs when recording stops
        console.log(`[RecordingService] Clearing active project/tutorial: ${this.activeProjectId}/${this.activeTutorialId}`);
        this.activeProjectId = null;
        this.activeTutorialId = null;
        
        this.emitStateUpdate();
        this.unregisterShortcuts();
    }

    pauseRecording(): void {
        if (!this.isRecording || this.isPaused) return;
        console.log('Pausing recording...');
        this.isPaused = true;
        this.emitStateUpdate();
    }

    resumeRecording(): void {
        if (!this.isRecording || !this.isPaused) return;
        console.log('Resuming recording...');
        this.isPaused = false;
        this.emitStateUpdate();
    }

    private emitStateUpdate(): void {
        const state = {
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            isReadyToCapture: this.isReadyToCapture,
            currentStep: this.stepCounter,
            steps: this.steps,
        };
        console.log('[RecordingService] Emitting state update:', JSON.stringify({
            isRecording: state.isRecording, 
            isPaused: state.isPaused,
            isReadyToCapture: state.isReadyToCapture,
            stepCount: this.steps.length,
            currentStep: this.stepCounter
        }));
        this.sendToRenderer(IpcChannels.RECORDING_STATUS, state);
        console.log('[RecordingService] State update sent.');
    }

    private sendToRenderer(channel: string, ...args: unknown[]): void {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
             console.log(`[RecordingService] Sending to renderer on channel '${channel}':`, args); // Log send details
             this.mainWindow.webContents.send(channel, ...args);
        } else {
             console.warn(`[RecordingService] Cannot send to renderer on '${channel}', mainWindow is invalid.`);
        }
    }

    private registerIpcHandlers(): void {
        console.log('[RecordingService] Setting up IPC handlers...');
        
        // Start recording command
        ipcMain.handle(IpcChannels.START_RECORDING, async (): Promise<void> => {
            return this.startRecording();
        });
        
        // Stop recording command
        ipcMain.handle(IpcChannels.STOP_RECORDING, async (): Promise<void> => {
            return this.stopRecording();
        });
        
        // Pause recording command
        ipcMain.handle(IpcChannels.PAUSE_RECORDING, async (): Promise<void> => {
            return this.pauseRecording();
        });
        
        // Resume recording command
        ipcMain.handle(IpcChannels.RESUME_RECORDING, async (): Promise<void> => {
            return this.resumeRecording();
        });
        
        // Update recording settings
        ipcMain.handle(IpcChannels.UPDATE_RECORDING_SETTINGS, (_event, settings: { 
            autoCapture: boolean, 
            autoCaptureEnter: boolean 
        }) => {
            console.log(`[RecordingService] Updating recording settings: autoCapture=${settings.autoCapture}, autoCaptureEnter=${settings.autoCaptureEnter}`);
            this.autoCapture = settings.autoCapture;
            this.autoCaptureEnter = settings.autoCaptureEnter;
            return { success: true };
        });
        
        // Listen for step recorded notifications from the renderer to broadcast to other renderer processes
        ipcMain.on(IpcChannels.STEP_RECORDED_NOTIFICATION, (_event, step: RecordingStep) => {
            console.log(`[RecordingService] Received step recorded notification, rebroadcasting to all windows`);
            this.sendToRenderer(IpcChannels.STEP_CREATED, step);
        });

        ipcMain.handle(IpcChannels.GET_MEDIA_ACCESS_STATUS, async (_event, mediaType: string) => {
           try {
              const status = systemPreferences.getMediaAccessStatus(mediaType as any);
              return status;
           } catch (error) {
              console.error(`Failed to get media access status for ${mediaType}:`, error);
              return 'error';
           }
        });
    }

    private initializeGlobalHookListener(): void {
        if (this.hookActive) return;
        console.log('[RecordingService] Initializing uiohook listener...');

        const mouseUpHandler = (event: UiohookMouseEvent) => {
            // Log *immediately* upon event firing
            console.log(`[!!! RecordingService] RAW mouseUp event detected (uiohook): Button ${event.button}, Clicks ${event.clicks} at (${event.x}, ${event.y}) - Timestamp: ${Date.now()}`);

            console.log(`[RecordingService] Checking mouseUp conditions: isRecording=${this.isRecording}, isPaused=${this.isPaused}, autoCapture=${this.autoCapture}`);

            const currentTime = Date.now();
            
            // Only capture if autoCapture is enabled
            if (this.isRecording && !this.isPaused && this.autoCapture) {
                // Use a much shorter debounce time
                if (currentTime - this.lastCaptureTime >= this.captureDebounceTime) {
                    console.log('[RecordingService] Capturing step due to mouseUp...');
                    this.lastCaptureTime = currentTime;
                    
                    // Store data first to minimize delay between event and capture
                    const mousePosition = { x: event.x, y: event.y };
                    
                    // Initiate capture immediately with minimal preprocessing
                    this.captureStep('click', mousePosition);
                } else {
                    console.log(`[RecordingService] Ignoring mouseUp event - debounce time not elapsed (${currentTime - this.lastCaptureTime}ms / ${this.captureDebounceTime}ms)`);
                }
            } else {
                console.log(`[RecordingService] Ignoring mouseUp event (Recording: ${this.isRecording}, Paused: ${this.isPaused}, AutoCapture: ${this.autoCapture}).`);
            }
        };

        // Add keyboard event handler for Enter key
        const keyboardHandler = (event: any) => {
            // Check if it's an Enter key press (keycode 28 in uIOhook)
            if (event.keycode === 28) {
                console.log('[RecordingService] Enter key detected');
                
                // Only capture if autoCaptureEnter is enabled
                if (this.isRecording && !this.isPaused && this.autoCaptureEnter) {
                    const currentTime = Date.now();
                    
                    // Check debounce like with mouse events
                    if (currentTime - this.lastCaptureTime >= this.captureDebounceTime) {
                        console.log('[RecordingService] Capturing step due to Enter key...');
                        this.lastCaptureTime = currentTime;
                        // Get current mouse position for the screenshot
                        this.captureStep('enter', undefined);
                    } else {
                        console.log(`[RecordingService] Ignoring Enter key - debounce time not elapsed`);
                    }
                } else {
                    console.log(`[RecordingService] Ignoring Enter key (Recording: ${this.isRecording}, Paused: ${this.isPaused}, AutoCaptureEnter: ${this.autoCaptureEnter}).`);
                }
            }
        };

        // Store the handler reference so we can remove it later
        this.mouseUpHandler = mouseUpHandler;

        uIOhook.on('mouseup', mouseUpHandler);
        uIOhook.on('keydown', keyboardHandler);

        try {
            uIOhook.start();
            this.hookActive = true;
            console.log('[RecordingService] uiohook listener started successfully.');
        } catch (error) {
            console.error('[RecordingService] Error starting uiohook listener:', error);
            this.sendToRenderer(IpcChannels.RECORDING_ERROR, 'Failed to start global input listener.');
        }
    }

    private async captureStep(type: 'click' | 'enter', data?: MousePosition): Promise<void> {
        if (!this.isRecording || this.isPaused) return;
        
        // Verify we have active project and tutorial IDs
        if (!this.activeProjectId || !this.activeTutorialId) {
            console.error('[RecordingService] Cannot capture step: No active project or tutorial');
            return;
        }
        
        // Capture the step number *before* any async operations
        const currentStepNumber = ++this.stepCounter;
        console.log(`Attempting to capture step ${currentStepNumber} (type: ${type})`, data);

        try {
            // Prepare all data synchronously before any async operations
            const timestamp = new Date().toISOString();
            const uniqueId = generateUniqueId();
            const screenshotFilename = `step_${uniqueId}.png`;
            const screenshotPath = path.join(this.tempDir, screenshotFilename);
            
            // Capture screenshot as early as possible with minimal pre-processing
            const screenshotPromise = this.screenshotService.captureScreen(screenshotPath);
            
            // Create the step object in parallel
            const newStep: RecordingStep = {
                id: uniqueId,
                number: currentStepNumber,
                timestamp: timestamp,
                screenshotPath: screenshotPath,
                mousePosition: data || { x: 0, y: 0 },
                windowTitle: '',
                description: type === 'click' 
                    ? `Clicked at (${data?.x || 0}, ${data?.y || 0})`
                    : 'Captured on Enter key press',
            };
            
            // Wait for screenshot to complete
            await screenshotPromise;
            console.log(`Screenshot saved to: ${screenshotPath}`);

            // Create click marker in parallel with step recording
            if (data) {
                // Use the new editable click marker instead of embedding in the image
                this.imageService.createEditableClickMarker(screenshotPath, data, currentStepNumber)
                    .then(() => {
                        console.log(`Editable click marker created for step ${currentStepNumber}: ${screenshotPath}`);
                    })
                    .catch(drawError => {
                        console.error(`[RecordingService] Failed to create click marker on ${screenshotPath} for step ${currentStepNumber}:`, drawError);
                    });
            }

            // Add step to steps array
            this.steps.push(newStep);
            
            // Send step to renderer
            this.sendToRenderer(IpcChannels.STEP_CREATED, newStep);

        } catch (error) {
            console.error('Failed to capture step:', error);
            if (error instanceof Error) {
                this.sendToRenderer(IpcChannels.RECORDING_ERROR, `Failed to capture step: ${error.message}`);
            } else {
                this.sendToRenderer(IpcChannels.RECORDING_ERROR, 'Failed to capture step: Unknown error');
            }
        }
    }

    private registerShortcuts(): void {
        // Unregister any existing shortcuts first to avoid conflicts
        this.unregisterShortcuts();
        
        // Now register the intended shortcuts
        if (!globalShortcut.register(KEYBOARD_SHORTCUTS.STOP_RECORDING, () => this.stopRecording())) {
             console.error(`Failed to register shortcut: ${KEYBOARD_SHORTCUTS.STOP_RECORDING}`);
        }
        if (!globalShortcut.register(KEYBOARD_SHORTCUTS.PAUSE_RECORDING, () => {
             this.isPaused ? this.resumeRecording() : this.pauseRecording();
        })) {
            console.error(`Failed to register shortcut: ${KEYBOARD_SHORTCUTS.PAUSE_RECORDING}`);
        }
        
        // Explicitly prevent Enter from doing anything in global shortcuts
        // This should intercept it before it can trigger UI actions
        globalShortcut.register('Enter', () => {
            console.log('[RecordingService] Enter key intercepted by global shortcut handler');
            // Do nothing - this prevents other handlers from getting it
            return false;
        });
        
        console.log('[RecordingService] Shortcuts registered, Enter key specially handled');
    }

    private unregisterShortcuts(): void {
        console.log('[RecordingService] Unregistering all shortcuts');
        globalShortcut.unregister(KEYBOARD_SHORTCUTS.STOP_RECORDING);
        globalShortcut.unregister(KEYBOARD_SHORTCUTS.PAUSE_RECORDING);
        globalShortcut.unregister('Enter');
        globalShortcut.unregister('Return');
        // Consider using unregisterAll() in production
    }

    public cleanup(): void {
        console.log('Cleaning up RecordingService...');
        this.unregisterShortcuts();
        
        // Make sure to stop buffering when cleaning up
        this.screenshotService.stopBuffering();
        
        if (this.hookActive) {
            try {
                // Remove the mouseup event listener if it exists
                if (this.mouseUpHandler) {
                    uIOhook.removeListener('mouseup', this.mouseUpHandler);
                    console.log('[RecordingService] Removed mouseup event listener');
                }
                
                // Stop the uIOhook
                uIOhook.stop();
                this.hookActive = false;
                console.log('[RecordingService] uIOhook stopped');
            } catch (error) {
                console.error('[RecordingService] Error cleaning up uIOhook:', error);
            }
        }
        
        // Make sure Enter key shortcuts are also unregistered
        try {
            globalShortcut.unregister('Enter');
            globalShortcut.unregister('Return');
        } catch (error) {
            console.log('No Enter/Return shortcuts to unregister during cleanup');
        }
    }
}

export default RecordingService;
