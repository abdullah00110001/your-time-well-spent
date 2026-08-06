import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/contexts/AppModeContext';
import { format } from 'date-fns';
import { toast } from 'sonner';

export interface ReflectionPrompt {
  id: string;
  prompt_text: string;
  prompt_text_bn: string | null;
  category: 'gratitude' | 'growth' | 'spiritual' | 'productivity' | 'relationships' | 'general';
  mode: 'islamic' | 'regular' | 'both';
  mood_trigger: string[] | null;
}

export interface UserReflection {
  id: string;
  prompt_id: string | null;
  custom_prompt: string | null;
  response: string;
  mood_before: number | null;
  mood_after: number | null;
  reflection_date: string;
  created_at: string;
  prompt?: ReflectionPrompt;
}

export function useReflections() {
  const { user } = useAuth();
  const { mode } = useAppMode();
  const [prompts, setPrompts] = useState<ReflectionPrompt[]>([]);
  const [reflections, setReflections] = useState<UserReflection[]>([]);
  const [todayPrompt, setTodayPrompt] = useState<ReflectionPrompt | null>(null);
  const [todayReflection, setTodayReflection] = useState<UserReflection | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;

    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Fetch prompts for user's mode
      const { data: promptsData, error: promptsError } = await supabase
        .from('reflection_prompts')
        .select('*')
        .eq('is_active', true)
        .or(`mode.eq.both,mode.eq.${mode}`);

      if (promptsError) throw promptsError;

      // Fetch user's reflections
      const { data: reflectionsData, error: reflectionsError } = await supabase
        .from('user_reflections')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (reflectionsError) throw reflectionsError;

      const typedPrompts = (promptsData as ReflectionPrompt[]) || [];
      const typedReflections = (reflectionsData as UserReflection[]) || [];

      setPrompts(typedPrompts);
      setReflections(typedReflections);

      // Find today's reflection
      const todayRef = typedReflections.find(r => r.reflection_date === today);
      setTodayReflection(todayRef || null);

      // Select a daily prompt (deterministic based on date)
      if (typedPrompts.length > 0) {
        const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
        const promptIndex = dayOfYear % typedPrompts.length;
        setTodayPrompt(typedPrompts[promptIndex]);
      }
    } catch (error) {
      console.error('Error fetching reflections:', error);
    } finally {
      setLoading(false);
    }
  }, [user, mode]);

  const saveReflection = async (
    response: string,
    promptId?: string,
    customPrompt?: string,
    moodBefore?: number,
    moodAfter?: number
  ) => {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    try {
      // Check if reflection exists for today
      if (todayReflection) {
        const { error } = await supabase
          .from('user_reflections')
          .update({
            response,
            prompt_id: promptId || null,
            custom_prompt: customPrompt || null,
            mood_before: moodBefore || null,
            mood_after: moodAfter || null
          })
          .eq('id', todayReflection.id);

        if (error) throw error;
        toast.success('Reflection updated! 📝');
      } else {
        const { error } = await supabase
          .from('user_reflections')
          .insert({
            user_id: user.id,
            response,
            prompt_id: promptId || null,
            custom_prompt: customPrompt || null,
            mood_before: moodBefore || null,
            mood_after: moodAfter || null,
            reflection_date: today
          });

        if (error) throw error;
        toast.success('Reflection saved! 🌟');
      }

      await fetchData();
    } catch (error) {
      console.error('Error saving reflection:', error);
      toast.error('Failed to save reflection');
    }
  };

  const getRandomPrompt = (currentMood?: 'low' | 'medium' | 'high') => {
    let filtered = prompts;
    
    if (currentMood) {
      filtered = prompts.filter(p => 
        p.mood_trigger?.includes(currentMood) || !p.mood_trigger?.length
      );
    }

    if (filtered.length === 0) return prompts[0] || null;
    
    return filtered[Math.floor(Math.random() * filtered.length)];
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    prompts,
    reflections,
    todayPrompt,
    todayReflection,
    loading,
    saveReflection,
    getRandomPrompt,
    refetch: fetchData
  };
}
