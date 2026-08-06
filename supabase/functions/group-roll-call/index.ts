import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Runs daily ~10AM local — computes how many members woke up today per group.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const today = new Date().toISOString().slice(0, 10);

  const { data: groups } = await svc.from('lifeos_groups').select('id').eq('is_deleted', false).eq('type', 'rise');
  let processed = 0;

  for (const g of groups ?? []) {
    const { data: members } = await svc.from('lifeos_group_members').select('user_id').eq('group_id', g.id);
    const memberIds = (members ?? []).map((m: any) => m.user_id);
    if (memberIds.length === 0) continue;

    const { data: wakes } = await svc
      .from('wake_logs')
      .select('user_id, wake_time')
      .in('user_id', memberIds)
      .eq('log_date', today);

    const wokeIds = (wakes ?? []).map((w: any) => w.user_id);
    const earliest = (wakes ?? []).reduce<string | null>((acc, w: any) => {
      if (!w.wake_time) return acc;
      if (!acc || w.wake_time < acc) return w.wake_time;
      return acc;
    }, null);

    await svc.from('group_roll_calls').upsert(
      {
        group_id: g.id,
        roll_date: today,
        total_members: memberIds.length,
        woke_count: wokeIds.length,
        woke_user_ids: wokeIds,
        earliest_wake_time: earliest,
      },
      { onConflict: 'group_id,roll_date' },
    );

    // Post system chat message
    await svc.from('group_chat_messages').insert({
      group_id: g.id,
      user_id: '00000000-0000-0000-0000-000000000000',
      content: `🌅 Morning roll call — ${wokeIds.length} of ${memberIds.length} members woke up today${earliest ? ` (earliest: ${earliest.slice(0, 5)})` : ''}.`,
      is_system: true,
    });

    processed++;
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});