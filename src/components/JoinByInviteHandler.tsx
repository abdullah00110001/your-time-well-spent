import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

/**
 * Reads ?join=<invite_code> from the URL on app boot and (once the user is
 * logged in) joins the matching LifeOS group, then navigates to /rise or
 * /shield depending on the group type. Idempotent — joining an already-joined
 * group is treated as a soft success.
 */
export default function JoinByInviteHandler() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (loading) return;
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get('join');
    if (!code) return;

    // Wait for auth — if not logged in, bounce to /auth and preserve the code.
    if (!user) {
      try { sessionStorage.setItem('pending_join_code', code); } catch {}
      url.searchParams.delete('join');
      window.history.replaceState({}, '', url.toString());
      navigate('/auth', { replace: true });
      return;
    }

    handled.current = true;
    url.searchParams.delete('join');
    window.history.replaceState({}, '', url.toString());

    (async () => {
      try {
        const { data: group, error } = await supabase
          .from('lifeos_groups')
          .select('id, name, type')
          .eq('invite_code', code)
          .maybeSingle();
        if (error || !group) { toast.error('Invite code not found'); return; }

        const { data: existing } = await supabase
          .from('lifeos_group_members')
          .select('user_id')
          .eq('group_id', group.id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!existing) {
          const { error: jErr } = await supabase
            .from('lifeos_group_members')
            .insert({ group_id: group.id, user_id: user.id });
          if (jErr) { toast.error(jErr.message); return; }
          toast.success(`Joined "${group.name}"`);
        } else {
          toast.info(`You're already in "${group.name}"`);
        }
        qc.invalidateQueries({ queryKey: ['lifeos-groups'] });
        navigate(group.type === 'shield' ? '/shield' : '/rise', { replace: true });
      } catch (e: any) {
        toast.error(e?.message ?? 'Failed to join group');
      }
    })();
  }, [user, loading, navigate, qc]);

  // After a fresh login, re-run with any pending code stashed before redirect.
  useEffect(() => {
    if (loading || !user) return;
    try {
      const pending = sessionStorage.getItem('pending_join_code');
      if (pending && !new URL(window.location.href).searchParams.get('join')) {
        sessionStorage.removeItem('pending_join_code');
        const u = new URL(window.location.href);
        u.searchParams.set('join', pending);
        window.history.replaceState({}, '', u.toString());
        handled.current = false;
      }
    } catch {}
  }, [user, loading]);

  return null;
}