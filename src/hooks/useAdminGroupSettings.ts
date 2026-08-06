import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AdminGroupSettings {
  max_capacity: number;
  chat_enabled_global: boolean;
  auto_delete_enabled: boolean;
  inactive_threshold_pct: number;
  inactive_window_days: number;
  leader_broadcast_per_day: number;
  member_wake_per_day: number;
  updated_at: string;
}

const DEFAULTS: AdminGroupSettings = {
  max_capacity: 100,
  chat_enabled_global: true,
  auto_delete_enabled: true,
  inactive_threshold_pct: 70,
  inactive_window_days: 14,
  leader_broadcast_per_day: 1,
  member_wake_per_day: 2,
  updated_at: new Date().toISOString(),
};

export function useAdminGroupSettings() {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-group-settings'],
    queryFn: async (): Promise<AdminGroupSettings> => {
      const { data, error } = await supabase
        .from('admin_group_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as any) ?? DEFAULTS;
    },
  });

  const save = useMutation({
    mutationFn: async (patch: Partial<AdminGroupSettings>) => {
      const { error } = await supabase
        .from('admin_group_settings')
        .upsert({ id: true, ...patch }, { onConflict: 'id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-group-settings'] });
      toast.success('Settings saved');
    },
    onError: (e: any) => toast.error(e?.message ?? 'Failed to save'),
  });

  return { ...query, save };
}