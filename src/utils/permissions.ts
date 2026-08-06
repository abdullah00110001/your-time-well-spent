import { Capacitor } from '@capacitor/core';
import Shield from '@/lib/capacitor/shieldPlugin';

const isAndroid = () => Capacitor.getPlatform() === 'android';

/**
 * Open Android Accessibility Settings (for Shield AccessibilityService).
 */
export const openAccessibilitySettings = async () => {
  if (!isAndroid()) {
    alert('This feature is only available on Android.');
    return;
  }
  try {
    await Shield.requestAccessibility();
  } catch (e) {
    console.error('[Permissions] openAccessibilitySettings failed:', e);
  }
};

/**
 * Open Android Battery Optimization settings (used as the safe entry point
 * for "advanced device protection" since Device Admin must be enabled by
 * the user explicitly through their own flow).
 */
export const openDeviceAdminSettings = async () => {
  if (!isAndroid()) {
    alert('This feature is only available on Android.');
    return;
  }
  try {
    await Shield.requestBattery();
  } catch (e) {
    console.error('[Permissions] openDeviceAdminSettings failed:', e);
  }
};

/**
 * Open Android Usage Access Settings (required by Shield to read app usage).
 */
export const openUsageAccessSettings = async () => {
  if (!isAndroid()) return;
  try {
    await Shield.requestUsageStats();
  } catch (e) {
    console.error('[Permissions] openUsageAccessSettings failed:', e);
  }
};
