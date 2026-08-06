import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface PatternInsight {
  id: string;
  title: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  confidence: number;
  actionable?: string;
}

export function PatternInsights() {
  const { user } = useAuth();
  const [insights, setInsights] = useState<PatternInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      analyzePatterns();
    }
  }, [user]);

  const analyzePatterns = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      const { data: entries } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(60);

      if (!entries || entries.length < 7) {
        setInsights([{
          id: 'not-enough-data',
          title: 'Gathering Data',
          description: 'Continue logging daily entries to unlock personalized pattern insights. We need at least 7 days of data.',
          impact: 'neutral',
          confidence: 0
        }]);
        setIsLoading(false);
        return;
      }

      const newInsights: PatternInsight[] = [];

      // Correlation: Sleep vs Productivity
      const sleepProductivityCorr = calculateCorrelation(
        entries.map(e => e.sleep_duration_minutes || 0),
        entries.map(e => e.focused_study_minutes || 0)
      );
      if (Math.abs(sleepProductivityCorr) > 0.3) {
        newInsights.push({
          id: 'sleep-productivity',
          title: 'Sleep-Productivity Link',
          description: sleepProductivityCorr > 0 
            ? `Better sleep correlates with ${Math.round(sleepProductivityCorr * 100)}% higher productivity for you.`
            : `Interestingly, you seem productive even with less sleep, but this may not be sustainable.`,
          impact: sleepProductivityCorr > 0 ? 'positive' : 'negative',
          confidence: Math.abs(sleepProductivityCorr),
          actionable: sleepProductivityCorr > 0 
            ? 'Prioritize 7-8 hours of sleep for optimal performance.'
            : 'Monitor your energy levels to prevent burnout.'
        });
      }

      // Correlation: Exercise vs Mood
      const exerciseDays = entries.filter(e => e.exercise_done);
      const nonExerciseDays = entries.filter(e => !e.exercise_done);
      const avgMoodExercise = exerciseDays.reduce((s, e) => s + (e.overall_day_rating || 0), 0) / (exerciseDays.length || 1);
      const avgMoodNoExercise = nonExerciseDays.reduce((s, e) => s + (e.overall_day_rating || 0), 0) / (nonExerciseDays.length || 1);
      
      if (exerciseDays.length >= 5 && nonExerciseDays.length >= 5) {
        const moodDiff = avgMoodExercise - avgMoodNoExercise;
        if (Math.abs(moodDiff) > 0.5) {
          newInsights.push({
            id: 'exercise-mood',
            title: 'Exercise-Mood Connection',
            description: moodDiff > 0
              ? `On days you exercise, your mood is ${Math.round(moodDiff * 10)}% higher on average.`
              : `Exercise days show slightly lower mood scores - you may be overtraining.`,
            impact: moodDiff > 0 ? 'positive' : 'negative',
            confidence: Math.min(Math.abs(moodDiff) / 2, 1),
            actionable: moodDiff > 0 
              ? 'Maintain your exercise routine for better emotional wellbeing.'
              : 'Consider lighter workouts or more rest days.'
          });
        }
      }

      // Pattern: Screen time impact
      const highScreenDays = entries.filter(e => (e.device_time_minutes || 0) > 180);
      const lowScreenDays = entries.filter(e => (e.device_time_minutes || 0) <= 180);
      const avgFocusHigh = highScreenDays.reduce((s, e) => s + (e.focus_level || 0), 0) / (highScreenDays.length || 1);
      const avgFocusLow = lowScreenDays.reduce((s, e) => s + (e.focus_level || 0), 0) / (lowScreenDays.length || 1);
      
      if (highScreenDays.length >= 5 && lowScreenDays.length >= 5) {
        const focusDiff = avgFocusLow - avgFocusHigh;
        if (focusDiff > 0.3) {
          newInsights.push({
            id: 'screen-focus',
            title: 'Screen Time Impact',
            description: `Days with less than 3 hours of recreational screen time show ${Math.round(focusDiff * 20)}% better focus.`,
            impact: 'positive',
            confidence: Math.min(focusDiff, 1),
            actionable: 'Set screen time limits to maintain focus throughout the day.'
          });
        }
      }

      // Pattern: Salah consistency
      const salahComplete = entries.filter(e => 
        e.fajr_completed && e.dhuhr_completed && e.asr_completed && 
        e.maghrib_completed && e.isha_completed
      );
      if (salahComplete.length >= 5) {
        const avgBarakah = salahComplete.reduce((s, e) => s + (e.barakah_index || 0), 0) / salahComplete.length;
        const avgBarakahOther = entries.filter(e => !salahComplete.includes(e))
          .reduce((s, e) => s + (e.barakah_index || 0), 0) / (entries.length - salahComplete.length || 1);
        
        if (avgBarakah > avgBarakahOther) {
          newInsights.push({
            id: 'salah-barakah',
            title: 'Salah & Barakah Connection',
            description: `Days with complete salah show ${Math.round((avgBarakah - avgBarakahOther) * 100)}% higher barakah index.`,
            impact: 'positive',
            confidence: 0.85,
            actionable: 'Maintain salah consistency for spiritual and worldly benefits.'
          });
        }
      }

      // Pattern: Best performing day
      const dayGroups: { [key: string]: typeof entries } = {};
      entries.forEach(e => {
        const day = new Date(e.date).toLocaleDateString('en', { weekday: 'long' });
        if (!dayGroups[day]) dayGroups[day] = [];
        dayGroups[day].push(e);
      });

      let bestDay = '';
      let bestScore = 0;
      Object.entries(dayGroups).forEach(([day, dayEntries]) => {
        const avgScore = dayEntries.reduce((s, e) => s + (e.overall_day_rating || 0), 0) / dayEntries.length;
        if (avgScore > bestScore) {
          bestScore = avgScore;
          bestDay = day;
        }
      });

      if (bestDay && bestScore > 3) {
        newInsights.push({
          id: 'best-day',
          title: 'Your Power Day',
          description: `${bestDay} is your most productive day with an average rating of ${bestScore.toFixed(1)}/5.`,
          impact: 'positive',
          confidence: 0.75,
          actionable: `Schedule important tasks on ${bestDay}s when possible.`
        });
      }

      setInsights(newInsights.slice(0, 5));
    } catch (error) {
      console.error('Error analyzing patterns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateCorrelation = (x: number[], y: number[]): number => {
    const n = x.length;
    if (n === 0) return 0;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
    const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
    const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive': return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case 'negative': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive': return 'border-l-emerald-500 bg-emerald-500/5';
      case 'negative': return 'border-l-red-500 bg-red-500/5';
      default: return 'border-l-muted-foreground bg-muted/30';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Pattern Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          AI Pattern Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map(insight => (
          <div
            key={insight.id}
            className={`p-4 rounded-lg border-l-4 ${getImpactColor(insight.impact)}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {getImpactIcon(insight.impact)}
                <h4 className="font-semibold">{insight.title}</h4>
              </div>
              {insight.confidence > 0 && (
                <Badge variant="outline" className="text-xs">
                  {Math.round(insight.confidence * 100)}% confidence
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">{insight.description}</p>
            {insight.actionable && (
              <p className="text-sm text-primary mt-2 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                {insight.actionable}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
