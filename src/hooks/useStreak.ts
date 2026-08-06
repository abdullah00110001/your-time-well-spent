import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays, parseISO, differenceInDays } from 'date-fns';

interface StreakData {
  currentStreak: number;
  bestStreak: number;
  consistencyScore: number;
  totalActiveDays: number;
  loading: boolean;
}

export function useStreak(): StreakData {
  const { user } = useAuth();
  const [data, setData] = useState<StreakData>({
    currentStreak: 0,
    bestStreak: 0,
    consistencyScore: 0,
    totalActiveDays: 0,
    loading: true,
  });

  useEffect(() => {
    if (!user?.id) {
      setData(d => ({ ...d, loading: false }));
      return;
    }
    calculateStreaks().catch((err) => {
      console.error('[useStreak] calculateStreaks failed:', err);
      setData(d => ({ ...d, loading: false }));
    });
  }, [user?.id]);

  const calculateStreaks = async () => {
    if (!user?.id) {
      setData(d => ({ ...d, loading: false }));
      return;
    }
    // Get all habit entries for the user
    const { data: entries } = await supabase
      .from('habit_entries')
      .select('date, completed')
      .eq('user_id', user.id)
      .eq('completed', true)
      .order('date', { ascending: false });

    // Get habits count
    const { count: habitsCount } = await supabase
      .from('habits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (!entries || entries.length === 0 || !habitsCount) {
      setData({
        currentStreak: 0,
        bestStreak: 0,
        consistencyScore: 0,
        totalActiveDays: 0,
        loading: false,
      });
      return;
    }

    // Group completions by date
    const completionsByDate = new Map<string, number>();
    entries.forEach((entry) => {
      const count = completionsByDate.get(entry.date) || 0;
      completionsByDate.set(entry.date, count + 1);
    });

    // Get unique active days (days with at least one completion)
    const activeDates = Array.from(completionsByDate.keys()).sort().reverse();
    const totalActiveDays = activeDates.length;

    // Calculate current streak (consecutive days from today or yesterday)
    let currentStreak = 0;
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    // Check if there's activity today or yesterday to start the streak
    let checkDate = activeDates.includes(today) ? today : 
                    activeDates.includes(yesterday) ? yesterday : null;

    if (checkDate) {
      for (let i = 0; i < 365; i++) {
        const dateStr = format(subDays(parseISO(checkDate), i), 'yyyy-MM-dd');
        if (completionsByDate.has(dateStr)) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Calculate best streak
    let bestStreak = 0;
    let tempStreak = 0;
    let lastDate: Date | null = null;

    activeDates.sort().forEach((dateStr) => {
      const currentDate = parseISO(dateStr);
      
      if (lastDate === null) {
        tempStreak = 1;
      } else {
        const diff = differenceInDays(currentDate, lastDate);
        if (diff === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }

      bestStreak = Math.max(bestStreak, tempStreak);
      lastDate = currentDate;
    });

    // Calculate consistency score (percentage of days with activity in last 30 days)
    const last30Days = Array.from({ length: 30 }, (_, i) => 
      format(subDays(new Date(), i), 'yyyy-MM-dd')
    );
    const activeLast30 = last30Days.filter(d => completionsByDate.has(d)).length;
    const consistencyScore = Math.round((activeLast30 / 30) * 100);

    setData({
      currentStreak,
      bestStreak,
      consistencyScore,
      totalActiveDays,
      loading: false,
    });
  };

  return data;
}
