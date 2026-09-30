/**
 * Sleep to Rise enforcement via the existing Shield blocking system.
 * No Sleep-to-Rise native code is used: during a lock window we hand Shield
 * a block list (user's own Shield apps + every installed non-allowed app),
 * and when the window ends we restore the user's original Shield list.
 * Shield's own block screen is shown for blocked apps.
 */
import { Capacitor } from '@capacitor/core';
import ShieldPlugin from '@/lib/capacitor/shieldPlugin';

const USER_LIST_KEY = 'shield_blocked_apps_v2';
const ACTIVE_KEY = 'n2r_shield_lock_active';

// Never hand these to Shield, even if not in the allowed list.
const NEVER_BLOCK = [
  'launcher', 'systemui', 'settings', 'dialer', 'telecom', 'emergency', 'incallui',
  'inputmethod', 'keyboard', 'permissioncontroller', 'packageinstaller', 'deskclock',
  'clock', 'phone', 'contacts', 'mms', 'messaging', 'safecenter',
];

const isNative = () => Capacitor.getPlatform() === 'android';

function userList(): string[] {
  try { return JSON.parse(localStorage.getItem(USER_LIST_KEY) || '[]'); } catch { return []; }
}

export async function applyN2RLock(allowed: string[]): Promise<void> {
  if (!isNative()) return;
  try {
    const self = (await import('@capacitor/app')).App;
    const selfId = (await self.getInfo()).id;
    const { apps } = await ShieldPlugin.getInstalledApps({ icons: false });
    const allow = new Set([...allowed, selfId]);
    const lockList = apps
      .map((a) => a.packageName)
      .filter((p) => !allow.has(p) && !NEVER_BLOCK.some((k) => p.toLowerCase().includes(k)));
    const merged = Array.from(new Set([...userList(), ...lockList]));
    await ShieldPlugin.blockApps({ apps: merged });
    try { await ShieldPlugin.enable(); } catch { /* already on */ }
    localStorage.setItem(ACTIVE_KEY, '1');
  } catch (e) {
    console.warn('[N2R→Shield] apply failed', e);
  }
}

export async function releaseN2RLock(): Promise<void> {
  if (!isNative()) return;
  if (localStorage.getItem(ACTIVE_KEY) !== '1') return;
  try {
    await ShieldPlugin.blockApps({ apps: userList() });
    localStorage.removeItem(ACTIVE_KEY);
  } catch (e) {
    console.warn('[N2R→Shield] release failed', e);
  }
}
