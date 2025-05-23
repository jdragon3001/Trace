import type { SubscriptionCheckResponse } from '../../shared/types/license';
import { LICENSE_CONFIG } from '../../shared/constants/license-constants';

export class SubscriptionService {
  /**
   * Check subscription status and machine registration
   */
  static async checkSubscription(userId: string, machineId: string): Promise<SubscriptionCheckResponse> {
    try {
      const response = await fetch(`${LICENSE_CONFIG.LICENSE_SERVER_URL}/subscriptions/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          machineId
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        isActive: data.isActive || false,
        subscription: data.subscription,
        machineRegistered: data.machineRegistered || false,
        machinesUsed: data.machinesUsed || 0,
        machineLimit: data.machineLimit || 2
      };
    } catch (error) {
      console.error('Subscription check failed:', error);
      
      // Return safe defaults on error
      return {
        isActive: false,
        subscription: {
          status: 'cancelled',
          currentPeriodEnd: new Date().toISOString(),
          cancelAtPeriodEnd: true,
          planId: 'unknown',
          planName: 'Unknown'
        },
        machineRegistered: false,
        machinesUsed: 0,
        machineLimit: 2
      };
    }
  }

  /**
   * Register a new machine for the user
   */
  static async registerMachine(userId: string, machineId: string, machineInfo: any): Promise<boolean> {
    try {
      const response = await fetch(`${LICENSE_CONFIG.LICENSE_SERVER_URL}/machines/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          machineId,
          machineInfo
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Machine registration failed:', error);
      return false;
    }
  }

  /**
   * Deregister a machine
   */
  static async deregisterMachine(userId: string, machineId: string): Promise<boolean> {
    try {
      const response = await fetch(`${LICENSE_CONFIG.LICENSE_SERVER_URL}/machines/deregister`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          machineId
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Machine deregistration failed:', error);
      return false;
    }
  }

  /**
   * Get list of registered machines for user
   */
  static async getUserMachines(userId: string): Promise<any[]> {
    try {
      const response = await fetch(`${LICENSE_CONFIG.LICENSE_SERVER_URL}/machines/${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.machines || [];
    } catch (error) {
      console.error('Failed to get user machines:', error);
      return [];
    }
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(userId: string): Promise<boolean> {
    try {
      const response = await fetch(`${LICENSE_CONFIG.LICENSE_SERVER_URL}/subscriptions/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      return response.ok;
    } catch (error) {
      console.error('Subscription cancellation failed:', error);
      return false;
    }
  }

  /**
   * Update payment method
   */
  static async updatePaymentMethod(userId: string, paymentMethodId: string): Promise<boolean> {
    try {
      const response = await fetch(`${LICENSE_CONFIG.LICENSE_SERVER_URL}/subscriptions/payment-method`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          paymentMethodId
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Payment method update failed:', error);
      return false;
    }
  }

  /**
   * Get subscription billing portal URL
   */
  static async getBillingPortalUrl(userId: string): Promise<string | null> {
    try {
      const response = await fetch(`${LICENSE_CONFIG.LICENSE_SERVER_URL}/subscriptions/billing-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.url || null;
    } catch (error) {
      console.error('Failed to get billing portal URL:', error);
      return null;
    }
  }
} 