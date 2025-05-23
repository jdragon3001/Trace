// License validation settings
export const LICENSE_CONFIG = {
  OFFLINE_GRACE_DAYS: 7, // Allow 7 days offline before requiring revalidation
  VALIDATION_INTERVAL_DAYS: 30, // Check license every 30 days
  MACHINE_LIMIT_BASIC: 2, // Basic plan allows 2 machines
  MACHINE_LIMIT_PRO: 5, // Pro plan allows 5 machines
  LICENSE_SERVER_URL: process.env.LICENSE_SERVER_URL || 'https://api.openscribe.com',
  CACHE_ENCRYPTION_KEY: 'openscribe-license-cache-v1'
};

// IPC Channel names for license operations
export const LICENSE_IPC_CHANNELS = {
  // Main to renderer
  LICENSE_STATUS_CHANGED: 'license:status-changed',
  LICENSE_VALIDATION_RESULT: 'license:validation-result',
  
  // Renderer to main
  CHECK_LICENSE: 'license:check',
  AUTHENTICATE_USER: 'license:authenticate',
  LOGOUT_USER: 'license:logout',
  ACTIVATE_LICENSE: 'license:activate',
  GET_MACHINE_INFO: 'license:get-machine-info',
  OPEN_SUBSCRIPTION_PORTAL: 'license:open-subscription-portal',
  
  // Subscription management
  GET_SUBSCRIPTION_STATUS: 'subscription:get-status',
  CANCEL_SUBSCRIPTION: 'subscription:cancel',
  UPDATE_PAYMENT_METHOD: 'subscription:update-payment'
};

// License validation reasons
export const LICENSE_VALIDATION_REASONS = {
  EXPIRED: 'expired',
  REVOKED: 'revoked',
  MACHINE_LIMIT: 'machine_limit',
  SUBSCRIPTION_ENDED: 'subscription_ended',
  NETWORK_ERROR: 'network_error',
  INVALID_TOKEN: 'invalid_token'
} as const;

// App states based on license
export const APP_STATES = {
  LICENSED: 'licensed', // Full access
  TRIAL: 'trial', // Trial period
  GRACE_PERIOD: 'grace_period', // Past due but in grace period
  LIMITED: 'limited', // Limited functionality
  UNLICENSED: 'unlicensed' // No license
} as const;

// Feature restrictions in limited mode
export const FEATURE_RESTRICTIONS = {
  MAX_PROJECTS_LIMITED: 1,
  MAX_TUTORIALS_PER_PROJECT: 5,
  MAX_STEPS_PER_TUTORIAL: 20,
  EXPORT_FORMATS_LIMITED: ['PDF'], // Only PDF in limited mode
  RECORDING_TIME_LIMIT_MINUTES: 5
};

export type AppState = typeof APP_STATES[keyof typeof APP_STATES];
export type LicenseValidationReason = typeof LICENSE_VALIDATION_REASONS[keyof typeof LICENSE_VALIDATION_REASONS]; 