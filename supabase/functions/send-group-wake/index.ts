import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
const FCM_KEY      = Deno.env.get('FIREBASE_SERVER_KEY');

const MAX_CALLS_PER_TARGET = 2;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return json({ error: 'Unauthorized' }, 401);
    const callerId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const { group_id, session_id, to_user_id, custom_message } = body ?? {};
    if (!group_id || !session_id || !to_user_id) {
      return json({ error: 'group_id, session_id, to_user_id are required' }, 400);
    }
    if (to_user_id === callerId) return json({ error: 'cannot wake yourself' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Verify both users are members of the group
    const { data: members } = await admin
      .from('lifeos_group_members')
      .select('user_id')
      .eq('group_id', group_id)
      .in('user_id', [callerId, to_user_id]);
    if (!members || members.length < 2) {
      return json({ error: 'Both users must be group members' }, 403);
    }

    // Enforce max calls per sender->target per session
    const { count } = await admin
      .from('group_wake_calls')
      .select('id', { count: 'exact', head: true })
      .eq('session_id', session_id)
      .eq('from_user_id', callerId)
      .eq('to_user_id', to_user_id);
    if ((count ?? 0) >= MAX_CALLS_PER_TARGET) {
      return json({ error: 'Wake-up call limit reached', limit: MAX_CALLS_PER_TARGET }, 429);
    }

    // Insert call
    const { error: insertErr } = await admin.from('group_wake_calls').insert({
      session_id, group_id, from_user_id: callerId, to_user_id,
      custom_message: custom_message ?? null,
    });
    if (insertErr) return json({ error: insertErr.message }, 500);

    // Bump received counter on member status (best-effort)
    await admin.rpc('exec_sql', {}).catch(() => {});
    const { data: existing } = await admin
      .from('group_wake_member_status')
      .select('id, wake_up_calls_received')
      .eq('session_id', session_id)
      .eq('user_id', to_user_id)
      .maybeSingle();
    if (existing) {
      await admin.from('group_wake_member_status')
        .update({ wake_up_calls_received: (existing.wake_up_calls_received ?? 0) + 1 })
        .eq('id', existing.id);
    }

    // Sender name for notification
    const { data: sender } = await admin.from('profiles').select('full_name').eq('user_id', callerId).maybeSingle();
    const senderName = sender?.full_name ?? 'Someone';

    const title = '⏰ Wake Up Call!';
    const messageText = (custom_message && String(custom_message).trim()) || `${senderName} is calling you to wake up`;

    // Push (best-effort)
    if (FCM_KEY) {
      const { data: device } = await admin
        .from('push_subscriptions')
        .select('endpoint')
        .eq('user_id', to_user_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (device?.endpoint) {
        try {
          await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `key=${FCM_KEY}` },
            body: JSON.stringify({
              to: device.endpoint,
              priority: 'high',
              notification: {
                title,
                body: messageText,
                sound: 'alarm_sound',
                channel_id: 'rise_alarm_channel_v3',
                android_channel_id: 'rise_alarm_channel_v3',
              },
              data: {
                type: 'WAKE_UP_CALL',
                group_id,
                session_id,
                from_user_id: callerId,
                custom_message: messageText,
                route: '/rise',
              },
            }),
          });
        } catch (e) {
          console.error('FCM send error:', e);
        }
      }
    }

    // In-app notification record (best-effort)
    try {
      await admin.from('notifications').insert({
        user_id: to_user_id,
        title,
        message: messageText,
        type: 'group_wake_call',
      });
    } catch (_) { /* ignore */ }

    return json({ success: true, remaining: MAX_CALLS_PER_TARGET - ((count ?? 0) + 1) }, 200);
  } catch (err) {
    console.error('send-group-wake error', err);
    return json({ error: err instanceof Error ? err.message : 'Unknown' }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}