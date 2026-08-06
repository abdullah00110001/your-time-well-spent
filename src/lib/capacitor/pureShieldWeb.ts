import { WebPlugin } from '@capacitor/core';
import type { PureShieldPluginInterface, PureShieldConfig, PermissionStatus, AdaptiveStatus, ModelStatus, LiveStats } from './pureShieldPlugin';

/**
 * Web stub — used in browser dev environment.
 * All methods return mock data so the React UI can be developed without a device.
 */
export class PureShieldWeb extends WebPlugin implements PureShieldPluginInterface {

  private cfg: PureShieldConfig = {
    blurGender:           'FEMALE',
    blurStyle:            'PIXELATE',
    confidenceThreshold:  0.72,
    enabled:              false,
    pauseOnBatteryBelow20: true,
  };

  private targetPackages: string[] = [];
  private running = false;

  async checkPermissions(): Promise<PermissionStatus> {
    return { overlay: true, projection: false };
  }

  async requestOverlayPermission() { return { granted: true }; }
  async requestMediaProjection()   { return { granted: true }; }

  async startPureShield() {
    this.running = true;
    console.log('[PureShield Web] Started (mock)');
    return { started: true };
  }

  async stopPureShield() {
    this.running = false;
    console.log('[PureShield Web] Stopped (mock)');
  }

  async isRunning() { return { running: this.running }; }

  async setConfig(cfg: Partial<PureShieldConfig>) {
    this.cfg = { ...this.cfg, ...cfg };
  }

  async getConfig() { return { ...this.cfg }; }

  async setTargetApps(data: { packages: string[] }) {
    this.targetPackages = data.packages;
  }

  async getTargetApps() { return { packages: this.targetPackages }; }

  async getInstalledApps() {
    return {
      apps: [
        { packageName: 'com.instagram.android', appName: 'Instagram' },
        { packageName: 'com.twitter.android',   appName: 'X (Twitter)' },
        { packageName: 'com.facebook.katana',   appName: 'Facebook' },
        { packageName: 'com.zhiliaoapp.musically', appName: 'TikTok' },
        { packageName: 'com.snapchat.android',  appName: 'Snapchat' },
        { packageName: 'com.reddit.frontpage',  appName: 'Reddit' },
        { packageName: 'com.pinterest',         appName: 'Pinterest' },
        { packageName: 'com.google.android.youtube', appName: 'YouTube' },
      ]
    };
  }

  async getAdaptiveStatus(): Promise<AdaptiveStatus> {
    return {
      deviceTier:       'MID',
      sampleIntervalMs: 700,
      batteryLevel:     85,
      thermalStatus:    0,
      lastInferenceMs:  18,
    };
  }

  async getModelStatus(): Promise<ModelStatus> {
    return { status: 'OK' };
  }

  async getLiveStats(): Promise<LiveStats> {
    return {
      totalFrames: this.running ? 24 : 0,
      totalFaces: this.running ? 6 : 0,
      totalBlurred: this.running ? 6 : 0,
      lastInferenceMs: this.running ? 18 : 0,
      lastDebugMessage: this.running ? 'Web preview: 6 faces, 6 overlays' : 'Stopped',
      modelStatus: 'OK',
      foregroundApp: 'web.preview',
      blazeMaxScore: 0.91,
      blazeAboveCount: this.running ? 6 : 0,
      blazeKeptCount: this.running ? 6 : 0,
      overlayCount: this.running ? 6 : 0,
      genderModelLoaded: true,
    };
  }
}
