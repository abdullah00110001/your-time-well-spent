/**
 * useNightToRiseGroupStats — SECTION 4: group leaderboard for Sleep to Rise.
 *
 * Aggregates `night_to_rise_logs` into *streak counts only* for the members of
 * one group. Per-night detail is never surfaced to other members; RLS also
 * restricts reads to users who share a group with the caller.
 */

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface GroupNightStat {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  streak: number;
  protectedNights: number;
}

const isoDate = (d: Date) => {
  const x = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};

function streakFor(dates: Set<string>): number {
  let streak = 0;
  const d = new Date();
  d.setDate(d.getDate() - 1);
  for (let i = 0; i < 400; i++) {
    if (!dates.has(isoDate(d))) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function useNightToRiseGroupStats(groupId?: string) {
  const [stats, setStats] = useState<GroupNightStat[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!groupId) { setStats([]); return; }
    let cancelled = false;

    (async () => {
      setIsLoading(true);
      const { data: members } = await supabase
        .from('lifeos_group_members')
        .select('user_id')
        .eq('group_id', groupId);
      const ids = (members ?? []).map((m) => m.user_id);
      if (!ids.length) { if (!cancelled) { setStats([]); setIsLoading(false); } return; }

      const from = new Date();
      from.setDate(from.getDate() - 120);

      const [{ data: logs }, { data: names }] = await Promise.all([
        supabase
          .from('night_to_rise_logs')
          .select('user_id, date, sleep_protected, rise_protected')
          .in('user_id', ids)
          .gte('date', isoDate(from)),
        supabase.rpc('get_user_display_names', { _user_ids: ids }),
      ]);

      const byUser = new Map<string, Set<string>>();
      for (const l of logs ?? []) {
        if (!l.sleep_protected || !l.rise_protected) continue;
        if (!byUser.has(l.user_id)) byUser.set(l.user_id, new Set());
        byUser.get(l.user_id)!.add(l.date as string);
      }
      const nameMap = new Map((names ?? []).map((n: any) => [n.user_id, n]));

      const out: GroupNightStat[] = ids.map((id) => {
        const dates = byUser.get(id) ?? new Set<string>();
        const info = nameMap.get(id);
        return {
          user_id: id,
          display_name: info?.display_name ?? 'Member',
          avatar_url: info?.avatar_url ?? null,
          streak: streakFor(dates),
          protectedNights: dates.size,
        };
      }).sort((a, b) => b.streak - a.streak || b.protectedNights - a.protectedNights);

      if (!cancelled) { setStats(out); setIsLoading(false); }
    })();

    return () => { cancelled = true; };
  }, [groupId]);

  const topStreak = useMemo(() => stats[0]?.streak ?? 0, [stats]);

  return { stats, isLoading, topStreak };
}
