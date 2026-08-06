/**
 * useRiseGroupLiveData — real wake events for the members of a Rise group
 * shaped into UnifiedMember[] for the YPT-style group shell.
 *
 *  - lifeos_group_members  → roster
 *  - profiles              → display name + avatar
 *  - rise_wake_events      → today wake_at + last 30 days for streak/totals
 */

import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { UnifiedMember } from '@/components/groups/UnifiedGroupDetail';
import type { WakeMemberStatusKind } from '@/hooks/useGroupWakeAlarm';

function startOfDay(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
}
function startOfIsoWeek(d = new Date()) {
  const day = d.getDay();
  const offsetToMon = (day + 6) % 7;
  const mon = startOfDay(d);
  mon.setDate(d.getDate() - offsetToMon);
  return mon;
}
function diffDaysIndex(weekStart: Date, woke: Date): number {
  const ms = startOfDay(woke).getTime() - weekStart.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export interface RiseGroupLiveData {
  members: UnifiedMember[];
  isLoading: boolean;
}

export function useRiseGroupLiveData(groupId: string | undefined): RiseGroupLiveData {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['rise-group-live', groupId],
    enabled: !!groupId,
    refetchInterval: 30_000,
    queryFn: async (): Promise<UnifiedMember[]> => {
      const { data: roster } = await supabase
        .from('lifeos_group_members')
        .select('user_id, role')
        .eq('group_id', groupId!);
      const userIds = (roster ?? []).map((r) => r.user_id);
      if (userIds.length === 0) return [];

      const { data: names } = await (supabase as any)
        .rpc('get_user_display_names', { _user_ids: userIds });
      const profMap = new Map<string, { name: string | null; avatar: string | null }>(
        (names ?? []).map((n: any) => [n.user_id, { name: n.display_name, avatar: n.avatar_url }]),
      );

      const weekStart = startOfIsoWeek(new Date());
      const since30 = new Date(); since30.setDate(since30.getDate() - 30);

      const { data: events } = await supabase
        .from('rise_wake_events')
        .select('user_id, woke_at')
        .in('user_id', userIds)
        .gte('woke_at', since30.toISOString())
        .eq('is_hidden', false)
        .order('woke_at', { ascending: true });

      // Per-user first wake per day (Mon..Sun of this week)
      const perUserWeek = new Map<string, (Date | null)[]>();
      // Per-user set of YYYY-MM-DD days woke in the last 30 days (for streak + total)
      const perUserDays = new Map<string, Set<string>>();
      userIds.forEach((u) => {
        perUserWeek.set(u, [null, null, null, null, null, null, null]);
        perUserDays.set(u, new Set());
      });

      for (const e of events ?? []) {
        const woke = new Date(e.woke_at as string);
        const dayKey = startOfDay(woke).toISOString().slice(0, 10);
        perUserDays.get(e.user_id)?.add(dayKey);

        const idx = diffDaysIndex(weekStart, woke);
        if (idx >= 0 && idx <= 6) {
          const arr = perUserWeek.get(e.user_id);
          if (arr && !arr[idx]) arr[idx] = woke;
        }
      }

      const now = Date.now();
      const todayIdx = diffDaysIndex(weekStart, new Date());

      return userIds.map((uid) => {
        const role = (roster ?? []).find((r) => r.user_id === uid)?.role;
        const week = perUserWeek.get(uid) ?? [];
        const days = perUserDays.get(uid) ?? new Set<string>();
        const wakeEvents = (events ?? [])
          .filter((e: any) => e.user_id === uid)
          .map((e: any) => e.woke_at as string);

        const weekSeconds = week.map((d) =>
          d ? Math.max(0, Math.floor((now - d.getTime()) / 1000)) : 0,
        );
        const weekChecked = week.map((d) => !!d);
        const weekWakeAt = week.map((d) => d?.toISOString() ?? null);

        const todayWake = week[todayIdx];
        const secondsToday = todayWake
          ? Math.max(0, Math.floor((now - todayWake.getTime()) / 1000))
          : 0;

        // Streak: consecutive days ending today
        let streak = 0;
        const cursor = startOfDay(new Date());
        // If hasn't woke today, streak can still be yesterday-anchored
        let started = false;
        for (let i = 0; i < 30; i++) {
          const key = cursor.toISOString().slice(0, 10);
          if (days.has(key)) { streak++; started = true; }
          else if (started || i > 0) break;
          cursor.setDate(cursor.getDate() - 1);
        }

        const prof = profMap.get(uid);
        const wakeStatus: WakeMemberStatusKind = todayWake
          ? secondsToday < 30 * 60 ? 'mission_done' : 'active'
          : 'pending';

        return {
          user_id: uid,
          full_name: prof?.name ?? null,
          avatar_url: prof?.avatar ?? null,
          seconds_today: secondsToday,
          goal_met: !!todayWake,
          is_active: !!todayWake,
          wake_status: wakeStatus,
          region_label: role === 'admin' || role === 'owner' || role === 'leader' ? '★ Leader' : undefined,
          week_seconds: weekSeconds,
          week_checked: weekChecked,
          week_wake_at: weekWakeAt,
          wake_events: wakeEvents,
          woke_at_today: todayWake?.toISOString() ?? null,
          streak_days: streak,
          total_wakes_30d: days.size,
          role: role ?? null,
        } satisfies UnifiedMember;
      });
    },
  });

  useEffect(() => {
    if (!groupId) return;
    const ch = supabase
      .channel(`rise-group-live-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rise_wake_events' },
        () => qc.invalidateQueries({ queryKey: ['rise-group-live', groupId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lifeos_group_members', filter: `group_id=eq.${groupId}` },
        () => qc.invalidateQueries({ queryKey: ['rise-group-live', groupId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [groupId, qc]);

  return useMemo(
    () => ({ members: query.data ?? [], isLoading: query.isLoading }),
    [query.data, query.isLoading],
  );
}
