export const IpcChannels = {
  // Recording control
  START_RECORDING: 'recording:start' as const,
  STOP_RECORDING: 'recording:stop' as const,
  PAUSE_RECORDING: 'recording:pause' as const,
  RESUME_RECORDING: 'recording:resume' as const,
  RECORDING_STATUS: 'recording:status' as const,
  UPDATE_RECORDING_SETTINGS: 'recording:update-settings' as const,
  
  // Region capture
  UPDATE_CAPTURE_MODE: 'capture:update-mode' as const,
  SELECT_CAPTURE_REGION: 'capture:select-region' as const,
  REGION_SELECTED: 'capture:region-selected' as const,
  
  // Step management
  GET_STEPS: 'steps:get' as const,
  ADD_STEP: 'steps:add' as const,
  STEP_CREATED: 'step:created' as const,
  STEP_UPDATED: 'step:updated' as const,
  STEP_DELETED: 'step:deleted' as const,
  STEP_RECORDED_NOTIFICATION: 'step:recorded-notification' as const,
  
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
  UPDATE_TUTORIAL_STATUS: 'tutorial:update-status' as const,
  
  // Enhanced Step Management
  SAVE_STEP: 'step:save' as const,
  GET_STEPS_BY_TUTORIAL: 'step:get-by-tutorial' as const,
  UPDATE_STEP: 'step:update' as const,
  DELETE_STEP: 'step:delete' as const,
  REORDER_STEPS: 'step:reorder' as const,
  
  // Shape Management
  SAVE_SHAPES: 'shape:save' as const,
  GET_SHAPES_BY_IMAGE: 'shape:get-by-image' as const,
  GET_SHAPES_BY_STEP: 'shape:get-by-step' as const,
  
  // State Management
  GET_CURRENT_PROJECT: 'project:get-current' as const,
  SET_CURRENT_PROJECT: 'project:set-current' as const,
  
  // Export
  EXPORT_PROJECT: 'project:export' as const,
  EXPORT_TUTORIAL: 'tutorial:export' as const,
  EXPORT_PREPARE_SHAPES: 'export:prepare-shapes' as const,
  EXPORT_PROGRESS: 'export:progress' as const,
  EXPORT_COMPLETE: 'export:complete' as const,
  EXPORT_ERROR: 'export:error' as const,
  
  // System / Permissions
  GET_MEDIA_ACCESS_STATUS: 'system:get-media-access' as const,
  
  // Error handling
  RECORDING_ERROR: 'recording:error' as const,
  
  // Settings
  SETTINGS_UPDATED: 'settings:updated' as const,
  
  // File operations
  OPEN_FILE_DIALOG: 'file:open-dialog' as const,
  COPY_IMAGE_FILE: 'file:copy-image' as const,
  LOAD_IMAGE_AS_DATA_URL: 'file:load-image-as-data-url' as const,
  SAVE_DATA_URL_TO_TEMP_FILE: 'file:save-data-url-to-temp' as const,
  
  // Assets
  GET_ASSETS_BY_TUTORIAL: 'assets:get-by-tutorial' as const,
  
  // Shapes from files
  LOAD_SHAPES_FROM_JSON: 'shapes:load-from-json' as const,
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