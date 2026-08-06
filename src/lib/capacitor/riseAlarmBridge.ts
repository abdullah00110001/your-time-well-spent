import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

// ============================================================
// PLUGIN INTERFACE — সব Java PluginMethod এর mirror
// ============================================================
export interface RisePluginType {
  // Permission
  canScheduleExactAlarms(): Promise<{ granted: boolean }>;
  openExactAlarmSettings(): Promise<void>;
  openBatterySettings(): Promise<void>;
  isBatteryOptimizationIgnored(): Promise<{ ignored: boolean }>;

  // Schedule
  scheduleAlarm(options: {
    id: number;
    timeInMillis: number;
    title: string;
    body: string;
    uuid: string;
    extraLoud?: boolean;
    soundUri?: string | null;  // ← NEW: custom ringtone URI
  }): Promise<{ success: boolean; id: number; uuid: string }>;
  cancelAlarm(options: { id: number }): Promise<void>;

  // Control
  stopRinging(): Promise<void>;

  // State reads
  getRingingAlarmId(): Promise<{ id: string | null }>;
  clearRingingAlarmId(): Promise<void>;
  isAlarmRinging(): Promise<{ ringing: boolean; uuid: string | null }>;  // NEW
  getSnoozeInfo(): Promise<{ count: number; max: number; canSnooze: boolean }>; // NEW
  getAlarmState(): Promise<{                                              // NEW
    isRinging: boolean;
    activeUuid: string | null;
    activeId: number;
    missionDone: boolean;
    snoozeCount: number;
    snoozeMax: number;
    canSnooze: boolean;
    triggerTime: number;
    durationMinutes: number;
    serviceRunning: boolean;
  }>;
}

const RisePlugin = registerPlugin<RisePluginType>('RiseAlarmPlugin');

export const isNativePlatform = Capacitor.isNativePlatform();
export const isAndroid = Capacitor.getPlatform() === 'android';

// ============================================================
// 🔔 NOTIFICATION CHANNEL
// ✅ EXPORTED — nativeAlarm.ts এ import হয়
// ============================================================
export const ensureNativeAlarmChannel = async (): Promise<void> => {
  if (!isNativePlatform || !isAndroid) return;
  try {
    await LocalNotifications.createChannel({
      id: 'rise_alarm_channel_v3',
      name: 'Rise Alarm',
      description: 'Mission-based wake-up alarm notifications',
      importance: 5,       // IMPORTANCE_MAX
      visibility: 1,       // VISIBILITY_PUBLIC
      vibration: true,
      lights: true,
      lightColor: '#FF6B00',
    });
  } catch (e) {
    console.error('[RiseBridge] channel create failed', e);
  }
};

// ============================================================
// 🔐 PERMISSIONS
// ============================================================
export const canScheduleExactAlarms = async (): Promise<boolean> => {
  if (!isNativePlatform || !isAndroid) return true;
  try {
    const res = await RisePlugin.canScheduleExactAlarms();
    return res.granted;
  } catch (e) {
    console.error('[RiseBridge] canScheduleExactAlarms failed', e);
    return false;
  }
};

export const openExactAlarmSettings = async (): Promise<void> => {
  if (!isNativePlatform || !isAndroid) return;
  try {
    await RisePlugin.openExactAlarmSettings();
  } catch (e) {
    console.error('[RiseBridge] openExactAlarmSettings failed', e);
  }
};

export const openBatterySettings = async (): Promise<void> => {
  if (!isNativePlatform || !isAndroid) return;
  try {
    await RisePlugin.openBatterySettings();
  } catch (e) {
    console.error('[RiseBridge] openBatterySettings failed', e);
  }
};

export const isBatteryOptimizationIgnored = async (): Promise<boolean> => {
  if (!isNativePlatform || !isAndroid) return true;
  try {
    const res = await RisePlugin.isBatteryOptimizationIgnored();
    return res.ignored;
  } catch (e) {
    console.error('[RiseBridge] isBatteryOptimizationIgnored failed', e);
    return false;
  }
};

// ============================================================
// 🔔 SCHEDULE
// ============================================================
export const scheduleRiseAlarm = async (
  id: number,
  timeInMillis: number,
  title: string,
  body: string,
  uuid: string,
  extraLoud = false,
  soundUri: string | null = null,
): Promise<boolean> => {
  if (!isNativePlatform) {
    console.log(`[RiseBridge-Web] Mock: id=${id} @ ${new Date(timeInMillis).toLocaleString()}`);
    return true;
  }
  try {
    await RisePlugin.scheduleAlarm({ id, timeInMillis, title, body, uuid, extraLoud, soundUri });
    console.log(`[RiseBridge] Scheduled id=${id} uuid=${uuid} extraLoud=${extraLoud} sound=${soundUri ?? 'default'}`);
    return true;
  } catch (e) {
    console.error('[RiseBridge] scheduleAlarm failed', e);
    return false;
  }
};

