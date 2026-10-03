/**
 * Sleep to Rise enforcement via Shield's native time-based lock.
 * JS computes the next 7 nights' absolute lock windows and hands them to
 * ShieldLockScheduler, which starts/ends blocking on time with AlarmManager —
 * even when the app is fully closed or after a reboot.
 */
import { Capacitor } from '@capacitor/core';
import ShieldPlugin from '@/lib/capacitor/shieldPlugin';
import { log } from '@/lib/logger';

const USER_LIST_KEY = 'shield_blocked_apps_v2';
const LEGACY_ACTIVE_KEY = 'n2r_shield_lock_active';

// Never hand these to Shield, even if not in the allowed list.
const NEVER_BLOCK = [
  'launcher', 'systemui', 'settings', 'dialer', 'telecom', 'emergency', 'incallui',
  'inputmethod', 'keyboard', 'permissioncontroller', 'packageinstaller', 'deskclock',
  'clock', 'phone', 'contacts', 'mms', 'messaging', 'safecenter',
];

export interface LockWindow { start: number; end: number; kind: 'sleep' | 'rise' }

const isNative = () => Capacitor.getPlatform() === 'android';

function userList(): string[] {
  try { return JSON.parse(localStorage.getItem(USER_LIST_KEY) || '[]'); } catch { return []; }
}

/** Restore the user's Shield list if an old in-app lock was left behind. */
async function cleanupLegacy(): Promise<void> {
  if (localStorage.getItem(LEGACY_ACTIVE_KEY) !== '1') return;
  try {
    await ShieldPlugin.blockApps({ apps: userList() });
    localStorage.removeItem(LEGACY_ACTIVE_KEY);
    log('INFO', 'N2R', 'legacy stuck lock cleaned, user list restored');
  } catch (e) { log('WARN', 'N2R', 'legacy cleanup failed', e); }
}

let lastSig = '';

export async function scheduleN2RLock(
  allowed: string[], windows: LockWindow[], sleepMessage: string, riseMessage: string,
): Promise<void> {
  if (!isNative()) return;
  await cleanupLegacy();
  if (!windows.length) { await clearN2RLock(); return; }
  const sig = JSON.stringify([allowed, windows, sleepMessage, riseMessage, userList()]);
  if (sig === lastSig) return;
  try {
    const selfId = (await (await import('@capacitor/app')).App.getInfo()).id;
    const { apps } = await ShieldPlugin.getInstalledApps({ icons: false });
    const allow = new Set([...allowed, selfId]);
    const lockApps = apps
      .map((a) => a.packageName)
      .filter((p) => !allow.has(p) && !NEVER_BLOCK.some((k) => p.toLowerCase().includes(k)));
    await ShieldPlugin.scheduleTimedLock({ lockApps, userApps: userList(), windows, sleepMessage, riseMessage });
    lastSig = sig;
    log('INFO', 'N2R', `scheduled ${windows.length} windows, ${lockApps.length} lock apps`);
  } catch (e) {
    log('ERROR', 'N2R', 'schedule failed', e);
  }
}

export async function clearN2RLock(): Promise<void> {
  if (!isNative()) return;
  await cleanupLegacy();
  if (lastSig === 'cleared') return;
  try {
    await ShieldPlugin.clearTimedLock();
    lastSig = 'cleared';
    log('INFO', 'N2R', 'schedule cleared');
  } catch (e) { log('WARN', 'N2R', 'clear failed', e); }
}
