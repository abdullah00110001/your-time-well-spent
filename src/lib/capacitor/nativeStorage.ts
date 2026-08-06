// Native Persistent Storage Bridge for Capacitor
import { Preferences } from '@capacitor/preferences';
import { isNative } from './platform';

// Set a value
export async function setItem(key: string, value: string): Promise<void> {
  if (!isNative) {
    localStorage.setItem(key, value);
    return;
  }
  
  try {
    await Preferences.set({ key, value });
  } catch (error) {
    console.error('[Storage] Set item failed:', error);
    localStorage.setItem(key, value);
  }
}

// Get a value
export async function getItem(key: string): Promise<string | null> {
  if (!isNative) {
    return localStorage.getItem(key);
  }
  
  try {
    const result = await Preferences.get({ key });
    return result.value;
  } catch (error) {
    console.error('[Storage] Get item failed:', error);
    return localStorage.getItem(key);
  }
}

// Remove a value
export async function removeItem(key: string): Promise<void> {
  if (!isNative) {
    localStorage.removeItem(key);
    return;
  }
  
  try {
    await Preferences.remove({ key });
  } catch (error) {
    console.error('[Storage] Remove item failed:', error);
    localStorage.removeItem(key);
  }
}

// Clear all values
export async function clear(): Promise<void> {
  if (!isNative) {
    localStorage.clear();
    return;
  }
  
  try {
    await Preferences.clear();
  } catch (error) {
    console.error('[Storage] Clear failed:', error);
    localStorage.clear();
  }
}

// Get all keys
export async function keys(): Promise<string[]> {
  if (!isNative) {
    return Object.keys(localStorage);
  }
  
  try {
    const result = await Preferences.keys();
    return result.keys;
  } catch (error) {
    console.error('[Storage] Get keys failed:', error);
    return Object.keys(localStorage);
  }
}

// Set JSON value
export async function setJSON<T>(key: string, value: T): Promise<void> {
  const jsonString = JSON.stringify(value);
  await setItem(key, jsonString);
}

// Get JSON value
export async function getJSON<T>(key: string): Promise<T | null> {
  const jsonString = await getItem(key);
  if (!jsonString) return null;
  
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('[Storage] Parse JSON failed:', error);
    return null;
  }
}

// Migrate data from localStorage to Preferences (useful for PWA → native migration)
export async function migrateFromLocalStorage(): Promise<number> {
  if (!isNative) return 0;
  
  let migratedCount = 0;
  
  try {
    const localKeys = Object.keys(localStorage);
    
    for (const key of localKeys) {
      const value = localStorage.getItem(key);
      if (value) {
        await Preferences.set({ key, value });
        migratedCount++;
      }
    }
    
    console.log(`[Storage] Migrated ${migratedCount} items from localStorage`);
  } catch (error) {
    console.error('[Storage] Migration failed:', error);
  }
  
  return migratedCount;
}

// Typed storage helpers for common data
export const AppStorage = {
  // User preferences
  async getUserPreferences<T extends Record<string, any>>(): Promise<T | null> {
    return getJSON<T>('user_preferences');
  },
  
  async setUserPreferences<T extends Record<string, any>>(prefs: T): Promise<void> {
    await setJSON('user_preferences', prefs);
  },
  
  // Theme
  async getTheme(): Promise<'light' | 'dark' | 'system' | null> {
    return getItem('theme') as Promise<'light' | 'dark' | 'system' | null>;
  },
  
  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await setItem('theme', theme);
  },
  
  // Language
  async getLanguage(): Promise<string | null> {
    return getItem('language');
  },
  
  async setLanguage(lang: string): Promise<void> {
    await setItem('language', lang);
  },
  
  // Onboarding
  async isOnboardingComplete(): Promise<boolean> {
    const value = await getItem('onboarding_complete');
    return value === 'true';
  },
  
  async setOnboardingComplete(complete: boolean): Promise<void> {
    await setItem('onboarding_complete', complete.toString());
  },
  
  // Last sync timestamp
  async getLastSyncTime(): Promise<number | null> {
    const value = await getItem('last_sync_time');
    return value ? parseInt(value, 10) : null;
  },
  
  async setLastSyncTime(timestamp: number): Promise<void> {
    await setItem('last_sync_time', timestamp.toString());
  },
  
  // Push token
  async getPushToken(): Promise<string | null> {
    return getItem('push_token');
  },
  
  async setPushToken(token: string): Promise<void> {
    await setItem('push_token', token);
  },
  
  // Device ID
  async getDeviceId(): Promise<string | null> {
    return getItem('device_id');
  },
  
  async setDeviceId(id: string): Promise<void> {
    await setItem('device_id', id);
  },
};

// Offline queue for failed operations
export const OfflineQueue = {
  queueKey: 'offline_queue',
  
  async getQueue(): Promise<any[]> {
    return (await getJSON<any[]>(this.queueKey)) || [];
  },
  
  async addToQueue(operation: {
    type: string;
    data: any;
    timestamp: number;
    retries?: number;
  }): Promise<void> {
    const queue = await this.getQueue();
    queue.push({ ...operation, retries: operation.retries ?? 0 });
    await setJSON(this.queueKey, queue);
  },
  
  async removeFromQueue(index: number): Promise<void> {
    const queue = await this.getQueue();
    queue.splice(index, 1);
    await setJSON(this.queueKey, queue);
  },
  
  async clearQueue(): Promise<void> {
    await removeItem(this.queueKey);
  },
  
  async getQueueLength(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  },
};
