export interface User {
  id: string;
  email: string;
  name?: string;
  subscription: SubscriptionStatus;
  machineLimit: number;
}

export interface SubscriptionStatus {
  status: 'active' | 'past_due' | 'cancelled' | 'trialing' | 'incomplete';
  currentPeriodEnd: string; // ISO date
  cancelAtPeriodEnd: boolean;
  planId: string;
  planName: string;
}

export interface LicenseToken {
  userId: string;
  email: string;
  machineId: string;
  expiresAt: string; // ISO date
  signature: string;
  issuedAt: string;
  allowedMachines: string[];
}

export interface LicenseCache {
  token: LicenseToken;
  lastValidated: string; // ISO date
  gracePeriodEnd?: string; // ISO date
  offlineUseDays: number;
}

export interface MachineInfo {
  id: string;
  osVersion: string;
  cpuInfo: string;
  hostname: string;
  registered: boolean;
}

export interface LicenseValidationResult {
  isValid: boolean;
  reason?: 'expired' | 'revoked' | 'machine_limit' | 'subscription_ended' | 'network_error' | 'invalid_token';
  gracePeriodDays?: number;
  allowOffline: boolean;
  user?: User;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface SubscriptionCheckResponse {
  isActive: boolean;
  subscription: SubscriptionStatus;
  machineRegistered: boolean;
  machinesUsed: number;
  machineLimit: number;
} 