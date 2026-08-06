import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { Haptics } from '@capacitor/haptics';
import {
  scheduleNativeAlarmShots,
  cancelNativeAlarmShots,
  canScheduleExactAlarms,
  ensureNativeAlarmChannel,
} from './riseAlarmBridge';

export interface AlarmConfig {
  id: number;
  title: string;
  body: string;
  scheduledAt: Date;
  missionType: 'photo' | 'math' | 'shake' | 'qr' | 'memory' | 'typing' | 'walking' | 'squat' | 'breath_hold' | 'morning_intention' | 'stand_detection' | 'none';
  snoozeMinutes?: number;
  alarmDbId?: string;
  intention?: string;
  whoDepends?: string;
  isGroupAlarm?: boolean;
  groupId?: string;
  extraLoud?: boolean;
  soundUri?: string | null;   // ← NEW: device/custom ringtone URI
}

export type AlarmNotification = LocalNotificationSchema;

const ALARM_STORAGE_KEY = 'scheduled_alarms';
const RISE_ALARM_CHANNEL_ID = 'rise_alarm_native_v2';

let listenersRegistered = false;

export function uuidToNumericId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 100000;
}

export const initializeAlarmChannel = async (): Promise<void> => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await ensureNativeAlarmChannel();
    await registerAlarmActions();
    console.log('[nativeAlarm] Alarm channel initialized successfully');
  } catch (error) {
    console.error('[nativeAlarm] Failed to initialize channel', error);
  }
};

export async function checkAllAlarmPermissions() {
  if (!Capacitor.isNativePlatform()) {
    return { notifications: true, exactAlarm: true };
  }
  const notifPerm = await LocalNotifications.checkPermissions();
  const exactAlarm = await canScheduleExactAlarms();
  return {
    notifications: notifPerm.display === 'granted',
    exactAlarm,
  };
}

export async function checkAlarmPermission(): Promise<boolean> {
  const perms = await checkAllAlarmPermissions();
  return perms.notifications && perms.exactAlarm;
}

export async function requestAllAlarmPermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  const notifPerm = await LocalNotifications.requestPermissions();
  return notifPerm.display === 'granted';
}

export async function requestAlarmPermission(): Promise<boolean> {
  return requestAllAlarmPermissions();
}

export async function registerAlarmActions(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'ALARM_ACTIONS',
          actions: [
            { id: 'dismiss', title: 'Dismiss' },
            { id: 'snooze', title: 'Snooze' },
          ],
        },
      ],
    });
  } catch (error) {
    console.error('Failed to register alarm actions', error);
  }
}

export async function scheduleAlarm(config: AlarmConfig): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('Web alarm scheduled', config);
    return true;
  }
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: config.id,
          title: config.title,
          body: config.body,
          schedule: { at: config.scheduledAt, allowWhileIdle: true },
          channelId: RISE_ALARM_CHANNEL_ID,
          actionTypeId: 'ALARM_ACTIONS',
          extra: {
            missionType: config.missionType,
            snoozeMinutes: config.snoozeMinutes || 5,
            alarmDbId: config.alarmDbId,
            originalId: config.id,
            intention: config.intention,
            whoDepends: config.whoDepends,
            isGroupAlarm: config.isGroupAlarm,
            groupId: config.groupId,
            extraLoud: config.extraLoud ?? false,  // ← NEW
          },
          autoCancel: false,
          ongoing: true,
        },
      ],
    });
    await saveAlarmToStorage(config);
    return true;
  } catch (error) {
    console.error('Schedule alarm failed', error);
    return false;
  }
}

export async function scheduleRecurringAlarm(
  uuid: string,
  time: string,
  daysOfWeek: number[],
  config: Omit<AlarmConfig, 'id' | 'scheduledAt'>,
): Promise<boolean> {
  const [hours, minutes] = time.split(':').map(Number);
  const baseId = uuidToNumericId(uuid);
  await cancelAlarmByUuid(uuid);

  if (Capacitor.isNativePlatform()) {
    await scheduleNativeAlarmShots(uuid, time, daysOfWeek, {
      title: config.title,
      body: config.body,
      missionType: config.missionType,
      extraLoud: config.extraLoud ?? false,
      soundUri: config.soundUri ?? null,
    });
    return true;
  }

  for (let i = 0; i < 7; i += 1) {
    if (!daysOfWeek.includes(i)) continue;
    const nextDate = getNextDayOfWeek(i, hours, minutes);
    const success = await scheduleAlarm({
      id: baseId + i,
      ...config,
      scheduledAt: nextDate,
    });
    if (!success) return false;
  }
  return true;
}

export async function cancelAlarm(id: number): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    await LocalNotifications.cancel({ notifications: [{ id }] });
    return true;
  } catch (error) {
    console.error('Cancel alarm failed', error);
    return false;
  }
}

