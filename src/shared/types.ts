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

// OLD Project interface - to be deprecated
export interface Project {
  id?: string;
  name: string;
  path?: string; // Only for legacy projects
  lastModified?: Date; // Only for legacy projects
  steps?: RecordingStep[]; // Only for legacy projects
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  tags?: string[];
}

// New database model interfaces
export interface Tutorial {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'draft' | 'ready' | 'exported';
  createdAt?: string;
  updatedAt?: string;
}

export interface Step {
  id?: string;
  tutorialId: string;
  order: number;
  screenshotPath: string;
  actionText: string;
  timestamp: string;
  mousePosition?: MousePosition;
  windowTitle?: string;
  keyboardShortcut?: string;
}

export interface Asset {
  id?: string;
  tutorialId: string;
  type: string;
  path: string;
} 