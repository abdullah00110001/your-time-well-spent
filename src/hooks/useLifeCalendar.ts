import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { differenceInWeeks, startOfWeek, addWeeks, format, parseISO } from 'date-fns';

export interface LifeProfile {
  id: string;
  user_id: string;
  birth_date: string;
  life_expectancy_years: number;
  gender: string | null;
  country: string | null;
}

export interface LifeWeek {
  id: string;
  user_id: string;
  year_number: number;
  week_number: number;
  discipline_score: number;
  focus_hours: number;
  mood_avg: number | null;
  notes: string | null;
  reflection: string | null;
  life_event: string | null;
  tags: string[];
}

export interface LifeMilestone {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  milestone_type: string;
  milestone_date: string;
  icon: string;
  color: string;
}

export type WeekStatus = 'past' | 'current' | 'future' | 'before-birth';

export interface WeekInfo {
  absoluteWeek: number; // 0-indexed from birth
  year: number; // age year (0-indexed)
  weekInYear: number; // 1-52
  status: WeekStatus;
  data?: LifeWeek;
  calendarDate: Date;
}

export function useLifeCalendar() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<LifeProfile | null>(null);
  const [weekData, setWeekData] = useState<Map<string, LifeWeek>>(new Map());
  const [milestones, setMilestones] = useState<LifeMilestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('life_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) setProfile(data as unknown as LifeProfile);
    setLoading(false);
  }, [user]);

  const fetchWeekData = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('life_weeks')
      .select('*')
      .eq('user_id', user.id);
    if (data) {
      const map = new Map<string, LifeWeek>();
      (data as unknown as LifeWeek[]).forEach(w => {
        map.set(`${w.year_number}-${w.week_number}`, w);
      });
      setWeekData(map);
    }
  }, [user]);

  const fetchMilestones = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('life_milestones')
      .select('*')
      .eq('user_id', user.id)
      .order('milestone_date', { ascending: true });
    if (data) setMilestones(data as unknown as LifeMilestone[]);
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchWeekData();
      fetchMilestones();
    }
  }, [user, fetchProfile, fetchWeekData, fetchMilestones]);

  const saveProfile = async (birthDate: string, expectancy: number, gender?: string, country?: string) => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      birth_date: birthDate,
      life_expectancy_years: expectancy,
      gender: gender || null,
      country: country || null,
    };

    const { data, error } = profile
      ? await supabase.from('life_profile').update(payload).eq('user_id', user.id).select().single()
      : await supabase.from('life_profile').insert(payload).select().single();

    if (!error && data) setProfile(data as unknown as LifeProfile);
    setSaving(false);
    return { error };
  };

  const saveWeekNote = async (yearNumber: number, weekNumber: number, updates: Partial<LifeWeek>) => {
    if (!user) return;
    setSaving(true);
    const key = `${yearNumber}-${weekNumber}`;
    const existing = weekData.get(key);

    if (existing) {
      const { error } = await supabase
        .from('life_weeks')
        .update({ ...updates })
        .eq('id', existing.id);
      if (!error) {
        setWeekData(prev => {
          const next = new Map(prev);
          next.set(key, { ...existing, ...updates } as LifeWeek);
          return next;
        });
      }
    } else {
      const { data, error } = await supabase
        .from('life_weeks')
        .insert({
          user_id: user.id,
          year_number: yearNumber,
          week_number: weekNumber,
          ...updates,
        })
        .select()
        .single();
      if (!error && data) {
        setWeekData(prev => {
          const next = new Map(prev);
          next.set(key, data as unknown as LifeWeek);
          return next;
        });
      }
    }
    setSaving(false);
  };

  const addMilestone = async (milestone: Omit<LifeMilestone, 'id' | 'user_id'>) => {
    if (!user) return;
    const { data, error } = await supabase
      .from('life_milestones')
      .insert({ ...milestone, user_id: user.id })
      .select()
      .single();
    if (!error && data) {
      setMilestones(prev => [...prev, data as unknown as LifeMilestone].sort(
        (a, b) => a.milestone_date.localeCompare(b.milestone_date)
      ));
    }
    return { error };
  };

  const deleteMilestone = async (id: string) => {
    const { error } = await supabase.from('life_milestones').delete().eq('id', id);
    if (!error) setMilestones(prev => prev.filter(m => m.id !== id));
  };

  // Computed life stats
  const lifeStats = useMemo(() => {
    if (!profile) return null;
    const birthDate = parseISO(profile.birth_date);
    const now = new Date();
    const totalWeeks = profile.life_expectancy_years * 52;
    const weeksLived = Math.max(0, differenceInWeeks(now, birthDate));
    const weeksRemaining = Math.max(0, totalWeeks - weeksLived);
    const percentUsed = Math.min(100, (weeksLived / totalWeeks) * 100);
    const currentAgeYears = weeksLived / 52;

    return {
      totalWeeks,
      weeksLived,
      weeksRemaining,
      percentUsed,
      currentAgeYears,
      birthDate,
    };
  }, [profile]);

  // Get week info for grid
  const getWeekInfo = useCallback((ageYear: number, weekInYear: number): WeekInfo => {
    if (!profile || !lifeStats) {
      return { absoluteWeek: 0, year: ageYear, weekInYear, status: 'future', calendarDate: new Date() };
    }
    const absoluteWeek = ageYear * 52 + (weekInYear - 1);
    const calendarDate = addWeeks(lifeStats.birthDate, absoluteWeek);
    const status: WeekStatus = absoluteWeek < lifeStats.weeksLived
      ? 'past'
      : absoluteWeek === lifeStats.weeksLived
        ? 'current'
        : 'future';

    const key = `${ageYear}-${weekInYear}`;
    return {
      absoluteWeek,
      year: ageYear,
      weekInYear,
      status,
      data: weekData.get(key),
      calendarDate,
    };
  }, [profile, lifeStats, weekData]);

  return {
    profile,
    loading,
    saving,
    lifeStats,
    weekData,
    milestones,
    saveProfile,
    saveWeekNote,
    addMilestone,
    deleteMilestone,
    getWeekInfo,
    refetch: () => { fetchProfile(); fetchWeekData(); fetchMilestones(); },
  };
}
