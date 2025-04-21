export const IpcChannels = {
  // Recording control
  START_RECORDING: 'recording:start',
  STOP_RECORDING: 'recording:stop',
  PAUSE_RECORDING: 'recording:pause',
  
  // Step management
  STEP_CREATED: 'step:created',
  STEP_UPDATED: 'step:updated',
  STEP_DELETED: 'step:deleted',
  
  // Error handling
  RECORDING_ERROR: 'recording:error',
  
  // Settings
  SETTINGS_UPDATED: 'settings:updated',
  
  // Export
  EXPORT_START: 'export:start',
  EXPORT_PROGRESS: 'export:progress',
  EXPORT_COMPLETE: 'export:complete',
  EXPORT_ERROR: 'export:error'
} as const;

export const DEFAULT_SETTINGS = {
  circleSize: 24,
  circleColor: '#FF0000',
  captureKeyboard: true,
  screenshotDir: 'screenshots'
} as const;

export const KEYBOARD_SHORTCUTS = {
  START_RECORDING: 'CommandOrControl+Shift+R',
  STOP_RECORDING: 'CommandOrControl+Shift+S',
  PAUSE_RECORDING: 'CommandOrControl+Shift+P'
} as const; 