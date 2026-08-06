import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  isNative,
  scheduleRecurringAlarm,
  cancelAlarmByUuid,
  cancelAllAlarms,
  snoozeAlarm,
  dismissAlarm,
  getPendingAlarms,
  checkAlarmPermission,
  requestAlarmPermission,
  uuidToNumericId,
  rescheduleAllAlarmsAfterBoot
} from '@/lib/capacitor';

interface RiseAlarm {
  id: string;
  alarm_time: string;
  days_of_week: number[];
  alarm_type: string;
  is_enabled: boolean;
  intention: string | null;
  label: string | null;
  verification_type: string;
  snooze_limit: number;
  snooze_interval_minutes: number;
  sound_type?: string;
  vibration_enabled?: boolean;
  who_depends?: string | null;
  group_id?: string | null;
}

interface AlarmState {
  alarms: RiseAlarm[];
  isLoading: boolean;
  hasPermission: boolean;
  pendingNativeAlarms: number;
}

export function useNativeAlarm() {
  const { user } = useAuth();
  const [state, setState] = useState<AlarmState>({
    alarms: [],
    isLoading: true,
    hasPermission: false,
    pendingNativeAlarms: 0
  });

  // Load alarms from database
  const loadAlarms = useCallback(async () => {
    if (!user) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const { data, error } = await supabase
        .from('rise_alarms')
        .select('*')
        .eq('user_id', user.id)
        .order('alarm_time', { ascending: true });
      
      if (error) throw error;
      
      // Get pending native alarms count
      let pendingCount = 0;
      if (isNative) {
        const pending = await getPendingAlarms();
        pendingCount = pending.length;
      }
      
      setState(prev => ({
        ...prev,
        alarms: data as RiseAlarm[] || [],
        isLoading: false,
        pendingNativeAlarms: pendingCount
      }));
    } catch (error) {
      console.error('[useNativeAlarm] Load failed:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  // Check and request permission
  const ensurePermission = useCallback(async (): Promise<boolean> => {
    if (!isNative) return true;
    
    let hasPermission = await checkAlarmPermission();
    
    if (!hasPermission) {
      hasPermission = await requestAlarmPermission();
    }
    
    setState(prev => ({ ...prev, hasPermission }));
    return hasPermission;
  }, []);

  // Schedule alarm natively
  const scheduleNativeAlarm = useCallback(async (alarm: RiseAlarm): Promise<boolean> => {
    if (!isNative) return true; // Web doesn't need native scheduling
    
    const hasPermission = await ensurePermission();
    if (!hasPermission) {
      toast.error('Notification permission required for alarms');
      return false;
    }
    
    try {
      const success = await scheduleRecurringAlarm(
        alarm.id,
        alarm.alarm_time,
        alarm.days_of_week,
        {
          title: alarm.label || 'Rise Alarm',
          body: alarm.intention || 'Time to wake up!',
          missionType: alarm.verification_type as any,
          intention: alarm.intention || undefined,
          whoDepends: alarm.who_depends || undefined,
          snoozeMinutes: alarm.snooze_interval_minutes || 5,
          isGroupAlarm: !!alarm.group_id,
          groupId: alarm.group_id || undefined
        }
      );
      
      if (success) {
        console.log('[useNativeAlarm] Scheduled:', alarm.id);
      }
      
      return success;
    } catch (error) {
      console.error('[useNativeAlarm] Schedule failed:', error);
      return false;
    }
  }, [ensurePermission]);

  // Cancel native alarm
  const cancelNativeAlarm = useCallback(async (alarmId: string): Promise<boolean> => {
    if (!isNative) return true;
    
    try {
      return await cancelAlarmByUuid(alarmId);
    } catch (error) {
      console.error('[useNativeAlarm] Cancel failed:', error);
      return false;
    }
  }, []);

  // Toggle alarm enabled state
  const toggleAlarm = useCallback(async (alarmId: string, enabled: boolean): Promise<boolean> => {
    const alarm = state.alarms.find(a => a.id === alarmId);
    if (!alarm) return false;
    
    try {
      // Update database
      const { error } = await supabase
        .from('rise_alarms')
        .update({ is_enabled: enabled })
        .eq('id', alarmId);
      
      if (error) throw error;
      
      // Update native alarm
      if (enabled) {
        await scheduleNativeAlarm({ ...alarm, is_enabled: true });
      } else {
        await cancelNativeAlarm(alarmId);
      }
      
      // Update local state
      setState(prev => ({
        ...prev,
        alarms: prev.alarms.map(a => 
          a.id === alarmId ? { ...a, is_enabled: enabled } : a
        )
      }));
      
      return true;
    } catch (error) {
      console.error('[useNativeAlarm] Toggle failed:', error);
      toast.error('Failed to update alarm');
      return false;
    }
  }, [state.alarms, scheduleNativeAlarm, cancelNativeAlarm]);

  // Create new alarm
  const createAlarm = useCallback(async (alarmData: Omit<RiseAlarm, 'id'>): Promise<string | null> => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('rise_alarms')
        .insert({
          user_id: user.id,
          ...alarmData
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Schedule native alarm if enabled
      if (data.is_enabled && isNative) {
        await scheduleNativeAlarm(data as RiseAlarm);
      }
      
      await loadAlarms();
      toast.success('Alarm created!');
      
      return data.id;
    } catch (error) {
      console.error('[useNativeAlarm] Create failed:', error);
      toast.error('Failed to create alarm');
      return null;
    }
  }, [user, scheduleNativeAlarm, loadAlarms]);

  // Update existing alarm
  const updateAlarm = useCallback(async (alarmId: string, updates: Partial<RiseAlarm>): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('rise_alarms')
        .update(updates)
        .eq('id', alarmId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Reschedule native alarm
      if (isNative) {
        await cancelNativeAlarm(alarmId);
        if (data.is_enabled) {
          await scheduleNativeAlarm(data as RiseAlarm);
        }
      }
      
      await loadAlarms();
      toast.success('Alarm updated!');
      
      return true;
    } catch (error) {
      console.error('[useNativeAlarm] Update failed:', error);
      toast.error('Failed to update alarm');
      return false;
    }
  }, [scheduleNativeAlarm, cancelNativeAlarm, loadAlarms]);

  // Delete alarm
  const deleteAlarm = useCallback(async (alarmId: string): Promise<boolean> => {
    try {
      // Cancel native alarm first
      await cancelNativeAlarm(alarmId);
      
      const { error } = await supabase
        .from('rise_alarms')
        .delete()
        .eq('id', alarmId);
      
      if (error) throw error;
      
      setState(prev => ({
        ...prev,
        alarms: prev.alarms.filter(a => a.id !== alarmId)
      }));
      
      toast.success('Alarm deleted');
      return true;
    } catch (error) {
      console.error('[useNativeAlarm] Delete failed:', error);
      toast.error('Failed to delete alarm');
      return false;
    }
  }, [cancelNativeAlarm]);

  // Snooze active alarm
  const snoozeActiveAlarm = useCallback(async (alarmId: string, minutes?: number): Promise<boolean> => {
    const alarm = state.alarms.find(a => a.id === alarmId);
    if (!alarm) return false;
    
    const snoozeMinutes = minutes || alarm.snooze_interval_minutes || 5;
    
    if (isNative) {
      return await snoozeAlarm(uuidToNumericId(alarmId), snoozeMinutes);
    }
    
    return true;
  }, [state.alarms]);

  // Dismiss active alarm
  const dismissActiveAlarm = useCallback(async (alarmId: string): Promise<boolean> => {
    if (isNative) {
      return await dismissAlarm(uuidToNumericId(alarmId), user?.id);
    }
    return true;
  }, [user]);

  // Reschedule all alarms (after boot or app restart)
  const rescheduleAllAlarms = useCallback(async (): Promise<void> => {
    if (!user || !isNative) return;
    
    await rescheduleAllAlarmsAfterBoot(user.id);
    await loadAlarms();
  }, [user, loadAlarms]);

  // Cancel all alarms
  const cancelAll = useCallback(async (): Promise<boolean> => {
    if (isNative) {
      await cancelAllAlarms();
    }
    
    // Disable all alarms in database
    if (user) {
      await supabase
        .from('rise_alarms')
        .update({ is_enabled: false })
        .eq('user_id', user.id);
    }
    
    await loadAlarms();
    return true;
  }, [user, loadAlarms]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadAlarms();
      ensurePermission();
    }
  }, [user, loadAlarms, ensurePermission]);

  // Listen for app resume to sync alarms
  useEffect(() => {
    const handleResume = () => {
      loadAlarms();
    };
    
    window.addEventListener('app:resume', handleResume);
    return () => window.removeEventListener('app:resume', handleResume);
  }, [loadAlarms]);

  return {
    ...state,
    loadAlarms,
    toggleAlarm,
    createAlarm,
    updateAlarm,
    deleteAlarm,
    snoozeActiveAlarm,
    dismissActiveAlarm,
    rescheduleAllAlarms,
    cancelAll,
    ensurePermission
  };
}
