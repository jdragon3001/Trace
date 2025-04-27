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
    onRecordingStatus: (callback: (state: { isRecording: boolean; isPaused: boolean }) => void) => {
        const listener = (_event: IpcRendererEvent, state: { isRecording: boolean; isPaused: boolean }) => callback(state);
        ipcRenderer.on(IpcChannels.RECORDING_STATUS, listener);
        return () => {
            ipcRenderer.removeListener(IpcChannels.RECORDING_STATUS, listener);
        };
    },
    onRecordingError: (callback: (error: string) => void) => {
      ipcRenderer.on(IpcChannels.RECORDING_ERROR, (_event, error) => callback(error));
    },
    getSteps: (): Promise<unknown[]> => ipcRenderer.invoke('get-steps'),
    addStep: (step: unknown) => ipcRenderer.send('add-step', step),
    getAudioSources: (): Promise<unknown[]> => ipcRenderer.invoke('get-audio-sources'),
    saveProject: (steps: unknown[], filePath?: string) => ipcRenderer.invoke('save-project', steps, filePath),
    loadProject: (filePath: string): Promise<unknown> => ipcRenderer.invoke('load-project', filePath),
    exportProject: (format: string, steps: unknown[], filePath: string) => 
      ipcRenderer.invoke('export-project', format, steps, filePath)
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