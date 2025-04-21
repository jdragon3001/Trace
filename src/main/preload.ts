import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/constants';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    store: {
      get: (key: string) => ipcRenderer.invoke('get-store-value', key),
      set: (key: string, val: any) => ipcRenderer.invoke('set-store-value', key, val)
    },
    recording: {
      start: () => ipcRenderer.invoke('start-recording'),
      stop: () => ipcRenderer.invoke('stop-recording'),
      captureClick: (x: number, y: number) => ipcRenderer.invoke('capture-click', x, y)
    },
    on: (channel: string, callback: (...args: any[]) => void) => {
      // Whitelist channels
      const validChannels = ['step-captured'];
      if (validChannels.includes(channel)) {
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
      }
    },
    off: (channel: string, callback: (...args: any[]) => void) => {
      // Whitelist channels
      const validChannels = ['step-captured'];
      if (validChannels.includes(channel)) {
        ipcRenderer.off(channel, callback);
      }
    }
  }
);

contextBridge.exposeInMainWorld('electronAPI', {
  startRecording: () => ipcRenderer.invoke(IpcChannels.START_RECORDING),
  stopRecording: () => ipcRenderer.invoke(IpcChannels.STOP_RECORDING),
  pauseRecording: () => ipcRenderer.invoke(IpcChannels.PAUSE_RECORDING),
  
  onStepCreated: (callback: (step: any) => void) => {
    ipcRenderer.on(IpcChannels.STEP_CREATED, (_event, step) => callback(step));
  },
  
  onRecordingError: (callback: (error: string) => void) => {
    ipcRenderer.on(IpcChannels.RECORDING_ERROR, (_event, error) => callback(error));
  }
}); 