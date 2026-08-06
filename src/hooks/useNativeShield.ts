import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  isNative,
  startShieldSession as nativeStartSession,
  endShieldSession as nativeEndSession,
  extendShieldSession,
  getActiveSession,
  isSessionActive,
  getSessionTimeRemaining,
  logBypassAttempt,
  requestEmergencyBypass,
  type ShieldSession
} from '@/lib/capacitor';

interface DisciplineProfile {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  strictness_level: 'normal' | 'hard' | 'absolute';
  is_active: boolean;
  blocked_apps: string[];
  blocked_websites: string[];
  blocked_keywords: string[];
  block_infinite_content: boolean;
  block_adult_content: boolean;
  default_duration_minutes: number;
}

interface DisciplineScore {
  current_score: number;
  current_streak_days: number;
  longest_streak_days: number;
  total_focus_minutes: number;
  total_time_saved_minutes: number;
  can_use_absolute_mode: boolean;
  bypass_penalty: number;
  unlock_penalty: number;
}

interface ShieldState {
  profiles: DisciplineProfile[];
  activeSession: ShieldSession | null;
  disciplineScore: DisciplineScore | null;
  isLoading: boolean;
  timeRemaining: number | null;
}

export function useNativeShield() {
  const { user } = useAuth();
  const [state, setState] = useState<ShieldState>({
    profiles: [],
    activeSession: null,
    disciplineScore: null,
    isLoading: true,
    timeRemaining: null
  });

  // Load Shield data from database
  const loadShieldData = useCallback(async () => {
    if (!user) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      // Load profiles
      const { data: profilesData } = await supabase
        .from('discipline_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Load or create discipline score
      let { data: scoreData } = await supabase
        .from('discipline_scores')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!scoreData) {
        const { data: newScore } = await supabase
          .from('discipline_scores')
          .insert({ user_id: user.id })
          .select()
          .single();
        scoreData = newScore;
      }

      // Load active session from database
      const { data: sessionData } = await supabase
        .from('shield_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();

      // Map profiles
      const mappedProfiles: DisciplineProfile[] = (profilesData || []).map(p => ({
        id: p.id,
        name: p.name,
        icon: p.icon || '🎯',
        description: p.description,
        strictness_level: (p.strictness_level as 'normal' | 'hard' | 'absolute') || 'normal',
        is_active: p.is_active || false,
        blocked_apps: Array.isArray(p.blocked_apps) ? p.blocked_apps as string[] : [],
        blocked_websites: Array.isArray(p.blocked_websites) ? p.blocked_websites as string[] : [],
        blocked_keywords: Array.isArray(p.blocked_keywords) ? p.blocked_keywords as string[] : [],
        block_infinite_content: p.block_infinite_content || false,
        block_adult_content: p.block_adult_content || false,
        default_duration_minutes: p.default_duration_minutes || 60
      }));

      // Convert database session to native session format
      let activeSession: ShieldSession | null = null;
      if (sessionData) {
        activeSession = {
          id: sessionData.id,
          profileId: sessionData.profile_id,
          profileName: sessionData.profile_name,
          strictnessLevel: sessionData.strictness_level as 'normal' | 'hard' | 'absolute',
          startedAt: new Date(sessionData.started_at),
          scheduledEndAt: new Date(sessionData.scheduled_end_at),
          blockedApps: [],
          blockedWebsites: [],
          blockedKeywords: [],
          blockInfiniteContent: false,
          blockAdultContent: false
        };
        
        // Get profile settings for the active session
        const profile = mappedProfiles.find(p => p.id === sessionData.profile_id);
        if (profile) {
          activeSession.blockedApps = profile.blocked_apps;
          activeSession.blockedWebsites = profile.blocked_websites;
          activeSession.blockedKeywords = profile.blocked_keywords;
          activeSession.blockInfiniteContent = profile.block_infinite_content;
          activeSession.blockAdultContent = profile.block_adult_content;
        }
      }

      // Create default profiles if none exist
      if (mappedProfiles.length === 0) {
        await createDefaultProfiles();
        return loadShieldData(); // Reload after creating defaults
      }

      setState({
        profiles: mappedProfiles,
        activeSession,
        disciplineScore: scoreData,
        isLoading: false,
        timeRemaining: activeSession ? getSessionTimeRemaining() : null
      });
    } catch (error) {
      console.error('[useNativeShield] Load failed:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, [user]);

  // Create default profiles
  const createDefaultProfiles = async () => {
    if (!user) return;

    const defaultProfiles = [
      {
        user_id: user.id,
        name: 'Study Mode',
        icon: '📚',
        description: 'Block distractions while studying',
        strictness_level: 'hard',
        blocked_apps: ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Twitter', 'Snapchat'],
        blocked_websites: ['instagram.com', 'tiktok.com', 'facebook.com', 'twitter.com', 'reddit.com'],
        blocked_keywords: ['shorts', 'reels', 'stories', 'trending'],
        block_infinite_content: true,
        block_adult_content: true,
        default_duration_minutes: 120,
        is_preset: true
      },
      {
        user_id: user.id,
        name: 'Deep Work',
        icon: '💼',
        description: 'Maximum focus for important work',
        strictness_level: 'absolute',
        blocked_apps: ['Instagram', 'TikTok', 'YouTube', 'Facebook', 'Twitter', 'Snapchat', 'WhatsApp', 'Games'],
        blocked_websites: ['facebook.com', 'youtube.com', 'reddit.com', 'netflix.com'],
        blocked_keywords: ['entertainment', 'gaming', 'stream'],
        block_infinite_content: true,
        block_adult_content: true,
        default_duration_minutes: 180,
        is_preset: true
      },
      {
        user_id: user.id,
        name: 'Prayer Focus',
        icon: '🕌',
        description: 'Focus during salah times',
        strictness_level: 'hard',
        blocked_apps: ['All Social Media'],
        blocked_websites: ['facebook.com', 'instagram.com'],
        blocked_keywords: [],
        block_infinite_content: true,
        block_adult_content: true,
        default_duration_minutes: 30,
        is_preset: true
      }
    ];

    await supabase.from('discipline_profiles').insert(defaultProfiles);
  };

  // Start a focus session
  const startSession = useCallback(async (profile: DisciplineProfile, durationMinutes?: number): Promise<boolean> => {
    if (!user) return false;
    
    const duration = durationMinutes || profile.default_duration_minutes;
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const session: ShieldSession = {
      id: crypto.randomUUID(),
      profileId: profile.id,
      profileName: profile.name,
      strictnessLevel: profile.strictness_level,
      startedAt: startTime,
      scheduledEndAt: endTime,
      blockedApps: profile.blocked_apps,
      blockedWebsites: profile.blocked_websites,
      blockedKeywords: profile.blocked_keywords,
      blockInfiniteContent: profile.block_infinite_content,
      blockAdultContent: profile.block_adult_content
    };

    try {
      // Start native session
      const success = await nativeStartSession(session, user.id);
      
      if (success) {
        // Update profile active state
        await supabase
          .from('discipline_profiles')
          .update({ is_active: true })
          .eq('id', profile.id);
        
        setState(prev => ({
          ...prev,
          activeSession: session,
          timeRemaining: duration * 60000
        }));
        
        toast.success(`${profile.name} activated! Stay focused 🛡️`);
      }
      
      return success;
    } catch (error) {
      console.error('[useNativeShield] Start session failed:', error);
      toast.error('Failed to start focus session');
      return false;
    }
  }, [user]);

  // End active session
  const endSession = useCallback(async (reason?: string): Promise<boolean> => {
    if (!state.activeSession) return false;
    
    try {
      const success = await nativeEndSession(reason, user?.id);
      
      if (success) {
        // Update profile active state
        await supabase
          .from('discipline_profiles')
          .update({ is_active: false })
          .eq('id', state.activeSession.profileId);
        
        setState(prev => ({
          ...prev,
          activeSession: null,
          timeRemaining: null
        }));
        
        await loadShieldData(); // Reload to get updated score
      }
      
      return success;
    } catch (error) {
      console.error('[useNativeShield] End session failed:', error);
      return false;
    }
  }, [state.activeSession, user, loadShieldData]);

  // Extend current session
  const extendSession = useCallback(async (additionalMinutes: number): Promise<boolean> => {
    if (!state.activeSession) return false;
    
    try {
      const success = await extendShieldSession(additionalMinutes);
      
      if (success) {
        const newEndTime = new Date(state.activeSession.scheduledEndAt.getTime() + additionalMinutes * 60000);
        
        setState(prev => ({
          ...prev,
          activeSession: prev.activeSession ? {
            ...prev.activeSession,
            scheduledEndAt: newEndTime
          } : null
        }));
        
        toast.success(`Session extended by ${additionalMinutes} minutes`);
      }
      
      return success;
    } catch (error) {
      console.error('[useNativeShield] Extend session failed:', error);
      return false;
    }
  }, [state.activeSession]);

  // Request emergency bypass
  const requestBypass = useCallback(async (): Promise<boolean> => {
    return await requestEmergencyBypass(
      async () => {
        // Show confirmation dialog
        return new Promise((resolve) => {
          const confirmed = window.confirm(
            'Emergency bypass will:\n' +
            '• End your focus session\n' +
            '• Reduce your discipline score by 15 points\n' +
            '• Reset your streak\n\n' +
            'Are you sure you need to exit?'
          );
          resolve(confirmed);
        });
      },
      user?.id
    );
  }, [user]);

  // Create new profile
  const createProfile = useCallback(async (profileData: Omit<DisciplineProfile, 'id' | 'is_active'>): Promise<string | null> => {
    if (!user) return null;
    
    try {
      const { data, error } = await supabase
        .from('discipline_profiles')
        .insert({
          user_id: user.id,
          ...profileData,
          is_active: false
        })
        .select()
        .single();
      
      if (error) throw error;
      
      await loadShieldData();
      toast.success('Profile created!');
      
      return data.id;
    } catch (error) {
      console.error('[useNativeShield] Create profile failed:', error);
      toast.error('Failed to create profile');
      return null;
    }
  }, [user, loadShieldData]);

  // Update profile
  const updateProfile = useCallback(async (profileId: string, updates: Partial<DisciplineProfile>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('discipline_profiles')
        .update(updates)
        .eq('id', profileId);
      
      if (error) throw error;
      
      await loadShieldData();
      toast.success('Profile updated!');
      
      return true;
    } catch (error) {
      console.error('[useNativeShield] Update profile failed:', error);
      toast.error('Failed to update profile');
      return false;
    }
  }, [loadShieldData]);

  // Delete profile
  const deleteProfile = useCallback(async (profileId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('discipline_profiles')
        .delete()
        .eq('id', profileId);
      
      if (error) throw error;
      
      await loadShieldData();
      toast.success('Profile deleted');
      
      return true;
    } catch (error) {
      console.error('[useNativeShield] Delete profile failed:', error);
      toast.error('Failed to delete profile');
      return false;
    }
  }, [loadShieldData]);

  // Update time remaining periodically
  useEffect(() => {
    if (!state.activeSession) return;
    
    const interval = setInterval(() => {
      const remaining = getSessionTimeRemaining();
      
      if (remaining !== null && remaining <= 0) {
        // Session ended naturally
        endSession('Session completed');
      } else {
        setState(prev => ({ ...prev, timeRemaining: remaining }));
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [state.activeSession, endSession]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadShieldData();
    }
  }, [user, loadShieldData]);

  // Listen for app resume
  useEffect(() => {
    const handleResume = () => {
      loadShieldData();
    };
    
    window.addEventListener('app:resume', handleResume);
    return () => window.removeEventListener('app:resume', handleResume);
  }, [loadShieldData]);

  // Listen for session events
  useEffect(() => {
    const handleSessionEnded = () => {
      loadShieldData();
    };
    
    window.addEventListener('shield:sessionEnded', handleSessionEnded);
    return () => window.removeEventListener('shield:sessionEnded', handleSessionEnded);
  }, [loadShieldData]);

  return {
    ...state,
    loadShieldData,
    startSession,
    endSession,
    extendSession,
    requestBypass,
    createProfile,
    updateProfile,
    deleteProfile,
    logBypassAttempt: (type: any, wasBlocked: boolean, details?: any) => 
      logBypassAttempt(type, wasBlocked, details, user?.id)
  };
}
