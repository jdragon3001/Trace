import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    startRecording: () => ipcRenderer.invoke('recording:start'),
    pauseRecording: () => ipcRenderer.invoke('recording:pause'),
    stopRecording: () => ipcRenderer.invoke('recording:stop'),
    onStepCreated: (callback: (step: any) => void) => {
        ipcRenderer.on('step:created', (_event, step) => callback(step));
    },
    onRecordingError: (callback: (error: string) => void) => {
        ipcRenderer.on('recording:error', (_event, error) => callback(error));
    }
}); 