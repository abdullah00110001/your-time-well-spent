import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import Shield from './shieldPlugin';
import { canScheduleExactAlarms, openExactAlarmSettings } from './riseAlarmBridge';
import { openAppSettings as openNativeAppSettings } from './openAppSettings';

const isNative = Capacitor.isNativePlatform();
const isAndroid = Capacitor.getPlatform() === 'android';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface PermissionState {
  notifications: PermissionStatus;
  exactAlarm: PermissionStatus;
  usageStats: PermissionStatus;
  overlay: PermissionStatus;
  battery: PermissionStatus;
  accessibility: PermissionStatus;
  deviceAdmin: PermissionStatus; // 🟢 Added
}

const normalizePermission = (value?: string | null): PermissionStatus => {
  if (value === 'granted') return 'granted';
  if (value === 'denied') return 'denied';
  if (value === 'prompt' || value === 'prompt-with-rationale') return 'prompt';
  return 'unknown';
};

export const checkNotificationPermission = async (): Promise<PermissionStatus> => {
  if (!isNative) {
    if (typeof Notification === 'undefined') return 'unknown';
    return normalizePermission(Notification.permission);
  }

  try {
    const status = await LocalNotifications.checkPermissions();
    return normalizePermission(status.display);
  } catch (error) {
    console.error('[Permissions] Notification check failed', error);
    return 'unknown';
  }
};

export const requestNotificationPermission = async (): Promise<PermissionStatus> => {
  if (!isNative) {
    if (typeof Notification === 'undefined') return 'unknown';
    return normalizePermission(await Notification.requestPermission());
  }

  try {
    const status = await LocalNotifications.requestPermissions();
    return normalizePermission(status.display);
  } catch (error) {
    console.error('[Permissions] Notification request failed', error);
    return 'denied';
  }
};

export const checkPushPermission = async (): Promise<PermissionStatus> => {
  if (!isNative) return 'unknown';

  try {
    const status = await PushNotifications.checkPermissions();
    return normalizePermission(status.receive);
  } catch (error) {
    console.error('[Permissions] Push permission check failed', error);
    return 'unknown';
  }
};

export const requestPushPermission = async (): Promise<PermissionStatus> => {
  if (!isNative) return 'unknown';

  try {
    const status = await PushNotifications.requestPermissions();
    const permission = normalizePermission(status.receive);

    if (permission === 'granted') {
      await PushNotifications.register();
    }

    return permission;
  } catch (error) {
    console.error('[Permissions] Push permission request failed', error);
    return 'denied';
  }
};

export const checkExactAlarmPermission = async (): Promise<PermissionStatus> => {
  if (!isAndroid) return 'granted';

  try {
    return (await canScheduleExactAlarms()) ? 'granted' : 'prompt';
  } catch (error) {
    console.error('[Permissions] Exact alarm check failed', error);
    return 'unknown';
  }
};

export const requestExactAlarmPermission = async (): Promise<PermissionStatus> => {
  if (!isAndroid) return 'granted';

  try {
    if (await canScheduleExactAlarms()) {
      return 'granted';
    }

    await openExactAlarmSettings();
    return 'prompt';
  } catch (error) {
    console.error('[Permissions] Exact alarm request failed', error);
    return 'denied';
  }
};

export const checkUsageStatsPermission = async (): Promise<PermissionStatus> => {
  if (!isAndroid) return 'granted';

  try {
    const { usageStats } = await Shield.checkPermissions();
    return usageStats ? 'granted' : 'prompt';
  } catch (error) {
    console.error('[Permissions] Usage stats check failed', error);
    return 'unknown';
  }
};

export const requestUsageStatsPermission = async (): Promise<PermissionStatus> => {
  if (!isAndroid) return 'granted';

  try {
    await Shield.requestUsageStats();
    return 'prompt';
  } catch (error) {
    console.error('[Permissions] Usage stats request failed', error);
    return 'denied';
  }
};

export const checkOverlayPermission = async (): Promise<PermissionStatus> => {
  if (!isAndroid) return 'granted';

  try {
    const { overlay } = await Shield.checkPermissions();
    return overlay ? 'granted' : 'prompt';
  } catch (error) {
    console.error('[Permissions] Overlay check failed', error);
    return 'unknown';
  }
};

export const requestOverlayPermission = async (): Promise<PermissionStatus> => {
  if (!isAndroid) return 'granted';

  try {
    await Shield.requestOverlay();
    return 'prompt';
  } catch (error) {
    console.error('[Permissions] Overlay request failed', error);
    return 'denied';
  }
};

