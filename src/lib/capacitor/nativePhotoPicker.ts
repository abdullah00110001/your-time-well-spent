/**
 * nativePhotoPicker — Android system photo picker bridge.
 *
 * The system picker (ACTION_PICK_IMAGES, Android 13+) needs no runtime
 * permission, which is why wallpaper selection prefers it over Capacitor
 * Camera: asking for the obsolete READ_MEDIA_IMAGES grant was the reason
 * picking a wallpaper silently failed on many devices.
 */
import { registerPlugin, Capacitor } from '@capacitor/core';

interface PhotoPickerPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  pickImage(): Promise<{ cancelled: boolean; dataUrl?: string }>;
}

const Plugin = registerPlugin<PhotoPickerPlugin>('PhotoPicker');

const isAndroidNative =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

export async function systemPhotoPickerAvailable(): Promise<boolean> {
  if (!isAndroidNative) return false;
  try {
    const res = await Plugin.isAvailable();
    return !!res?.available;
  } catch {
    return false;
  }
}

export type PickResult =
  | { status: 'picked'; dataUrl: string }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

export async function pickImageWithSystemPicker(): Promise<PickResult> {
  if (!isAndroidNative) return { status: 'unavailable' };
  try {
    const res = await Plugin.pickImage();
    if (res?.cancelled) return { status: 'cancelled' };
    if (res?.dataUrl) return { status: 'picked', dataUrl: res.dataUrl };
    return { status: 'error', message: 'Empty result from photo picker' };
  } catch (e: any) {
    const msg = String(e?.message ?? e ?? '');
    if (/not implemented|unimplemented|unavailable/i.test(msg)) {
      return { status: 'unavailable' };
    }
    return { status: 'error', message: msg };
  }
}
