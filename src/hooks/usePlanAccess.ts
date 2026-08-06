import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

type PlanTier = 'free' | 'premium' | 'ultimate';

interface UsePlanAccessReturn {
  currentTier: PlanTier;
  isLoading: boolean;
  isPremium: boolean;
  isUltimate: boolean;
  isTrial: boolean;
  trialEndsAt: string | null;
  expiresAt: string | null;
  canAccess: (requiredTier: PlanTier) => boolean;
}

const tierOrder: Record<PlanTier, number> = { free: 0, premium: 1, ultimate: 2 };

export function usePlanAccess(): UsePlanAccessReturn {
  const { user } = useAuth();
  const [currentTier, setCurrentTier] = useState<PlanTier>('free');
  const [isTrial, setIsTrial] = useState(false);
  const [trialEndsAt, setTrialEndsAt] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCurrentTier('free');
      setIsLoading(false);
      return;
    }

    const fetchSubscription = async () => {
      try {
        const { data } = await supabase
          .from('user_subscriptions')
          .select('*, subscription_plans(*)')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          const tier = (data.subscription_plans as any)?.tier as PlanTier || 'free';
          setCurrentTier(tier);
          setIsTrial(data.is_trial || false);
          setTrialEndsAt(data.trial_ends_at || null);
          setExpiresAt(data.expires_at || null);
        } else {
          setCurrentTier('free');
        }
      } catch (err) {
        console.warn('Failed to fetch plan access:', err);
        setCurrentTier('free');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubscription();
  }, [user]);

  const canAccess = (requiredTier: PlanTier): boolean => {
    return tierOrder[currentTier] >= tierOrder[requiredTier];
  };

  return {
    currentTier,
    isLoading,
    isPremium: tierOrder[currentTier] >= tierOrder.premium,
    isUltimate: currentTier === 'ultimate',
    isTrial,
    trialEndsAt,
    expiresAt,
    canAccess,
  };
}
