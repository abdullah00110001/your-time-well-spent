import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LogEventInput {
  source: string;
  severity: string;
  reason: string;
  matchedText?: string | null;
  contextLabel?: string | null;
}

const LOOP_WINDOW_MS = 60_000;
const LOOP_THRESHOLD = 30;
const MUTE_MS = 5 * 60_000;

/** source -> epoch ms until which we skip logging that source */
const mutedUntil = new Map<string, number>();

export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return;

    const now = Date.now();
    const muted = mutedUntil.get(input.source) ?? 0;
    if (now < muted) return;

    const sinceIso = new Date(now - LOOP_WINDOW_MS).toISOString();
    const { count } = await supabase
      .from('activity_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('source', input.source)
      .gte('created_at', sinceIso);

    const recent = count ?? 0;
    if (recent > LOOP_THRESHOLD) {
      mutedUntil.set(input.source, now + MUTE_MS);
      await supabase.from('activity_log').insert({
        user_id: userId,
        source: input.source,
        severity: 'POSSIBLE_LOOP',
        reason: `${recent} events in 60s from ${input.source}`,
      });
      return;
    }

    await supabase.from('activity_log').insert({
      user_id: userId,
      source: input.source,
      severity: input.severity,
      reason: input.reason,
      matched_text: input.matchedText ?? null,
      context_label: input.contextLabel ?? null,
    });
  } catch (err) {
    console.error('[ActivityLog] logEvent failed', err);
  }
}

/** Trim the current user's log: drop rows older than 7 days, cap total at 5000. */
export async function pruneActivityLog(): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth?.user?.id;
    if (!userId) return;

    const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
    await supabase.from('activity_log').delete().eq('user_id', userId).lt('created_at', cutoff);

    const { data: keep } = await supabase
      .from('activity_log')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(4999, 4999);

    const oldestKept = keep?.[0]?.created_at;
    if (oldestKept) {
      await supabase
        .from('activity_log')
        .delete()
        .eq('user_id', userId)
        .lt('created_at', oldestKept);
    }
  } catch (err) {
    console.error('[ActivityLog] prune failed', err);
  }
}

export function useActivityLogger() {
  return { logEvent: useCallback(logEvent, []), pruneActivityLog: useCallback(pruneActivityLog, []) };
}
