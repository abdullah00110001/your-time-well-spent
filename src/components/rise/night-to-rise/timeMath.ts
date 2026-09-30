/**
 * timeMath — the SINGLE source of truth for every Sleep-to-Rise time
 * calculation (Section 0.2).
 *
 * Everything here works in *local* minutes-of-day (0..1439) and treats the
 * clock as a circle, so windows that cross midnight (e.g. sleep 23:30 → rise
 * 06:00) never produce negative or wrapped-around durations.
 *
 * Rules used everywhere:
 *   - `parseHM("23:30")`            → 1410
 *   - `forwardDelta(from, to)`      → minutes going *forward* from `from` to
 *                                     `to`, always in [0, 1439]. This is what
 *                                     makes midnight rollover correct: at
 *                                     00:30 the delta to 23:30 is 1380, and the
 *                                     delta from 23:30 to 00:30 is 60.
 *   - a window [start, end) is active when
 *     `forwardDelta(start, now) < forwardDelta(start, end)`.
 *
 * All four displays required by the spec are derived from these two helpers:
 *   (a) time until Sleep Guard activates   → untilSleepGuard
 *   (b) time left once Sleep Guard active  → sleepGuardRemaining
 *   (c) time until the Rise alarm          → untilRiseAlarm
 *   (d) time left in the post-wake lock    → riseGuardRemaining
 */

export const MINUTES_PER_DAY = 1440;

