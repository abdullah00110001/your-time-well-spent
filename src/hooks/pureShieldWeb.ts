import { WebPlugin } from '@capacitor/core';
import type {
  PureShieldPluginInterface,
  PureShieldConfig,
  PermissionStatus,
  AdaptiveStatus,
  ModelStatus,
  LiveStats,
  InstalledApp,
  DeviceInfo,
} from './pureShieldPlugin';

/**
 * Web stub for the PureShield native plugin.
 * The real implementation only runs on Android — this exists so the bundle
 * builds and runs in the browser without throwing.
 */
export class PureShieldWeb extends WebPlugin implements PureShieldPluginInterface {
  private _config: PureShieldConfig = {
    blurGender: 'FEMALE',
    blurStyle: 'PIXELATE',
    confidenceThreshold: 0.5,
    blurOpacity: 100,
    blurPaddingPct: 10,
    minFaceSizePct: 2,
    maxFaces: 10,
    debugOverlay: false,
    enabled: false,
    pauseOnBatteryBelow20: true,
  };
  private targetApps: string[] = [];

  async checkPermissions(): Promise<PermissionStatus> {
    return { overlay: false, projection: false };
  }
  async requestOverlayPermission() { return { granted: false }; }
  async requestMediaProjection() { return { granted: false }; }

  async startPureShield() { return { started: false, requiresProjection: false }; }
  async stopPureShield() { /* no-op */ }
  async isRunning() { return { running: false }; }

  async setConfig(config: Partial<PureShieldConfig>) {
    this._config = { ...this._config, ...config };
  }
  async getConfig() { return this._config; }

  async setTargetApps(data: { packages: string[] }) { this.targetApps = data.packages ?? []; }
  async getTargetApps() { return { packages: this.targetApps }; }
  async getInstalledApps(): Promise<{ apps: InstalledApp[] }> { return { apps: [] }; }

  async getAdaptiveStatus(): Promise<AdaptiveStatus> {
    return { deviceTier: 'web', sampleIntervalMs: 0, batteryLevel: 1, thermalStatus: 0, lastInferenceMs: 0 };
  }
  async getModelStatus(): Promise<ModelStatus> { return { status: 'UNKNOWN' }; }
  async getLiveStats(): Promise<LiveStats> {
    return { totalFrames: 0, totalFaces: 0, totalBlurred: 0, lastInferenceMs: 0, lastDebugMessage: 'web stub', modelStatus: 'UNKNOWN' };
  }

  async getDeviceInfo(): Promise<DeviceInfo> {
    return {
      autoDetectedTier: 'web',
      selectedTier: 'web',
      deviceInfo: 'Browser (stub)',
      expectedFps: 0,
      batteryDrain: 0,
      tierName: 'Web',
      tierDescription: 'PureShield only runs on Android devices.',
    };
  }
  async switchModelTier(_data: { tier: string }) { /* no-op */ }

  // aliases
  async startService() { return this.startPureShield(); }
  async stopService() { return this.stopPureShield(); }
  async isEnabled() { return this.isRunning(); }
  async saveConfig(config: Partial<PureShieldConfig>) { return this.setConfig(config); }
  async loadConfig() { return this.getConfig(); }
}
