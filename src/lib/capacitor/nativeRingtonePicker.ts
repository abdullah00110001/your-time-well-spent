import { isNative } from './platform';
import { registerPlugin } from '@capacitor/core';

/**
 * Native Android RingtoneManager bridge.
 *
 * Resolves to the system ringtone picker on Android. Falls back to null on web.
 * The native side (NativeRingtonePickerPlugin.java) opens
 * RingtoneManager.ACTION_RINGTONE_PICKER and returns the selected
 * content:// URI + display title.
 */
interface NativeRingtonePickerPlugin {
  pick(options?: { title?: string; existingUri?: string | null }): Promise<{
    uri: string | null;
    title: string | null;
  }>;
  listSystemRingtones(): Promise<{
    ringtones: Array<{ uri: string; title: string }>;
  }>;
}

const NativeRingtonePicker = registerPlugin<NativeRingtonePickerPlugin>('NativeRingtonePicker');

export async function pickDeviceRingtone(opts?: {
  title?: string;
  existingUri?: string | null;
}): Promise<{ uri: string; title: string } | null> {
  if (!isNative) return null;
  try {
    const res = await NativeRingtonePicker.pick({
      title: opts?.title ?? 'Choose alarm sound',
      existingUri: opts?.existingUri ?? null,
    });
    if (!res?.uri) return null;
    return { uri: res.uri, title: res.title ?? 'Device ringtone' };
  } catch (e) {
    console.warn('[NativeRingtonePicker] pick failed:', e);
    return null;
  }
}

export async function listDeviceRingtones(): Promise<Array<{ uri: string; title: string }>> {
  if (!isNative) return [];
  try {
    const res = await NativeRingtonePicker.listSystemRingtones();
    return res?.ringtones ?? [];
  } catch (e) {
    console.warn('[NativeRingtonePicker] list failed:', e);
    return [];
  }
}
