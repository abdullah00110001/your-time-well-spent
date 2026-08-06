import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { WeeklyRecapData } from '@/components/rise/WeeklyRecapSheet';

const DAYS_BN = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];

export function useWeeklyRecap() {
  const { user } = useAuth();
  const [recap, setRecap] = useState<WeeklyRecapData | null>(null);
  const [recapOpen, setRecapOpen] = useState(false);

  const buildRecap = useCallback(async () => {
    if (!user) return;

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('rise_wake_events' as any)
      .select('woke_at, city')
      .eq('user_id', user.id)
      .gte('woke_at', weekStart.toISOString())
      .order('woke_at', { ascending: true });

    const events = (data as any[]) || [];

    if (events.length === 0) return;

    // Unique days woken
    const uniqueDays = new Set(events.map((e: any) => e.woke_at.split('T')[0]));
    const daysWoken = uniqueDays.size;

    // Avg wake time (minutes from midnight)
    const totalMinutes = events.reduce((sum: number, e: any) => {
      const d = new Date(e.woke_at);
      return sum + d.getHours() * 60 + d.getMinutes();
    }, 0);
    const avgMin = Math.round(totalMinutes / events.length);
    const avgH = Math.floor(avgMin / 60).toString().padStart(2, '0');
    const avgM = (avgMin % 60).toString().padStart(2, '0');
    const avgWakeTime = `${avgH}:${avgM} AM`;

    // Best day (earliest wake)
    const earliest = events[0];
    const bestDay = DAYS_BN[new Date(earliest.woke_at).getDay()];

    // City stats — wakers in same city this week
    const myCity = events[events.length - 1]?.city;
    let cityTotalWakers = 0;
    let cityEarliestWake = '—';
    let cityMostActiveDay = '—';

    if (myCity) {
      const { data: cityData } = await supabase
        .from('rise_wake_events' as any)
        .select('woke_at')
        .eq('city', myCity)
        .gte('woke_at', weekStart.toISOString())
        .order('woke_at', { ascending: true });

      const cityEvents = (cityData as any[]) || [];
      cityTotalWakers = new Set(cityEvents.map((e: any) => e.user_id)).size;

      if (cityEvents.length > 0) {
        const first = new Date(cityEvents[0].woke_at);
        cityEarliestWake = first.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Day with most wakers
        const dayCount: Record<number, number> = {};
        cityEvents.forEach((e: any) => {
          const d = new Date(e.woke_at).getDay();
          dayCount[d] = (dayCount[d] || 0) + 1;
        });
        const topDay = Object.entries(dayCount).sort((a, b) => b[1] - a[1])[0];
        if (topDay) cityMostActiveDay = DAYS_BN[parseInt(topDay[0])];
      }
    }

    setRecap({
      daysWoken,
      totalDays: 7,
      avgWakeTime,
      bestDay,
      currentStreak: 0, // will be filled by streak hook
      cityTotalWakers,
      cityEarliestWake,
      cityMostActiveDay,
    });
  }, [user]);

  // Show recap on Sunday
  useEffect(() => {
    const day = new Date().getDay();
    const hour = new Date().getHours();
    const shownKey = `rise_recap_shown_${new Date().toISOString().split('T')[0]}`;
    if (day === 0 && hour >= 9 && !localStorage.getItem(shownKey)) {
      buildRecap().then(() => {
        localStorage.setItem(shownKey, '1');
        setRecapOpen(true);
      });
    }
  }, [buildRecap]);

  return { recap, recapOpen, setRecapOpen, buildRecap };
}
