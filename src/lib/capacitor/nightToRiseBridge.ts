/**
 * nightToRiseBridge — JS → native bridge for syncing Night-to-Rise config
 * into Android SharedPreferences, so the ShieldAccessibilityService can
 * enforce the lock at the OS level. Web/iOS: silent no-op.
 *
 * Native plugin name: `NightToRise` with methods setConfig({ json }),
 * setRiseAlarm({ epochMillis }), and consumePendingBreak() [NEW].
 */

import { registerPlugin, Capacitor } from '@capacitor/core';
import type { NightToRiseConfig } from '@/components/rise/night-to-rise/types';

interface NightToRiseNativePlugin {
  setConfig(options: { json: string }): Promise<void>;
  setRiseAlarm(options: { epochMillis: number; days?: number[] }): Promise<void>;
  consumePendingBreak(): Promise<{ broke: boolean }>;
  getStatus(): Promise<NativeLockStatus>;
  getDiagnostics(): Promise<NativeDiagnostics>;
}

/** Live self-test of the native enforcement chain. */
export interface NativeDiagnostics {
  enabled: boolean;
  configured: boolean;
  phase: string;
  locking: boolean;
  endTimeMs: number;
  sleepGuardEnabled: boolean;
  riseGuardEnabled: boolean;
  sleepTime: string;
  riseAlarmMs: number;
  allowedCount: number;
  accessibilityEnabled: boolean;
  accessibilityConnected: boolean;
  overlayGranted: boolean;
  guardServiceSynced: boolean;
  guardServiceRunning: boolean;
  lastPhase: string;
  lastLocking: boolean;
  lastForegroundPackage: string | null;
  lastGuardPassAt: number;
  lastUsageAccess: boolean;
  lastBlockAt: number;
  lastBlockedPkg: string | null;
  lastError: string | null;
}

export interface NativeLockStatus {
  enabled: boolean;
  phase: 'OFF' | 'ARMED' | 'SLEEP_LOCK' | 'RISE_LOCK' | 'PAUSED' | 'INACTIVE_DAY';
  locking: boolean;
  endTimeMs: number;
  accessibilityEnabled: boolean;
}

const Plugin = registerPlugin<NightToRiseNativePlugin>('NightToRise');

const isAndroid = Capacitor.getPlatform() === 'android';

export const nightToRiseBridge = {
  async setConfig(cfg: NightToRiseConfig): Promise<void> {
    if (!isAndroid) return;
    try { await Plugin.setConfig({ json: JSON.stringify(cfg) }); } catch (e) {
      console.warn('[NightToRise bridge] setConfig failed', e);
    }
  },
  /**
   * @param days weekdays (0=Sun..6=Sat) the alarm actually rings on. Empty
   * means daily. Rise Guard must never lock a morning with no alarm.
   */
  async setRiseAlarm(epochMillis: number, days: number[] = []): Promise<void> {
    if (!isAndroid) return;
    try { await Plugin.setRiseAlarm({ epochMillis, days }); } catch (e) {
      console.warn('[NightToRise bridge] setRiseAlarm failed', e);
    }
  },
  /**
   * NEW: check whether the native block screen's "Emergency unlock" was
   * tapped since the last check. Call on app mount + on resume (visibility
   * change) so a break taken while the app wasn't in the foreground still
   * gets recorded against the streak.
   */
  async consumePendingBreak(): Promise<boolean> {
    if (!isAndroid) return false;
    try {
      const res = await Plugin.consumePendingBreak();
      return res.broke;
    } catch (e) {
      console.warn('[NightToRise bridge] consumePendingBreak failed', e);
      return false;
    }
  },
  /** Real native enforcement state — reflects what the OS is actually doing. */
  async getStatus(): Promise<NativeLockStatus | null> {
    if (!isAndroid) return null;
    try {
      return await Plugin.getStatus();
    } catch (e) {
      console.warn('[NightToRise bridge] getStatus failed', e);
      return null;
    }
  },
  /**
   * Full enforcement self-test. Also self-heals on the native side by
   * re-syncing the background guard service before reporting.
   */
  async getDiagnostics(): Promise<NativeDiagnostics | null> {
    if (!isAndroid) return null;
    try {
      return await Plugin.getDiagnostics();
    } catch (e) {
      console.warn('[NightToRise bridge] getDiagnostics failed', e);
      return null;
    }
  },
};
