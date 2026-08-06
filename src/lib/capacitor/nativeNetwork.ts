// Native Network Bridge for Capacitor
import { Network, ConnectionStatus, ConnectionType } from '@capacitor/network';
import { isNative } from './platform';

export interface NetworkState {
  connected: boolean;
  connectionType: ConnectionType;
}

let networkListenerHandle: any = null;
let currentStatus: NetworkState = {
  connected: true,
  connectionType: 'unknown',
};

// Get current network status
export async function getNetworkStatus(): Promise<NetworkState> {
  if (!isNative) {
    return {
      connected: navigator.onLine,
      connectionType: navigator.onLine ? 'wifi' : 'none',
    };
  }

  try {
    const status = await Network.getStatus();
    currentStatus = {
      connected: status.connected,
      connectionType: status.connectionType,
    };
    return currentStatus;
  } catch (error) {
    console.error('[Network] Get status failed:', error);
    return {
      connected: navigator.onLine,
      connectionType: 'unknown',
    };
  }
}

// Check if connected
export async function isConnected(): Promise<boolean> {
  const status = await getNetworkStatus();
  return status.connected;
}

// Check if on WiFi
export async function isOnWifi(): Promise<boolean> {
  const status = await getNetworkStatus();
  return status.connected && status.connectionType === 'wifi';
}

// Check if on cellular
export async function isOnCellular(): Promise<boolean> {
  const status = await getNetworkStatus();
  return status.connected && status.connectionType === 'cellular';
}

// Setup network listeners
export function setupNetworkListeners(
  onOnline: (status: NetworkState) => void,
  onOffline: (status: NetworkState) => void
): void {
  if (!isNative) {
    // Web fallback
    window.addEventListener('online', () => {
      const status = { connected: true, connectionType: 'wifi' as ConnectionType };
      currentStatus = status;
      onOnline(status);
    });
    window.addEventListener('offline', () => {
      const status = { connected: false, connectionType: 'none' as ConnectionType };
      currentStatus = status;
      onOffline(status);
    });
    return;
  }

  networkListenerHandle = Network.addListener('networkStatusChange', (status: ConnectionStatus) => {
    const networkState: NetworkState = {
      connected: status.connected,
      connectionType: status.connectionType,
    };
    currentStatus = networkState;

    if (status.connected) {
      onOnline(networkState);
    } else {
      onOffline(networkState);
    }
  });
}

// Remove network listeners
export function removeNetworkListeners(): void {
  if (networkListenerHandle) {
    networkListenerHandle.remove();
    networkListenerHandle = null;
  }
}

// Get cached status (synchronous)
export function getCachedNetworkStatus(): NetworkState {
  return currentStatus;
}

// Network-aware fetch wrapper
export async function networkAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const isOnline = await isConnected();
  
  if (!isOnline) {
    throw new Error('OFFLINE: No network connection available');
  }
  
  return fetch(input, init);
}

// Retry fetch with network awareness
export async function retryFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: {
    maxRetries?: number;
    retryDelay?: number;
    onRetry?: (attempt: number) => void;
  }
): Promise<Response> {
  const maxRetries = options?.maxRetries ?? 3;
  const retryDelay = options?.retryDelay ?? 1000;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const isOnline = await isConnected();
      
      if (!isOnline) {
        throw new Error('OFFLINE');
      }
      
      return await fetch(input, init);
    } catch (error: any) {
      lastError = error;
      
      if (attempt < maxRetries) {
        options?.onRetry?.(attempt);
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }
  }
  
  throw lastError || new Error('Fetch failed after retries');
}

// Wait for network
export async function waitForNetwork(timeout: number = 30000): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const isOnline = await isConnected();
    if (isOnline) return true;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}
