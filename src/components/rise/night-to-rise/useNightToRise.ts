import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_CONFIG,
  NightToRiseConfig,
  STORAGE_KEY,
  getIsoWeekKey,
  MAX_PAUSES_PER_WEEK,
  STRICT_LOCK_MS,
  STRICT_UNLOCK_DELAY_MS,
  type PauseReason,
} from './types';
import { nightToRiseBridge } from '@/lib/capacitor/nightToRiseBridge';
import { computeNightWindows, relevantAlarmOccurrenceMs } from './timeMath';
import type { NextRiseAlarm } from './nextRiseAlarm';

function load(): NightToRiseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

/** Keys that stay editable even while strict mode holds the settings locked. */
const STRICT_ALLOWED_KEYS = new Set<keyof NightToRiseConfig>([
  'strictUnlockRequestedAt',
  'strictLockedUntil',
  'strictMode',
]);

/**
 * @param riseAlarm the nearest upcoming alarm (weekday-aware) from
 * useNextRiseAlarm(). This hook is the ONLY writer of the alarm reference that
 * native enforcement reads, so the two can never disagree.
 */
export function useNightToRise(riseAlarm?: NextRiseAlarm | null) {
  const riseAlarmTime = riseAlarm?.time ?? null;
  const [config, setConfig] = useState<NightToRiseConfig>(load);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  /** True while the 24h strict-mode commitment is still running. */
  const strictLocked = useMemo(() => {
    if (!config.strictMode) return false;
    const until = config.strictLockedUntil ? new Date(config.strictLockedUntil).getTime() : 0;
    return until > now.getTime();
  }, [config.strictMode, config.strictLockedUntil, now]);

  const strictLockRemainingMs = useMemo(() => {
    if (!strictLocked || !config.strictLockedUntil) return 0;
    return Math.max(0, new Date(config.strictLockedUntil).getTime() - now.getTime());
  }, [strictLocked, config.strictLockedUntil, now]);

  const writeConfig = useCallback((next: NightToRiseConfig) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
    void nightToRiseBridge.setConfig(next);
  }, []);

  const update = useCallback((patch: Partial<NightToRiseConfig>) => {
    setConfig((prev) => {
      // SECTION 4 — enforcement, not just UI dimming: reject settings changes
      // while the strict-mode commitment window is active.
      const lockedUntil = prev.strictLockedUntil ? new Date(prev.strictLockedUntil).getTime() : 0;
      const isLocked = prev.strictMode && lockedUntil > Date.now();
      if (isLocked) {
        const illegal = (Object.keys(patch) as (keyof NightToRiseConfig)[]).filter(
          (k) => !STRICT_ALLOWED_KEYS.has(k),
        );
        if (illegal.length) return prev;
        // Strict mode itself cannot be switched off before the window ends.
        if ('strictMode' in patch && patch.strictMode === false) return prev;
      }
      const next = { ...prev, ...patch, configured: true };
      writeConfig(next);
      return next;
    });
  }, [writeConfig]);

  // Push current config to native once on mount (after restart).
  useEffect(() => { void nightToRiseBridge.setConfig(config); /* eslint-disable-next-line */ }, []);

  // Keep the native scheduler aware of the next rise-alarm occurrence AND of
  // the weekdays that alarm actually rings on, so Rise Guard never locks the
  // phone on a morning with no alarm.
  const alarmDaysKey = (riseAlarm?.daysOfWeek ?? []).join(',');
  useEffect(() => {
    if (!riseAlarmTime) {
      void nightToRiseBridge.setRiseAlarm(0, []);
      return;
    }
    const days = alarmDaysKey ? alarmDaysKey.split(',').map(Number) : [];
    void nightToRiseBridge.setRiseAlarm(
      riseAlarm?.atMs && riseAlarm.atMs > 0
        ? riseAlarm.atMs
        : relevantAlarmOccurrenceMs(riseAlarmTime, config.riseLockMinutesAfter, now),
      days,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riseAlarmTime, riseAlarm?.atMs, alarmDaysKey, config.riseLockMinutesAfter]);

  /** The target actually enforced tonight (gradual-shift aware). */
  const effectiveSleepTime = config.shiftTargetTime || config.sleepTime;

  const windows = useMemo(
    () => computeNightWindows({
      sleepTime: effectiveSleepTime,
      riseTime: riseAlarmTime ?? null,
      lockBeforeMin: config.sleepLockMinutesBefore,
      lockAfterMin: config.riseLockMinutesAfter,
      now,
      // NEW (v4): wire the independent guard toggles + Sleep Guard end mode
      // into the in-app time computation, so the status pill/countdown shown
      // here always matches what native enforcement is actually doing.
      sleepGuardEnabled: config.sleepGuardEnabled,
      riseGuardEnabled: config.riseGuardEnabled,
      sleepEndMode: config.sleepGuardEndMode,
      sleepDurationMin: config.sleepGuardDurationMinutes,
      // Weekdays the alarm rings on, and the same safety cap native uses, so
      // the countdown on screen can never drift from real enforcement.
      riseDays: riseAlarm?.daysOfWeek ?? [],
      safetyCapMinutes: Math.max(60, (config.safetyCapHours ?? 10) * 60),
    }),
    [
      effectiveSleepTime, riseAlarmTime, config.sleepLockMinutesBefore, config.riseLockMinutesAfter, now,
      config.sleepGuardEnabled, config.riseGuardEnabled, config.sleepGuardEndMode, config.sleepGuardDurationMinutes,
      config.safetyCapHours, riseAlarm?.daysOfWeek,
    ],
  );

  const status = useMemo(() => {
    if (!config.enabled || !config.configured) {
      return { phase: 'off' as const, label: null as string | null, endsAt: null as Date | null };
    }
    if (config.pausedUntil && new Date(config.pausedUntil) > now) {
      return { phase: 'paused' as const, label: 'Paused tonight', endsAt: new Date(config.pausedUntil) };
    }
    const day = now.getDay();
    const active = config.scheduleMode === 'everyday'
      ? true
      : config.scheduleMode === 'weekdays'
        ? day >= 1 && day <= 5
        : config.scheduleDays.includes(day);

    if (!active) return { phase: 'inactive-day' as const, label: 'Not scheduled today', endsAt: null };

    if (windows.sleepActive) {
      return { phase: 'sleep-lock' as const, label: 'Sleep lock active', endsAt: null };
    }
    if (windows.riseActive) {
      return { phase: 'rise-lock' as const, label: 'Rise lock active', endsAt: null };
    }
    return { phase: 'armed' as const, label: 'Armed', endsAt: null };
  }, [config, now, windows]);

  const isLockEnforcing = status.phase === 'sleep-lock' || status.phase === 'rise-lock';

  const canPauseTonight = useMemo(() => {
    if (strictLocked) return false;
    const weekKey = getIsoWeekKey(new Date());
    const usesThisWeek = config.pauseHistory.filter((d) => getIsoWeekKey(new Date(d)) === weekKey).length;
    return usesThisWeek < MAX_PAUSES_PER_WEEK;
  }, [config.pauseHistory, strictLocked]);

  const pausesThisWeek = useMemo(() => {
    const weekKey = getIsoWeekKey(new Date());
    return config.pauseHistory.filter((d) => getIsoWeekKey(new Date(d)) === weekKey).length;
  }, [config.pauseHistory]);

  const pauseTonight = useCallback((_reason?: PauseReason) => {
    if (!canPauseTonight) return false;
    const next = new Date();
    next.setHours(12, 0, 0, 0);
    if (next < new Date()) next.setDate(next.getDate() + 1);
    const todayIso = new Date().toISOString().slice(0, 10);
    update({
      pausedUntil: next.toISOString(),
      pauseHistory: [...config.pauseHistory.slice(-13), todayIso],
    });
    return true;
  }, [update, canPauseTonight, config.pauseHistory]);

  /** Enable strict mode with the 24h commitment window. */
  const enableStrictMode = useCallback(() => {
    setConfig((prev) => {
      const next: NightToRiseConfig = {
        ...prev,
        configured: true,
        strictMode: true,
        strictLockedUntil: new Date(Date.now() + STRICT_LOCK_MS).toISOString(),
        strictUnlockRequestedAt: null,
      };
      writeConfig(next);
      return next;
    });
  }, [writeConfig]);

  const disableStrictMode = useCallback(() => {
    setConfig((prev) => {
      const until = prev.strictLockedUntil ? new Date(prev.strictLockedUntil).getTime() : 0;
      if (until > Date.now()) return prev; // still committed
      const next: NightToRiseConfig = {
        ...prev,
        strictMode: false,
        strictLockedUntil: null,
        strictUnlockRequestedAt: null,
      };
      writeConfig(next);
      return next;
    });
  }, [writeConfig]);

  /** Emergency unlock — a 10 minute delayed unlock, persisted so it survives
   *  navigation / the activity being destroyed. */
  const requestEmergencyUnlock = useCallback(() => {
    update({ strictUnlockRequestedAt: Date.now() });
  }, [update]);

  const emergencyUnlockMsLeft = useMemo(() => {
    if (!config.strictUnlockRequestedAt) return null;
    return Math.max(0, config.strictUnlockRequestedAt + STRICT_UNLOCK_DELAY_MS - now.getTime());
  }, [config.strictUnlockRequestedAt, now]);

  return {
    config,
    update,
    status,
    windows,
    effectiveSleepTime,
    isLockEnforcing,
    pauseTonight,
    canPauseTonight,
    pausesThisWeek,
    strictLocked,
    strictLockRemainingMs,
    enableStrictMode,
    disableStrictMode,
    requestEmergencyUnlock,
    emergencyUnlockMsLeft,
  };
}
