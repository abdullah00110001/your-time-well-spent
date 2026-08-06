import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type WakeMemberStatusKind =
  | 'pending'
  | 'mission_done'
  | 'active'
  | 'silent'
  | 'sleeping';

export interface GroupWakeAlarm {
  id: string;
  group_id: string;
  created_by: string;
  wake_time: string; // HH:mm:ss
  days_of_week: number[];
  mission_type: string;
  is_active: boolean;
  follow_up_minutes?: number;
  max_wake_calls?: number;
  roll_call_minutes_after?: number;
  shared_ringtone_url?: string | null;
  shared_ringtone_title?: string | null;
}

export interface GroupWakeAlarmInput {
  wake_time: string;
  days_of_week: number[];
  mission_type: string;
  follow_up_minutes?: number;
  max_wake_calls?: number;
  roll_call_minutes_after?: number;
  shared_ringtone_url?: string | null;
  shared_ringtone_title?: string | null;
}

export interface GroupWakeSession {
  id: string;
  group_alarm_id: string;
  group_id: string;
  session_date: string;
  triggered_at: string;
}

export interface GroupWakeMemberStatus {
  id: string;
  session_id: string;
  user_id: string;
  group_id: string;
  status: WakeMemberStatusKind;
  status_text: string | null;
  mission_completed_at: string | null;
  status_updated_at: string | null;
  wake_up_calls_received: number;
}

const SILENCE_MS = 15 * 60 * 1000;

export function deriveAgedStatus(s: GroupWakeMemberStatus, nowMs: number = Date.now()): WakeMemberStatusKind {
  if (s.status === 'mission_done' || s.status === 'active') {
    const ts = s.status_updated_at ? new Date(s.status_updated_at).getTime() : 0;
    if (s.status === 'mission_done' && nowMs - ts > SILENCE_MS) return 'silent';
    return s.status;
  }
  if (s.status === 'pending') {
    const ts = s.mission_completed_at ? new Date(s.mission_completed_at).getTime() : 0;
    if (ts && nowMs - ts > SILENCE_MS) return 'sleeping';
  }
  return s.status;
}

export function useGroupWakeAlarm(groupId: string | null) {
  const { user } = useAuth();
  const [alarm, setAlarm] = useState<GroupWakeAlarm | null>(null);
  const [session, setSession] = useState<GroupWakeSession | null>(null);
  const [statuses, setStatuses] = useState<GroupWakeMemberStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const { data: alarmRow } = await supabase
        .from('group_wake_alarms')
        .select('*')
        .eq('group_id', groupId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setAlarm((alarmRow as any) || null);

      if (alarmRow) {
        const { data: sessionRow } = await supabase
          .from('group_wake_sessions')
          .select('*')
          .eq('group_alarm_id', alarmRow.id)
          .eq('session_date', today)
          .maybeSingle();
        setSession((sessionRow as any) || null);

        if (sessionRow) {
          const { data: statusRows } = await supabase
            .from('group_wake_member_status')
            .select('*')
            .eq('session_id', sessionRow.id);
          setStatuses((statusRows as any) || []);
        } else {
          setStatuses([]);
        }
      } else {
        setSession(null);
        setStatuses([]);
      }
    } finally {
      setLoading(false);
    }
  }, [groupId, today]);

  useEffect(() => { void load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!session?.id) return;
    const channel = supabase
      .channel(`gwms-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_wake_member_status', filter: `session_id=eq.${session.id}` }, () => {
        void load();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_wake_calls', filter: `session_id=eq.${session.id}` }, () => {
        void load();
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [session?.id, load]);

  const myStatus = useMemo(
    () => statuses.find((s) => s.user_id === user?.id) || null,
    [statuses, user?.id]
  );

  const upsertMyStatus = useCallback(async (patch: Partial<Pick<GroupWakeMemberStatus, 'status' | 'status_text' | 'mission_completed_at'>>) => {
    if (!user || !session || !groupId) {
      toast.error('No active group wake session');
      return;
    }
    const now = new Date().toISOString();
    const payload: any = {
      session_id: session.id,
      user_id: user.id,
      group_id: groupId,
      status_updated_at: now,
      ...patch,
    };
    const { error } = await supabase
      .from('group_wake_member_status')
      .upsert(payload, { onConflict: 'session_id,user_id' });
    if (error) {
      console.error(error);
      toast.error('Could not update status');
    } else {
      void load();
    }
  }, [user, session, groupId, load]);

  const sendWakeUpCall = useCallback(async (toUserId: string, message?: string) => {
    if (!session) return;
    try {
      const { data, error } = await supabase.functions.invoke('send-group-wake', {
        body: { session_id: session.id, to_user_id: toUserId, custom_message: message || null },
      });
      if (error) throw error;
      toast.success('Wake-up call sent');
      return data;
    } catch (e: any) {
      toast.error(e?.message || 'Could not send wake-up call');
    }
  }, [session]);

  const upsertAlarm = useCallback(async (input: GroupWakeAlarmInput) => {
    if (!user || !groupId) return;
    if (alarm) {
      const { error } = await supabase
        .from('group_wake_alarms')
        .update({ ...input, is_active: true } as any)
        .eq('id', alarm.id);
      if (error) { toast.error('Could not save alarm'); return; }
    } else {
      const { error } = await supabase
        .from('group_wake_alarms')
        .insert({ ...input, group_id: groupId, created_by: user.id, is_active: true } as any);
      if (error) { toast.error('Could not create alarm'); return; }
    }
    toast.success('Group alarm saved');
    void load();
  }, [alarm, user, groupId, load]);

  const disableAlarm = useCallback(async () => {
    if (!alarm) return;
    await supabase.from('group_wake_alarms').update({ is_active: false }).eq('id', alarm.id);
    toast.success('Alarm disabled');
    void load();
  }, [alarm, load]);

  return {
    loading,
    alarm,
    session,
    statuses,
    myStatus,
    upsertMyStatus,
    sendWakeUpCall,
    upsertAlarm,
    disableAlarm,
    reload: load,
  };
}