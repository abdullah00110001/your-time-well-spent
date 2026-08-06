import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Plus, TrendingUp, Clock, Target, Zap } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GoalSuggestion {
  id: string;
  title: string;
  description: string;
  reason: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  icon: string;
}

export function SmartGoalSuggestions() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<GoalSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingGoal, setAddingGoal] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      generateSuggestions();
    }
  }, [user]);

  const generateSuggestions = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Fetch recent user data to analyze patterns
      const { data: entries } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(30);

      const { data: habits } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id);

      // Analyze patterns and generate suggestions
      const newSuggestions: GoalSuggestion[] = [];

      // Analyze sleep patterns
      const avgSleep = entries?.reduce((sum, e) => sum + (e.sleep_duration_minutes || 0), 0) / (entries?.length || 1);
      if (avgSleep < 420) { // Less than 7 hours
        newSuggestions.push({
          id: 'sleep-improvement',
          title: 'Improve Sleep Quality',
          description: 'Aim for 7-8 hours of quality sleep each night',
          reason: `Your average sleep is ${Math.round(avgSleep / 60)}h. Better sleep can boost productivity by 30%`,
          difficulty: 'medium',
          category: 'Health',
          icon: '😴'
        });
      }

      // Analyze Quran reading
      const quranDays = entries?.filter(e => e.quran_read).length || 0;
      if (quranDays < (entries?.length || 0) * 0.5) {
        newSuggestions.push({
          id: 'quran-daily',
          title: 'Daily Quran Connection',
          description: 'Read Quran for at least 10 minutes daily',
          reason: 'Consistent Quran reading correlates with higher life satisfaction scores',
          difficulty: 'easy',
          category: 'Spiritual',
          icon: '📖'
        });
      }

      // Analyze exercise patterns
      const exerciseDays = entries?.filter(e => e.exercise_done).length || 0;
      if (exerciseDays < (entries?.length || 0) * 0.4) {
        newSuggestions.push({
          id: 'exercise-routine',
          title: 'Build Exercise Habit',
          description: 'Exercise at least 4 times per week',
          reason: 'Regular exercise improves focus and energy levels significantly',
          difficulty: 'medium',
          category: 'Health',
          icon: '💪'
        });
      }

      // Analyze screen time
      const avgScreenTime = entries?.reduce((sum, e) => sum + (e.device_time_minutes || 0), 0) / (entries?.length || 1);
      if (avgScreenTime > 240) { // More than 4 hours
        newSuggestions.push({
          id: 'screen-reduction',
          title: 'Reduce Screen Time',
          description: 'Limit recreational screen time to 2 hours daily',
          reason: `Current average: ${Math.round(avgScreenTime / 60)}h/day. Reducing can free up productive time`,
          difficulty: 'hard',
          category: 'Productivity',
          icon: '📱'
        });
      }

      // Analyze focus patterns
      const avgStudy = entries?.reduce((sum, e) => sum + (e.focused_study_minutes || 0), 0) / (entries?.length || 1);
      if (avgStudy < 60) {
        newSuggestions.push({
          id: 'deep-work',
          title: 'Master Deep Work',
          description: 'Complete 2 hours of focused work daily',
          reason: 'Deep work sessions lead to 3x higher productivity output',
          difficulty: 'hard',
          category: 'Productivity',
          icon: '🎯'
        });
      }

      // Check for missing habits
      if (!habits?.some(h => h.name.toLowerCase().includes('gratitude'))) {
        newSuggestions.push({
          id: 'gratitude-practice',
          title: 'Start Gratitude Practice',
          description: 'Write 3 things you are grateful for each day',
          reason: 'Gratitude journaling is linked to increased happiness and resilience',
          difficulty: 'easy',
          category: 'Mindfulness',
          icon: '🙏'
        });
      }

      setSuggestions(newSuggestions.slice(0, 4)); // Show top 4 suggestions
    } catch (error) {
      console.error('Error generating suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addGoal = async (suggestion: GoalSuggestion) => {
    if (!user) return;
    setAddingGoal(suggestion.id);

    try {
      const { error } = await supabase.from('goals').insert({
        user_id: user.id,
        title: suggestion.title,
        description: suggestion.description,
        year: new Date().getFullYear()
      });

      if (error) throw error;

      toast.success('Goal added successfully!');
      setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
    } catch (error) {
      console.error('Error adding goal:', error);
      toast.error('Failed to add goal');
    } finally {
      setAddingGoal(null);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'hard': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Smart Goal Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Smart Goal Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <Zap className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>Great job! You're on track with all suggested goals.</p>
            <p className="text-sm mt-1">Keep logging your daily activities for more personalized suggestions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Smart Goal Suggestions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map(suggestion => (
          <div
            key={suggestion.id}
            className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-2xl">{suggestion.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold">{suggestion.title}</h4>
                    <Badge variant="outline" className={getDifficultyColor(suggestion.difficulty)}>
                      {suggestion.difficulty}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {suggestion.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{suggestion.description}</p>
                  <p className="text-xs text-primary mt-2 flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {suggestion.reason}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => addGoal(suggestion)}
                disabled={addingGoal === suggestion.id}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
