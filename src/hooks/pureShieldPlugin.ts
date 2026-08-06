import { registerPlugin } from '@capacitor/core';

export type BlurGender = 'FEMALE' | 'MALE' | 'BOTH';
export type BlurStyle  = 'PIXELATE' | 'FROSTED' | 'SOLID' | 'MOSAIC' | 'BLUR' | 'SMUDGE' | 'DOTS';

// ✅ সব config fields যোগ করা হয়েছে — আগে অনেকগুলো missing ছিল
// ফলে blurOpacity, blurPaddingPct, minFaceSizePct, maxFaces, debugOverlay
// কখনো native Java তে পৌঁছাতো না
export interface PureShieldConfig {
  blurGender:             BlurGender;
  blurStyle:              BlurStyle;
  confidenceThreshold:    number;
  blurOpacity:            number;   // ✅ 0–100, blur এর transparency
  blurPaddingPct:         number;   // ✅ face এর চারপাশে extra padding %
  minFaceSizePct:         number;   // ✅ minimum face size % of screen
  maxFaces:               number;   // ✅ একসাথে কতগুলো face blur করবে
  debugOverlay:           boolean;  // ✅ green bounding box debug mode
  enabled:                boolean;
  pauseOnBatteryBelow20:  boolean;
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
  deviceTier:       string;
  sampleIntervalMs: number;
  batteryLevel:     number;
  thermalStatus:    number | string;
  lastInferenceMs:  number;
}

export type ModelStatusCode = 'OK' | 'MODEL_FAILED' | 'MODEL_EMPTY' | 'UNKNOWN';

export interface ModelStatus {
  status: ModelStatusCode;
  reason?: string;
}

// ✅ সব live stats fields যোগ করা হয়েছে
export interface LiveStats {
  totalFrames:       number;
  totalFaces:        number;
  totalBlurred:      number;
  lastInferenceMs:   number;
  lastDebugMessage:  string;
  modelStatus:       string;
  foregroundApp?:    string;
  blazeMaxScore?:    number;
  blazeAboveCount?:  number;
  blazeKeptCount?:   number;
  overlayCount?:     number;
  genderModelLoaded?: boolean;
}

export interface DeviceInfo {
  autoDetectedTier: string;
  selectedTier:     string;
  deviceInfo:       string;
  expectedFps:      number;
  batteryDrain:     number;
  tierName:         string;
  tierDescription:  string;
}

export interface PureShieldPluginInterface {
  checkPermissions():          Promise<PermissionStatus>;
  requestOverlayPermission():  Promise<{ granted: boolean }>;
  requestMediaProjection():    Promise<{ granted: boolean }>;

  startPureShield():           Promise<{ started: boolean; requiresProjection: boolean }>;
  stopPureShield():            Promise<void>;
  isRunning():                 Promise<{ running: boolean }>;

  setConfig(config: Partial<PureShieldConfig>): Promise<void>;
  getConfig():                 Promise<PureShieldConfig>;

  setTargetApps(data: { packages: string[] }): Promise<void>;
  getTargetApps():             Promise<{ packages: string[] }>;
  getInstalledApps():          Promise<{ apps: InstalledApp[] }>;

  getAdaptiveStatus():         Promise<AdaptiveStatus>;
  getModelStatus():            Promise<ModelStatus>;
  getLiveStats():              Promise<LiveStats>;   // ✅ properly typed
  getDeviceInfo():             Promise<DeviceInfo>;
  switchModelTier(data: { tier: string }): Promise<void>;

  // aliases
  startService():              Promise<{ started: boolean; requiresProjection: boolean }>;
  stopService():               Promise<void>;
  isEnabled():                 Promise<{ running: boolean }>;
  saveConfig(config: Partial<PureShieldConfig>): Promise<void>;
  loadConfig():                Promise<PureShieldConfig>;
}

export const PureShieldPlugin = registerPlugin<PureShieldPluginInterface>(
  'PureShield',
  {
    web: () => import('./pureShieldWeb').then(m => new m.PureShieldWeb()),
  }
);
