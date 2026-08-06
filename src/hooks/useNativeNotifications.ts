import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { 
  isNative,
  registerPushNotifications,
  unregisterPushNotifications,
  checkNotificationPermission,
  requestNotificationPermission,
  sendDailyInputReminder,
  sendPrayerReminder,
  sendAchievementNotification,
  clearAllNotifications
} from '@/lib/capacitor';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { showPermissionDeniedToast } from '@/lib/capacitor/openAppSettings';

interface NotificationPreferences {
  dailyInputReminder: boolean;
  prayerReminders: boolean;
  mentorMessages: boolean;
  achievementAlerts: boolean;
  challengeUpdates: boolean;
  habitReminders: boolean;
  reminderTime: string;
}

interface NativeNotificationState {
  hasPermission: boolean;
  isRegistered: boolean;
  preferences: NotificationPreferences | null;
  isLoading: boolean;
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  dailyInputReminder: true,
  prayerReminders: true,
  mentorMessages: true,
  achievementAlerts: true,
  challengeUpdates: true,
  habitReminders: true,
  reminderTime: '20:00'
};

export function useNativeNotifications() {
  const { user } = useAuth();
  const [state, setState] = useState<NativeNotificationState>({
    hasPermission: false,
    isRegistered: false,
    preferences: null,
    isLoading: true
  });

  // Load preferences from database
  const loadPreferences = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      if (data) {
        setState(prev => ({
          ...prev,
          preferences: {
            dailyInputReminder: data.daily_input_reminder ?? true,
            prayerReminders: data.prayer_reminders ?? true,
            mentorMessages: data.mentor_messages ?? true,
            achievementAlerts: data.achievement_alerts ?? true,
            challengeUpdates: data.challenge_updates ?? true,
            habitReminders: data.habit_reminders ?? true,
            reminderTime: data.reminder_time || '20:00'
          }
        }));
      } else {
        // Create default preferences (map camelCase → snake_case for DB)
        await supabase.from('notification_preferences').insert({
          user_id: user.id,
          daily_input_reminder: DEFAULT_PREFERENCES.dailyInputReminder,
          prayer_reminders: DEFAULT_PREFERENCES.prayerReminders,
          mentor_messages: DEFAULT_PREFERENCES.mentorMessages,
          achievement_alerts: DEFAULT_PREFERENCES.achievementAlerts,
          challenge_updates: DEFAULT_PREFERENCES.challengeUpdates,
          habit_reminders: DEFAULT_PREFERENCES.habitReminders,
          reminder_time: DEFAULT_PREFERENCES.reminderTime,
        });
        setState(prev => ({ ...prev, preferences: DEFAULT_PREFERENCES }));
      }
    } catch (error) {
      console.error('[useNativeNotifications] Load preferences failed:', error);
      setState(prev => ({ ...prev, preferences: DEFAULT_PREFERENCES }));
    }
  }, [user]);

  // Check current permission status
  const checkPermission = useCallback(async () => {
    const permission = await checkNotificationPermission();
    setState(prev => ({ ...prev, hasPermission: permission === 'granted' }));
    return permission === 'granted';
  }, []);

  // Request notification permission.
  // MUST be called from a direct user gesture (button click) to satisfy Android 13+.
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const permission = await requestNotificationPermission();
      const granted = permission === 'granted';

      setState(prev => ({ ...prev, hasPermission: granted }));

      if (granted) {
        toast.success('Notifications enabled!');
      } else {
        showPermissionDeniedToast({
          feature: 'Notifications',
          reason: 'Enable notifications so we can send daily reminders, prayer alerts, and your alarm.',
        });
      }

      return granted;
    } catch (e) {
      console.error('[useNativeNotifications] requestPermission error:', e);
      showPermissionDeniedToast({
        feature: 'Notifications',
        reason: 'We could not request notification permission. Please enable it manually.',
      });
      return false;
    }
  }, []);

  // Register for push notifications
  const registerForPush = useCallback(async (): Promise<boolean> => {
    if (!user || !isNative) return false;
    
    const hasPermission = await checkPermission();
    if (!hasPermission) {
      const granted = await requestPermission();
      if (!granted) return false;
    }
    
    const token = await registerPushNotifications(user.id);
    const registered = !!token;
    
    setState(prev => ({ ...prev, isRegistered: registered }));
    
    return registered;
  }, [user, checkPermission, requestPermission]);

  // Unregister from push notifications
  const unregisterFromPush = useCallback(async (): Promise<void> => {
    if (!user) return;
    
    await unregisterPushNotifications(user.id);
    setState(prev => ({ ...prev, isRegistered: false }));
  }, [user]);

  // Update preferences
  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const newPreferences = { ...state.preferences, ...updates };
      
      await supabase
        .from('notification_preferences')
        .update({
          daily_input_reminder: newPreferences.dailyInputReminder,
          prayer_reminders: newPreferences.prayerReminders,
          mentor_messages: newPreferences.mentorMessages,
          achievement_alerts: newPreferences.achievementAlerts,
          challenge_updates: newPreferences.challengeUpdates,
          habit_reminders: newPreferences.habitReminders,
          reminder_time: newPreferences.reminderTime
        })
        .eq('user_id', user.id);
      
      setState(prev => ({ ...prev, preferences: newPreferences as NotificationPreferences }));
      
      // Reschedule reminders based on new preferences
      await scheduleReminders(newPreferences as NotificationPreferences);
      
      return true;
    } catch (error) {
      console.error('[useNativeNotifications] Update preferences failed:', error);
      toast.error('Failed to update notification preferences');
      return false;
    }
  }, [user, state.preferences]);

  // Schedule daily reminders
  const scheduleReminders = useCallback(async (prefs: NotificationPreferences) => {
    if (!isNative || !prefs) return;
    
    // Clear existing scheduled notifications first
    await clearAllNotifications();
    
    // Schedule daily input reminder
    if (prefs.dailyInputReminder) {
      const [hours, minutes] = prefs.reminderTime.split(':').map(Number);
      const reminderTime = new Date();
      reminderTime.setHours(hours, minutes, 0, 0);
      
      // If time has passed today, schedule for tomorrow
      if (reminderTime <= new Date()) {
        reminderTime.setDate(reminderTime.getDate() + 1);
      }
      
      await sendDailyInputReminder(reminderTime);
    }
    
    // Prayer reminders would need prayer time calculation
    // This would integrate with a prayer times API
    if (prefs.prayerReminders) {
      // Example: Schedule Fajr reminder for 5:30 AM
      const fajrTime = new Date();
      fajrTime.setHours(5, 30, 0, 0);
      if (fajrTime <= new Date()) {
        fajrTime.setDate(fajrTime.getDate() + 1);
      }
      await sendPrayerReminder('Fajr', fajrTime);
    }
  }, []);

  // Send custom notification
  const sendNotification = useCallback(async (
    title: string, 
    body: string, 
    type: 'achievement' | 'reminder' | 'alert' = 'reminder'
  ) => {
    if (type === 'achievement') {
      await sendAchievementNotification(title, body);
    } else {
      // Use web notification if not native
      if (!isNative && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    }
  }, []);

  // Initial setup — load preferences & current permission status only.
  // CRITICAL: We do NOT auto-request permission or auto-register for push here.
  // Both are opt-in and must be triggered by explicit user action (Settings toggle).
  useEffect(() => {
    const init = async () => {
      setState(prev => ({ ...prev, isLoading: true }));
      try {
        await checkPermission();
        await loadPreferences();
      } catch (e) {
        console.error('[useNativeNotifications] init error:', e);
      }
      setState(prev => ({ ...prev, isLoading: false }));
    };

    if (user) {
      init();
    }
  }, [user, checkPermission, loadPreferences]);

  // Schedule reminders when preferences are loaded
  useEffect(() => {
    if (state.preferences && state.hasPermission) {
      scheduleReminders(state.preferences);
    }
  }, [state.preferences, state.hasPermission, scheduleReminders]);

  return {
    ...state,
    requestPermission,
    registerForPush,
    unregisterFromPush,
    updatePreferences,
    sendNotification,
    loadPreferences
  };
}
