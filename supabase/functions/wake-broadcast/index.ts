import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface BroadcastBody {
  group_id: string;
  kind: 'leader' | 'member';
  target_user_id?: string;
  message?: string;
}

const TRUSTED_MIN_GAP_MS = 60_000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401);
    const senderId = userData.user.id;

    const body = (await req.json()) as BroadcastBody;
    if (!body?.group_id || !body?.kind) return json({ error: 'Missing fields' }, 400);
    if (body.kind === 'member' && !body.target_user_id)
      return json({ error: 'target_user_id required' }, 400);
    if (body.kind === 'member' && body.target_user_id === senderId)
      return json({ error: 'Cannot wake yourself' }, 400);

    const svc = createClient(supabaseUrl, serviceKey);

    // ── LEADER broadcast path (unchanged: caps daily via RPC) ────────────────
    if (body.kind === 'leader') {
      const { data: ok } = await userClient.rpc('can_send_leader_wake', { _group_id: body.group_id });
      if (!ok) return json({ error: 'Rate limit reached for leader broadcast today', code: 'leader_rate_limited' }, 429);

      await svc.from('group_wake_broadcasts').insert({
        group_id: body.group_id,
        sender_id: senderId,
        kind: 'leader',
        target_user_id: null,
        message: body.message ?? null,
      });

      const { data: members } = await svc
        .from('lifeos_group_members')
        .select('user_id')
        .eq('group_id', body.group_id);
      const recipients = (members ?? []).map((m: any) => m.user_id).filter((id: string) => id !== senderId);
      const { data: senderProfile } = await svc.from('profiles').select('full_name').eq('user_id', senderId).maybeSingle();
      return json({ success: true, recipients, sender_name: senderProfile?.full_name ?? 'Someone', kind: 'leader' });
    }

    // ── MEMBER wake-call path: trusted-waker → unlimited (≥60s gap); else max_wake_calls/day ──
    const targetId = body.target_user_id!;
    const today = new Date().toISOString().slice(0, 10);

    // Membership check
    const { data: isMember } = await userClient.rpc('is_lifeos_group_member', {
      _group_id: body.group_id, _user_id: senderId,
    });
    if (!isMember) return json({ error: 'Not a group member' }, 403);

    // Is sender a trusted waker for target?
    const { data: trustRow } = await svc
      .from('group_trusted_wakers')
      .select('id')
      .eq('group_id', body.group_id)
      .eq('grantor_id', targetId)
      .eq('grantee_id', senderId)
      .maybeSingle();
    const isTrusted = !!trustRow;

    if (isTrusted) {
      // 60-second cooldown
      const { data: last } = await svc
        .from('group_wake_calls')
        .select('sent_at')
        .eq('group_id', body.group_id)
        .eq('from_user_id', senderId)
        .eq('to_user_id', targetId)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last?.sent_at && Date.now() - new Date(last.sent_at).getTime() < TRUSTED_MIN_GAP_MS) {
        const waitS = Math.ceil((TRUSTED_MIN_GAP_MS - (Date.now() - new Date(last.sent_at).getTime())) / 1000);
        return json({ error: `Wait ${waitS}s before next wake call`, code: 'trusted_cooldown', wait_seconds: waitS }, 429);
      }
    } else {
      // Per-day cap from group's active alarm setting
      const { data: alarmRow } = await svc
        .from('group_wake_alarms')
        .select('max_wake_calls')
        .eq('group_id', body.group_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const maxCalls: number = alarmRow?.max_wake_calls ?? 2;

      const { count } = await svc
        .from('group_wake_calls')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', body.group_id)
        .eq('from_user_id', senderId)
        .eq('to_user_id', targetId)
        .eq('call_date', today);

      if ((count ?? 0) >= maxCalls) {
        return json({
          error: `Daily limit reached (${maxCalls} calls per morning)`,
          code: 'member_rate_limited',
          used: count, max: maxCalls,
        }, 429);
      }
    }

    // Log call
    const { error: callErr } = await svc.from('group_wake_calls').insert({
      group_id: body.group_id,
      from_user_id: senderId,
      to_user_id: targetId,
      call_date: today,
      trusted: isTrusted,
    });
    if (callErr) return json({ error: callErr.message }, 500);

    // Log broadcast row (back-compat for existing UIs)
    await svc.from('group_wake_broadcasts').insert({
      group_id: body.group_id,
      sender_id: senderId,
      kind: 'member',
      target_user_id: targetId,
      message: body.message ?? null,
    });

    const { data: senderProfile } = await svc.from('profiles').select('full_name').eq('user_id', senderId).maybeSingle();
    const senderName = senderProfile?.full_name ?? 'Someone';

    // Best-effort push
    try {
      await svc.functions.invoke('send-wake-signal', {
        body: { target_user_id: targetId, sender_user_id: senderId, group_id: body.group_id, signal_type: isTrusted ? 'urgent' : 'gentle' },
      });
    } catch { /* ignore */ }

    return json({
      success: true,
      recipients: [targetId],
      sender_name: senderName,
      kind: 'member',
      trusted: isTrusted,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
