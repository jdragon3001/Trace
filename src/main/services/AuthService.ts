import { createHash, createHmac } from 'crypto';
import { app } from 'electron';
import { promises as fs } from 'fs';
import { join } from 'path';
import type { AuthCredentials, AuthResponse, User, LicenseToken } from '../../shared/types/license';
import { LICENSE_CONFIG } from '../../shared/constants/license-constants';

export class AuthService {
  private static readonly AUTH_CACHE_FILE = 'auth.cache';
  private static readonly TOKEN_SECRET = 'openscribe-auth-secret-v1';
  
  /**
   * Authenticate user with email and password
   */
  static async authenticate(credentials: AuthCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${LICENSE_CONFIG.LICENSE_SERVER_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.text();
        return {
          success: false,
          error: error || 'Authentication failed'
        };
      }

      const data = await response.json();
      
      if (data.success && data.user && data.token) {
        // Cache the auth token
        await this.cacheAuthToken(data.token, data.user);
        
        return {
          success: true,
          user: data.user,
          token: data.token
        };
      }

      return {
        success: false,
        error: 'Invalid response from server'
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return {
        success: false,
        error: 'Network error. Please check your connection.'
      };
    }
  }

  /**
   * Validate cached authentication token
   */
  static async validateCachedAuth(): Promise<AuthResponse> {
    try {
      const cache = await this.loadAuthCache();
      if (!cache) {
        return { success: false, error: 'No cached authentication' };
      }

      // Check if token is expired
      if (new Date() > new Date(cache.expiresAt)) {
        await this.clearAuthCache();
        return { success: false, error: 'Token expired' };
      }

      // Validate token with server
      const response = await fetch(`${LICENSE_CONFIG.LICENSE_SERVER_URL}/auth/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cache.token}`
        }
      });

      if (!response.ok) {
        await this.clearAuthCache();
        return { success: false, error: 'Invalid token' };
      }

      const data = await response.json();
      
      return {
        success: true,
        user: data.user,
        token: cache.token
      };
    } catch (error) {
      console.error('Token validation error:', error);
      return { success: false, error: 'Validation failed' };
    }
  }

  /**
   * Generate a license token for offline use
   */
  static async generateLicenseToken(user: User, machineId: string): Promise<LicenseToken> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days

    const tokenData = {
      userId: user.id,
      email: user.email,
      machineId,
      expiresAt: expiresAt.toISOString(),
      issuedAt: now.toISOString(),
      allowedMachines: [machineId] // Initially just this machine
    };

    // Create signature
    const signature = this.signTokenData(tokenData);

    return {
      ...tokenData,
      signature
    };
  }

  /**
   * Logout and clear all cached data
   */
  static async logout(): Promise<void> {
    try {
      await this.clearAuthCache();
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Cache authentication token
   */
  private static async cacheAuthToken(token: string, user: User): Promise<void> {
    try {
      const cache = {
        token,
        user,
        expiresAt: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString(), // 7 days
        cachedAt: new Date().toISOString()
      };

      const cachePath = this.getAuthCachePath();
      await fs.writeFile(cachePath, JSON.stringify(cache), 'utf8');
    } catch (error) {
      console.error('Failed to cache auth token:', error);
    }
  }

  /**
   * Load cached authentication data
   */
  private static async loadAuthCache(): Promise<{
    token: string;
    user: User;
    expiresAt: string;
    cachedAt: string;
  } | null> {
    try {
      const cachePath = this.getAuthCachePath();
      
      try {
        await fs.access(cachePath);
      } catch {
        return null; // File doesn't exist
      }

      const data = await fs.readFile(cachePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load auth cache:', error);
      return null;
    }
  }

  /**
   * Clear cached authentication data
   */
  private static async clearAuthCache(): Promise<void> {
    try {
      const cachePath = this.getAuthCachePath();
      await fs.unlink(cachePath);
    } catch (error: unknown) {
      // File might not exist, which is fine
      if (error && typeof error === 'object' && 'code' in error && error.code !== 'ENOENT') {
        console.error('Failed to clear auth cache:', error);
      }
    }
  }

  /**
   * Get the path to the auth cache file
   */
  private static getAuthCachePath(): string {
    const userDataPath = app.getPath('userData');
    return join(userDataPath, this.AUTH_CACHE_FILE);
  }

  /**
   * Sign token data for integrity verification
   */
  private static signTokenData(tokenData: Omit<LicenseToken, 'signature'>): string {
    const dataString = JSON.stringify(tokenData);
    return createHmac('sha256', this.TOKEN_SECRET)
      .update(dataString)
      .digest('hex');
  }

  /**
   * Verify token signature
   */
  static verifyTokenSignature(token: LicenseToken): boolean {
    const { signature, ...tokenData } = token;
    const expectedSignature = this.signTokenData(tokenData);
    return signature === expectedSignature;
  }

  /**
   * Get user profile from server
   */
  static async getUserProfile(userId: string, authToken: string): Promise<User | null> {
    try {
      const response = await fetch(`${LICENSE_CONFIG.LICENSE_SERVER_URL}/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }
} 