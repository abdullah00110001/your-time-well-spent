import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/contexts/AppModeContext';
import { toast } from 'sonner';

export interface Challenge {
  id: string;
  title: string;
  title_bn: string | null;
  description: string;
  description_bn: string | null;
  challenge_type: 'daily' | 'weekly' | 'monthly';
  target_metric: string;
  target_value: number;
  reward_points: number;
  badge_name: string | null;
  badge_icon: string | null;
  mode: 'islamic' | 'regular' | 'both';
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface UserChallenge {
  id: string;
  user_id: string;
  challenge_id: string;
  progress: number;
  is_completed: boolean;
  completed_at: string | null;
  joined_at: string;
  challenge?: Challenge;
}

export interface UserBadge {
  id: string;
  badge_name: string;
  badge_icon: string | null;
  badge_description: string | null;
  earned_at: string;
}

export function useChallenges() {
  const { user } = useAuth();
  const { mode } = useAppMode();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChallenges = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch available challenges for user's mode
      const { data: challengesData, error: challengesError } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_active', true)
        .or(`mode.eq.both,mode.eq.${mode}`);

      if (challengesError) throw challengesError;

      // Fetch user's joined challenges
      const { data: userChallengesData, error: ucError } = await supabase
        .from('user_challenges')
        .select('*')
        .eq('user_id', user.id);

      if (ucError) throw ucError;

      // Fetch user badges
      const { data: badgesData, error: badgesError } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', user.id)
        .order('earned_at', { ascending: false });

      if (badgesError) throw badgesError;

      setChallenges((challengesData as Challenge[]) || []);
      setUserChallenges((userChallengesData as UserChallenge[]) || []);
      setUserBadges((badgesData as UserBadge[]) || []);
    } catch (error) {
      console.error('Error fetching challenges:', error);
    } finally {
      setLoading(false);
    }
  }, [user, mode]);

  const joinChallenge = async (challengeId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('user_challenges')
        .insert({
          user_id: user.id,
          challenge_id: challengeId,
          progress: 0
        });

      if (error) throw error;

      toast.success('Challenge joined! Good luck! 🎯');
      await fetchChallenges();
    } catch (error: any) {
      if (error.code === '23505') {
        toast.error('You have already joined this challenge');
      } else {
        toast.error('Failed to join challenge');
      }
    }
  };

  const updateProgress = async (challengeId: string, newProgress: number) => {
    if (!user) return;

    const challenge = challenges.find(c => c.id === challengeId);
    const isCompleted = challenge ? newProgress >= challenge.target_value : false;

    try {
      const { error } = await supabase
        .from('user_challenges')
        .update({
          progress: newProgress,
          is_completed: isCompleted,
          completed_at: isCompleted ? new Date().toISOString() : null
        })
        .eq('user_id', user.id)
        .eq('challenge_id', challengeId);

      if (error) throw error;

      // If completed, award badge
      if (isCompleted && challenge?.badge_name) {
        await supabase
          .from('user_badges')
          .insert({
            user_id: user.id,
            badge_name: challenge.badge_name,
            badge_icon: challenge.badge_icon,
            badge_description: `Earned by completing: ${challenge.title}`,
            source_challenge_id: challengeId
          });

        toast.success(`🏆 Badge Earned: ${challenge.badge_name}!`);
      }

      await fetchChallenges();
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  const getActiveChallenges = () => {
    const joinedIds = userChallenges.map(uc => uc.challenge_id);
    return challenges.filter(c => !joinedIds.includes(c.id));
  };

  const getJoinedChallenges = () => {
    return userChallenges.map(uc => ({
      ...uc,
      challenge: challenges.find(c => c.id === uc.challenge_id)
    }));
  };

  return {
    challenges,
    userChallenges,
    userBadges,
    loading,
    joinChallenge,
    updateProgress,
    getActiveChallenges,
    getJoinedChallenges,
    refetch: fetchChallenges
  };
}
