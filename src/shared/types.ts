export interface MousePosition {
  x: number;
  y: number;
}

export interface RecordingStep {
  id: string;
  number: number;
  timestamp: string;
  screenshotPath: string;
  mousePosition: MousePosition;
  windowTitle: string;
  description: string;
  keyboardShortcut?: string;
}

export interface RecordingSettings {
  circleSize: number;
  circleColor: string;
  captureKeyboard: boolean;
  screenshotDir: string;
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  currentStep: number;
  steps: RecordingStep[];
} 