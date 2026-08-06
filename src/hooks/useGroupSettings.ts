import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface MemberSettings {
  bio: string;
  dndEnabled: boolean;
  dndReason: string;
  blockedUsers: string[];
  locationOptIn: boolean;
  city: string;
}

const DEFAULT_SETTINGS: MemberSettings = {
  bio: '',
  dndEnabled: false,
  dndReason: '',
  blockedUsers: [],
  locationOptIn: false,
  city: '',
};

// Falls back to localStorage when the rise_user_profile table is not migrated yet.
const localKey = (id: string) => `rise_group_settings_${id}`;
const readLocal = (id: string): MemberSettings => {
  try {
    const raw = localStorage.getItem(localKey(id));
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};
const writeLocal = (id: string, v: MemberSettings) => {
  try { localStorage.setItem(localKey(id), JSON.stringify(v)); } catch { /* noop */ }
};

export function useGroupSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<MemberSettings>(DEFAULT_SETTINGS);
  const [memberSettings, setMemberSettings] = useState<Record<string, MemberSettings>>({});

  const fetchProfiles = useCallback(async (userIds: string[]): Promise<Record<string, MemberSettings>> => {
    if (userIds.length === 0) return {};
    const next: Record<string, MemberSettings> = {};
    userIds.forEach((id) => { next[id] = readLocal(id); });

    try {
      const { data, error } = await supabase
        .from('rise_user_profile' as any)
        .select('user_id, bio, dnd_enabled, dnd_reason, blocked_users')
        .in('user_id', userIds);

      if (!error && data) {
        const locOptIn: Record<string, { city: string; opted_in: boolean }> = {};
        const { data: locs } = await supabase
          .from('user_locations' as any)
          .select('user_id, city, opted_in')
          .in('user_id', userIds);
        ((locs as any[]) || []).forEach((l) => {
          locOptIn[l.user_id] = { city: l.city || '', opted_in: !!l.opted_in };
        });

        (data as any[]).forEach((row) => {
          const local = next[row.user_id] || DEFAULT_SETTINGS;
          next[row.user_id] = {
            ...local,
            bio: row.bio || '',
            dndEnabled: !!row.dnd_enabled,
            dndReason: row.dnd_reason || '',
            blockedUsers: row.blocked_users || [],
            city: locOptIn[row.user_id]?.city || local.city,
            locationOptIn: locOptIn[row.user_id]?.opted_in ?? local.locationOptIn,
          };
          writeLocal(row.user_id, next[row.user_id]);
        });
      }
    } catch {
      // Tables not migrated — local fallback only
    }
    return next;
  }, []);

  const refreshMemberSettings = useCallback(async (userIds: string[] = []) => {
    const next = await fetchProfiles(userIds);
    setMemberSettings((prev) => ({ ...prev, ...next }));
    if (user?.id && next[user.id]) setSettings(next[user.id]);
  }, [fetchProfiles, user?.id]);

  useEffect(() => {
    if (!user) return;
    setSettings(readLocal(user.id));
    void refreshMemberSettings([user.id]);
  }, [user, refreshMemberSettings]);

  const updateSettings = useCallback(async (partial: Partial<MemberSettings>) => {
    if (!user) return;
    const next = { ...settings, ...partial };
    setSettings(next);
    setMemberSettings((m) => ({ ...m, [user.id]: next }));
    writeLocal(user.id, next);

    // Best-effort remote sync
    try {
      await supabase.from('rise_user_profile' as any).upsert({
        user_id: user.id,
        bio: next.bio,
        dnd_enabled: next.dndEnabled,
        dnd_reason: next.dndReason,
        blocked_users: next.blockedUsers,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

      if (partial.locationOptIn !== undefined || partial.city !== undefined) {
        await supabase.from('user_locations' as any).upsert({
          user_id: user.id,
          city: next.city || null,
          opted_in: next.locationOptIn,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      }
    } catch {
      // Tables not yet migrated — local copy already saved
    }
  }, [settings, user]);

  const isUserBlocked = useCallback((userId: string) => settings.blockedUsers.includes(userId), [settings.blockedUsers]);
  const blockUser = useCallback((userId: string) => {
    void updateSettings({ blockedUsers: [...new Set([...settings.blockedUsers, userId])] });
  }, [settings.blockedUsers, updateSettings]);
  const unblockUser = useCallback((userId: string) => {
    void updateSettings({ blockedUsers: settings.blockedUsers.filter((id) => id !== userId) });
  }, [settings.blockedUsers, updateSettings]);

  return { settings, memberSettings, updateSettings, refreshMemberSettings, isUserBlocked, blockUser, unblockUser };
}
