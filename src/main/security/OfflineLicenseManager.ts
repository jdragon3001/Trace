import { createCipher, createDecipher, createHash } from 'crypto';
import { app } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { LicenseCache, LicenseToken, LicenseValidationResult } from '../../shared/types/license';
import { LICENSE_CONFIG, APP_STATES, LICENSE_VALIDATION_REASONS } from '../../shared/constants/license-constants';

export class OfflineLicenseManager {
  private static readonly CACHE_FILE_NAME = 'license.cache';
  private static readonly ALGORITHM = 'aes-256-cbc';
  
  /**
   * Get the path to the license cache file
   */
  private static getCachePath(): string {
    const userDataPath = app.getPath('userData');
    return join(userDataPath, this.CACHE_FILE_NAME);
  }

  /**
   * Encrypt data for secure storage
   */
  private static encrypt(data: string): string {
    const cipher = createCipher(this.ALGORITHM, LICENSE_CONFIG.CACHE_ENCRYPTION_KEY);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt stored data
   */
  private static decrypt(encryptedData: string): string {
    const decipher = createDecipher(this.ALGORITHM, LICENSE_CONFIG.CACHE_ENCRYPTION_KEY);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Save license cache to encrypted file
   */
  static async saveLicenseCache(token: LicenseToken): Promise<void> {
    try {
      const cache: LicenseCache = {
        token,
        lastValidated: new Date().toISOString(),
        offlineUseDays: 0
      };

      const encryptedData = this.encrypt(JSON.stringify(cache));
      await fs.writeFile(this.getCachePath(), encryptedData, 'utf8');
      
      console.log('License cache saved successfully');
    } catch (error) {
      console.error('Failed to save license cache:', error);
      throw error;
    }
  }

  /**
   * Load and validate cached license
   */
  static async loadLicenseCache(): Promise<LicenseCache | null> {
    try {
      const cachePath = this.getCachePath();
      
      // Check if cache file exists
      try {
        await fs.access(cachePath);
      } catch {
        return null; // No cache file exists
      }

      const encryptedData = await fs.readFile(cachePath, 'utf8');
      const decryptedData = this.decrypt(encryptedData);
      const cache: LicenseCache = JSON.parse(decryptedData);

      // Validate cache structure
      if (!this.isValidCacheStructure(cache)) {
        console.warn('Invalid cache structure, clearing cache');
        await this.clearCache();
        return null;
      }

      return cache;
    } catch (error) {
      console.error('Failed to load license cache:', error);
      // Clear corrupted cache
      await this.clearCache();
      return null;
    }
  }

  /**
   * Validate license from cache for offline use
   */
  static async validateOfflineLicense(machineId: string): Promise<LicenseValidationResult> {
    const cache = await this.loadLicenseCache();
    
    if (!cache) {
      return {
        isValid: false,
        reason: LICENSE_VALIDATION_REASONS.INVALID_TOKEN,
        allowOffline: false
      };
    }

    const now = new Date();
    const lastValidated = new Date(cache.lastValidated);
    const tokenExpiry = new Date(cache.token.expiresAt);
    const daysSinceValidation = Math.floor((now.getTime() - lastValidated.getTime()) / (1000 * 60 * 60 * 24));

    // Check if token has expired
    if (now > tokenExpiry) {
      return {
        isValid: false,
        reason: LICENSE_VALIDATION_REASONS.EXPIRED,
        allowOffline: false
      };
    }

    // Check if machine ID matches
    if (cache.token.machineId !== machineId && !cache.token.allowedMachines.includes(machineId)) {
      return {
        isValid: false,
        reason: LICENSE_VALIDATION_REASONS.MACHINE_LIMIT,
        allowOffline: false
      };
    }

    // Check grace period
    const gracePeriodDays = LICENSE_CONFIG.OFFLINE_GRACE_DAYS;
    if (daysSinceValidation > gracePeriodDays) {
      // Update cache with grace period info
      cache.gracePeriodEnd = new Date(now.getTime() + (24 * 60 * 60 * 1000)).toISOString();
      await this.updateCache(cache);
      
      return {
        isValid: false,
        reason: LICENSE_VALIDATION_REASONS.NETWORK_ERROR,
        gracePeriodDays: Math.max(0, gracePeriodDays - daysSinceValidation),
        allowOffline: true
      };
    }

    // Update offline use counter
    cache.offlineUseDays = daysSinceValidation;
    await this.updateCache(cache);

    return {
      isValid: true,
      allowOffline: true,
      gracePeriodDays: Math.max(0, gracePeriodDays - daysSinceValidation)
    };
  }

  /**
   * Update the cached license with new validation timestamp
   */
  static async updateValidationTimestamp(): Promise<void> {
    const cache = await this.loadLicenseCache();
    if (cache) {
      cache.lastValidated = new Date().toISOString();
      cache.offlineUseDays = 0;
      delete cache.gracePeriodEnd;
      await this.updateCache(cache);
    }
  }

  /**
   * Update cache data
   */
  private static async updateCache(cache: LicenseCache): Promise<void> {
    try {
      const encryptedData = this.encrypt(JSON.stringify(cache));
      await fs.writeFile(this.getCachePath(), encryptedData, 'utf8');
    } catch (error) {
      console.error('Failed to update cache:', error);
    }
  }

  /**
   * Clear the license cache
   */
  static async clearCache(): Promise<void> {
    try {
      const cachePath = this.getCachePath();
      await fs.unlink(cachePath);
      console.log('License cache cleared');
    } catch (error: unknown) {
      // File might not exist, which is fine
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        console.error('Failed to clear cache:', error);
      }
    }
  }

  /**
   * Check if we're in grace period
   */
  static async isInGracePeriod(): Promise<boolean> {
    const cache = await this.loadLicenseCache();
    if (!cache || !cache.gracePeriodEnd) {
      return false;
    }

    const now = new Date();
    const gracePeriodEnd = new Date(cache.gracePeriodEnd);
    return now < gracePeriodEnd;
  }

  /**
   * Get days remaining in grace period
   */
  static async getGracePeriodDaysRemaining(): Promise<number> {
    const cache = await this.loadLicenseCache();
    if (!cache || !cache.gracePeriodEnd) {
      return 0;
    }

    const now = new Date();
    const gracePeriodEnd = new Date(cache.gracePeriodEnd);
    const msRemaining = gracePeriodEnd.getTime() - now.getTime();
    return Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  }

  /**
   * Validate cache structure
   */
  private static isValidCacheStructure(cache: any): cache is LicenseCache {
    return (
      cache &&
      typeof cache === 'object' &&
      cache.token &&
      typeof cache.token === 'object' &&
      typeof cache.token.userId === 'string' &&
      typeof cache.token.email === 'string' &&
      typeof cache.token.machineId === 'string' &&
      typeof cache.token.expiresAt === 'string' &&
      typeof cache.token.signature === 'string' &&
      typeof cache.lastValidated === 'string' &&
      typeof cache.offlineUseDays === 'number' &&
      Array.isArray(cache.token.allowedMachines)
    );
  }

  /**
   * Get cache statistics for debugging
   */
  static async getCacheStats(): Promise<{
    exists: boolean;
    lastValidated?: string;
    offlineUseDays?: number;
    gracePeriodDaysRemaining?: number;
    tokenExpiry?: string;
  }> {
    const cache = await this.loadLicenseCache();
    
    if (!cache) {
      return { exists: false };
    }

    return {
      exists: true,
      lastValidated: cache.lastValidated,
      offlineUseDays: cache.offlineUseDays,
      gracePeriodDaysRemaining: await this.getGracePeriodDaysRemaining(),
      tokenExpiry: cache.token.expiresAt
    };
  }
} 