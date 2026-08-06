import { useEffect, useRef, useCallback, useState } from 'react';
import { useAuth } from './useAuth';
import { isNative } from '@/lib/capacitor/platform';
import { supabase } from '@/integrations/supabase/client';
import { showPermissionDeniedToast } from '@/lib/capacitor/openAppSettings';
import { scheduleRiseAlarm, uuidToNumericId } from '@/lib/capacitor/riseAlarmBridge';
import { useNavigate } from 'react-router-dom';

type PushPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

export function usePushNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const registeredRef = useRef(false);
  const [permissionStatus, setPermissionStatus] = useState<PushPermissionStatus>('unknown');
  const [token, setToken] = useState<string | null>(null);

  // Request permission and register for push.
  // CRITICAL: This entire flow is wrapped so no failure can crash the app.
  const registerPush = useCallback(async () => {
    try {
    if (registeredRef.current) return;

    // Web fallback: use browser Notification API
    if (!isNative) {
      try {
        if (typeof Notification === 'undefined') {
          console.warn('[Push] Notifications API not available');
          setPermissionStatus('denied');
          return;
        }
        const currentPerm = Notification.permission;
        if (currentPerm === 'granted') {
          setPermissionStatus('granted');
          registeredRef.current = true;
          return;
        }
        if (currentPerm === 'denied') {
          setPermissionStatus('denied');
          return;
        }
        // Must be called directly from user gesture
        const result = await Notification.requestPermission();
        setPermissionStatus(result as PushPermissionStatus);
        if (result === 'granted') {
          registeredRef.current = true;
        }
      } catch (e) {
        console.warn('[Push] Web notification permission failed:', e);
        setPermissionStatus('denied');
      }
      return;
    }

    if (!user) return;

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      try {
        await PushNotifications.removeAllListeners();
      } catch (e) {
        console.warn('[Push] removeAllListeners failed:', e);
      }

      // Check current status
      let permResult;
      try {
        permResult = await PushNotifications.checkPermissions();
      } catch (e) {
        console.warn('[Push] checkPermissions failed:', e);
        return;
      }
      setPermissionStatus(permResult.receive as PushPermissionStatus);

      // Request if needed (must be triggered from a user gesture on Android 13+)
      if (permResult.receive !== 'granted') {
        try {
          const requestResult = await PushNotifications.requestPermissions();
          setPermissionStatus(requestResult.receive as PushPermissionStatus);
          if (requestResult.receive !== 'granted') {
            console.warn('[Push] Permission denied');
            showPermissionDeniedToast({
              feature: 'Push notifications',
              reason: 'Push notifications are needed for wake signals, mentor messages, and group alerts.',
            });
            return;
          }
        } catch (e) {
          console.warn('[Push] requestPermissions failed:', e);
          showPermissionDeniedToast({
            feature: 'Push notifications',
            reason: 'We could not request push permission. Enable it manually in Settings.',
          });
          return;
        }
      }

      // Don't remove all listeners - other hooks may have set them up
      // Just add our own listeners

      // Listen for token
      PushNotifications.addListener('registration', async (tokenData) => {
        console.log('[Push] FCM token received');
        setToken(tokenData.value);
        registeredRef.current = true;

        // Store token in profiles table (safe - column may not exist yet)
        try {
          await supabase
            .from('profiles')
            .update({
              push_token: tokenData.value,
              push_token_updated_at: new Date().toISOString(),
            } as any)
            .eq('user_id', user.id);
        } catch (err) {
          // Column may not exist, that's OK
          console.warn('[Push] Token save skipped:', err);
        }

        // Persist FCM token for server-side push targeting (wake-up signals etc.)
        try {
          await (supabase as any).from('fcm_tokens').upsert(
            {
              user_id: user.id,
              token: tokenData.value,
              platform: 'android',
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'token' }
          );
        } catch (err) {
          console.warn('[Push] fcm_tokens upsert skipped:', err);
        }
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('[Push] Registration error:', error);
      });

      // Foreground notification - show as in-app toast only
      PushNotifications.addListener('pushNotificationReceived', async (notification) => {
        console.log('[Push] Foreground notification:', notification);

        const { title, body, data } = notification;

        // Handle WAKE_UP_CALL — schedule a native alarm 5 seconds out
        if (data?.type === 'WAKE_UP_CALL' && isNative) {
          try {
            const wakeUuid = `wakeup-${data.session_id}-${Date.now()}`;
            const numericId = uuidToNumericId(wakeUuid);
            await scheduleRiseAlarm(
              numericId,
              Date.now() + 5000,
              title || '⏰ Wake Up Call!',
              body || 'Someone is calling you to wake up',
              wakeUuid
            );
            console.log('[Push] Scheduled wake-up call alarm', wakeUuid);
          } catch (e) {
            console.error('[Push] Failed to schedule wake-up call alarm:', e);
          }
        }

        // Show as local notification if possible
        if (isNative) {
          try {
            const { LocalNotifications } = await import('@capacitor/local-notifications');
            await LocalNotifications.schedule({
              notifications: [{
                id: Date.now(),
                title: title || 'Life OS',
                body: body || '',
                channelId: data?.type === 'wakeup' ? 'wakeup_channel' : (data?.channelId || 'general'),
                extra: {
                  ...data,
                  route: data?.route || '/',
                },
              }],
            });
          } catch {
            // Silently fail - notification is still received
          }
        }
      });

      // Notification tapped (background/killed)
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push] Notification tapped:', action);
        const data = action.notification.data;
        const route = data?.route || data?.url;

        // WAKE_UP_CALL navigates to rise ring - the app resume logic will catch ringing alarm
        if (data?.type === 'WAKE_UP_CALL') {
          setTimeout(() => { navigate('/rise'); }, 500);
          return;
        }

        // Wake-up push from a group member → open Rise / Community screen
        if (data?.type === 'wakeup') {
          setTimeout(() => { window.location.href = '/rise'; }, 500);
          return;
        }

        if (route) {
          setTimeout(() => { window.location.href = route; }, 500);
        } else {
          const typeRoutes: Record<string, string> = {
            group_wake: '/rise',
            mentor_feedback: '/dashboard',
            challenge_update: '/challenges',
            achievement: '/gamification',
            prayer_reminder: '/islamic-dashboard',
            daily_reminder: '/daily-input',
            shield_alert: '/shield',
            app_update: '/download',
          };
          const targetRoute = typeRoutes[data?.type] || '/dashboard';
          setTimeout(() => { window.location.href = targetRoute; }, 500);
        }
      });

      // Register with FCM
      await PushNotifications.register();
      console.log('[Push] Registration initiated');
    } catch (error) {
      console.error('[Push] Setup failed:', error);
    }
    } catch (outerError) {
      // Outermost guard: never let push registration crash the app.
      console.error('[Push] Fatal error swallowed:', outerError);
    }
  }, [user]);

  // Check web permission status on mount
  useEffect(() => {
    if (!isNative && typeof Notification !== 'undefined') {
      setPermissionStatus(Notification.permission as PushPermissionStatus);
    }
  }, []);

  // NOTE: We deliberately do NOT auto-register for push on login.
  // Push registration is opt-in: the user must explicitly enable it from Settings,
  // which calls `registerPush()`. Auto-registering on login was crashing the app
  // on Android when FCM registration failed.

  return { permissionStatus, token, registerPush };
}
