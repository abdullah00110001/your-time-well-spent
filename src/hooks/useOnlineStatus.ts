import { useEffect, useState } from 'react';
import { isNative } from '@/lib/capacitor/platform';

/**
 * Live online/offline status. Uses native Network plugin on Capacitor when
 * available, falls back to `navigator.onLine` events on web.
 */
export function useOnlineStatus() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    let cleanup: (() => void) | undefined;

    if (isNative) {
      (async () => {
        try {
          const { Network } = await import('@capacitor/network');
          const status = await Network.getStatus();
          setOnline(status.connected);
          const handle = await Network.addListener('networkStatusChange', (s) => {
            setOnline(s.connected);
          });
          cleanup = () => handle.remove();
        } catch {
          /* fallback handled below */
        }
      })();
    }

    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);

    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
      cleanup?.();
    };
  }, []);

  return online;
}
