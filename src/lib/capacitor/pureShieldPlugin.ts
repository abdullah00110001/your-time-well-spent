import { registerPlugin } from '@capacitor/core';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type BlurGender = 'FEMALE' | 'MALE' | 'BOTH';
export type BlurStyle  = 'BLUR' | 'PIXELATE' | 'SMUDGE' | 'DOTS' | 'FROSTED' | 'MOSAIC' | 'SOLID';

export interface PureShieldConfig {
  blurGender:           BlurGender;
  blurStyle:            BlurStyle;
  confidenceThreshold:  number; // 0.0 – 1.0, default 0.72
  blurOpacity?:         number;
  blurPaddingPct?:      number;
  minFaceSizePct?:      number;
  maxFaces?:            number;
  debugOverlay?:        boolean;
  enabled:              boolean;
  pauseOnBatteryBelow20: boolean;
}

export interface InstalledApp {
  packageName: string;
  appName:     string;
}

export interface PermissionStatus {
  overlay:    boolean;
  projection: boolean;
}

export interface AdaptiveStatus {
  deviceTier:      string;
  sampleIntervalMs: number;
  batteryLevel:    number;
  thermalStatus:   number;
  lastInferenceMs: number;
}

export type ModelStatusCode = 'OK' | 'MODEL_FAILED' | 'MODEL_EMPTY' | 'UNKNOWN';

export interface ModelStatus {
  status: ModelStatusCode;
  reason?: string;
}

export interface LiveStats {
  totalFrames: number;
  totalFaces: number;
  totalBlurred: number;
  lastInferenceMs: number;
  lastDebugMessage: string;
  modelStatus: string;
  foregroundApp?: string;
  blazeMaxScore?: number;
  blazeAboveCount?: number;
  blazeKeptCount?: number;
  overlayCount?: number;
  genderModelLoaded?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plugin interface
// ─────────────────────────────────────────────────────────────────────────────

export interface PureShieldPluginInterface {
  checkPermissions():            Promise<PermissionStatus>;
  requestOverlayPermission():    Promise<{ granted: boolean }>;
  requestMediaProjection():      Promise<{ granted: boolean }>;

  startPureShield():             Promise<{ started: boolean }>;
  stopPureShield():              Promise<void>;
  isRunning():                   Promise<{ running: boolean }>;

  setConfig(config: Partial<PureShieldConfig>): Promise<void>;
  getConfig():                   Promise<PureShieldConfig>;

  setTargetApps(data: { packages: string[] }): Promise<void>;
  getTargetApps():               Promise<{ packages: string[] }>;
  getInstalledApps():            Promise<{ apps: InstalledApp[] }>;

  getAdaptiveStatus():           Promise<AdaptiveStatus>;
  getModelStatus():              Promise<ModelStatus>;
  getLiveStats():                Promise<LiveStats>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Register
// ─────────────────────────────────────────────────────────────────────────────

export const PureShieldPlugin = registerPlugin<PureShieldPluginInterface>(
  'PureShield',
  {
    // Web stub for browser dev environment
    web: () => import('./pureShieldWeb').then(m => new m.PureShieldWeb()),
  }
);
