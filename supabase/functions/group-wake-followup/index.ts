// Fires at wake_time + follow_up_minutes. Names still-sleeping members in chat
// and pushes a wake nudge. Idempotent per day per group.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: 'Unauthorized' }, 401);

    const { group_id, alarm_date } = await req.json() as { group_id: string; alarm_date?: string };
    if (!group_id) return json({ error: 'group_id required' }, 400);
    const today = alarm_date || new Date().toISOString().slice(0, 10);

    const { data: isMember } = await userClient.rpc('is_lifeos_group_member', {
      _group_id: group_id, _user_id: userData.user.id,
    });
    if (!isMember) return json({ error: 'Not a member' }, 403);

    const svc = createClient(supabaseUrl, serviceKey);

    // Find still-sleeping
    const { data: sleepers } = await svc
      .from('group_wake_attendance')
      .select('user_id')
      .eq('group_id', group_id)
      .eq('alarm_date', today)
      .eq('status', 'sleeping');

    if (!sleepers || sleepers.length === 0) {
      return json({ success: true, sleepers: 0, posted: false });
    }

    // Idempotency: check if follow-up was already posted today
    const { data: existing } = await svc
      .from('group_chat_messages')
      .select('id')
      .eq('group_id', group_id)
      .eq('is_system', true)
      .gte('created_at', `${today}T00:00:00Z`)
      .ilike('content', '😴%')
      .maybeSingle();
    if (existing) return json({ success: true, sleepers: sleepers.length, posted: false, reason: 'already_posted' });

    const ids = sleepers.map((s: any) => s.user_id);
    const { data: profiles } = await svc.from('profiles').select('user_id, full_name').in('user_id', ids);
    const names = (profiles ?? []).map((p: any) => p.full_name ?? 'Member');

    await svc.from('group_chat_messages').insert({
      group_id, user_id: userData.user.id, is_system: true,
      content: `😴 ${names.join(', ')} haven't woken up yet`,
    });

    // Push notifications (best-effort)
    for (const uid of ids) {
      try {
        await svc.functions.invoke('send-wake-signal', {
          body: { target_user_id: uid, sender_user_id: userData.user.id, group_id, signal_type: 'urgent' },
        });
      } catch { /* ignore */ }
    }

    return json({ success: true, sleepers: ids.length, posted: true, names });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
