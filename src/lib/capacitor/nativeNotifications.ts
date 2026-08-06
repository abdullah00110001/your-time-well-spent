import { LocalNotifications, LocalNotificationSchema } from '@capacitor/local-notifications';
import { PushNotifications, Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { isNative, isAndroid } from './platform';
import { supabase } from '@/integrations/supabase/client';

export interface GroupWakeSignal {
  fromUserId: string;
  fromUserName: string;
  groupId: string;
  message: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
}

export interface MentorFeedback {
  feedbackId: string;
  message: string;
  feedbackType: string;
  adminName?: string;
}

// Register for push notifications and save token
export const registerPushNotifications = async (userId: string): Promise<string | null> => {
  if (!isNative) return null;

  try {
    // Check current permission status
    const { receive } = await PushNotifications.checkPermissions();
    
    if (receive === 'prompt') {
      // Request permission
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        console.log('[Notifications] Push permission denied');
        return null;
      }
    } else if (receive !== 'granted') {
      console.log('[Notifications] Push permission not granted:', receive);
      return null;
    }

    // Register with FCM/APNs
    await PushNotifications.register();

    // Wait for token
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log('[Notifications] Token registration timeout');
        resolve(null);
      }, 10000);

      PushNotifications.addListener('registration', async (token: Token) => {
        clearTimeout(timeout);
        console.log('[Notifications] Push token received');
        
        // Save token to Supabase for server-side notifications
        try {
          await supabase.from('push_subscriptions').upsert({
            user_id: userId,
            endpoint: token.value,
            p256dh: 'fcm', // Marker for FCM tokens
            auth: 'native',
            is_active: true
          }, {
            onConflict: 'user_id'
          });
          console.log('[Notifications] Token saved to database');
        } catch (error) {
          console.error('[Notifications] Failed to save token:', error);
        }
        
        resolve(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        clearTimeout(timeout);
        console.error('[Notifications] Registration error:', error);
        resolve(null);
      });
    });
  } catch (error) {
    console.error('[Notifications] Push registration failed:', error);
    return null;
  }
};

// Unregister push notifications
export const unregisterPushNotifications = async (userId: string): Promise<void> => {
  if (!isNative) return;
  
  try {
    await supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', userId);
    
    console.log('[Notifications] Push unregistered');
  } catch (error) {
    console.error('[Notifications] Unregister failed:', error);
  }
};

// Setup push notification listeners
export const setupPushListeners = (
  onGroupWakeSignal: (signal: GroupWakeSignal) => void,
  onMentorFeedback: (feedback: MentorFeedback) => void,
  onGenericNotification: (title: string, body: string, data?: any) => void
) => {
  if (!isNative) return;

  // Notification received while app is open
  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('[Notifications] Push received:', notification);
    
    const { data } = notification;
    
    switch (data?.type) {
      case 'group_wake':
        onGroupWakeSignal({
          fromUserId: data.fromUserId,
          fromUserName: data.fromUserName || 'Someone',
          groupId: data.groupId,
          message: data.message || 'Someone needs help waking up!',
          urgency: data.urgency || 'high'
        });
        break;
        
      case 'mentor_feedback':
        onMentorFeedback({
          feedbackId: data.feedbackId,
          message: notification.body || 'You have new feedback',
          feedbackType: data.feedbackType || 'encouragement',
          adminName: data.adminName
        });
        break;
        
      case 'challenge_update':
      case 'achievement':
      case 'reminder':
      default:
        onGenericNotification(
          notification.title || 'Life OS',
          notification.body || '',
          data
        );
    }
  });

  // Notification tapped
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('[Notifications] Push action:', action);
    
    const { data } = action.notification;
    
    // Navigate based on notification type
    switch (data?.type) {
      case 'group_wake':
        window.location.href = '/rise';
        break;
      case 'mentor_feedback':
        window.location.href = '/dashboard';
        break;
      case 'challenge_update':
        window.location.href = '/challenges';
        break;
      case 'achievement':
        window.location.href = '/gamification';
        break;
      default:
        // Stay on current page or go to dashboard
        if (data?.route) {
          window.location.href = data.route;
        }
    }
  });
};

// Send local notification for group wake signal
export const sendGroupWakeNotification = async (signal: GroupWakeSignal): Promise<void> => {
  try {
    const sound = signal.urgency === 'critical' ? 'alarm_sound.wav' : 'notification.wav';
    const importance = signal.urgency === 'critical' ? 5 : 4;
    
    await LocalNotifications.schedule({
      notifications: [{
        id: Date.now(),
        title: '🚨 Wake Up Call!',
        body: `${signal.fromUserName}: ${signal.message}`,
        channelId: 'group_wake',
        sound,
        extra: {
          type: 'group_wake',
          groupId: signal.groupId,
          fromUserId: signal.fromUserId,
          urgency: signal.urgency
        },
        ongoing: signal.urgency === 'critical',
        autoCancel: signal.urgency !== 'critical'
      }]
    });
  } catch (error) {
    console.error('[Notifications] Group wake notification failed:', error);
  }
};

// Send shield reminder notification
export const sendShieldReminder = async (
  title: string,
  body: string,
  scheduledAt?: Date
): Promise<void> => {
  try {
    const notification: LocalNotificationSchema = {
      id: Date.now(),
      title,
      body,
      channelId: 'shield_reminders',
      extra: { type: 'shield_reminder' }
    };

    if (scheduledAt) {
      notification.schedule = { at: scheduledAt, allowWhileIdle: true };
    }

    await LocalNotifications.schedule({ notifications: [notification] });
  } catch (error) {
    console.error('[Notifications] Shield reminder failed:', error);
  }
};

