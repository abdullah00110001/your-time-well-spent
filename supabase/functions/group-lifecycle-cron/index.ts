import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { data: settings } = await svc.from('admin_group_settings').select('*').limit(1).maybeSingle();
  if (!settings?.auto_delete_enabled) {
    return new Response(JSON.stringify({ skipped: true, reason: 'auto_delete disabled' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const thresholdPct = settings.inactive_threshold_pct ?? 70;
  const windowDays = settings.inactive_window_days ?? 14;
  const sinceIso = new Date(Date.now() - windowDays * 86400000).toISOString();

  // Soft delete: groups where last_activity_at is older than window
  const { data: stale } = await svc
    .from('lifeos_groups')
    .select('id, name, created_by, last_activity_at, deleted_at')
    .eq('is_deleted', false)
    .lt('last_activity_at', sinceIso);

  const deleted: string[] = [];
  for (const g of stale ?? []) {
    // Count inactive members: those with no wake_log and no chat in window
    const { data: members } = await svc
      .from('lifeos_group_members')
      .select('user_id')
      .eq('group_id', g.id);
    const total = members?.length ?? 0;
    if (total === 0) continue;
    let inactive = 0;
    for (const m of members!) {
      const [{ count: wakeCt }, { count: chatCt }] = await Promise.all([
        svc.from('wake_logs').select('*', { count: 'exact', head: true }).eq('user_id', m.user_id).gte('log_date', sinceIso.slice(0, 10)),
        svc.from('group_chat_messages').select('*', { count: 'exact', head: true }).eq('group_id', g.id).eq('user_id', m.user_id).gte('created_at', sinceIso),
      ]);
      if ((wakeCt ?? 0) === 0 && (chatCt ?? 0) === 0) inactive++;
    }
    const inactivePct = (inactive / total) * 100;
    if (inactivePct >= thresholdPct) {
      await svc.from('lifeos_groups').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', g.id);
      deleted.push(g.id);
    }
  }

  // Hard delete after 7-day grace
  const graceCutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  await svc.from('lifeos_groups').delete().eq('is_deleted', true).lt('deleted_at', graceCutoff);

  return new Response(JSON.stringify({ scanned: stale?.length ?? 0, soft_deleted: deleted }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});