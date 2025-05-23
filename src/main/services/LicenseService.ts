import { ipcMain } from 'electron';
import type { 
  LicenseValidationResult, 
  AuthCredentials, 
  AuthResponse, 
  User,
  MachineInfo,
  SubscriptionCheckResponse 
} from '../../shared/types/license';
import { 
  LICENSE_IPC_CHANNELS, 
  LICENSE_CONFIG, 
  APP_STATES, 
  LICENSE_VALIDATION_REASONS,
  type AppState 
} from '../../shared/constants/license-constants';
import { MachineIdGenerator } from '../security/MachineIdGenerator';
import { OfflineLicenseManager } from '../security/OfflineLicenseManager';
import { AuthService } from './AuthService';
import { SubscriptionService } from './SubscriptionService';

export class LicenseService {
  private static instance: LicenseService;
  private currentAppState: AppState = APP_STATES.UNLICENSED;
  private currentUser: User | null = null;
  private machineId: string | null = null;
  private validationInProgress = false;

  private constructor() {
    this.setupIpcHandlers();
  }

  static getInstance(): LicenseService {
    if (!LicenseService.instance) {
      LicenseService.instance = new LicenseService();
    }
    return LicenseService.instance;
  }

  /**
   * Initialize the license service - call this on app startup
   */
  async initialize(): Promise<void> {
    try {
      // Generate machine ID
      this.machineId = await MachineIdGenerator.generateMachineId();
      console.log('Machine ID generated:', this.machineId.substring(0, 8) + '...');

      // Perform initial license validation
      await this.performLicenseValidation();
    } catch (error) {
      console.error('Failed to initialize license service:', error);
      this.setAppState(APP_STATES.UNLICENSED);
    }
  }

  /**
   * Perform comprehensive license validation
   */
  async performLicenseValidation(): Promise<LicenseValidationResult> {
    if (this.validationInProgress) {
      // Return current state if validation is already in progress
      return {
        isValid: this.currentAppState === APP_STATES.LICENSED,
        allowOffline: true
      };
    }

    this.validationInProgress = true;

    try {
      if (!this.machineId) {
        this.machineId = await MachineIdGenerator.generateMachineId();
      }

      // First, try online validation
      const onlineResult = await this.validateOnline();
      if (onlineResult.isValid) {
        await OfflineLicenseManager.updateValidationTimestamp();
        this.setAppState(APP_STATES.LICENSED);
        this.validationInProgress = false;
        return onlineResult;
      }

      // If online validation fails, try offline validation
      const offlineResult = await OfflineLicenseManager.validateOfflineLicense(this.machineId);
      
      if (offlineResult.isValid) {
        this.setAppState(APP_STATES.LICENSED);
      } else if (offlineResult.allowOffline && offlineResult.gracePeriodDays && offlineResult.gracePeriodDays > 0) {
        this.setAppState(APP_STATES.GRACE_PERIOD);
      } else {
        this.setAppState(APP_STATES.LIMITED);
      }

      this.validationInProgress = false;
      return offlineResult;

    } catch (error) {
      console.error('License validation error:', error);
      this.validationInProgress = false;
      
      // Try offline validation as fallback
      const fallbackResult = await OfflineLicenseManager.validateOfflineLicense(this.machineId!);
      this.setAppState(fallbackResult.isValid ? APP_STATES.LICENSED : APP_STATES.LIMITED);
      
      return fallbackResult;
    }
  }

  /**
   * Attempt online license validation
   */
  private async validateOnline(): Promise<LicenseValidationResult> {
    try {
      if (!this.currentUser) {
        // Try to get cached auth token and validate it
        const authResult = await AuthService.validateCachedAuth();
        if (!authResult.success) {
          return {
            isValid: false,
            reason: LICENSE_VALIDATION_REASONS.INVALID_TOKEN,
            allowOffline: false
          };
        }
        this.currentUser = authResult.user!;
      }

      // Ensure machineId is available
      if (!this.machineId) {
        return {
          isValid: false,
          reason: LICENSE_VALIDATION_REASONS.INVALID_TOKEN,
          allowOffline: false
        };
      }

      // Check subscription status
      const subscriptionResult = await SubscriptionService.checkSubscription(
        this.currentUser.id, 
        this.machineId
      );

      if (!subscriptionResult.isActive) {
        return {
          isValid: false,
          reason: LICENSE_VALIDATION_REASONS.SUBSCRIPTION_ENDED,
          allowOffline: false
        };
      }

      if (!subscriptionResult.machineRegistered && 
          subscriptionResult.machinesUsed >= subscriptionResult.machineLimit) {
        return {
          isValid: false,
          reason: LICENSE_VALIDATION_REASONS.MACHINE_LIMIT,
          allowOffline: false
        };
      }

      // If we get here, license is valid - save to cache
      const licenseToken = await AuthService.generateLicenseToken(this.currentUser, this.machineId);
      await OfflineLicenseManager.saveLicenseCache(licenseToken);

      return {
        isValid: true,
        allowOffline: true,
        user: this.currentUser || undefined
      };

    } catch (error) {
      console.error('Online validation failed:', error);
      return {
        isValid: false,
        reason: LICENSE_VALIDATION_REASONS.NETWORK_ERROR,
        allowOffline: true
      };
    }
  }

