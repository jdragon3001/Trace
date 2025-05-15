import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IpcChannels } from '../shared/constants';
import { MousePosition, RecordingStep } from '../shared/types'; // Correct path from src/main/preload.ts to src/shared/types.ts

console.log('--- FULL PRELOAD SCRIPT EXECUTING --- ');

// Expose electronAPI (Keep this one)
try {
  console.log('[Preload] Attempting to expose window.electronAPI...');
  contextBridge.exposeInMainWorld('electronAPI', {
    startRecording: () => ipcRenderer.invoke(IpcChannels.START_RECORDING),
    stopRecording: () => ipcRenderer.invoke(IpcChannels.STOP_RECORDING),
    pauseRecording: () => ipcRenderer.invoke(IpcChannels.PAUSE_RECORDING),
    resumeRecording: () => ipcRenderer.invoke(IpcChannels.RESUME_RECORDING),
    onStepCreated: (callback: (step: any) => void) => {
      const listener = (_event: IpcRendererEvent, step: any) => callback(step);
      ipcRenderer.on(IpcChannels.STEP_CREATED, listener);
      return () => {
        ipcRenderer.removeListener(IpcChannels.STEP_CREATED, listener);
      };
    },
    onRecordingStatus: (callback: (state: { isRecording: boolean; isPaused: boolean; currentStep: number; steps: any[] }) => void) => {
        const listener = (_event: IpcRendererEvent, state: { isRecording: boolean; isPaused: boolean; currentStep: number; steps: any[] }) => callback(state);
        ipcRenderer.on(IpcChannels.RECORDING_STATUS, listener);
        return () => {
            ipcRenderer.removeListener(IpcChannels.RECORDING_STATUS, listener);
        };
    },
    onRecordingError: (callback: (error: string) => void) => {
      const listener = (_event: IpcRendererEvent, error: string) => callback(error);
      ipcRenderer.on(IpcChannels.RECORDING_ERROR, listener);
      return () => {
        ipcRenderer.removeListener(IpcChannels.RECORDING_ERROR, listener);
      };
    },
    getSteps: (): Promise<unknown[]> => ipcRenderer.invoke(IpcChannels.GET_STEPS),
    addStep: (step: unknown) => ipcRenderer.send(IpcChannels.ADD_STEP, step),
    getAudioSources: (): Promise<unknown[]> => ipcRenderer.invoke('get-audio-sources'),
    // Project Management APIs
    getProjects: () => ipcRenderer.invoke(IpcChannels.GET_PROJECTS),
    getRecentProjects: () => ipcRenderer.invoke(IpcChannels.GET_RECENT_PROJECTS),
    createProject: (name: string, description?: string) => ipcRenderer.invoke(IpcChannels.CREATE_PROJECT, name, description),
    saveProject: (steps: unknown[], filePath?: string) => ipcRenderer.invoke(IpcChannels.SAVE_PROJECT, steps, filePath),
    loadProject: (filePath: string): Promise<unknown> => ipcRenderer.invoke(IpcChannels.LOAD_PROJECT, filePath),
    deleteProject: (projectId: string) => ipcRenderer.invoke(IpcChannels.DELETE_PROJECT, projectId),
    
    // Tutorial Management APIs
    createTutorial: (projectId: string, title: string) => ipcRenderer.invoke(IpcChannels.CREATE_TUTORIAL, projectId, title),
    getTutorialsByProject: (projectId: string) => ipcRenderer.invoke(IpcChannels.GET_TUTORIALS_BY_PROJECT, projectId),
    getTutorial: (tutorialId: string) => ipcRenderer.invoke(IpcChannels.GET_TUTORIAL, tutorialId),
    deleteTutorial: (tutorialId: string) => ipcRenderer.invoke(IpcChannels.DELETE_TUTORIAL, tutorialId),
    updateTutorialStatus: (tutorialId: string, status: 'draft' | 'ready' | 'exported') => 
      ipcRenderer.invoke(IpcChannels.UPDATE_TUTORIAL_STATUS, tutorialId, status),
    
    // Step Management APIs
    saveStep: (step: unknown) => ipcRenderer.invoke(IpcChannels.SAVE_STEP, step),
    getStepsByTutorial: (tutorialId: string) => ipcRenderer.invoke(IpcChannels.GET_STEPS_BY_TUTORIAL, tutorialId),
    updateStep: (step: unknown) => ipcRenderer.invoke(IpcChannels.UPDATE_STEP, step),
    deleteStep: (stepId: string) => ipcRenderer.invoke(IpcChannels.DELETE_STEP, stepId),
    reorderSteps: (steps: unknown[]) => ipcRenderer.invoke(IpcChannels.REORDER_STEPS, steps),
    
    // Shape Management APIs
    saveShapes: (stepId: string, imagePath: string, shapes: any[]) => 
      ipcRenderer.invoke(IpcChannels.SAVE_SHAPES, stepId, imagePath, shapes),
    getShapesByImage: (imagePath: string, stepId?: string) => 
      ipcRenderer.invoke(IpcChannels.GET_SHAPES_BY_IMAGE, imagePath, stepId),
    getShapesByStep: (stepId: string) => 
      ipcRenderer.invoke(IpcChannels.GET_SHAPES_BY_STEP, stepId),
    
    // State Management APIs
    getCurrentProject: () => ipcRenderer.invoke(IpcChannels.GET_CURRENT_PROJECT),
    getCurrentTutorial: () => ipcRenderer.invoke(IpcChannels.GET_CURRENT_TUTORIAL),
    setCurrentProject: (projectId: string) => ipcRenderer.invoke(IpcChannels.SET_CURRENT_PROJECT, projectId),
    setCurrentTutorial: (tutorialId: string) => ipcRenderer.invoke(IpcChannels.SET_CURRENT_TUTORIAL, tutorialId),
    
    // Step notification
    notifyStepRecorded: (step: RecordingStep) => ipcRenderer.send(IpcChannels.STEP_RECORDED_NOTIFICATION, step),
    
    // Recording Settings
    updateRecordingSettings: (settings: { autoCapture: boolean, autoCaptureEnter: boolean }) => 
      ipcRenderer.invoke(IpcChannels.UPDATE_RECORDING_SETTINGS, settings),
    
    // Export APIs
    exportProject: (format: string, steps: unknown[], filePath: string) => 
      ipcRenderer.invoke(IpcChannels.EXPORT_PROJECT, format, steps, filePath),
    exportTutorial: (tutorialId: string, options: unknown) => 
      ipcRenderer.invoke(IpcChannels.EXPORT_TUTORIAL, tutorialId, options),
    prepareShapesForExport: (tutorialId: string, shapeData: Record<string, Array<any>>) =>
      ipcRenderer.invoke(IpcChannels.EXPORT_PREPARE_SHAPES, tutorialId, shapeData),
    loadImageAsDataUrl: (imagePath: string): Promise<string> => 
      ipcRenderer.invoke(IpcChannels.LOAD_IMAGE_AS_DATA_URL, imagePath),
      
    // File operations
    openFileDialog: (options: {
      title?: string;
      defaultPath?: string;
      filters?: Array<{ name: string; extensions: string[] }>;
      properties?: Array<string>;
    }) => ipcRenderer.invoke(IpcChannels.OPEN_FILE_DIALOG, options),
    
    copyImageFile: (options: {
      sourcePath: string;
      tutorialId: string;
      stepId: string;
      makeBackup?: boolean;
    }) => ipcRenderer.invoke(IpcChannels.COPY_IMAGE_FILE, options),
    
    saveDataUrlToTempFile: (options: {
      dataUrl: string;
      fileType: string;
    }) => ipcRenderer.invoke(IpcChannels.SAVE_DATA_URL_TO_TEMP_FILE, options),
    
    // Assets API
    getAssetsByTutorial: (tutorialId: string) => 
      ipcRenderer.invoke(IpcChannels.GET_ASSETS_BY_TUTORIAL, tutorialId),
      
    // Load shapes from JSON files
    loadShapesFromJson: (imagePath: string): Promise<any[]> =>
      ipcRenderer.invoke(IpcChannels.LOAD_SHAPES_FROM_JSON, imagePath),
  });
  console.log('[Preload] window.electronAPI exposed successfully.');
} catch (error) {
  console.error('[Preload] FATAL ERROR exposing window.electronAPI:', error);
}

