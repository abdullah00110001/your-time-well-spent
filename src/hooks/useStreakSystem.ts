import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  hasWokenToday: boolean;
}

export function useStreakSystem() {
  const { user } = useAuth();
  const [streakData, setStreakData] = useState<StreakData>({
    currentStreak: 0,
    longestStreak: 0,
    hasWokenToday: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  const fetchStreak = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Get all wake events ordered by date desc
      const { data } = await supabase
        .from('rise_wake_events' as any)
        .select('woke_at')
        .eq('user_id', user.id)
        .order('woke_at', { ascending: false });

      if (!data || data.length === 0) {
        setStreakData({ currentStreak: 0, longestStreak: 0, hasWokenToday: false });
        return;
      }

      // Unique dates
      const dates = Array.from(
        new Set((data as any[]).map((r: any) => r.woke_at.split('T')[0]))
      ).sort((a, b) => b.localeCompare(a)) as string[];

      const hasWokenToday = dates[0] === todayStr;

      // Calculate current streak
      let currentStreak = 0;
      let checkDate = new Date();
      // If not woken today, start from yesterday
      if (!hasWokenToday) checkDate.setDate(checkDate.getDate() - 1);

      for (const date of dates) {
        const expected = checkDate.toISOString().split('T')[0];
        if (date === expected) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Calculate longest streak
      let longestStreak = 0;
      let tempStreak = 1;
      for (let i = 1; i < dates.length; i++) {
        const prev = new Date(dates[i - 1]);
        const curr = new Date(dates[i]);
        const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);
        if (diffDays === 1) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, currentStreak, 1);

      setStreakData({ currentStreak, longestStreak, hasWokenToday });
    } finally {
      setIsLoading(false);
    }
  }, [user, todayStr]);

  useEffect(() => {
    void fetchStreak();
  }, [fetchStreak]);

  return { streakData, isLoading, refetch: fetchStreak };
}