/** "HH:MM" (24h) → minutes of day. Invalid input degrades to 0. */
export function parseHM(value: string | null | undefined): number {
  if (!value) return 0;
  const [h, m] = value.split(':').map((n) => Number(n));
  const hh = Number.isFinite(h) ? h : 0;
  const mm = Number.isFinite(m) ? m : 0;
  return (((hh * 60 + mm) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Local minutes-of-day for a Date (defaults to now). */
export function minutesOfDay(d: Date = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Normalise any minute value onto [0, 1439]. */
export function norm(min: number): number {
  return ((Math.round(min) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

/** Minutes going forward around the clock from `from` to `to`. Always >= 0. */
export function forwardDelta(from: number, to: number): number {
  return norm(to - from);
}

/** Is `now` inside the half-open circular window [start, end)? */
export function inWindow(now: number, start: number, end: number): boolean {
  const span = forwardDelta(start, end);
  if (span === 0) return false;
  return forwardDelta(start, now) < span;
}

/** Length of the circular window [start, end); a full day when start === end. */
export function windowSpan(start: number, end: number): number {
  const span = forwardDelta(start, end);
  return span === 0 ? MINUTES_PER_DAY : span;
}

/** Progress through a circular window, clamped to [0, 1]. */
export function windowProgress(now: number, start: number, end: number): number {
  const span = windowSpan(start, end);
  return Math.min(1, Math.max(0, forwardDelta(start, now) / span));
}

/** "2h 10m" / "18m" / "now". */
export function formatGap(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m === 0) return 'now';
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}m`;
}

/** 12-hour clock label for a minutes-of-day value. */
export function formatClock(minutesOfDayValue: number): string {
  const v = norm(minutesOfDayValue);
  const h = Math.floor(v / 60);
  const m = v % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export interface NightWindowInput {
  /** "HH:MM" target sleep time. */
  sleepTime: string;
  /** "HH:MM" rise alarm, or null when no alarm is set. */
  riseTime: string | null;
  /** Minutes the sleep lock starts *before* the target sleep time. */
  lockBeforeMin: number;
  /** Minutes the rise lock stays on *after* the alarm. */
  lockAfterMin: number;
  /** Current time (defaults to now). */
  now?: Date;
  /** User can run Sleep Guard, Rise Guard, or both. Default: both on. */
  sleepGuardEnabled?: boolean;
  riseGuardEnabled?: boolean;
  /** 'until-alarm' (default) or 'duration' — Sleep Guard auto-off. */
  sleepEndMode?: 'until-alarm' | 'duration';
  /** Minutes Sleep Guard runs in 'duration' mode. */
  sleepDurationMin?: number;
  /** Weekdays (0=Sun) the alarm rings on. Empty = every day. */
  riseDays?: number[];
  /**
   * Hard ceiling (minutes) on Sleep Guard when no alarm is attached. Measured
   * from the LOCK START, exactly like native enforcement, so the on-screen
   * countdown and the phone's behaviour can never drift apart.
   */
  safetyCapMinutes?: number;
}


export interface NightWindows {
  nowMin: number;
  /** Sleep Guard window. */
  sleepStart: number;
  sleepEnd: number;
  sleepActive: boolean;
  /** Rise Guard (post-alarm) window. Null when no alarm is set. */
  riseStart: number | null;
  riseEnd: number | null;
  riseActive: boolean;
  /** (a) minutes until Sleep Guard turns on; 0 while it is already on. */
  untilSleepGuard: number;
  /** (b) minutes left of the active Sleep Guard window; 0 when inactive. */
  sleepGuardRemaining: number;
  /** (c) minutes until the Rise alarm fires; null when no alarm. */
  untilRiseAlarm: number | null;
  /** (d) minutes left of the active Rise Guard lock; 0 when inactive. */
  riseGuardRemaining: number;
  /** Whole protected span (sleep lock start → rise lock end) and progress. */
  nightStart: number;
  nightEnd: number;
  nightProgress: number;
  inNight: boolean;
}

/**
 * Computes every Sleep-to-Rise time value from one consistent model.
 * With no rise alarm, Sleep Guard ends at the safety cap measured from the
 * LOCK START — the same rule native enforcement applies.
 */
export function computeNightWindows({
  sleepTime,
  riseTime,
  lockBeforeMin,
  lockAfterMin,
  now = new Date(),
  sleepGuardEnabled = true,
  riseGuardEnabled = true,
  sleepEndMode = 'until-alarm',
  sleepDurationMin = 180,
  riseDays = [],
  safetyCapMinutes = 600,
}: NightWindowInput): NightWindows {
  const nowMin = minutesOfDay(now);
  const sleepTarget = parseHM(sleepTime);
  const sleepStart = norm(sleepTarget - lockBeforeMin);

  const alarm = riseTime ? parseHM(riseTime) : null;
  // Sleep Guard runs from the wind-down start until the alarm (or the safety
  // cap, counted from the lock start, when there is no alarm) — unless the
  // user asked it to switch itself off after a fixed duration, in which case
  // it ends at whichever comes first: that duration, or the alarm.
  const cap = Math.max(60, Math.round(safetyCapMinutes));
  const untilAlarmEnd = alarm !== null ? alarm : norm(sleepStart + cap);
  let sleepEnd = untilAlarmEnd;
  if (sleepEndMode === 'duration') {
    const duration = Math.max(15, Math.round(sleepDurationMin));
    const alarmSpan = alarm !== null ? windowSpan(sleepStart, alarm) : cap;
    sleepEnd = duration < alarmSpan ? norm(sleepStart + duration) : untilAlarmEnd;
  }

  const riseStart = alarm;
  const riseEnd = alarm !== null ? norm(alarm + lockAfterMin) : null;

  const sleepActive = sleepGuardEnabled && inWindow(nowMin, sleepStart, sleepEnd);
  // Rise Guard only exists on mornings the alarm actually rings.
  const alarmRingsToday = riseDays.length === 0 || riseDays.includes(now.getDay());
  const riseActive =
    riseGuardEnabled && alarmRingsToday && riseStart !== null && riseEnd !== null && lockAfterMin > 0
      ? inWindow(nowMin, riseStart, riseEnd)
      : false;


  const nightStart = sleepStart;
  const nightEnd = riseEnd ?? sleepEnd;

  return {
    nowMin,
    sleepStart,
    sleepEnd,
    sleepActive,
    riseStart,
    riseEnd,
    riseActive,
    untilSleepGuard: sleepActive ? 0 : forwardDelta(nowMin, sleepStart),
    sleepGuardRemaining: sleepActive ? forwardDelta(nowMin, sleepEnd) : 0,
    untilRiseAlarm: riseStart === null ? null : forwardDelta(nowMin, riseStart),
    riseGuardRemaining: riseActive && riseEnd !== null ? forwardDelta(nowMin, riseEnd) : 0,
    nightStart,
    nightEnd,
    nightProgress: windowProgress(nowMin, nightStart, nightEnd),
    inNight: inWindow(nowMin, nightStart, nightEnd),
  };
}

/**
 * Human status line shared by the Night Arc and every other "time remaining"
 * display, so they can never disagree.
 */
export function describeStatus(
  w: NightWindows,
  phase: string,
): { primary: string; secondary: string } {
  if (phase === 'off') return { primary: 'Protection off', secondary: 'Turn it on to begin' };
  if (phase === 'paused') return { primary: 'Paused tonight', secondary: 'Protection resumes tomorrow' };
  if (phase === 'inactive-day') return { primary: 'Not scheduled tonight', secondary: 'No lock will run' };
  if (phase === 'rise-lock') {
    return {
      primary: `Rise Guard active — ${formatGap(w.riseGuardRemaining)} left`,
      secondary: 'Screens stay closed a little longer',
    };
  }
  if (phase === 'sleep-lock') {
    return {
      primary: `Sleep Guard active — ${formatGap(w.sleepGuardRemaining)} left`,
      secondary: 'Rest now, the phone can wait',
    };
  }
  return {
    primary: `Sleep Guard in ${formatGap(w.untilSleepGuard)}`,
    secondary: `Wind-down starts at ${formatClock(w.sleepStart)}`,
  };
}

/** Next epoch-ms occurrence of a "HH:MM" local time (today if ahead, else tomorrow). */
export function nextOccurrenceMs(timeStr: string, from: Date = new Date()): number {
  const target = parseHM(timeStr);
  const d = new Date(from);
  d.setHours(Math.floor(target / 60), target % 60, 0, 0);
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/**
 * Alarm occurrence that belongs to the currently relevant Sleep-to-Rise
 * window. During the post-alarm Rise Guard this deliberately returns today's
 * already-fired alarm instead of jumping to tomorrow. Native enforcement needs
 * that timestamp to keep Rise Guard active until its configured end.
 */
export function relevantAlarmOccurrenceMs(
  timeStr: string,
  riseLockMinutesAfter: number,
  from: Date = new Date(),
): number {
  const target = parseHM(timeStr);
  const occurrence = new Date(from);
  occurrence.setHours(Math.floor(target / 60), target % 60, 0, 0);

  const elapsed = from.getTime() - occurrence.getTime();
  const riseWindowMs = Math.max(0, riseLockMinutesAfter) * 60_000;
  if (elapsed <= 0 || elapsed < riseWindowMs) return occurrence.getTime();

  occurrence.setDate(occurrence.getDate() + 1);
  return occurrence.getTime();
}