  /**
   * Authenticate user with credentials
   */
  async authenticateUser(credentials: AuthCredentials): Promise<AuthResponse> {
    try {
      const authResult = await AuthService.authenticate(credentials);
      
      if (authResult.success && authResult.user) {
        this.currentUser = authResult.user;
        
        // Immediately validate the license after authentication
        const validationResult = await this.performLicenseValidation();
        
        if (validationResult.isValid) {
          this.setAppState(APP_STATES.LICENSED);
        } else {
          this.setAppState(APP_STATES.LIMITED);
        }
      }

      return authResult;
    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed. Please try again.'
      };
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      await AuthService.logout();
      await OfflineLicenseManager.clearCache();
      this.currentUser = null;
      this.setAppState(APP_STATES.UNLICENSED);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Get current machine information
   */
  async getMachineInfo(): Promise<MachineInfo> {
    return await MachineIdGenerator.getMachineInfo();
  }

  /**
   * Set the current app state and notify renderer
   */
  private setAppState(state: AppState): void {
    if (this.currentAppState !== state) {
      this.currentAppState = state;
      console.log('App state changed to:', state);
      
      // Notify all renderer processes
      this.notifyRendererOfStateChange();
    }
  }

  /**
   * Get current app state
   */
  getCurrentState(): AppState {
    return this.currentAppState;
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Check if feature is allowed in current state
   */
  isFeatureAllowed(feature: 'recording' | 'export' | 'unlimited_projects' | 'markup'): boolean {
    switch (this.currentAppState) {
      case APP_STATES.LICENSED:
        return true;
      case APP_STATES.TRIAL:
      case APP_STATES.GRACE_PERIOD:
        return true; // Allow most features during trial/grace period
      case APP_STATES.LIMITED:
        return feature === 'recording'; // Only allow basic recording
      case APP_STATES.UNLICENSED:
        return false;
      default:
        return false;
    }
  }

  /**
   * Get feature restrictions for current state
   */
  getFeatureRestrictions(): any {
    if (this.currentAppState === APP_STATES.LIMITED) {
      return {
        maxProjects: 1,
        maxTutorialsPerProject: 5,
        maxStepsPerTutorial: 20,
        exportFormats: ['PDF'],
        recordingTimeLimitMinutes: 5
      };
    }
    return null; // No restrictions for licensed users
  }

  /**
   * Setup IPC handlers for renderer communication
   */
  private setupIpcHandlers(): void {
    ipcMain.handle(LICENSE_IPC_CHANNELS.CHECK_LICENSE, async () => {
      return await this.performLicenseValidation();
    });

    ipcMain.handle(LICENSE_IPC_CHANNELS.AUTHENTICATE_USER, async (_, credentials: AuthCredentials) => {
      return await this.authenticateUser(credentials);
    });

    ipcMain.handle(LICENSE_IPC_CHANNELS.LOGOUT_USER, async () => {
      await this.logout();
    });

    ipcMain.handle(LICENSE_IPC_CHANNELS.GET_MACHINE_INFO, async () => {
      return await this.getMachineInfo();
    });

    ipcMain.handle(LICENSE_IPC_CHANNELS.GET_SUBSCRIPTION_STATUS, async () => {
      if (!this.currentUser) {
        return null;
      }
      return await SubscriptionService.checkSubscription(this.currentUser.id, this.machineId!);
    });
  }

  /**
   * Notify renderer processes of state changes
   */
  private notifyRendererOfStateChange(): void {
    // We'll implement this when we create the main window management
    // For now, just log the state change
    console.log('Would notify renderer of state change:', {
      state: this.currentAppState,
      user: this.currentUser?.email,
      restrictions: this.getFeatureRestrictions()
    });
  }

  /**
   * Schedule periodic license validation
   */
  startPeriodicValidation(): void {
    // Check license every 24 hours
    setInterval(async () => {
      console.log('Performing periodic license validation...');
      await this.performLicenseValidation();
    }, 24 * 60 * 60 * 1000);

    // Also check when app becomes focused (user returns to app)
    // This will be implemented when we integrate with the main window
  }

  /**
   * Get current license cache statistics (for debugging)
   */
  async getLicenseCacheStats(): Promise<any> {
    return await OfflineLicenseManager.getCacheStats();
  }
} 