export const cancelRiseAlarm = async (id: number): Promise<boolean> => {
  if (!isNativePlatform) return true;
  try {
    await RisePlugin.cancelAlarm({ id });
    return true;
  } catch (e) {
    console.error('[RiseBridge] cancelAlarm failed', e);
    return false;
  }
};

// ============================================================
// 🔥 STOP RINGING
// ============================================================
let isStopping = false;

export const stopNativeRinging = async (): Promise<void> => {
  if (!isNativePlatform) return;
  if (isStopping) return;
  isStopping = true;
  try {
    await RisePlugin.stopRinging();
    console.log('[RiseBridge] stopRinging OK');
  } catch (e) {
    console.error('[RiseBridge] stopRinging failed', e);
  } finally {
    isStopping = false;
  }
};

// ============================================================
// 🧠 STATE
// ============================================================
export const getRingingAlarmId = async (): Promise<string | null> => {
  if (!isNativePlatform) return null;
  try {
    const res = await RisePlugin.getRingingAlarmId();
    return res.id ?? null;
  } catch (e) {
    console.error('[RiseBridge] getRingingAlarmId failed', e);
    return null;
  }
};

export const clearRingingAlarmId = async (): Promise<void> => {
  if (!isNativePlatform) return;
  try {
    await RisePlugin.clearRingingAlarmId();
  } catch (e) {
    console.error('[RiseBridge] clearRingingAlarmId failed', e);
  }
};

/** [NEW] Alarm বাজছে কিনা check করো */
export const isAlarmRinging = async (): Promise<boolean> => {
  if (!isNativePlatform) return false;
  try {
    const res = await RisePlugin.isAlarmRinging();
    return res.ringing;
  } catch (e) {
    console.error('[RiseBridge] isAlarmRinging failed', e);
    return false;
  }
};

/** [NEW] Snooze info */
export const getSnoozeInfo = async (): Promise<{
  count: number;
  max: number;
  canSnooze: boolean;
}> => {
  if (!isNativePlatform) return { count: 0, max: 3, canSnooze: true };
  try {
    return await RisePlugin.getSnoozeInfo();
  } catch (e) {
    console.error('[RiseBridge] getSnoozeInfo failed', e);
    return { count: 0, max: 3, canSnooze: true };
  }
};

/** [NEW] Full alarm state — debug + UI sync */
export const getAlarmState = async () => {
  if (!isNativePlatform) return null;
  try {
    return await RisePlugin.getAlarmState();
  } catch (e) {
    console.error('[RiseBridge] getAlarmState failed', e);
    return null;
  }
};

// ============================================================
// 🔄 MULTI-DAY RECURRING ALARMS
// ============================================================
export const scheduleNativeAlarmShots = async (
  uuid: string,
  time: string,
  daysOfWeek: number[],
  config: {
    title: string;
    body: string;
    missionType?: string;
    extraLoud?: boolean;
    soundUri?: string | null;  // ← NEW
  }
): Promise<boolean> => {
  if (!isNativePlatform) return true;
  try {
    await ensureNativeAlarmChannel();
    const [hours, minutes] = time.split(':').map(Number);
    const baseId = uuidToNumericId(uuid);
    const extraLoud = config.extraLoud ?? false;
    const soundUri = config.soundUri ?? null;

    for (let i = 0; i < 7; i++) {
      if (!daysOfWeek.includes(i)) continue;
      const nextDate = getNextDayOfWeek(i, hours, minutes);
      await RisePlugin.scheduleAlarm({
        id: baseId + i,
        timeInMillis: nextDate.getTime(),
        title: config.title,
        body: config.body,
        uuid: `${uuid}_day${i}`,
        extraLoud,
        soundUri,
      });
      console.log(`[RiseBridge] Scheduled day=${i} id=${baseId + i} sound=${soundUri ?? 'default'}`);
    }
    return true;
  } catch (e) {
    console.error('[RiseBridge] scheduleNativeAlarmShots failed', e);
    return false;
  }
};

export const cancelNativeAlarmShots = async (uuid: string): Promise<boolean> => {
  if (!isNativePlatform) return true;
  try {
    const baseId = uuidToNumericId(uuid);
    for (let i = 0; i < 7; i++) {
      await RisePlugin.cancelAlarm({ id: baseId + i });
    }
    return true;
  } catch (e) {
    console.error('[RiseBridge] cancelNativeAlarmShots failed', e);
    return false;
  }
};

// ============================================================
// 🔧 HELPERS
// ============================================================
export function uuidToNumericId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 90000; // max 90000 so base+6 stays < 100000
}

export function getNextDayOfWeek(dayOfWeek: number, hours: number, minutes: number): Date {
  const now    = new Date();
  const result = new Date();
  result.setHours(hours, minutes, 0, 0);
  const currentDay = now.getDay();
  let diff = dayOfWeek - currentDay;
  if (diff < 0 || (diff === 0 && result <= now)) diff += 7;
  result.setDate(now.getDate() + diff);
  return result;
}
