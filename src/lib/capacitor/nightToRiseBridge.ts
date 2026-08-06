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
  setRiseAlarm(options: { epochMillis: number }): Promise<void>;
  consumePendingBreak(): Promise<{ broke: boolean }>;
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
  async setRiseAlarm(epochMillis: number): Promise<void> {
    if (!isAndroid) return;
    try { await Plugin.setRiseAlarm({ epochMillis }); } catch (e) {
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
};
