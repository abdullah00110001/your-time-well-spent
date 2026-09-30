/**
 * useNightToRiseStreak — tracks consecutive nights the user did NOT break the
 * Night to Rise lock. Stored entirely in localStorage as approved in the plan.
 *
 * Storage key: `night_to_rise_sessions_v1` → Array<{ date: 'YYYY-MM-DD'; broken: boolean }>
 * Call `recordBreak()` whenever the user uses the emergency unlock or opens a
 * disallowed app from within the guard. Call `recordCleanNight()` once per day
 * when the rise-lock window ends without a break.
 */

import { useCallback, useEffect, useState } from 'react';

export interface SessionRow {
  date: string;       // YYYY-MM-DD
  broken: boolean;
}

const KEY = 'night_to_rise_sessions_v1';

function read(): SessionRow[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SessionRow[];
  } catch { return []; }
}

function write(rows: SessionRow[]) {
  try { localStorage.setItem(KEY, JSON.stringify(rows.slice(-90))); } catch {}
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function calcStreak(rows: SessionRow[]): number {
  if (rows.length === 0) return 0;
  const map = new Map(rows.map((r) => [r.date, r.broken]));
  let streak = 0;
  const d = new Date();
  // walk backwards starting yesterday
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 90; i++) {
    const key = d.toISOString().slice(0, 10);
    if (!map.has(key)) break;
    if (map.get(key) === true) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** PHASE 3 — longest clean run anywhere in the stored history. */
function calcLongest(rows: SessionRow[]): number {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const r of sorted) {
    if (r.broken) { run = 0; prev = r.date; continue; }
    if (prev) {
      const gap = (new Date(r.date).getTime() - new Date(prev).getTime()) / 86400000;
      run = gap === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    prev = r.date;
    best = Math.max(best, run);
  }
  return best;
}

/** PHASE 3 — last `days` days, oldest → newest, for the recap strip. */
function buildRecent(rows: SessionRow[], days: number) {
  const map = new Map(rows.map((r) => [r.date, r.broken]));
  const out: { date: string; state: 'clean' | 'broken' | 'none' }[] = [];
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, state: map.has(key) ? (map.get(key) ? 'broken' : 'clean') : 'none' });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

export function useNightToRiseStreak() {
  const [rows, setRows] = useState<SessionRow[]>(read);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setRows(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const recordBreak = useCallback(() => {
    setRows((prev) => {
      const t = todayKey();
      const next = [...prev.filter((r) => r.date !== t), { date: t, broken: true }];
      write(next);
      return next;
    });
  }, []);

  const recordCleanNight = useCallback(() => {
    setRows((prev) => {
      const t = todayKey();
      if (prev.find((r) => r.date === t)) return prev;
      const next = [...prev, { date: t, broken: false }];
      write(next);
      return next;
    });
  }, []);

  const last7 = buildRecent(rows, 7);
  const last30 = buildRecent(rows, 30);

  return {
    rows,
    streak: calcStreak(rows),
    longestStreak: calcLongest(rows),
    protectedNights: rows.filter((r) => !r.broken).length,
    brokenNights: rows.filter((r) => r.broken).length,
    last7,
    last30,
    weekProtected: last7.filter((d) => d.state === 'clean').length,
    weekBroken: last7.filter((d) => d.state === 'broken').length,
    recordBreak,
    recordCleanNight,
  };
}
