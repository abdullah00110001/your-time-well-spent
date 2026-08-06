// Local-only state for PureShield options the native plugin doesn't expose yet.
// Safe defaults if storage unavailable.

export interface LocalShieldExtras {
  blurOpacity: number;          // 0-100
  blurSensitivity: number;      // 0-100
  minFaceSizePct: number;       // 0-50 (% of frame)
  pauseOnLowMemory: boolean;
  debugOverlay: boolean;
  showFps: boolean;
}

export interface ShieldStat {
  date: string;          // YYYY-MM-DD
  facesBlurred: number;
  perApp: Record<string, number>;
  perHour: number[];     // 24 buckets
}

export interface PerAppConfig {
  blurStyle?: 'PIXELATE' | 'FROSTED' | 'SOLID' | 'MOSAIC';
  blurGender?: 'FEMALE' | 'MALE' | 'BOTH';
  intensity?: number;
}

const KEYS = {
  extras: 'pureShield.extras.v1',
  stats: 'pureShield.stats.v1',
  perApp: 'pureShield.perApp.v1',
  whitelist: 'pureShield.whitelist.v1',
};

export const DEFAULT_EXTRAS: LocalShieldExtras = {
  blurOpacity: 100,
  blurSensitivity: 60,
  minFaceSizePct: 2,
  pauseOnLowMemory: true,
  debugOverlay: false,
  showFps: false,
};

const safeGet = <T,>(k: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const safeSet = (k: string, v: unknown) => {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
};

export const loadExtras = (): LocalShieldExtras => ({ ...DEFAULT_EXTRAS, ...safeGet(KEYS.extras, {}) });
export const saveExtras = (e: LocalShieldExtras) => safeSet(KEYS.extras, e);

export const loadStats = (): ShieldStat[] => safeGet<ShieldStat[]>(KEYS.stats, []);
export const saveStats = (s: ShieldStat[]) => safeSet(KEYS.stats, s);

export const loadPerApp = (): Record<string, PerAppConfig> => safeGet(KEYS.perApp, {});
export const savePerApp = (m: Record<string, PerAppConfig>) => safeSet(KEYS.perApp, m);

export const loadWhitelist = (): { id: string; label: string; createdAt: number }[] =>
  safeGet(KEYS.whitelist, []);
export const saveWhitelist = (w: { id: string; label: string; createdAt: number }[]) =>
  safeSet(KEYS.whitelist, w);

// Recommended packages for "Recommended" badge
export const RECOMMENDED_PACKAGES = new Set([
  'com.google.android.youtube',
  'com.android.chrome',
  'com.google.android.apps.photos',
  'com.instagram.android',
  'com.zhiliaoapp.musically',
  'com.snapchat.android',
  'com.facebook.katana',
  'com.twitter.android',
  'com.reddit.frontpage',
  'com.pinterest',
]);

export function lifetimeFacesBlurred(stats: ShieldStat[]): number {
  return stats.reduce((acc, s) => acc + s.facesBlurred, 0);
}

export function todayStat(stats: ShieldStat[]): ShieldStat | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return stats.find((s) => s.date === today);
}
