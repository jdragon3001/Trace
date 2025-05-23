import { createHash } from 'crypto';
import { platform, hostname, cpus, arch } from 'os';
import { execSync } from 'child_process';
import type { MachineInfo } from '../../shared/types/license';

export class MachineIdGenerator {
  private static cachedMachineId: string | null = null;

  /**
   * Generate a unique machine identifier based on hardware and system info
   * This should remain consistent across app restarts but be unique per machine
   */
  static async generateMachineId(): Promise<string> {
    if (this.cachedMachineId) {
      return this.cachedMachineId;
    }

    try {
      const components = [
        this.getSystemId(),
        hostname(),
        arch(),
        this.getCpuInfo(),
        this.getVolumeSerial()
      ].filter(Boolean);

      // Create a hash of all components
      const hash = createHash('sha256');
      hash.update(components.join('|'));
      
      this.cachedMachineId = hash.digest('hex').substring(0, 32);
      return this.cachedMachineId;
    } catch (error) {
      console.error('Error generating machine ID:', error);
      // Fallback to a less secure but functional ID
      const fallbackHash = createHash('sha256');
      fallbackHash.update(`${hostname()}-${platform()}-${Date.now()}`);
      this.cachedMachineId = fallbackHash.digest('hex').substring(0, 32);
      return this.cachedMachineId;
    }
  }

  /**
   * Get detailed machine information for registration
   */
  static async getMachineInfo(): Promise<MachineInfo> {
    const machineId = await this.generateMachineId();
    
    return {
      id: machineId,
      osVersion: this.getOsVersion(),
      cpuInfo: this.getCpuInfo(),
      hostname: hostname(),
      registered: false // Will be set by the license service
    };
  }

  private static getSystemId(): string {
    const platformName = platform();
    
    try {
      switch (platformName) {
        case 'win32':
          // Use Windows machine GUID
          return execSync('wmic csproduct get UUID /value', { encoding: 'utf8' })
            .split('=')[1]?.trim() || '';
            
        case 'darwin':
          // Use macOS hardware UUID
          return execSync('system_profiler SPHardwareDataType | grep "Hardware UUID"', { encoding: 'utf8' })
            .split(':')[1]?.trim() || '';
            
        case 'linux':
          // Use machine ID from systemd or fallback to DMI UUID
          try {
            return execSync('cat /etc/machine-id', { encoding: 'utf8' }).trim();
          } catch {
            return execSync('cat /sys/class/dmi/id/product_uuid', { encoding: 'utf8' }).trim();
          }
          
        default:
          return '';
      }
    } catch (error) {
      console.warn('Could not get system ID:', error);
      return '';
    }
  }

  private static getCpuInfo(): string {
    try {
      const cpu = cpus()[0];
      return `${cpu.model}-${cpu.speed}`;
    } catch {
      return 'unknown-cpu';
    }
  }

  private static getVolumeSerial(): string {
    const platformName = platform();
    
    try {
      switch (platformName) {
        case 'win32':
          // Get Windows volume serial number
          return execSync('wmic logicaldisk where caption="C:" get VolumeSerialNumber /value', { encoding: 'utf8' })
            .split('=')[1]?.trim() || '';
            
        case 'darwin':
          // Get macOS boot volume UUID
          return execSync('diskutil info / | grep "Volume UUID"', { encoding: 'utf8' })
            .split(':')[1]?.trim() || '';
            
        case 'linux':
          // Get Linux root filesystem UUID
          return execSync('lsblk -f | grep "/$" | awk \'{print $3}\'', { encoding: 'utf8' }).trim();
            
        default:
          return '';
      }
    } catch (error) {
      console.warn('Could not get volume serial:', error);
      return '';
    }
  }

  private static getOsVersion(): string {
    const platformName = platform();
    
    try {
      switch (platformName) {
        case 'win32':
          return execSync('ver', { encoding: 'utf8' }).trim();
          
        case 'darwin':
          return execSync('sw_vers -productVersion', { encoding: 'utf8' }).trim();
          
        case 'linux':
          return execSync('lsb_release -d -s', { encoding: 'utf8' }).trim();
          
        default:
          return `${platformName}-unknown`;
      }
    } catch {
      return `${platformName}-unknown`;
    }
  }

  /**
   * Clear the cached machine ID (useful for testing)
   */
  static clearCache(): void {
    this.cachedMachineId = null;
  }
} 