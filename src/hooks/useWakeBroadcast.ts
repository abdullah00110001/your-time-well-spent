import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface WakeBroadcastInput {
  group_id: string;
  kind: 'leader' | 'member';
  target_user_id?: string;
  message?: string;
}

export function useWakeBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WakeBroadcastInput) => {
      const { data, error } = await supabase.functions.invoke('wake-broadcast', { body: input });
      if (error) {
        // Functions client wraps non-2xx as error; extract body when available
        const ctx: any = (error as any).context;
        try {
          const body = ctx?.body ? JSON.parse(await new Response(ctx.body).text()) : null;
          if (body?.error) throw Object.assign(new Error(body.error), { code: body.code, used: body.used, max: body.max });
        } catch (_) { /* fallthrough */ }
        throw error;
      }
      if ((data as any)?.error) {
        throw Object.assign(new Error((data as any).error), { code: (data as any).code });
      }
      return data;
    },
    onSuccess: (data: any, vars) => {
      qc.invalidateQueries({ queryKey: ['group-wake-calls', vars.group_id] });
      const count = Array.isArray(data?.recipients) ? data.recipients.length : 1;
      if (vars.kind === 'leader') {
        toast.success(`Wake call sent to ${count} member${count !== 1 ? 's' : ''}`);
      } else {
        toast.success(data?.trusted ? 'Trusted wake call sent 🔔' : 'Wake call sent 🔔');
      }
    },
    onError: (e: any) => {
      const code = e?.code;
      if (code === 'member_rate_limited') {
        toast.error(`${e.used}/${e.max} wake calls used for today`);
      } else if (code === 'trusted_cooldown') {
        toast.error(e.message);
      } else {
        toast.error(e?.message ?? 'Could not send wake call');
      }
    },
  });
}

export function useCanLeaderWake(groupId: string | undefined) {
  return useQuery({
    queryKey: ['can-leader-wake', groupId],
    enabled: !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_send_leader_wake', { _group_id: groupId! });
      if (error) return false;
      return !!data;
    },
    refetchInterval: 60_000,
  });
}

export function useTrustedWakers(groupId: string | undefined, grantorId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['trusted-wakers', groupId, grantorId],
    enabled: !!groupId && !!grantorId,
    queryFn: async () => {
      const { data } = await supabase
        .from('group_trusted_wakers')
        .select('grantee_id')
        .eq('group_id', groupId!)
        .eq('grantor_id', grantorId!);
      return new Set((data ?? []).map((r: any) => r.grantee_id));
    },
  });

  const toggle = useMutation({
    mutationFn: async (granteeId: string) => {
      const current = query.data;
      if (!groupId || !grantorId) return;
      if (current?.has(granteeId)) {
        const { error } = await supabase.from('group_trusted_wakers')
          .delete()
          .eq('group_id', groupId).eq('grantor_id', grantorId).eq('grantee_id', granteeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('group_trusted_wakers')
          .insert({ group_id: groupId, grantor_id: grantorId, grantee_id: granteeId });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['trusted-wakers', groupId, grantorId] }),
    onError: (e: any) => toast.error(e?.message ?? 'Failed'),
  });

  return { ...query, toggle };
}