export const checkBatteryPermission = async (): Promise<PermissionStatus> => {
  if (!isAndroid) return 'granted';

  try {
    const { battery } = await Shield.checkPermissions();
    return battery ? 'granted' : 'prompt';
  } catch (error) {
    console.error('[Permissions] Battery optimization check failed', error);
    return 'unknown';
  }
};

export const requestBatteryPermission = async (): Promise<PermissionStatus> => {
  if (!isAndroid) return 'granted';

  try {
    await Shield.requestBattery();
    return 'prompt';
  } catch (error) {
    console.error('[Permissions] Battery optimization request failed', error);
    return 'denied';
  }
};

export const checkAccessibilityPermission = async (): Promise<PermissionStatus> => {
  if (!isAndroid) return 'granted';

  try {
    const { accessibility } = await Shield.checkPermissions();
    return accessibility ? 'granted' : 'prompt';
  } catch (error) {
    console.error('[Permissions] Accessibility check failed', error);
    return 'unknown';
  }
};

export const requestAccessibilityPermission = async (): Promise<PermissionStatus> => {
  if (!isAndroid) return 'granted';

  try {
    await Shield.requestAccessibility();
    return 'prompt';
  } catch (error) {
    console.error('[Permissions] Accessibility request failed', error);
    return 'denied';
  }
};

// 🟢 Device Admin — DNS lock + uninstall prevention
export const checkDeviceAdminPermission = async (): Promise<PermissionStatus> => {
  if (!isAndroid) return 'granted';

  try {
    const { deviceAdmin } = await Shield.checkPermissions();
    return deviceAdmin ? 'granted' : 'prompt';
  } catch (error) {
    console.error('[Permissions] Device Admin check failed', error);
    return 'unknown';
  }
};

export const requestDeviceAdminPermission = async (): Promise<PermissionStatus> => {
  if (!isAndroid) return 'granted';

  try {
    await Shield.requestDeviceAdmin();
    return 'prompt';
  } catch (error) {
    console.error('[Permissions] Device Admin request failed', error);
    return 'denied';
  }
};

export const openAppSettings = openNativeAppSettings;

export const openUsageStatsSettings = async (): Promise<void> => {
  if (!isAndroid) return;
  await Shield.requestUsageStats();
};

export const openBatterySettings = async (): Promise<void> => {
  if (!isAndroid) return;
  await Shield.requestBattery();
};

export const getAllPermissions = async (): Promise<PermissionState> => {
  const [notifications, exactAlarm, usageStats, overlay, battery, accessibility, deviceAdmin] =
    await Promise.all([
      checkNotificationPermission(),
      checkExactAlarmPermission(),
      checkUsageStatsPermission(),
      checkOverlayPermission(),
      checkBatteryPermission(),
      checkAccessibilityPermission(),
      checkDeviceAdminPermission(), // 🟢 Added
    ]);

  return { notifications, exactAlarm, usageStats, overlay, battery, accessibility, deviceAdmin };
};

export const hasRisePermissions = async (): Promise<boolean> => {
  const [notifications, exactAlarm] = await Promise.all([
    checkNotificationPermission(),
    checkExactAlarmPermission(),
  ]);

  return notifications === 'granted' && exactAlarm === 'granted';
};

export const hasShieldPermissions = async (): Promise<boolean> => {
  const [usageStats, overlay, accessibility, deviceAdmin] = await Promise.all([
    checkUsageStatsPermission(),
    checkOverlayPermission(),
    checkAccessibilityPermission(),
    checkDeviceAdminPermission(), // 🟢 Added
  ]);

  return (
    usageStats === 'granted' &&
    overlay === 'granted' &&
    accessibility === 'granted' &&
    deviceAdmin === 'granted'
  );
};

export const requestRisePermissions = async (): Promise<{
  notifications: PermissionStatus;
  exactAlarm: PermissionStatus;
}> => {
  const notifications = await requestNotificationPermission();
  const exactAlarm = await requestExactAlarmPermission();
  return { notifications, exactAlarm };
};

export const requestShieldPermissions = async (): Promise<{
  notifications: PermissionStatus;
  usageStats: PermissionStatus;
  overlay: PermissionStatus;
  accessibility: PermissionStatus;
  battery: PermissionStatus;
  deviceAdmin: PermissionStatus; // 🟢 Added
}> => {
  const notifications = await requestNotificationPermission();
  const usageStats = await requestUsageStatsPermission();
  const overlay = await requestOverlayPermission();
  const accessibility = await requestAccessibilityPermission();
  const battery = await requestBatteryPermission();
  const deviceAdmin = await requestDeviceAdminPermission(); // 🟢 Added

  return { notifications, usageStats, overlay, accessibility, battery, deviceAdmin };
};
