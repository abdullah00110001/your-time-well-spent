/**
 * nextRiseAlarm — the SINGLE source of truth for "which Rise alarm does Sleep
 * to Rise hand off to, and when does it ring next".
 *
 * Fixes two long-standing defects:
 *  1. Two places used to tell native when the alarm is. The Rise page computed
 *     it correctly (respecting the chosen weekdays) while the Sleep to Rise
 *     page recomputed a day-blind value every 30s and overwrote it. Only
 *     `useNightToRise` writes the alarm to native now, and it uses this module.
 *  2. The Sleep to Rise page took the FIRST enabled alarm in local storage
 *     rather than the NEAREST upcoming one, and never looked at the alarms
 *     saved in the user's account. Both sources are merged here.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AlarmLike {
  alarm_time?: string | null;
  time?: string | null;
  is_enabled?: boolean;
  enabled?: boolean;
  days_of_week?: number[] | null;
  daysOfWeek?: number[] | null;
}

export interface NormalizedAlarm {
  /** "HH:MM" local time. */
  time: string;
  /** 0=Sun..6=Sat. Empty array means "every day". */
  daysOfWeek: number[];
}

export interface NextRiseAlarm extends NormalizedAlarm {
  /** Epoch ms of the next occurrence, weekday-aware. */
  atMs: number;
}

/** Keeps only enabled alarms that carry a usable time. */
export function normalizeAlarms(list: unknown): NormalizedAlarm[] {
  if (!Array.isArray(list)) return [];
  const out: NormalizedAlarm[] = [];
  for (const raw of list as AlarmLike[]) {
    if (!raw) continue;
    const enabled = raw.is_enabled ?? raw.enabled ?? true;
    if (!enabled) continue;
    const time = (raw.alarm_time || raw.time || '').trim();
    if (!/^\d{1,2}:\d{2}/.test(time)) continue;
    const days = (raw.days_of_week ?? raw.daysOfWeek ?? []) as number[];
    out.push({
      time: time.slice(0, 5),
      daysOfWeek: Array.isArray(days) ? days.filter((d) => d >= 0 && d <= 6) : [],
    });
  }
  return out;
}

/**
 * Nearest upcoming occurrence across every enabled alarm, honouring each
 * alarm's own weekday list (an empty list means the alarm repeats daily).
 */
export function computeNextRiseAlarm(
  alarms: NormalizedAlarm[],
  from: Date = new Date(),
): NextRiseAlarm | null {
  let best: NextRiseAlarm | null = null;
  const today = from.getDay();
  for (const alarm of alarms) {
    const [h, m] = alarm.time.split(':').map(Number);
    for (let offset = 0; offset <= 7; offset++) {
      const day = (today + offset) % 7;
      if (alarm.daysOfWeek.length > 0 && !alarm.daysOfWeek.includes(day)) continue;
      const when = new Date(from);
      when.setDate(when.getDate() + offset);
      when.setHours(h || 0, m || 0, 0, 0);
      if (when.getTime() <= from.getTime()) continue;
      if (!best || when.getTime() < best.atMs) {
        best = { time: alarm.time, daysOfWeek: alarm.daysOfWeek, atMs: when.getTime() };
      }
      break;
    }
  }
  return best;
}

function readLocalAlarms(): NormalizedAlarm[] {
  try {
    const raw = localStorage.getItem('local_alarms');
    return raw ? normalizeAlarms(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/**
 * Reactive next-alarm reader: merges local alarms with the account's saved
 * alarms, recomputes on storage changes and once a minute.
 */
export function useNextRiseAlarm(): NextRiseAlarm | null {
  const [remote, setRemote] = useState<NormalizedAlarm[]>([]);
  const [next, setNext] = useState<NextRiseAlarm | null>(null);

  const recompute = useCallback((remoteAlarms: NormalizedAlarm[]) => {
    const all = [...readLocalAlarms(), ...remoteAlarms];
    setNext((prev) => {
      const candidate = computeNextRiseAlarm(all);
      if (
        prev && candidate
        && prev.atMs === candidate.atMs
        && prev.time === candidate.time
        && prev.daysOfWeek.join(',') === candidate.daysOfWeek.join(',')
      ) return prev;
      return candidate;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth?.user) return;
        const { data } = await supabase
          .from('rise_alarms')
          .select('alarm_time, days_of_week, is_enabled')
          .eq('user_id', auth.user.id);
        if (!cancelled && data) setRemote(normalizeAlarms(data));
      } catch { /* offline — local alarms still apply */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    recompute(remote);
    const id = setInterval(() => recompute(remote), 60_000);
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === 'local_alarms') recompute(remote);
    };
    window.addEventListener('storage', onStorage);
    return () => { clearInterval(id); window.removeEventListener('storage', onStorage); };
  }, [remote, recompute]);

  return next;
}
