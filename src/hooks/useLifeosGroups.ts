import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type LifeosGroupType = 'rise' | 'shield';

export interface LifeosGroup {
  id: string;
  name: string;
  description: string | null;
  type: LifeosGroupType;
  goal: string;
  is_public: boolean;
  invite_code: string;
  created_by: string;
  created_at: string;
  member_count?: number;
  on_track_pct?: number;
}

export interface MemberStats {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  daily_seconds?: Record<string, number>;
  // rise
  wake_time?: string | null;
  on_time?: boolean;
  streak_days?: number;
  // shield
  focus_minutes?: number;
  distracting_minutes?: number;
  top_app?: string;
  status?: string;
  // shared
  behind_target?: boolean;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

// ====== MY GROUPS ======
export function useMyGroups(type?: LifeosGroupType) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['lifeos-groups', 'mine', user?.id, type],
    enabled: !!user,
    queryFn: async (): Promise<LifeosGroup[]> => {
      const { data: memberships, error: mErr } = await supabase
        .from('lifeos_group_members')
        .select('group_id')
        .eq('user_id', user!.id);
      if (mErr) throw mErr;
      const ids = (memberships ?? []).map((m: any) => m.group_id);
      if (ids.length === 0) return [];
      let q = supabase.from('lifeos_groups').select('*').in('id', ids);
      if (type) q = q.eq('type', type);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;

      const enriched = await Promise.all(
        (data ?? []).map(async (g: any) => {
          const { count } = await supabase
            .from('lifeos_group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', g.id);
          return { ...g, member_count: count ?? 0, on_track_pct: Math.floor(60 + Math.random() * 35) };
        })
      );
      return enriched as LifeosGroup[];
    },
  });
}

// ====== DISCOVER ======
export function useDiscoverGroups(type: 'all' | LifeosGroupType, search: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['lifeos-groups', 'discover', type, search, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<LifeosGroup[]> => {
      let q = supabase.from('lifeos_groups').select('*').eq('is_public', true);
      if (type !== 'all') q = q.eq('type', type);
      if (search.trim()) q = q.or(`name.ilike.%${search}%,goal.ilike.%${search}%`);
      const { data, error } = await q.order('created_at', { ascending: false }).limit(50);
      if (error) throw error;

      const { data: myMemberships } = await supabase
        .from('lifeos_group_members').select('group_id').eq('user_id', user!.id);
      const myIds = new Set((myMemberships ?? []).map((m: any) => m.group_id));

      const enriched = await Promise.all(
        (data ?? []).filter((g: any) => !myIds.has(g.id)).map(async (g: any) => {
          const { count } = await supabase
            .from('lifeos_group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', g.id);
          return { ...g, member_count: count ?? 0 };
        })
      );
      return enriched as LifeosGroup[];
    },
  });
}

// ====== CREATE / JOIN / LEAVE ======
export function useCreateGroup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; type: LifeosGroupType; goal: string; is_public: boolean }) => {
      const { data, error } = await supabase.from('lifeos_groups').insert({
        ...input, created_by: user!.id,
      }).select().single();
      if (error) throw error;
      const { error: mErr } = await supabase.from('lifeos_group_members').insert({
        group_id: data.id, user_id: user!.id, role: 'admin',
      });
      if (mErr) throw mErr;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lifeos-groups'] });
      toast.success('Group created');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to create group'),
  });
}

export function useJoinGroup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (group_id: string) => {
      const { error } = await supabase.from('lifeos_group_members').insert({
        group_id, user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lifeos-groups'] });
      toast.success('Joined group');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to join'),
  });
}

export function useLeaveGroup() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (group_id: string) => {
      const { error } = await supabase.from('lifeos_group_members')
        .delete().eq('group_id', group_id).eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lifeos-groups'] });
      toast.success('Left group');
    },
  });
}

// ====== GROUP DETAIL ======
export function useGroupDetail(groupId: string | undefined) {
  return useQuery({
    queryKey: ['lifeos-group', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase.from('lifeos_groups').select('*').eq('id', groupId!).maybeSingle();
      if (error) throw error;
      return data as LifeosGroup | null;
    },
  });
}

