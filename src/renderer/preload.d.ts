import { IpcChannels } from '../shared/constants';
import { RecordingStep } from '../shared/types';

declare global {
  interface Window {
    electronAPI: {
      startRecording: () => Promise<void>;
      stopRecording: () => Promise<void>;
      pauseRecording: () => Promise<void>;
      resumeRecording: () => Promise<void>;
      onStepCreated: (callback: (step: RecordingStep) => void) => (() => void) | undefined;
      onRecordingStatus: (callback: (state: { isRecording: boolean; isPaused: boolean }) => void) => (() => void) | undefined;
      onRecordingError: (callback: (error: string) => void) => (() => void) | undefined;
      getSteps: () => Promise<RecordingStep[]>;
      addStep: (step: RecordingStep) => void;
      getAudioSources: () => Promise<unknown[]>;
      saveProject: (steps: RecordingStep[], filePath?: string) => Promise<void>;
      loadProject: (filePath: string) => Promise<unknown>;
      exportProject: (format: string, steps: RecordingStep[], filePath: string) => Promise<void>;
    };
    systemPreferences: {
      getMediaAccessStatus: (mediaType: string) => Promise<string>;
    };
  }
}

export {}; 