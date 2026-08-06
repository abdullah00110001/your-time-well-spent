import { useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, differenceInHours } from 'date-fns';
import { isNative } from '@/lib/capacitor/platform';

// Smart notification triggers
const NOTIFICATION_CONFIG = {
  dailyInputReminder: { hour: 21, message: "🌙 Time for your daily input! Don't break your streak." },
  morningMotivation: { hour: 6, message: "☀️ Bismillah! A new day, a new chance to grow." },
  streakDanger: { threshold: 1, message: "🔥 Your streak is in danger! Complete today's habits." },
  prayerReminder: { message: "🕌 It's prayer time. Pause and reconnect." },
  weeklyReview: { day: 0, message: "📊 Your weekly review is ready. See how you did!" },
};

export function useSmartNotifications() {
  const { user } = useAuth();

  const checkAndNotify = useCallback(async () => {
    if (!user) return;
    
    const now = new Date();
    const hour = now.getHours();
    const today = format(now, 'yyyy-MM-dd');
    const lastNotified = localStorage.getItem(`last_notified_${today}`);
    
    if (lastNotified === 'true') return;

    try {
      // Check if daily input is done
      if (hour >= 21 && hour < 23) {
        const { data: entry } = await supabase
          .from('daily_entries')
          .select('id')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle();
        
        if (!entry) {
          toast.info(NOTIFICATION_CONFIG.dailyInputReminder.message, {
            duration: 8000,
            action: { label: 'Go', onClick: () => window.location.href = '/daily-input' },
          });
        }
      }

      // Check streak danger
      const { data: entries } = await supabase
        .from('habit_entries')
        .select('completed')
        .eq('user_id', user.id)
        .eq('date', today);

      const habitsCompleted = entries?.filter(e => e.completed).length || 0;
      
      const { count: totalHabits } = await supabase
        .from('habits')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (hour >= 18 && totalHabits && habitsCompleted < (totalHabits / 2)) {
        toast.warning(NOTIFICATION_CONFIG.streakDanger.message, {
          duration: 6000,
          action: { label: 'Complete', onClick: () => window.location.href = '/habits' },
        });
      }

      // Weekly review reminder (Sunday)
      if (now.getDay() === 0 && hour >= 18) {
        toast.info(NOTIFICATION_CONFIG.weeklyReview.message, {
          duration: 6000,
          action: { label: 'Review', onClick: () => window.location.href = '/weekly-review' },
        });
      }

      localStorage.setItem(`last_notified_${today}`, 'true');
    } catch (err) {
      console.error('[SmartNotifications] Error:', err);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    // Check on mount
    const timer = setTimeout(checkAndNotify, 5000);
    
    // Check every 30 minutes
    const interval = setInterval(checkAndNotify, 30 * 60 * 1000);
    
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [user, checkAndNotify]);
}

export default function SmartNotificationProvider() {
  useSmartNotifications();
  return null;
}
