import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, subDays } from 'date-fns';

export interface DailyEntryData {
  date: string;
  fajr_completed: boolean;
  dhuhr_completed: boolean;
  asr_completed: boolean;
  maghrib_completed: boolean;
  isha_completed: boolean;
  quran_minutes: number;
  focused_study_minutes: number;
  device_time_minutes: number;
  mindless_scrolling_minutes: number;
  service_hours: number;
  tahajjud_performed: boolean;
  urges_resisted: number;
  urges_succumbed: number;
  day_reset_used: boolean;
  mawt_preparedness: number;
  barakah_index: number;
  akhirah_score: number;
  dunya_score: number;
  weighted_daily_score: number;
  energy_level: number;
}

export interface StudySessionData {
  id: string;
  date: string;
  niyyah: string;
  niyyah_multiplier: number;
  duration_minutes: number;
  barakah_score: number;
  started_at: string;
  ended_at: string | null;
}

export interface ServiceLogData {
  id: string;
  date: string;
  service_type: string;
  hours: number;
  beneficiary: string | null;
  mood_before: number | null;
  mood_after: number | null;
}

export interface NafsLogData {
  id: string;
  date: string;
  resisted: boolean;
  urge_type: string;
  triggered_at: string;
}

export interface TahajjudData {
  date: string;
  performed: boolean;
  energyLevel: number;
}

interface DashboardData {
  todayEntry: DailyEntryData | null;
  recentEntries: DailyEntryData[];
  studySessions: StudySessionData[];
  serviceLogs: ServiceLogData[];
  nafsLogs: NafsLogData[];
  tahajjudData: TahajjudData[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useDashboardData(): DashboardData {
  const { user } = useAuth();
  const [todayEntry, setTodayEntry] = useState<DailyEntryData | null>(null);
  const [recentEntries, setRecentEntries] = useState<DailyEntryData[]>([]);
  const [studySessions, setStudySessions] = useState<StudySessionData[]>([]);
  const [serviceLogs, setServiceLogs] = useState<ServiceLogData[]>([]);
  const [nafsLogs, setNafsLogs] = useState<NafsLogData[]>([]);
  const [tahajjudData, setTahajjudData] = useState<TahajjudData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const today = format(new Date(), 'yyyy-MM-dd');
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

      // Fetch all data in parallel
      const [
        todayResult,
        recentResult,
        sessionsResult,
        serviceResult,
        nafsResult,
      ] = await Promise.all([
        // Today's entry
        supabase
          .from('daily_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle(),

        // Recent 30 days entries
        supabase
          .from('daily_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', thirtyDaysAgo)
          .order('date', { ascending: false }),

        // Study sessions
        supabase
          .from('study_sessions')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', thirtyDaysAgo)
          .order('started_at', { ascending: false }),

        // Service logs
        supabase
          .from('service_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', thirtyDaysAgo)
          .order('date', { ascending: false }),

        // Nafs logs
        supabase
          .from('nafs_logs')
          .select('*')
          .eq('user_id', user.id)
          .gte('date', thirtyDaysAgo)
          .order('triggered_at', { ascending: false }),
      ]);

      // Only throw on critical errors, not missing tables
      if (todayResult.error) console.warn('[Dashboard] todayEntry error:', todayResult.error.message);
      if (recentResult.error) console.warn('[Dashboard] recentEntries error:', recentResult.error.message);
      if (sessionsResult.error) console.warn('[Dashboard] sessions error:', sessionsResult.error.message);
      if (serviceResult.error) console.warn('[Dashboard] service error:', serviceResult.error.message);
      if (nafsResult.error) console.warn('[Dashboard] nafs error:', nafsResult.error.message);

      // Process today's entry
      setTodayEntry(todayResult.data as DailyEntryData | null);

      // Process recent entries
      const entries = (recentResult.data || []) as DailyEntryData[];
      setRecentEntries(entries);

      // Generate tahajjud correlation data
      const tahajjud: TahajjudData[] = entries.map(e => ({
        date: e.date,
        performed: e.tahajjud_performed || false,
        energyLevel: e.energy_level || 5,
      }));
      setTahajjudData(tahajjud);

      // Process study sessions
      setStudySessions((sessionsResult.data || []) as StudySessionData[]);

      // Process service logs
      setServiceLogs((serviceResult.data || []) as ServiceLogData[]);

      // Process nafs logs
      setNafsLogs((nafsResult.data || []) as NafsLogData[]);

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [user]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_entries',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'study_sessions',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_logs',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'nafs_logs',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    todayEntry,
    recentEntries,
    studySessions,
    serviceLogs,
    nafsLogs,
    tahajjudData,
    loading,
    error,
    refetch: fetchData,
  };
}

// Helper function to calculate scores
export function calculateScores(entry: DailyEntryData | null) {
  if (!entry) {
    return {
      salahCompleted: 0,
      worshipScore: 0,
      productivityScore: 0,
      overallScore: 0,
    };
  }

  const salahCompleted = [
    entry.fajr_completed,
    entry.dhuhr_completed,
    entry.asr_completed,
    entry.maghrib_completed,
    entry.isha_completed,
  ].filter(Boolean).length;

  // Worship score (max 100)
  const salahPoints = salahCompleted * 12; // 60 max
  const quranPoints = Math.min(20, (entry.quran_minutes || 0) / 1.5);
  const tahajjudPoints = entry.tahajjud_performed ? 10 : 0;
  const servicePoints = Math.min(10, (entry.service_hours || 0) * 5);
  const worshipScore = Math.round(salahPoints + quranPoints + tahajjudPoints + servicePoints);

  // Productivity score (max 100)
  const studyPoints = Math.min(50, (entry.focused_study_minutes || 0) / 3);
  const devicePenalty = Math.min(30, (entry.mindless_scrolling_minutes || 0) / 4);
  const productivityScore = Math.max(0, Math.round(studyPoints + 50 - devicePenalty));

  // Overall weighted score (60% worship, 40% productivity)
  const overallScore = Math.round(worshipScore * 0.6 + productivityScore * 0.4);

  return {
    salahCompleted,
    worshipScore,
    productivityScore,
    overallScore,
  };
}
