export type BlurGender = 'FEMALE' | 'MALE' | 'BOTH';
export type BlurStyle = 'BLUR' | 'PIXELATE' | 'SMUDGE' | 'DOTS' | 'FROSTED' | 'MOSAIC' | 'SOLID';

export interface PureShieldOptions {
  pauseOnBatteryBelow20: boolean;
  showIndicatorIcon: boolean;
}

export interface PureShieldMetrics {
  deviceTier: 'HIGH' | 'MID' | 'LOW';
  sampleIntervalMs: number;
  lastInferenceMs: number;
  batteryLevel: number;
  thermalStatus: 'Normal' | 'Warning' | 'Critical';
}

export interface InstalledAppItem {
  packageName: string;
  appName: string;
}
