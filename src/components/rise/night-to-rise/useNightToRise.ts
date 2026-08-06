import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_CONFIG, NightToRiseConfig, STORAGE_KEY, getIsoWeekKey, MAX_PAUSES_PER_WEEK } from './types';
import { nightToRiseBridge } from '@/lib/capacitor/nightToRiseBridge';


function load(): NightToRiseConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function parseHM(s: string): { h: number; m: number } {
  const [h, m] = s.split(':').map(Number);
  return { h: h || 0, m: m || 0 };
}

function minutesNow(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

/** Next epoch-ms occurrence of a "HH:MM" time (today if still ahead, else tomorrow). */
function nextOccurrenceMs(timeStr: string): number {
  const { h, m } = parseHM(timeStr);
  const next = new Date();
  next.setHours(h, m, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  return next.getTime();
}

export function useNightToRise(riseAlarmTime?: string | null) {
  const [config, setConfig] = useState<NightToRiseConfig>(load);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const update = useCallback((patch: Partial<NightToRiseConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...patch, configured: true };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      // Push to Android native side (no-op on web/iOS).
      void nightToRiseBridge.setConfig(next);
      return next;
    });
  }, []);

  // Push current config to native once on mount (after restart).
  useEffect(() => { void nightToRiseBridge.setConfig(config); /* eslint-disable-next-line */ }, []);

  // FIX (v2): the native side previously never learned the rise-alarm time,
  // so Rise Guard could never trigger while the app wasn't in the foreground.
  // Push it to native whenever it changes (and re-push periodically so the
  // "next occurrence" stays fresh across day boundaries).
  useEffect(() => {
    if (!riseAlarmTime) {
      void nightToRiseBridge.setRiseAlarm(0);
      return;
    }
    void nightToRiseBridge.setRiseAlarm(nextOccurrenceMs(riseAlarmTime));
  }, [riseAlarmTime, now]);

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

    const cur = minutesNow(now);
    const sleep = parseHM(config.sleepTime);
    const sleepStart = (sleep.h * 60 + sleep.m - config.sleepLockMinutesBefore + 24 * 60) % (24 * 60);
    // FIX (v2): sleep window no longer force-closes 30 min after target time.
    // It stays open until the rise alarm (if any); the web overlay mirrors the
    // native manager's "continuous lock" behavior. Fallback grace kept modest
    // here since this path is only used for the in-app overlay preview.
    const sleepEnd = riseAlarmTime ? parseHM(riseAlarmTime).h * 60 + parseHM(riseAlarmTime).m : (sleep.h * 60 + sleep.m + 570) % (24 * 60);
    const sleepActive = sleepStart <= sleepEnd
      ? cur >= sleepStart && cur < sleepEnd
      : cur >= sleepStart || cur < sleepEnd;
    if (sleepActive) {
      return { phase: 'sleep-lock' as const, label: 'Sleep lock active', endsAt: null };
    }

    if (riseAlarmTime) {
      const a = parseHM(riseAlarmTime);
      const riseStart = a.h * 60 + a.m;
      const riseEnd = (riseStart + config.riseLockMinutesAfter) % (24 * 60);
      const riseActive = riseStart <= riseEnd
        ? cur >= riseStart && cur < riseEnd
        : cur >= riseStart || cur < riseEnd;
      if (riseActive) return { phase: 'rise-lock' as const, label: 'Rise lock active', endsAt: null };
    }

    return { phase: 'armed' as const, label: 'Armed', endsAt: null };
  }, [config, now, riseAlarmTime]);

  // NEW: weekly pause-limit check
  const canPauseTonight = useMemo(() => {
    const weekKey = getIsoWeekKey(new Date());
    const usesThisWeek = config.pauseHistory.filter((d) => getIsoWeekKey(new Date(d)) === weekKey).length;
    return usesThisWeek < MAX_PAUSES_PER_WEEK;
  }, [config.pauseHistory]);

  const pauseTonight = useCallback(() => {
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

  return { config, update, status, pauseTonight, canPauseTonight };
}
