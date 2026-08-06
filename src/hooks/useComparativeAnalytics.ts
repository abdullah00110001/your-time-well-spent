import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

export interface PeriodStats {
  studyTime: number;
  deviceTime: number;
  focusScore: number;
  disciplineScore: number;
  salahOnTime: number;
  quranDays: number;
  moodAverage: number;
  entriesCount: number;
}

export interface ComparisonData {
  current: PeriodStats;
  previous: PeriodStats;
  changes: {
    studyTime: number;
    deviceTime: number;
    focusScore: number;
    disciplineScore: number;
    salahOnTime: number;
    quranDays: number;
    moodAverage: number;
  };
}

export function useComparativeAnalytics() {
  const { user } = useAuth();
  const [weeklyComparison, setWeeklyComparison] = useState<ComparisonData | null>(null);
  const [monthlyComparison, setMonthlyComparison] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  const calculateStats = (entries: any[]): PeriodStats => {
    if (entries.length === 0) {
      return {
        studyTime: 0,
        deviceTime: 0,
        focusScore: 0,
        disciplineScore: 0,
        salahOnTime: 0,
        quranDays: 0,
        moodAverage: 0,
        entriesCount: 0
      };
    }

    const totals = entries.reduce((acc, entry) => ({
      studyTime: acc.studyTime + (entry.study_time || 0),
      deviceTime: acc.deviceTime + (entry.device_time || 0),
      focusScore: acc.focusScore + (entry.focus_level || 0),
      disciplineScore: acc.disciplineScore + (entry.discipline_score || 0),
      salahOnTime: acc.salahOnTime + (entry.salah_on_time || 0),
      quranDays: acc.quranDays + (entry.quran_read ? 1 : 0),
      moodAverage: acc.moodAverage + (entry.mood || 0)
    }), {
      studyTime: 0,
      deviceTime: 0,
      focusScore: 0,
      disciplineScore: 0,
      salahOnTime: 0,
      quranDays: 0,
      moodAverage: 0
    });

    const count = entries.length;
    return {
      studyTime: Math.round(totals.studyTime / count * 10) / 10,
      deviceTime: Math.round(totals.deviceTime / count * 10) / 10,
      focusScore: Math.round(totals.focusScore / count * 10) / 10,
      disciplineScore: Math.round(totals.disciplineScore / count * 10) / 10,
      salahOnTime: Math.round(totals.salahOnTime / count * 10) / 10,
      quranDays: totals.quranDays,
      moodAverage: Math.round(totals.moodAverage / count * 10) / 10,
      entriesCount: count
    };
  };

  const calculateChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;

    try {
      const today = new Date();
      
      // Weekly comparison
      const thisWeekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const thisWeekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const lastWeekStart = format(startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const lastWeekEnd = format(endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 }), 'yyyy-MM-dd');

      // Monthly comparison
      const thisMonthStart = format(startOfMonth(today), 'yyyy-MM-dd');
      const thisMonthEnd = format(endOfMonth(today), 'yyyy-MM-dd');
      const lastMonthStart = format(startOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');
      const lastMonthEnd = format(endOfMonth(subMonths(today, 1)), 'yyyy-MM-dd');

      // Fetch all periods
      const [thisWeek, lastWeek, thisMonth, lastMonth] = await Promise.all([
        supabase
          .from('daily_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', thisWeekStart)
          .lte('date', thisWeekEnd),
        supabase
          .from('daily_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', lastWeekStart)
          .lte('date', lastWeekEnd),
        supabase
          .from('daily_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', thisMonthStart)
          .lte('date', thisMonthEnd),
        supabase
          .from('daily_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', lastMonthStart)
          .lte('date', lastMonthEnd)
      ]);

      const thisWeekStats = calculateStats(thisWeek.data || []);
      const lastWeekStats = calculateStats(lastWeek.data || []);
      const thisMonthStats = calculateStats(thisMonth.data || []);
      const lastMonthStats = calculateStats(lastMonth.data || []);

      setWeeklyComparison({
        current: thisWeekStats,
        previous: lastWeekStats,
        changes: {
          studyTime: calculateChange(thisWeekStats.studyTime, lastWeekStats.studyTime),
          deviceTime: calculateChange(thisWeekStats.deviceTime, lastWeekStats.deviceTime),
          focusScore: calculateChange(thisWeekStats.focusScore, lastWeekStats.focusScore),
          disciplineScore: calculateChange(thisWeekStats.disciplineScore, lastWeekStats.disciplineScore),
          salahOnTime: calculateChange(thisWeekStats.salahOnTime, lastWeekStats.salahOnTime),
          quranDays: calculateChange(thisWeekStats.quranDays, lastWeekStats.quranDays),
          moodAverage: calculateChange(thisWeekStats.moodAverage, lastWeekStats.moodAverage)
        }
      });

      setMonthlyComparison({
        current: thisMonthStats,
        previous: lastMonthStats,
        changes: {
          studyTime: calculateChange(thisMonthStats.studyTime, lastMonthStats.studyTime),
          deviceTime: calculateChange(thisMonthStats.deviceTime, lastMonthStats.deviceTime),
          focusScore: calculateChange(thisMonthStats.focusScore, lastMonthStats.focusScore),
          disciplineScore: calculateChange(thisMonthStats.disciplineScore, lastMonthStats.disciplineScore),
          salahOnTime: calculateChange(thisMonthStats.salahOnTime, lastMonthStats.salahOnTime),
          quranDays: calculateChange(thisMonthStats.quranDays, lastMonthStats.quranDays),
          moodAverage: calculateChange(thisMonthStats.moodAverage, lastMonthStats.moodAverage)
        }
      });
    } catch (error) {
      console.error('Error fetching comparative analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    weeklyComparison,
    monthlyComparison,
    loading,
    refetch: fetchAnalytics
  };
}
