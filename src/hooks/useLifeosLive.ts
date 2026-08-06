import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type PresenceStatus =
  | 'sleeping' | 'waking' | 'in_rise_mission'
  | 'deep_work' | 'shield_focus'
  | 'distracted' | 'idle' | 'offline';

export type RoomKind = 'study' | 'deep_work' | 'wake_up' | 'quran' | 'detox' | 'custom';
export type ChallengeKind = 'wake_race' | 'focus_marathon' | 'anti_relapse' | 'streak_battle' | 'custom';
export type FailureKind = 'missed_wake' | 'focus_abandon' | 'relapse' | 'streak_break';

// ============== PRESENCE ==============
export async function setPresence(input: {
  status: PresenceStatus;
  current_group_id?: string | null;
  current_room_id?: string | null;
  metadata?: Record<string, any>;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('user_presence').upsert({
    user_id: user.id,
    status: input.status,
    current_group_id: input.current_group_id ?? null,
    current_room_id: input.current_room_id ?? null,
    metadata: (input.metadata ?? {}) as any,
    last_seen: new Date().toISOString(),
  });
}

export function useGroupPresence(groupId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['presence', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data: members } = await supabase
        .from('lifeos_group_members').select('user_id').eq('group_id', groupId!);
      const ids = (members ?? []).map((m: any) => m.user_id);
      if (!ids.length) return [];
      const { data: presence } = await supabase
        .from('user_presence').select('*').in('user_id', ids);
      const { data: profiles } = await supabase
        .from('profiles').select('user_id, full_name, avatar_url').in('user_id', ids);
      const pmap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      const presenceMap = new Map((presence ?? []).map((p: any) => [p.user_id, p]));
      return ids.map((uid) => {
        const prof: any = pmap.get(uid) ?? {};
        const pres: any = presenceMap.get(uid) ?? { status: 'offline', last_seen: null };
        return {
          user_id: uid,
          display_name: prof.full_name ?? 'Member',
          avatar_url: prof.avatar_url ?? null,
          status: pres.status as PresenceStatus,
          last_seen: pres.last_seen,
          current_room_id: pres.current_room_id,
          metadata: pres.metadata ?? {},
        };
      });
    },
  });

  useEffect(() => {
    if (!groupId) return;
    const ch = supabase.channel(`presence-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' },
        () => qc.invalidateQueries({ queryKey: ['presence', groupId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [groupId, qc]);

  return query;
}

// Auto heartbeat presence while user has an active group context.
export function usePresenceHeartbeat(groupId: string | undefined, status: PresenceStatus = 'idle') {
  useEffect(() => {
    if (!groupId) return;
    setPresence({ status, current_group_id: groupId });
    const id = setInterval(() => setPresence({ status, current_group_id: groupId }), 45_000);
    const offHandler = () => setPresence({ status: 'offline', current_group_id: null });
    window.addEventListener('beforeunload', offHandler);
    return () => {
      clearInterval(id);
      window.removeEventListener('beforeunload', offHandler);
      setPresence({ status: 'offline', current_group_id: null });
    };
  }, [groupId, status]);
}

// ============== ROOMS ==============
export function useGroupRooms(groupId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['rooms', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_rooms').select('*')
        .eq('group_id', groupId!).eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // count active participants per room
      const enriched = await Promise.all((data ?? []).map(async (r: any) => {
        const { count } = await supabase
          .from('room_participants').select('*', { count: 'exact', head: true })
          .eq('room_id', r.id).is('left_at', null);
        return { ...r, active_count: count ?? 0 };
      }));
      return enriched;
    },
  });

  useEffect(() => {
    if (!groupId) return;
    const ch = supabase.channel(`rooms-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_rooms', filter: `group_id=eq.${groupId}` },
        () => qc.invalidateQueries({ queryKey: ['rooms', groupId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `group_id=eq.${groupId}` },
        () => qc.invalidateQueries({ queryKey: ['rooms', groupId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [groupId, qc]);

  return query;
}

export function useCreateRoom() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { group_id: string; name: string; kind: RoomKind; target_minutes?: number; description?: string }) => {
      const { data, error } = await supabase.from('group_rooms').insert({
        group_id: input.group_id, name: input.name, kind: input.kind,
        target_minutes: input.target_minutes ?? 60,
        description: input.description ?? null,
        created_by: user!.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['rooms', vars.group_id] });
      toast.success('Live room created');
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to create room'),
  });
}

export function useJoinRoom() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { room_id: string; group_id: string }) => {
      const { error } = await supabase.from('room_participants').insert({
        room_id: input.room_id, group_id: input.group_id, user_id: user!.id, status: 'focusing',
      });
      if (error) throw error;
      await setPresence({ status: 'deep_work', current_group_id: input.group_id, current_room_id: input.room_id });
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['rooms', v.group_id] }),
    onError: (e: any) => toast.error(e.message ?? 'Failed to join'),
  });
}

