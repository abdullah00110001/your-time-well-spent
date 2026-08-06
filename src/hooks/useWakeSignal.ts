import { useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

type SignalType = 'gentle' | 'urgent' | 'sos';

const COOLDOWN_MS = 5 * 60 * 1000;
const COOLDOWN_KEY = 'rise_signal_cooldowns';

interface SignalCooldown { [targetUserId: string]: number; }

function getCooldowns(): SignalCooldown {
  try { return JSON.parse(localStorage.getItem(COOLDOWN_KEY) || '{}'); } catch { return {}; }
}
function setCooldown(targetUserId: string) {
  const c = getCooldowns(); c[targetUserId] = Date.now();
  localStorage.setItem(COOLDOWN_KEY, JSON.stringify(c));
}
function isOnCooldown(targetUserId: string): boolean {
  const last = getCooldowns()[targetUserId];
  return !!last && Date.now() - last < COOLDOWN_MS;
}
function getRemainingCooldown(targetUserId: string): number {
  const last = getCooldowns()[targetUserId];
  if (!last) return 0;
  const remaining = COOLDOWN_MS - (Date.now() - last);
  return remaining > 0 ? remaining : 0;
}

export function useWakeSignal() {
  const { user } = useAuth();
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const sendWakeSignal = useCallback(async (targetUserId: string, groupId: string, signalType: SignalType = 'gentle') => {
    if (!user) return false;

    // Server-side cooldown check (best-effort)
    try {
      const since = new Date(Date.now() - COOLDOWN_MS).toISOString();
      const { count } = await supabase
        .from('wake_signals' as any)
        .select('id', { count: 'exact', head: true })
        .eq('sender_id', user.id)
        .eq('target_id', targetUserId)
        .gte('sent_at', since);
      if ((count || 0) > 0) {
        setCooldown(targetUserId);
      }
    } catch { /* table may not exist yet */ }

    if (isOnCooldown(targetUserId)) {
      const remaining = Math.ceil(getRemainingCooldown(targetUserId) / 60000);
      toast.error(`Please wait ${remaining} minute${remaining === 1 ? '' : 's'} before sending another signal`);
      return false;
    }

    setSendingTo(targetUserId);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: existing } = await supabase
        .from('group_wake_status')
        .select('id')
        .eq('group_id', groupId)
        .eq('user_id', targetUserId)
        .eq('wake_date', today)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from('group_wake_status').update({ needs_help: true }).eq('id', existing.id);
      }

      // Record signal in DB (audit + cooldown)
      try {
        await supabase.from('wake_signals' as any).insert({
          sender_id: user.id,
          target_id: targetUserId,
          group_id: groupId,
          signal_type: signalType,
        });
      } catch { /* ignore */ }

      // Optionally trigger push edge function
      try {
        await supabase.functions.invoke('send-wake-signal', {
          body: { target_user_id: targetUserId, sender_user_id: user.id, group_id: groupId, signal_type: signalType },
        });
      } catch {
        console.log('Push notification function unavailable, DB status updated only');
      }

      setCooldown(targetUserId);

      const labels: Record<SignalType, string> = {
        gentle: 'Gentle nudge sent',
        urgent: 'Urgent alarm sent',
        sos: 'SOS signal sent',
      };
      toast.success(labels[signalType]);
      return true;
    } catch (error) {
      console.error('Error sending wake signal:', error);
      toast.error('Failed to send wake signal');
      return false;
    } finally {
      setSendingTo(null);
    }
  }, [user]);

  return { sendWakeSignal, sendingTo, isOnCooldown, getRemainingCooldown };
}
