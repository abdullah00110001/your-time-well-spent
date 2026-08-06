import { registerPlugin } from '@capacitor/core';

export interface AppUpdatePlugin {
  downloadAndInstall(options: { url: string; fileName?: string }): Promise<{ success: boolean; message: string }>;
  getDownloadProgress(): Promise<{ progress: number; bytesDownloaded?: number; bytesTotal?: number; status: string }>;
  addListener(eventName: 'updateProgress', listenerFunc: (data: { status: string; message?: string; downloadId?: number }) => void): Promise<{ remove: () => void }>;
}

export const AppUpdate = registerPlugin<AppUpdatePlugin>('AppUpdate');
