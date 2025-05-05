export const IpcChannels = {
  // Recording control
  START_RECORDING: 'recording:start' as const,
  STOP_RECORDING: 'recording:stop' as const,
  PAUSE_RECORDING: 'recording:pause' as const,
  RESUME_RECORDING: 'recording:resume' as const,
  RECORDING_STATUS: 'recording:status' as const,
  
  // Step management
  GET_STEPS: 'steps:get' as const,
  ADD_STEP: 'steps:add' as const,
  STEP_CREATED: 'step:created' as const,
  STEP_UPDATED: 'step:updated' as const,
  STEP_DELETED: 'step:deleted' as const,
  
  // Project Management
  SAVE_PROJECT: 'project:save' as const,
  LOAD_PROJECT: 'project:load' as const,
  GET_PROJECTS: 'project:get-all' as const,
  GET_RECENT_PROJECTS: 'project:get-recent' as const,
  CREATE_PROJECT: 'project:create' as const,
  DELETE_PROJECT: 'project:delete' as const,
  
  // Tutorial Management
  CREATE_TUTORIAL: 'tutorial:create' as const,
  GET_TUTORIALS: 'tutorial:get-all' as const,
  GET_TUTORIALS_BY_PROJECT: 'tutorial:get-by-project' as const,
  DELETE_TUTORIAL: 'tutorial:delete' as const,
  GET_CURRENT_TUTORIAL: 'tutorial:get-current' as const,
  SET_CURRENT_TUTORIAL: 'tutorial:set-current' as const,
  GET_TUTORIAL: 'tutorial:get' as const,
  GET_RECENT_TUTORIALS: 'tutorial:get-recent' as const,
  
  // Enhanced Step Management
  SAVE_STEP: 'step:save' as const,
  GET_STEPS_BY_TUTORIAL: 'step:get-by-tutorial' as const,
  UPDATE_STEP: 'step:update' as const,
  DELETE_STEP: 'step:delete' as const,
  REORDER_STEPS: 'step:reorder' as const,
  
  // State Management
  GET_CURRENT_PROJECT: 'project:get-current' as const,
  SET_CURRENT_PROJECT: 'project:set-current' as const,
  
  // Export
  EXPORT_PROJECT: 'project:export' as const,
  EXPORT_PROGRESS: 'export:progress' as const,
  EXPORT_COMPLETE: 'export:complete' as const,
  EXPORT_ERROR: 'export:error' as const,
  
  // System / Permissions
  GET_MEDIA_ACCESS_STATUS: 'system:get-media-access' as const,
  
  // Error handling
  RECORDING_ERROR: 'recording:error' as const,
  
  // Settings
  SETTINGS_UPDATED: 'settings:updated' as const,
} as const;

// Re-export for type safety
export type IpcChannel = typeof IpcChannels[keyof typeof IpcChannels];

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