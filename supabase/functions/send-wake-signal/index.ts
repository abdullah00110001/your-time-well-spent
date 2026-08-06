import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FCM_SERVICE_ACCOUNT_JSON = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')!;

// ---- FCM HTTP v1 token helper ----
let cachedToken: { token: string; exp: number } | null = null;

async function importServiceAccountKey(pem: string): Promise<CryptoKey> {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const der = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function getAccessToken(): Promise<{ token: string; projectId: string }> {
  const sa = JSON.parse(FCM_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.exp > now + 60) {
    return { token: cachedToken.token, projectId: sa.project_id };
  }
  const key = await importServiceAccountKey(sa.private_key);
  const jwt = await create(
    { alg: 'RS256', typ: 'JWT' },
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: getNumericDate(60 * 60),
    },
    key,
  );
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`OAuth token fetch failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  cachedToken = { token: json.access_token, exp: now + (json.expires_in ?? 3600) };
  return { token: json.access_token, projectId: sa.project_id };
}

async function sendFcm(deviceToken: string, payload: {
  title: string; body: string; data: Record<string, string>; priority: string;
}) {
  const { token, projectId } = await getAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const message = {
    message: {
      token: deviceToken,
      notification: { title: payload.title, body: payload.body },
      data: payload.data,
      android: {
        priority: payload.priority === 'high' ? 'HIGH' : 'NORMAL',
        notification: {
          channel_id: 'wakeup_channel',
          sound: 'default',
          default_vibrate_timings: true,
          default_light_settings: true,
          notification_priority: 'PRIORITY_MAX',
          visibility: 'PUBLIC',
        },
        ttl: '60s',
      },
    },
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
  });
  const text = await res.text();
  if (!res.ok) console.error('FCM send failed', res.status, text);
  return { ok: res.ok, status: res.status, body: text };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { target_user_id, sender_user_id, group_id, signal_type } = await req.json();
    if (!target_user_id || !sender_user_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: senderProfile } = await supabase
      .from('profiles').select('full_name').eq('user_id', sender_user_id).maybeSingle();
    const senderName = senderProfile?.full_name || 'Someone';

    const messages: Record<string, { title: string; body: string; priority: string }> = {
      gentle: { title: `${senderName} is waking you up! 🔔`, body: 'Rise and shine! Someone wants you awake.', priority: 'high' },
      urgent: { title: `${senderName} is waking you up! 🚨`, body: 'Urgent wake-up — rise now!', priority: 'high' },
      sos:    { title: `${senderName} sent an SOS wake-up! 🆘`, body: 'Critical wake-up signal.', priority: 'high' },
    };
    const m = messages[signal_type] || messages.gentle;

    const { data: tokens } = await supabase
      .from('fcm_tokens').select('token').eq('user_id', target_user_id);

    const fcmResults: any[] = [];
    if (tokens && tokens.length > 0) {
      for (const t of tokens) {
        try {
          const r = await sendFcm(t.token, {
            title: m.title, body: m.body, priority: m.priority,
            data: {
              type: 'wakeup',
              senderId: String(sender_user_id),
              senderName,
              groupId: group_id ? String(group_id) : '',
              signal_type: signal_type ?? 'gentle',
              route: '/rise',
            },
          });
          fcmResults.push(r);
          if (!r.ok && (r.status === 404 || r.status === 400)) {
            // Stale token — clean up
            await supabase.from('fcm_tokens').delete().eq('token', t.token);
          }
        } catch (e) {
          console.error('FCM error', e);
        }
      }
    }

    try {
      await supabase.from('notifications').insert({
        user_id: target_user_id, title: m.title, message: m.body, type: 'wake_signal',
      });
    } catch (e) { console.error('notif insert skipped', e); }

    return new Response(JSON.stringify({ success: true, sent: fcmResults.length, results: fcmResults }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
