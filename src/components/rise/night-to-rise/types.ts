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
  /**
   * The ONLY apps that may be opened while a lock window is active.
   * Everything else is blocked by default (allowlist model).
   */
  allowedApps: AllowedApp[];
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
  /** SECTION 4 — strict mode 24h commitment lock (ISO date) while enabled. */
  strictLockedUntil?: string | null;
  /** SECTION 4 — pending emergency-unlock request (epoch ms) under strict mode. */
  strictUnlockRequestedAt?: number | null;
  /** SECTION 4 — chronotype onboarding result. */
  chronotype?: 'lark' | 'neutral' | 'owl' | null;
  chronotypeAnswered?: boolean;
  /** Gradual Shift Assistant — intermediate target while easing to sleepTime. */
  shiftTargetTime?: string | null;
  /** Custom-schedule weekend target (used for the social-jetlag warning). */
  weekendSleepTime?: string | null;
  /** Alarm volume ramp length in seconds (mirrored to native prefs). */
  alarmRampSeconds?: number;
  /** Which guards the user wants. Either, both, or one alone. */
  sleepGuardEnabled: boolean;
  riseGuardEnabled: boolean;
  /**
   * How Sleep Guard ends:
   *  - 'until-alarm' → keeps holding right up to the rise alarm
   *  - 'duration'    → switches itself off N minutes after it started
   */
  sleepGuardEndMode: 'until-alarm' | 'duration';
  /** Minutes Sleep Guard runs when sleepGuardEndMode === 'duration'. */
  sleepGuardDurationMinutes: number;
  /**
   * Hard ceiling (hours) on how long Sleep Guard may run with no alarm
   * attached. Spec default: 10 hours. Mirrored to native preferences.
   */
  safetyCapHours: number;
}

export type SleepGuardEndMode = NightToRiseConfig['sleepGuardEndMode'];


/** Popular apps, used as a web fallback list inside the app picker. */
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

export const DEFAULT_CONFIG: NightToRiseConfig = {
  enabled: false,
  sleepTime: '22:30',
  sleepLockMinutesBefore: 30,
  riseLockMinutesAfter: 30,
  allowedApps: [
    { id: 'com.android.dialer', name: 'Phone' },
    { id: 'com.android.deskclock', name: 'Clock' },
    { id: 'com.google.android.deskclock', name: 'Clock (Google)' },
  ],

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
  strictLockedUntil: null,
  strictUnlockRequestedAt: null,
  chronotype: null,
  chronotypeAnswered: false,
  shiftTargetTime: null,
  weekendSleepTime: null,
  alarmRampSeconds: 45,
  sleepGuardEnabled: true,
  riseGuardEnabled: true,
  sleepGuardEndMode: 'until-alarm',
  sleepGuardDurationMinutes: 180,
  safetyCapHours: 10,
};

/** SECTION 4 — strict mode commits the user for 24 hours. */
export const STRICT_LOCK_MS = 24 * 60 * 60 * 1000;

/** Reasons offered when pausing for one night. */
export const PAUSE_REASONS = ['Travel', 'Emergency', 'Illness', 'Other'] as const;
export type PauseReason = (typeof PAUSE_REASONS)[number];

/**
 * Apps that can never be blocked, for user safety. Enforced in the UI so a
 * user can't lock themselves out of calls or the alarm clock.
 */
export const ALWAYS_ALLOWED_IDS = [
  'com.android.phone',
  'com.android.dialer',
  'com.google.android.dialer',
  'com.android.server.telecom',
  'com.android.emergency',
  'com.android.deskclock',
  'com.google.android.deskclock',
];


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

/** PHASE 2 — strict mode: emergency unlock only becomes available after this
 *  cool-down (10 minutes), instead of being hidden entirely. */
export const STRICT_UNLOCK_DELAY_MS = 10 * 60 * 1000;
