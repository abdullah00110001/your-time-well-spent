// Initializes morning attendance rows for a group's wake session and posts a system message.
// Invoked by clients when their group alarm fires (idempotent per day per group).
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

    // Get all members
    const { data: members } = await svc
      .from('lifeos_group_members').select('user_id').eq('group_id', group_id);
    const memberIds = (members ?? []).map((m: any) => m.user_id);

    // Upsert sleeping attendance rows for everyone (don't overwrite woke status)
    if (memberIds.length > 0) {
      const rows = memberIds.map((uid: string) => ({
        group_id, user_id: uid, alarm_date: today, status: 'sleeping',
      }));
      await svc.from('group_wake_attendance').upsert(rows, { onConflict: 'group_id,user_id,alarm_date', ignoreDuplicates: true });
    }

    // Get wake_time for the message
    const { data: alarmRow } = await svc
      .from('group_wake_alarms')
      .select('wake_time')
      .eq('group_id', group_id).eq('is_active', true)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    const wakeTime = (alarmRow?.wake_time as string | undefined)?.slice(0, 5) ?? '';

    // System chat message (idempotent: check for today's trigger message)
    const { data: existingMsg } = await svc
      .from('group_chat_messages')
      .select('id')
      .eq('group_id', group_id)
      .eq('is_system', true)
      .gte('created_at', `${today}T00:00:00Z`)
      .ilike('content', '⏰ Morning Crew alarm fired%')
      .maybeSingle();
    if (!existingMsg) {
      await svc.from('group_chat_messages').insert({
        group_id, user_id: userData.user.id, is_system: true,
        content: `⏰ Morning Crew alarm fired — ${wakeTime}`,
      });
    }

    return json({ success: true, member_count: memberIds.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
