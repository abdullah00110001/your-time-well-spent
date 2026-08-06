import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

/**
 * Opens the OS-level app settings page so the user can manually
 * grant a permission that they previously denied.
 */
export async function openAppSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    toast.info('Open your browser settings to manage permissions');
    return;
  }

  try {
    const { Browser } = await import('@capacitor/browser');
    // 'app-settings:' URI ক্যাপাসিটরে Android এবং iOS দুটিতেই কাজ করে
    await Browser.open({ url: 'app-settings:' });
    return;
  } catch (e) {
    console.warn('[openAppSettings] Browser open failed:', e);
  }

  toast.error('Could not open settings. Please open them manually from your device.');
}

/**
 * Show a standardized "permission denied" toast with an
 * action button that opens app settings.
 */
export function showPermissionDeniedToast(opts: {
  feature: string; // e.g. "Notifications", "Camera"
  reason: string;  // why the app needs it
}) {
  toast.error(`${opts.feature} permission denied`, {
    description: opts.reason,
    duration: 8000,
    action: {
      label: 'Open Settings',
      onClick: () => { openAppSettings(); },
    },
  });
}