export async function cancelAlarmByUuid(uuid: string): Promise<boolean> {
  const baseId = uuidToNumericId(uuid);
  const ids = Array.from({ length: 7 }, (_, i) => ({ id: baseId + i }));
  try {
    if (Capacitor.isNativePlatform()) {
      await LocalNotifications.cancel({ notifications: ids });
      await cancelNativeAlarmShots(uuid);
    }
    await removeAlarmFromStorage(baseId);
    return true;
  } catch (error) {
    console.error('Cancel alarm by uuid failed', error);
    return false;
  }
}

export async function cancelAllAlarms(): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id })),
        });
      }
    }
    await Preferences.remove({ key: ALARM_STORAGE_KEY });
    return true;
  } catch (error) {
    console.error('Cancel all alarms failed', error);
    return false;
  }
}

export async function snoozeAlarm(id: number, minutes = 5): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    const pending = await LocalNotifications.getPending();
    const existing = pending.notifications.find((n) => n.id === id);
    await cancelAlarm(id);
    const nextAt = new Date(Date.now() + minutes * 60 * 1000);
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: existing?.title || 'Rise Alarm',
          body: existing?.body || 'Time to wake up!',
          schedule: { at: nextAt, allowWhileIdle: true },
          channelId: RISE_ALARM_CHANNEL_ID,
          actionTypeId: 'ALARM_ACTIONS',
          extra: { ...(existing?.extra || {}), snoozed: true },
          autoCancel: false,
          ongoing: true,
        },
      ],
    });
    return true;
  } catch (error) {
    console.error('Snooze alarm failed', error);
    return false;
  }
}

export async function dismissAlarm(id: number, userId?: string): Promise<boolean> {
  if (userId) console.log('Dismiss alarm for user', userId);
  return cancelAlarm(id);
}

export async function getPendingAlarms() {
  if (!Capacitor.isNativePlatform()) return [];
  const result = await LocalNotifications.getPending();
  return result.notifications;
}

export async function triggerAlarmVibration(): Promise<boolean> {
  try {
    await Haptics.vibrate({ duration: 800 });
    return true;
  } catch (error) {
    console.error('Alarm vibration failed', error);
    return false;
  }
}

export function setupAlarmListeners(
  onTriggered: (alarmId: number, extra?: Record<string, any>) => void,
  onAction: (alarmId: number, action: string) => void,
): void {
  if (!Capacitor.isNativePlatform() || listenersRegistered) return;
  listenersRegistered = true;
  LocalNotifications.addListener('localNotificationReceived', (notification) => {
    onTriggered(notification.id, notification.extra as Record<string, any> | undefined);
  });
  LocalNotifications.addListener('localNotificationActionPerformed', (result) => {
    onAction(result.notification.id, result.actionId);
  });
}

export async function restoreAlarmsOnBoot() {
  if (!Capacitor.isNativePlatform()) return;
  App.addListener('appStateChange', async ({ isActive }) => {
    if (!isActive) return;
    const stored = await Preferences.get({ key: ALARM_STORAGE_KEY });
    if (!stored.value) return;
    const alarms: AlarmConfig[] = JSON.parse(stored.value);
    const now = new Date();
    for (const alarm of alarms) {
      const scheduledAt = new Date(alarm.scheduledAt);
      if (scheduledAt > now) {
        await scheduleAlarm({ ...alarm, scheduledAt });
      }
    }
  });
}

export async function rescheduleAllAlarmsAfterBoot(userId?: string): Promise<void> {
  if (userId) console.log('Rescheduling alarms for user', userId);
  await restoreAlarmsOnBoot();
}

function getNextDayOfWeek(dayOfWeek: number, hours: number, minutes: number): Date {
  const now = new Date();
  const result = new Date();
  result.setHours(hours, minutes, 0, 0);
  const currentDay = now.getDay();
  let diff = dayOfWeek - currentDay;
  if (diff < 0 || (diff === 0 && result <= now)) diff += 7;
  result.setDate(now.getDate() + diff);
  return result;
}

async function saveAlarmToStorage(config: AlarmConfig) {
  const stored = await Preferences.get({ key: ALARM_STORAGE_KEY });
  const alarms: AlarmConfig[] = stored.value ? JSON.parse(stored.value) : [];
  const index = alarms.findIndex((a) => a.id === config.id);
  const next = { ...config, scheduledAt: new Date(config.scheduledAt) as unknown as Date };
  if (index >= 0) alarms[index] = next;
  else alarms.push(next);
  await Preferences.set({ key: ALARM_STORAGE_KEY, value: JSON.stringify(alarms) });
}

async function removeAlarmFromStorage(baseId: number) {
  const stored = await Preferences.get({ key: ALARM_STORAGE_KEY });
  if (!stored.value) return;
  const alarms: AlarmConfig[] = JSON.parse(stored.value);
  const filtered = alarms.filter(
    (a) => !Array.from({ length: 7 }, (_, i) => baseId + i).includes(a.id),
  );
  await Preferences.set({ key: ALARM_STORAGE_KEY, value: JSON.stringify(filtered) });
}
