// Offline Sync Manager for Capacitor App
import { supabase } from '@/integrations/supabase/client';
import { AppStorage, OfflineQueue } from './nativeStorage';
import { isConnected, setupNetworkListeners } from './nativeNetwork';

export interface SyncOperation {
  id: string;
  type: 'insert' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
  retries: number;
  status: 'pending' | 'syncing' | 'failed' | 'completed';
}

let isSyncing = false;
let syncListeners: ((status: SyncStatus) => void)[] = [];

export interface SyncStatus {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncTime: number | null;
  errors: string[];
}

// Get current sync status
export async function getSyncStatus(): Promise<SyncStatus> {
  const queue = await OfflineQueue.getQueue();
  const lastSync = await AppStorage.getLastSyncTime();
  
  return {
    isSyncing,
    pendingCount: queue.length,
    lastSyncTime: lastSync,
    errors: queue.filter(op => op.retries > 2).map(op => `Failed: ${op.type} to ${op.table}`),
  };
}

// Add operation to offline queue
export async function queueOfflineOperation(operation: {
  type: 'insert' | 'update' | 'delete';
  table: string;
  data: any;
}): Promise<void> {
  await OfflineQueue.addToQueue({
    type: `db_${operation.type}`,
    data: {
      table: operation.table,
      payload: operation.data,
    },
    timestamp: Date.now(),
    retries: 0,
  });
  
  // Try to sync immediately if online
  const online = await isConnected();
  if (online && !isSyncing) {
    syncPendingOperations();
  }
  
  notifyListeners();
}

// Process pending sync operations
export async function syncPendingOperations(): Promise<boolean> {
  if (isSyncing) return false;
  
  const online = await isConnected();
  if (!online) {
    console.log('[Sync] Offline, skipping sync');
    return false;
  }
  
  isSyncing = true;
  notifyListeners();
  
  try {
    const queue = await OfflineQueue.getQueue();
    
    if (queue.length === 0) {
      console.log('[Sync] No pending operations');
      isSyncing = false;
      notifyListeners();
      return true;
    }
    
    console.log(`[Sync] Processing ${queue.length} pending operations`);
    
    let successCount = 0;
    const failedOperations: any[] = [];
    
    for (let i = 0; i < queue.length; i++) {
      const operation = queue[i];
      
      try {
        await processOperation(operation);
        successCount++;
      } catch (error) {
        console.error('[Sync] Operation failed:', error);
        
        if (operation.retries < 3) {
          failedOperations.push({
            ...operation,
            retries: operation.retries + 1,
          });
        } else {
          console.error('[Sync] Operation exceeded max retries, discarding:', operation);
        }
      }
    }
    
    // Clear queue and re-add failed operations
    await OfflineQueue.clearQueue();
    for (const op of failedOperations) {
      await OfflineQueue.addToQueue(op);
    }
    
    // Update last sync time
    await AppStorage.setLastSyncTime(Date.now());
    
    console.log(`[Sync] Completed: ${successCount} success, ${failedOperations.length} failed`);
    
    isSyncing = false;
    notifyListeners();
    
    return failedOperations.length === 0;
  } catch (error) {
    console.error('[Sync] Sync failed:', error);
    isSyncing = false;
    notifyListeners();
    return false;
  }
}

// Process single operation
async function processOperation(operation: any): Promise<void> {
  const { type, data } = operation;
  const { table, payload } = data;
  
  switch (type) {
    case 'db_insert':
      const { error: insertError } = await supabase
        .from(table)
        .insert(payload);
      if (insertError) throw insertError;
      break;
      
    case 'db_update':
      const { id, ...updateData } = payload;
      const { error: updateError } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', id);
      if (updateError) throw updateError;
      break;
      
    case 'db_delete':
      const { error: deleteError } = await supabase
        .from(table)
        .delete()
        .eq('id', payload.id);
      if (deleteError) throw deleteError;
      break;
      
    default:
      console.warn('[Sync] Unknown operation type:', type);
  }
}

// Subscribe to sync status changes
export function subscribeSyncStatus(callback: (status: SyncStatus) => void): () => void {
  syncListeners.push(callback);
  
  return () => {
    syncListeners = syncListeners.filter(cb => cb !== callback);
  };
}

// Notify all listeners
async function notifyListeners(): Promise<void> {
  const status = await getSyncStatus();
  syncListeners.forEach(cb => cb(status));
}

// Initialize offline sync
export function initializeOfflineSync(): void {
  // Setup network listeners
  setupNetworkListeners(
    // On online
    async () => {
      console.log('[Sync] Network restored, syncing...');
      await syncPendingOperations();
    },
    // On offline
    () => {
      console.log('[Sync] Network lost');
      notifyListeners();
    }
  );
  
  // Sync on app start if online
  isConnected().then(online => {
    if (online) {
      syncPendingOperations();
    }
  });
}

// Cache manager for offline data
export const OfflineCache = {
  cachePrefix: 'cache_',
  
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const cacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: ttl || 1000 * 60 * 60, // Default 1 hour
    };
    await AppStorage.setUserPreferences({ [`${this.cachePrefix}${key}`]: cacheEntry });
  },
  
  async get<T>(key: string): Promise<T | null> {
    const prefs = await AppStorage.getUserPreferences<Record<string, any>>();
    const entry = prefs?.[`${this.cachePrefix}${key}`];
    
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      return null;
    }
    
    return entry.data as T;
  },
  
  async invalidate(key: string): Promise<void> {
    const prefs = await AppStorage.getUserPreferences<Record<string, any>>() || {};
    delete prefs[`${this.cachePrefix}${key}`];
    await AppStorage.setUserPreferences(prefs);
  },
  
  async clearAll(): Promise<void> {
    const prefs = await AppStorage.getUserPreferences<Record<string, any>>() || {};
    const newPrefs: Record<string, any> = {};
    
    for (const key of Object.keys(prefs)) {
      if (!key.startsWith(this.cachePrefix)) {
        newPrefs[key] = prefs[key];
      }
    }
    
    await AppStorage.setUserPreferences(newPrefs);
  },
};

// Supabase query wrapper with offline support
export async function offlineQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  cacheKey: string,
  options?: { ttl?: number; forceRefresh?: boolean }
): Promise<T | null> {
  const online = await isConnected();
  
  // Try cache first if offline
  if (!online || !options?.forceRefresh) {
    const cached = await OfflineCache.get<T>(cacheKey);
    if (cached) {
      console.log(`[Cache] Hit for ${cacheKey}`);
      return cached;
    }
  }
  
  // If offline and no cache, return null
  if (!online) {
    console.log(`[Cache] Miss for ${cacheKey}, offline`);
    return null;
  }
  
  // Fetch from network
  try {
    const { data, error } = await queryFn();
    
    if (error) {
      console.error(`[Query] Error for ${cacheKey}:`, error);
      // Return stale cache on error
      const cached = await OfflineCache.get<T>(cacheKey);
      return cached;
    }
    
    if (data) {
      // Update cache
      await OfflineCache.set(cacheKey, data, options?.ttl);
    }
    
    return data;
  } catch (error) {
    console.error(`[Query] Failed for ${cacheKey}:`, error);
    const cached = await OfflineCache.get<T>(cacheKey);
    return cached;
  }
}