export function useLeaveRoom() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { room_id: string; group_id: string; focus_minutes: number }) => {
      const { error } = await supabase.from('room_participants').update({
        left_at: new Date().toISOString(), focus_minutes: input.focus_minutes, status: 'done',
      }).eq('room_id', input.room_id).eq('user_id', user!.id).is('left_at', null);
      if (error) throw error;
      await setPresence({ status: 'idle', current_group_id: input.group_id, current_room_id: null });
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['rooms', v.group_id] }),
  });
}

export function useRoomParticipants(roomId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['room-participants', roomId],
    enabled: !!roomId,
    queryFn: async () => {
      const { data } = await supabase.from('room_participants').select('*')
        .eq('room_id', roomId!).is('left_at', null);
      const ids = (data ?? []).map((p: any) => p.user_id);
      if (!ids.length) return [];
      const { data: profiles } = await supabase
        .from('profiles').select('user_id, full_name, avatar_url').in('user_id', ids);
      const pmap = new Map((profiles ?? []).map((p: any) => [p.user_id, p]));
      return (data ?? []).map((p: any) => ({
        ...p,
        display_name: (pmap.get(p.user_id) as any)?.full_name ?? 'Member',
        avatar_url: (pmap.get(p.user_id) as any)?.avatar_url ?? null,
      }));
    },
  });

  useEffect(() => {
    if (!roomId) return;
    const ch = supabase.channel(`participants-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_participants', filter: `room_id=eq.${roomId}` },
        () => qc.invalidateQueries({ queryKey: ['room-participants', roomId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId, qc]);

  return query;
}

// ============== CHALLENGES ==============
export function useGroupChallenges(groupId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['challenges', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data } = await supabase.from('group_challenges').select('*')
        .eq('group_id', groupId!).order('created_at', { ascending: false }).limit(20);
      return data ?? [];
    },
  });
  useEffect(() => {
    if (!groupId) return;
    const ch = supabase.channel(`challenges-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_challenges', filter: `group_id=eq.${groupId}` },
        () => qc.invalidateQueries({ queryKey: ['challenges', groupId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [groupId, qc]);
  return query;
}

export function useCreateChallenge() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      group_id: string; title: string; kind: ChallengeKind;
      target_value: number; target_unit: string;
      ends_at: string; description?: string; prize?: string;
    }) => {
      const { data, error } = await supabase.from('group_challenges').insert({
        ...input, created_by: user!.id,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, v) => { qc.invalidateQueries({ queryKey: ['challenges', v.group_id] }); toast.success('Challenge launched'); },
    onError: (e: any) => toast.error(e.message ?? 'Failed'),
  });
}

export function useJoinChallenge() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { challenge_id: string; group_id: string }) => {
      const { error } = await supabase.from('challenge_participants').insert({
        challenge_id: input.challenge_id, user_id: user!.id,
      });
      if (error && !error.message.includes('duplicate')) throw error;
    },
    onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['challenges', v.group_id] }),
    onError: (e: any) => toast.error(e.message ?? 'Failed'),
  });
}

// ============== FAILURES ==============
export function useGroupFailures(groupId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['failures', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data } = await supabase.from('accountability_failures').select('*')
        .eq('group_id', groupId!).order('created_at', { ascending: false }).limit(50);
      const ids = Array.from(new Set((data ?? []).map((f: any) => f.user_id)));
      const { data: profiles } = ids.length
        ? await supabase.from('profiles').select('user_id, full_name').in('user_id', ids)
        : { data: [] as any[] };
      const pmap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.full_name]));
      return (data ?? []).map((f: any) => ({ ...f, display_name: pmap.get(f.user_id) ?? 'Member' }));
    },
  });
  useEffect(() => {
    if (!groupId) return;
    const ch = supabase.channel(`failures-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'accountability_failures', filter: `group_id=eq.${groupId}` },
        () => qc.invalidateQueries({ queryKey: ['failures', groupId] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [groupId, qc]);
  return query;
}

export async function logFailure(input: {
  group_id: string; kind: FailureKind; severity?: 'low' | 'medium' | 'high';
  penalty_points?: number; message?: string;
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('accountability_failures').insert({
    user_id: user.id,
    group_id: input.group_id,
    kind: input.kind,
    severity: input.severity ?? 'medium',
    penalty_points: input.penalty_points ?? 5,
    message: input.message ?? null,
  });
}

// ============== Live ticker for room session ==============
export function useRoomTicker(joinedAt: string | null) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!joinedAt) return;
    const start = new Date(joinedAt).getTime();
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [joinedAt]);
  return seconds;
}