import { useEffect, useState, useCallback, useRef } from 'react';
import { 
  isNative, 
  isAndroid,
  initializeCapacitor, 
  getDeviceInfo 
} from '@/lib/capacitor/platform';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CapacitorState {
  isNative: boolean;
  isAndroid: boolean;
  isInitialized: boolean;
  deviceInfo: any;
  pushToken: string | null;
}

export function useCapacitor() {
  const { user } = useAuth();
  const initRef = useRef(false);
  const [state, setState] = useState<CapacitorState>({
    isNative,
    isAndroid,
    isInitialized: !isNative,
    deviceInfo: null,
    pushToken: null
  });

  const handleBackButton = useCallback((): boolean => {
    try {
      const dialogs = document.querySelectorAll('[role="dialog"][data-state="open"]');
      if (dialogs.length > 0) {
        const closeButton = dialogs[dialogs.length - 1].querySelector('[aria-label="Close"]');
        if (closeButton) {
          (closeButton as HTMLElement).click();
          return true;
        }
      }
      const drawers = document.querySelectorAll('[data-vaul-drawer][data-state="open"]');
      if (drawers.length > 0) {
        document.body.click();
        return true;
      }
    } catch (e) {
      console.error('[Capacitor] Back button handler error:', e);
    }
    return false;
  }, []);

  const handleDeepLink = useCallback((url: string) => {
    try {
      console.log('[Capacitor] Deep link received:', url);
      if (url.includes('auth/callback') || url.includes('supabase.co')) {
        window.location.href = url;
        return;
      }
      const urlObj = new URL(url);
      const path = urlObj.pathname;
      if (path && path !== '/') {
        window.location.href = path;
      }
    } catch {
      // Invalid URL
    }
  }, []);

  // Initialize Capacitor - runs once
  useEffect(() => {
    if (!isNative || initRef.current) return;
    initRef.current = true;

    const init = async () => {
      // Step 1: Core platform init
      try {
        await initializeCapacitor(handleBackButton, handleDeepLink);
      } catch (error) {
        console.error('[Capacitor] Platform init error:', error);
      }

      let deviceInfo = null;
      try {
        deviceInfo = await getDeviceInfo();
      } catch (error) {
        console.error('[Capacitor] Device info error:', error);
      }

      // Step 2: Android-specific setup (all wrapped individually)
      // NOTE: Notification permission is NOT auto-requested here.
      // It is requested contextually when the user enables notifications in Settings
      // or sets up an alarm/feature that needs it.
      if (isAndroid) {
        // Notification channels - each in its own try/catch
        try {
          const { initializeNotificationChannels } = await import('@/lib/capacitor/nativeNotifications');
          await initializeNotificationChannels();
        } catch (error) {
          console.error('[Capacitor] Notification channels error:', error);
        }

        try {
          const { initializeAlarmChannel, registerAlarmActions } = await import('@/lib/capacitor/nativeAlarm');
          await initializeAlarmChannel();
          await registerAlarmActions();
        } catch (error) {
          console.error('[Capacitor] Alarm channel error:', error);
        }

        try {
          const { initializeShieldChannel } = await import('@/lib/capacitor/nativeShield');
          await initializeShieldChannel();
        } catch (error) {
          console.error('[Capacitor] Shield channel error:', error);
        }
      }

      // Step 3: Set up listeners (non-blocking)
      setupListeners();

      // Mark as initialized
      setState({
        isNative: true,
        isAndroid,
        isInitialized: true,
        deviceInfo,
        pushToken: null
      });

      console.log('[Capacitor] Initialization complete');
    };

    // Non-critical listener setup - won't block init
    const setupListeners = () => {
      // Alarm listeners
      import('@/lib/capacitor/nativeAlarm').then(({ setupAlarmListeners }) => {
        setupAlarmListeners(
          (alarmId, extra) => {
            window.dispatchEvent(new CustomEvent('rise:alarmTriggered', { detail: { alarmId, ...extra } }));
            toast('⏰ Alarm!', { description: extra?.intention || 'Time to wake up!', duration: 10000 });
          },
          (alarmId, action) => {
            window.dispatchEvent(new CustomEvent('rise:alarmAction', { detail: { alarmId, action } }));
          }
        );
      }).catch(e => console.error('[Capacitor] Alarm listeners error:', e));

      // Shield listeners
      import('@/lib/capacitor/nativeShield').then(({ setupShieldListeners, extendSession }) => {
        setupShieldListeners(
          () => { try { window.location.href = '/shield'; } catch {} },
          () => { try { extendSession(15); window.dispatchEvent(new CustomEvent('shield:extendSession')); } catch {} }
        );
      }).catch(e => console.error('[Capacitor] Shield listeners error:', e));

      // Push listeners
      import('@/lib/capacitor/nativeNotifications').then(({ setupPushListeners }) => {
        setupPushListeners(
          (signal) => { toast.error('🚨 Wake Up Call!', { description: `${signal.fromUserName}: ${signal.message}`, duration: 15000 }); },
          (feedback) => { toast.success('📝 New Feedback', { description: feedback.message }); },
          (title, body) => { toast(title, { description: body }); }
        );
      }).catch(e => console.error('[Capacitor] Push listeners error:', e));
    };

    init();
  }, []);

  // Push registration is now handled by usePushNotifications hook

  return state;
}