// Expose systemPreferences API
try {
  console.log('[Preload] Attempting to expose window.systemPreferences...');
  contextBridge.exposeInMainWorld('systemPreferences', {
      getMediaAccessStatus: (mediaType: string): Promise<string> => 
          ipcRenderer.invoke(IpcChannels.GET_MEDIA_ACCESS_STATUS, mediaType),
  });
  console.log('[Preload] window.systemPreferences exposed successfully.');
} catch (error) {
  console.error('[Preload] FATAL ERROR exposing window.systemPreferences:', error);
}

// Expose ipcEvents (Consider merging or removing if redundant)
try {
  console.log('[Preload] Attempting to expose window.ipcEvents...');
  interface StepPayload { type: string; /* other properties...*/ }
  contextBridge.exposeInMainWorld('ipcEvents', {
      onStepCaptured: (callback: (payload: StepPayload) => void) => {
          const listener = (_event: IpcRendererEvent, payload: StepPayload) => callback(payload);
          ipcRenderer.on('step-captured', listener);
          return () => {
              ipcRenderer.removeListener('step-captured', listener);
          };
      },
  });
  console.log('[Preload] window.ipcEvents exposed successfully.');
} catch (error) {
  console.error('[Preload] FATAL ERROR exposing window.ipcEvents:', error);
} 