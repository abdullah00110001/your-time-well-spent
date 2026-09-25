/**
 * useNightToRiseLogs — SECTION 4: the real (server-backed) source for
 * Sleep-to-Rise streaks, protected nights and blocked-attempt analytics.
 *
 * Rows live in `night_to_rise_logs` (one per calendar date, unique per user).
 * A night counts toward the streak only when BOTH windows were respected.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface NightLog {
  date: string;                 // YYYY-MM-DD
  sleep_protected: boolean;
  rise_protected: boolean;
  actual_sleep_minutes: number | null;
  target_sleep_minutes: number | null;
  blocked_attempts: number;
}

const isoDate = (d: Date) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};

function computeStreak(logs: NightLog[]): number {
  const map = new Map(logs.map((l) => [l.date, l.sleep_protected && l.rise_protected]));
  let streak = 0;
  const d = new Date();
  // A night is only finalised the next morning, so start from yesterday.
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 400; i++) {
    const key = isoDate(d);
    if (map.get(key) !== true) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function computeLongest(logs: NightLog[]): number {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0; let run = 0; let prev: string | null = null;
  for (const l of sorted) {
    const ok = l.sleep_protected && l.rise_protected;
    if (!ok) { run = 0; prev = l.date; continue; }
    const gap = prev ? (new Date(l.date).getTime() - new Date(prev).getTime()) / 86400000 : 0;
    run = prev && gap === 1 ? run + 1 : 1;
    prev = l.date;
    best = Math.max(best, run);
  }
  return best;
}

export function useNightToRiseLogs(days = 120) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<NightLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) { setLogs([]); setIsLoading(false); return; }
    const from = new Date();
    from.setDate(from.getDate() - days);
    const { data, error } = await supabase
      .from('night_to_rise_logs')
      .select('date, sleep_protected, rise_protected, actual_sleep_minutes, target_sleep_minutes, blocked_attempts')
      .eq('user_id', user.id)
      .gte('date', isoDate(from))
      .order('date', { ascending: false });
    if (!error && data) setLogs(data as NightLog[]);
    setIsLoading(false);
  }, [user, days]);

  useEffect(() => { void load(); }, [load]);

  /** Upsert tonight's (or a given date's) result. */
  const recordNight = useCallback(async (patch: Partial<NightLog> & { date?: string }) => {
    if (!user) return false;
    const date = patch.date ?? isoDate(new Date());
    const { error } = await supabase
      .from('night_to_rise_logs')
      .upsert({
        user_id: user.id,
        date,
        sleep_protected: patch.sleep_protected ?? false,
        rise_protected: patch.rise_protected ?? false,
        actual_sleep_minutes: patch.actual_sleep_minutes ?? null,
        target_sleep_minutes: patch.target_sleep_minutes ?? null,
        blocked_attempts: patch.blocked_attempts ?? 0,
      }, { onConflict: 'user_id,date' });
    if (error) return false;
    await load();
    return true;
  }, [user, load]);

  /** Log a blocked-app attempt (analytics + the per-night counter). */
  const recordBlockedAttempt = useCallback(async (packageName: string, windowType: 'sleep' | 'rise') => {
    if (!user) return;
    await supabase.from('night_to_rise_events').insert({
      user_id: user.id,
      package_name: packageName,
      window_type: windowType,
    });
  }, [user]);

  const derived = useMemo(() => {
    const tracked = logs.length;
    const protectedNights = logs.filter((l) => l.sleep_protected && l.rise_protected).length;
    return {
      streak: computeStreak(logs),
      longestStreak: computeLongest(logs),
      protectedNights,
      trackedNights: tracked,
      successRate: tracked ? Math.round((protectedNights / tracked) * 100) : 0,
      /** Average actual bedtime in minutes-of-day (null when not enough data). */
      averageSleepMinutes: (() => {
        const vals = logs.map((l) => l.actual_sleep_minutes).filter((v): v is number => v != null);
        if (vals.length < 5) return null;
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
      })(),
    };
  }, [logs]);

  return { logs, isLoading, reload: load, recordNight, recordBlockedAttempt, ...derived };
}
