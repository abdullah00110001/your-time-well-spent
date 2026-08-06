export type ScheduleMode = 'everyday' | 'weekdays' | 'custom';

export interface AllowedApp {
  id: string;
  name: string;
  icon?: string;
}

export interface NightToRiseConfig {
  enabled: boolean;
  sleepTime: string; // "HH:MM" 24h
  sleepLockMinutesBefore: number;
  riseLockMinutesAfter: number;
  allowedApps: AllowedApp[];
  /** PHASE 2 — distraction apps blocked during sleep/rise windows. */
  blockedApps: AllowedApp[];
  /** PHASE 2 — distracting sites blocked in the browser during lock windows. */
  blockedSites: string[];
  /** PHASE 2 — block any URL/search containing these keywords. */
  blockedKeywords: string[];
  /**
   * PHASE 2 — enforcement strategy:
   *  - 'blocklist': only the blocked apps/sites are locked
   *  - 'allowlist': everything is locked except the allowed apps (stricter)
   */
  blocklistMode: 'blocklist' | 'allowlist';
  sleepBlockMessage: string;
  riseBlockMessage: string;
  scheduleMode: ScheduleMode;
  scheduleDays: number[]; // 0=Sun..6=Sat
  strictMode: boolean;
  showStreakOnBlock: boolean;
  pausedUntil?: string | null; // ISO date
  configured: boolean;
  /** PHASE 3 — share nightly result with the user's Rise group feed. */
  shareWithGroup: boolean;
  /**
   * NEW: dates ("YYYY-MM-DD") "Pause for one night" was used, kept for the
   * last ~14 entries. Used to enforce a 1-pause-per-week limit so the
   * feature can't be used to silently disable protection every night.
   */
  pauseHistory: string[];
}

/** PHASE 2 — popular distraction apps suggested by default. */
export const SUGGESTED_BLOCK_APPS: AllowedApp[] = [
  { id: 'com.facebook.katana', name: 'Facebook' },
  { id: 'com.instagram.android', name: 'Instagram' },
  { id: 'com.zhiliaoapp.musically', name: 'TikTok' },
  { id: 'com.google.android.youtube', name: 'YouTube' },
  { id: 'com.snapchat.android', name: 'Snapchat' },
  { id: 'com.twitter.android', name: 'X (Twitter)' },
  { id: 'com.tencent.ig', name: 'PUBG Mobile' },
  { id: 'com.dts.freefireth', name: 'Free Fire' },
  { id: 'com.netflix.mediaclient', name: 'Netflix' },
  { id: 'com.reddit.frontpage', name: 'Reddit' },
];

/** PHASE 2 — commonly blocked distracting sites. */
export const SUGGESTED_BLOCK_SITES = [
  'facebook.com',
  'instagram.com',
  'tiktok.com',
  'youtube.com',
  'x.com',
  'reddit.com',
];

export const DEFAULT_CONFIG: NightToRiseConfig = {
  enabled: false,
  sleepTime: '22:30',
  sleepLockMinutesBefore: 30,
  riseLockMinutesAfter: 30,
  allowedApps: [
    { id: 'com.android.phone', name: 'Phone' },
    { id: 'com.android.clock', name: 'Clock' },
    { id: 'com.android.camera', name: 'Camera' },
    { id: 'quran', name: 'Quran' },
    { id: 'notes', name: 'Notes' },
  ],
  blockedApps: SUGGESTED_BLOCK_APPS.slice(0, 4),
  blockedSites: [],
  blockedKeywords: [],
  blocklistMode: 'blocklist',
  sleepBlockMessage: 'Time to rest. Put the phone down. 🌙',
  riseBlockMessage: 'Start your morning right. No scrolling yet. 🌅',
  scheduleMode: 'everyday',
  scheduleDays: [0, 1, 2, 3, 4, 5, 6],
  strictMode: false,
  showStreakOnBlock: true,
  pausedUntil: null,
  configured: false,
  shareWithGroup: false,
  pauseHistory: [],
};

/**
 * Apps that can never be blocked, for user safety. Enforced in the UI so a
 * user can't lock themselves out of calls or the alarm clock.
 */
export const ALWAYS_ALLOWED_IDS = ['com.android.phone', 'com.android.dialer', 'com.android.clock'];

export const STORAGE_KEY = 'night_to_rise_config_v1';

/** ISO week key (e.g. "2026-W32") — used for the weekly pause limit. */
export function getIsoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

/** Max "Pause for one night" uses allowed within a single ISO week. */
export const MAX_PAUSES_PER_WEEK = 1;