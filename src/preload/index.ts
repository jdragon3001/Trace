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
      ipcRenderer.on(IpcChannels.STEP_CREATED, (_event, step) => callback(step));
    },
    onRecordingStatus: (callback: (state: { isRecording: boolean; isPaused: boolean; currentStep: number; steps: any[] }) => void) => {
        const listener = (_event: IpcRendererEvent, state: { isRecording: boolean; isPaused: boolean; currentStep: number; steps: any[] }) => callback(state);
        ipcRenderer.on(IpcChannels.RECORDING_STATUS, listener);
        return () => {
            ipcRenderer.removeListener(IpcChannels.RECORDING_STATUS, listener);
        };
    },
    onRecordingError: (callback: (error: string) => void) => {
      ipcRenderer.on(IpcChannels.RECORDING_ERROR, (_event, error) => callback(error));
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
    
    // Step Management APIs
    saveStep: (step: unknown) => ipcRenderer.invoke(IpcChannels.SAVE_STEP, step),
    getStepsByTutorial: (tutorialId: string) => ipcRenderer.invoke(IpcChannels.GET_STEPS_BY_TUTORIAL, tutorialId),
    updateStep: (step: unknown) => ipcRenderer.invoke(IpcChannels.UPDATE_STEP, step),
    deleteStep: (stepId: string) => ipcRenderer.invoke(IpcChannels.DELETE_STEP, stepId),
    reorderSteps: (steps: unknown[]) => ipcRenderer.invoke(IpcChannels.REORDER_STEPS, steps),
    
    // State Management APIs
    getCurrentProject: () => ipcRenderer.invoke(IpcChannels.GET_CURRENT_PROJECT),
    getCurrentTutorial: () => ipcRenderer.invoke(IpcChannels.GET_CURRENT_TUTORIAL),
    setCurrentProject: (projectId: string) => ipcRenderer.invoke(IpcChannels.SET_CURRENT_PROJECT, projectId),
    setCurrentTutorial: (tutorialId: string) => ipcRenderer.invoke(IpcChannels.SET_CURRENT_TUTORIAL, tutorialId),
    
    // Export APIs
    exportProject: (format: string, steps: unknown[], filePath: string) => 
      ipcRenderer.invoke(IpcChannels.EXPORT_PROJECT, format, steps, filePath),
    loadImageAsDataUrl: (imagePath: string): Promise<string> => 
      ipcRenderer.invoke('load-image-as-data-url', imagePath)
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