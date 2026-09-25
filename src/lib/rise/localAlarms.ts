/**
 * Cached accessor for the `local_alarms` localStorage blob.
 *
 * Every screen used to `JSON.parse(localStorage.getItem('local_alarms'))` on
 * each toggle / snooze / delete, which is synchronous main-thread work on a
 * screen that is also running audio + haptics. This keeps a single parsed
 * copy in memory and invalidates it on write (and on cross-tab changes).
 */

const KEY = 'local_alarms';

let cache: any[] | null = null;

export function readLocalAlarms(): any[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function writeLocalAlarms(list: any[]): void {
  cache = Array.isArray(list) ? list : [];
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('[localAlarms] persist failed', e);
  }
}

/** Mutate a single alarm in place and persist. Returns true when found. */
export function updateLocalAlarm(id: string, patch: Record<string, unknown>): boolean {
  const list = [...readLocalAlarms()];
  const idx = list.findIndex((a) => String(a?.id) === String(id));
  if (idx < 0) return false;
  list[idx] = { ...list[idx], ...patch };
  writeLocalAlarms(list);
  return true;
}

export function invalidateLocalAlarms(): void {
  cache = null;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY || e.key === null) invalidateLocalAlarms();
  });
  // Section 0.1 — the `storage` event never fires in the tab that wrote the
  // value, so a same-tab write (the alarm editor) used to leave this cache
  // stale and the newly saved alarm looked like it had not been saved.
  window.addEventListener('localAlarmsUpdated', invalidateLocalAlarms);
}