// Send daily input reminder
export const sendDailyInputReminder = async (
  reminderTime: Date,
  message?: string
): Promise<void> => {
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: 888888, // Fixed ID for daily reminder
        title: '📝 Daily Check-in',
        body: message || "Time to log your day and reflect on your progress!",
        channelId: 'daily_reminders',
        schedule: { at: reminderTime, allowWhileIdle: true },
        extra: { type: 'daily_input' }
      }]
    });
  } catch (error) {
    console.error('[Notifications] Daily reminder failed:', error);
  }
};

// Send prayer reminder
export const sendPrayerReminder = async (
  prayerName: string,
  scheduledAt: Date
): Promise<void> => {
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: Date.now(),
        title: `🕌 ${prayerName} Time`,
        body: `Time for ${prayerName} prayer. Stay connected with Allah.`,
        channelId: 'prayer_reminders',
        schedule: { at: scheduledAt, allowWhileIdle: true },
        extra: { 
          type: 'prayer_reminder',
          prayer: prayerName
        }
      }]
    });
  } catch (error) {
    console.error('[Notifications] Prayer reminder failed:', error);
  }
};

// Send achievement notification
export const sendAchievementNotification = async (
  title: string,
  description: string,
  badgeIcon?: string
): Promise<void> => {
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: Date.now(),
        title: `🏆 ${title}`,
        body: description,
        channelId: 'achievements',
        extra: { 
          type: 'achievement',
          badgeIcon
        }
      }]
    });
  } catch (error) {
    console.error('[Notifications] Achievement notification failed:', error);
  }
};

// Initialize all notification channels (Android)
export const initializeNotificationChannels = async (): Promise<void> => {
  if (!isAndroid) return;

  try {
    // Group wake channel - max priority for urgent wake calls
    await LocalNotifications.createChannel({
      id: 'group_wake',
      name: 'Group Wake Signals',
      description: 'Urgent wake-up calls from your accountability group',
      importance: 5,
      visibility: 1,
      vibration: true,
      sound: 'alarm_sound.wav',
      lights: true,
      lightColor: '#ef4444'
    });

    // Shield reminders - high priority
    await LocalNotifications.createChannel({
      id: 'shield_reminders',
      name: 'Shield Reminders',
      description: 'Focus session reminders and updates',
      importance: 4,
      visibility: 1,
      vibration: true
    });

    // Daily input reminders
    await LocalNotifications.createChannel({
      id: 'daily_reminders',
      name: 'Daily Reminders',
      description: 'Reminders for daily check-ins and reflections',
      importance: 3,
      visibility: 1,
      vibration: true
    });

    // Prayer reminders
    await LocalNotifications.createChannel({
      id: 'prayer_reminders',
      name: 'Prayer Reminders',
      description: 'Salah time notifications',
      importance: 4,
      visibility: 1,
      vibration: true,
      sound: 'adhan.wav'
    });

    // Achievements
    await LocalNotifications.createChannel({
      id: 'achievements',
      name: 'Achievements',
      description: 'Badge and milestone notifications',
      importance: 3,
      visibility: 1,
      vibration: true
    });

    // General notifications - default priority
    await LocalNotifications.createChannel({
      id: 'general',
      name: 'General Notifications',
      description: 'App updates and reminders',
      importance: 3,
      visibility: 1
    });

    console.log('[Notifications] All channels created');
  } catch (error) {
    console.error('[Notifications] Channel creation failed:', error);
  }
};

// Clear all notifications
export const clearAllNotifications = async (): Promise<void> => {
  try {
    // Cancel all pending notifications
    const { notifications } = await LocalNotifications.getPending();
    if (notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: notifications.map(n => ({ id: n.id }))
      });
    }
    
    // Also clear delivered notifications
    await LocalNotifications.removeAllDeliveredNotifications();
    
    console.log('[Notifications] All notifications cleared');
  } catch (error) {
    console.error('[Notifications] Clear failed:', error);
  }
};

// Clear specific notification by ID
export const clearNotification = async (notificationId: number): Promise<void> => {
  try {
    await LocalNotifications.cancel({
      notifications: [{ id: notificationId }]
    });
  } catch (error) {
    console.error('[Notifications] Clear notification failed:', error);
  }
};

// Get notification badge count
export const getBadgeCount = async (): Promise<number> => {
  // Would need native implementation via custom plugin
  return 0;
};

// Set notification badge count
export const setBadgeCount = async (count: number): Promise<void> => {
  // Would need native implementation via custom plugin
  console.log('[Notifications] Badge count:', count);
};

// Check notification permission status
export const checkNotificationPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  if (!isNative) {
    if ('Notification' in window) {
      return Notification.permission as 'granted' | 'denied' | 'prompt';
    }
    return 'denied';
  }
  
  try {
    const { display } = await LocalNotifications.checkPermissions();
    return display as 'granted' | 'denied' | 'prompt';
  } catch {
    return 'denied';
  }
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<'granted' | 'denied' | 'prompt'> => {
  if (!isNative) {
    if ('Notification' in window) {
      const result = await Notification.requestPermission();
      return result as 'granted' | 'denied' | 'prompt';
    }
    return 'denied';
  }
  
  try {
    const { display } = await LocalNotifications.requestPermissions();
    return display as 'granted' | 'denied' | 'prompt';
  } catch {
    return 'denied';
  }
};
