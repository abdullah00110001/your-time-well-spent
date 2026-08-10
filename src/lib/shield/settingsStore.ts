// Focus Shield V2.0 - Unique Light Ritual Design. No Blue. No Clone.
// Single source of truth for all persisted Shield settings.
// Storage: localStorage (Capacitor WebView persists this like AsyncStorage).

export type PerformanceMode = 'LOW' | 'MEDIUM' | 'HIGH';
export type DetectionModel = 'FAST' | 'BALANCED' | 'ACCURATE';
export type BlockBackground = 'DARK_SOIL' | 'LIGHT_RAYS';
export type OrbCorner = 'TL' | 'TR' | 'BL' | 'BR';

// ── PureShield performance ───────────────────────────────────────────────────

export interface PureShieldPerfSettings {
  performanceMode: PerformanceMode;
  detectionModel: DetectionModel;
  showFps: boolean;
  onboardingDone: boolean;
}

export const DEFAULT_PERF: PureShieldPerfSettings = {
  performanceMode: 'MEDIUM',
  detectionModel: 'BALANCED',
  showFps: false,
  onboardingDone: false,
};

/**
 * Maps a UI performance/model choice onto concrete native PureShield config.
 * Lower sample rate + higher threshold + fewer faces = less CPU = less lag.
 */
export function perfToNativeConfig(p: PureShieldPerfSettings) {
  const byMode = {
    LOW: { maxFaces: 6, confidenceThreshold: 0.75 },
    MEDIUM: { maxFaces: 20, confidenceThreshold: 0.62 },
    HIGH: { maxFaces: 100, confidenceThreshold: 0.5 },
  }[p.performanceMode];

  const byModel = {
    FAST: { minFaceSizePct: 6 },
    BALANCED: { minFaceSizePct: 3 },
    ACCURATE: { minFaceSizePct: 1 },
  }[p.detectionModel];

  return { ...byMode, ...byModel };
}

// ── Block screen ─────────────────────────────────────────────────────────────

export interface BlockScreenSettings {
  message: string;
  showReason: boolean;
  reasonText: string;
  allowOneMinBypass: boolean;
  bypassPin: string; // '' = no PIN required
  background: BlockBackground;
}

export const DEFAULT_BLOCK_SCREEN: BlockScreenSettings = {
  message: 'This will pull a weed',
  showReason: true,
  reasonText: 'Blocked during Focus Mode',
  allowOneMinBypass: false,
  bypassPin: '',
  background: 'DARK_SOIL',
};

// ── Light Orb timer ──────────────────────────────────────────────────────────

export interface OrbTimerSettings {
  enabled: boolean;
  corner: OrbCorner;
  x: number; // px offset from the chosen corner
  y: number;
  size: number; // 48–96 px
  opacity: number; // 0.3–1
  showSeconds: boolean;
  pulseAtFiveMin: boolean;
}

export const DEFAULT_ORB: OrbTimerSettings = {
  enabled: true,
  corner: 'TR',
  x: 16,
  y: 96,
  size: 64,
  opacity: 0.95,
  showSeconds: true,
  pulseAtFiveMin: true,
};

// ── Blocking databases ───────────────────────────────────────────────────────

export interface BlockingDbSettings {
  adultSitesEnabled: boolean;
  bnKeywordsEnabled: boolean;
}

export const DEFAULT_BLOCKING_DB: BlockingDbSettings = {
  adultSitesEnabled: true,
  bnKeywordsEnabled: true,
};

// ── Generic persistence helpers ──────────────────────────────────────────────

const KEYS = {
  perf: 'shield_v2_pureshield_perf',
  block: 'shield_v2_block_screen',
  orb: 'shield_v2_orb_timer',
  blockingDb: 'shield_v2_blocking_db',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    // Instant cross-component sync (localStorage `storage` event
    // does not fire in the same document).
    window.dispatchEvent(new CustomEvent('shield:settings', { detail: { key } }));
  } catch {
    /* quota / private mode — settings simply won't persist */
  }
}

export const loadPerf = () => read(KEYS.perf, DEFAULT_PERF);
export const savePerf = (v: PureShieldPerfSettings) => write(KEYS.perf, v);

export const loadBlockScreen = () => read(KEYS.block, DEFAULT_BLOCK_SCREEN);
export const saveBlockScreen = (v: BlockScreenSettings) => write(KEYS.block, v);

export const loadOrb = () => read(KEYS.orb, DEFAULT_ORB);
export const saveOrb = (v: OrbTimerSettings) => write(KEYS.orb, v);

export const loadBlockingDb = () => read(KEYS.blockingDb, DEFAULT_BLOCKING_DB);
export const saveBlockingDb = (v: BlockingDbSettings) => write(KEYS.blockingDb, v);

export const SETTINGS_KEYS = KEYS;