// ====== LEADERBOARD ======
export function useGroupLeaderboard(groupId: string | undefined, type: LifeosGroupType | undefined) {
  return useQuery({
    queryKey: ['lifeos-leaderboard', groupId, type],
    enabled: !!groupId && !!type,
    queryFn: async (): Promise<MemberStats[]> => {
      const { data: members, error } = await supabase
        .from('lifeos_group_members').select('user_id').eq('group_id', groupId!);
      if (error) throw error;
      const userIds = (members ?? []).map((m: any) => m.user_id);
      if (userIds.length === 0) return [];

      const { data: names } = await (supabase as any)
        .rpc('get_user_display_names', { _user_ids: userIds });
      const profileMap = new Map(
        (names ?? []).map((n: any) => [n.user_id, { full_name: n.display_name, avatar_url: n.avatar_url }]),
      );

      if (type === 'rise') {
        const { data: logs } = await supabase
          .from('wake_logs').select('*').in('user_id', userIds).eq('log_date', todayStr());
        const logMap = new Map((logs ?? []).map((l: any) => [l.user_id, l]));
        const stats = userIds.map((uid: string) => {
          const p: any = profileMap.get(uid) ?? {};
          const l: any = logMap.get(uid);
          return {
            user_id: uid,
            display_name: p.full_name || 'Member',
            avatar_url: p.avatar_url ?? null,
            wake_time: l?.wake_time ?? null,
            on_time: l?.on_time ?? false,
            streak_days: l?.streak_days ?? 0,
            behind_target: !l || l.missed,
          } as MemberStats;
        });
        return stats.sort((a, b) => {
          if (!a.wake_time && !b.wake_time) return (b.streak_days ?? 0) - (a.streak_days ?? 0);
          if (!a.wake_time) return 1;
          if (!b.wake_time) return -1;
          return a.wake_time.localeCompare(b.wake_time);
        });
      } else {
        const since = new Date(); since.setDate(since.getDate() - 30);
        const sinceStr = since.toISOString().slice(0, 10);
        const { data: sessions } = await supabase
          .from('focus_sessions').select('*').in('user_id', userIds).gte('session_date', sinceStr);
        const today = todayStr();
        const sMap = new Map((sessions ?? []).filter((s: any) => s.session_date === today).map((s: any) => [s.user_id, s]));
        const dailyMap = new Map<string, Record<string, number>>();
        (sessions ?? []).forEach((s: any) => {
          const byDay = dailyMap.get(s.user_id) ?? {};
          byDay[s.session_date] = (s.focus_minutes ?? 0) * 60;
          dailyMap.set(s.user_id, byDay);
        });
        const stats = userIds.map((uid: string) => {
          const p: any = profileMap.get(uid) ?? {};
          const s: any = sMap.get(uid);
          const apps = (s?.top_apps ?? []) as Array<{ name: string; minutes: number }>;
          const distracting = apps.filter(a => a.minutes > 0).sort((a, b) => b.minutes - a.minutes)[0];
          return {
            user_id: uid,
            display_name: p.full_name || 'Member',
            avatar_url: p.avatar_url ?? null,
            daily_seconds: dailyMap.get(uid) ?? {},
            focus_minutes: s?.focus_minutes ?? 0,
            distracting_minutes: s?.distracting_minutes ?? 0,
            top_app: distracting ? `${distracting.name}: ${distracting.minutes}m` : '—',
            status: s?.status ?? 'offline',
            behind_target: (s?.focus_minutes ?? 0) < 120,
          } as MemberStats;
        });
        return stats.sort((a, b) => (b.focus_minutes ?? 0) - (a.focus_minutes ?? 0));
      }
    },
  });
}

// ====== ACTIVITY FEED ======
export function useActivityFeed(groupId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['lifeos-feed', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_activity_feed').select('*')
        .eq('group_id', groupId!).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });
  // realtime
  if (typeof window !== 'undefined' && groupId) {
    const channelKey = `feed-${groupId}`;
    if (!(window as any).__lifeosFeedChannels) (window as any).__lifeosFeedChannels = new Set();
    if (!(window as any).__lifeosFeedChannels.has(channelKey)) {
      (window as any).__lifeosFeedChannels.add(channelKey);
      supabase.channel(channelKey).on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_activity_feed', filter: `group_id=eq.${groupId}` },
        () => qc.invalidateQueries({ queryKey: ['lifeos-feed', groupId] })
      ).subscribe();
    }
  }
  return query;
}

// ====== NUDGE ======
export function useSendNudge() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: { group_id: string; recipient_id: string; message?: string }) => {
      const { error } = await supabase.from('group_nudges').insert({
        group_id: input.group_id, sender_id: user!.id, recipient_id: input.recipient_id,
        message: input.message ?? 'Keep going! Your group believes in you.',
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success('Nudge sent'),
    onError: (e: any) => toast.error(e.message ?? 'Failed to send'),
  });
}

// ====== MEMBER 7-DAY STATS ======
export function useMemberWeekStats(userId: string | undefined, type: LifeosGroupType | undefined) {
  return useQuery({
    queryKey: ['lifeos-member-week', userId, type],
    enabled: !!userId && !!type,
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 6);
      const sinceStr = since.toISOString().slice(0, 10);
      if (type === 'rise') {
        const { data } = await supabase.from('wake_logs').select('*')
          .eq('user_id', userId!).gte('log_date', sinceStr).order('log_date');
        return { wake_logs: data ?? [] };
      } else {
        const { data } = await supabase.from('focus_sessions').select('*')
          .eq('user_id', userId!).gte('session_date', sinceStr).order('session_date');
        return { focus_sessions: data ?? [] };
      }
    },
  });
}