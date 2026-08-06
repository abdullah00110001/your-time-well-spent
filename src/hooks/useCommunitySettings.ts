import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CommunitySettings {
  show_in_community: boolean;
  anonymous_mode: boolean;
  nearby_radius_km: number;
  show_alarm_label: boolean;
}

const DEFAULTS: CommunitySettings = {
  show_in_community: true,
  anonymous_mode: true,
  nearby_radius_km: 5,
  show_alarm_label: true,
};

export function useCommunitySettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<CommunitySettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    (async () => {
      const { data } = await supabase
        .from('rise_community_settings' as any)
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        const d = data as any;
        setSettings({
          show_in_community: d.show_in_community ?? true,
          anonymous_mode: d.anonymous_mode ?? true,
          nearby_radius_km: d.nearby_radius_km ?? 5,
          show_alarm_label: d.show_alarm_label ?? true,
        });
      }
      setLoaded(true);
    })();
  }, [user]);

  const update = useCallback(async (patch: Partial<CommunitySettings>) => {
    if (!user) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    await supabase
      .from('rise_community_settings' as any)
      .upsert({ user_id: user.id, ...next }, { onConflict: 'user_id' });
  }, [user, settings]);

  return { settings, loaded, update };
}
