import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, TrendingDown, Brain, Battery, Clock, Shield, Lightbulb, Heart } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface PredictionData {
  burnoutRisk: number;
  burnoutFactors: string[];
  recommendations: string[];
  optimalWorkTime: string;
  energyPrediction: 'high' | 'medium' | 'low';
  weeklyOutlook: string;
}

export function PredictiveAnalytics() {
  const { user } = useAuth();
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      analyzePredictions();
    }
  }, [user]);

  const analyzePredictions = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Get recent entries for analysis
      const { data: entries } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(30);

      if (!entries || entries.length < 3) {
        setPrediction({
          burnoutRisk: 0,
          burnoutFactors: [],
          recommendations: ['Continue logging daily entries to unlock personalized predictions'],
          optimalWorkTime: 'Not enough data',
          energyPrediction: 'medium',
          weeklyOutlook: 'Keep tracking to see your weekly outlook'
        });
        setIsLoading(false);
        return;
      }

      // Calculate burnout indicators
      const burnoutFactors: string[] = [];
      
      // Factor 1: Low sleep consistency
      const avgSleep = entries.reduce((s, e) => s + (e.sleep_duration_minutes || 0), 0) / entries.length;
      if (avgSleep < 360) burnoutFactors.push('Insufficient sleep (< 6 hours average)');
      
      // Factor 2: High screen time
      const avgScreen = entries.reduce((s, e) => s + (e.device_time_minutes || 0), 0) / entries.length;
      if (avgScreen > 300) burnoutFactors.push('High recreational screen time');
      
      // Factor 3: Low exercise frequency
      const exerciseDays = entries.filter(e => e.exercise_done).length;
      if (exerciseDays < entries.length * 0.3) burnoutFactors.push('Low exercise frequency');
      
      // Factor 4: Declining mood trend
      const recentMoods = entries.slice(0, 7).map(e => e.overall_day_rating || 3);
      const olderMoods = entries.slice(7, 14).map(e => e.overall_day_rating || 3);
      const recentAvg = recentMoods.reduce((s, m) => s + m, 0) / recentMoods.length;
      const olderAvg = olderMoods.reduce((s, m) => s + m, 0) / (olderMoods.length || 1);
      if (recentAvg < olderAvg - 0.5) burnoutFactors.push('Declining mood trend');
      
      // Factor 5: Skipped prayers
      const completeSalahDays = entries.filter(e => 
        e.fajr_completed && e.dhuhr_completed && e.asr_completed && 
        e.maghrib_completed && e.isha_completed
      ).length;
      if (completeSalahDays < entries.length * 0.5) burnoutFactors.push('Inconsistent prayer routine');
      
      // Factor 6: Low focus levels
      const avgFocus = entries.reduce((s, e) => s + (e.focus_level || 3), 0) / entries.length;
      if (avgFocus < 2.5) burnoutFactors.push('Sustained low focus levels');

      // Calculate burnout risk (0-100)
      const burnoutRisk = Math.min(100, Math.round(burnoutFactors.length * 15 + (5 - recentAvg) * 10));

      // Generate recommendations
      const recommendations: string[] = [];
      if (avgSleep < 360) recommendations.push('Aim for 7-8 hours of sleep tonight');
      if (avgScreen > 300) recommendations.push('Try a 30-minute digital detox this evening');
      if (exerciseDays < entries.length * 0.3) recommendations.push('Schedule a 15-minute walk today');
      if (recentAvg < olderAvg) recommendations.push('Practice gratitude journaling before bed');
      if (completeSalahDays < entries.length * 0.5) recommendations.push('Set prayer reminders on your phone');
      
      if (recommendations.length === 0) {
        recommendations.push('Great job! Keep maintaining your healthy routines');
      }

      // Determine optimal work time based on patterns
      const morningEntries = entries.filter(e => e.focus_level && e.focus_level >= 4);
      const optimalWorkTime = morningEntries.length > entries.length * 0.5 
        ? 'Morning (9am - 12pm)'
        : 'Afternoon (2pm - 5pm)';

      // Energy prediction for tomorrow
      const lastEntry = entries[0];
      const sleptWell = (lastEntry?.sleep_duration_minutes || 0) >= 420;
      const exercisedRecently = entries.slice(0, 3).some(e => e.exercise_done);
      const energyPrediction: 'high' | 'medium' | 'low' = 
        sleptWell && exercisedRecently ? 'high' :
        sleptWell || exercisedRecently ? 'medium' : 'low';

      // Weekly outlook
      const weeklyOutlook = burnoutRisk > 60 
        ? 'Consider taking a recovery day this week'
        : burnoutRisk > 40
        ? 'Monitor your energy levels closely'
        : 'Looking good! Maintain your momentum';

      setPrediction({
        burnoutRisk,
        burnoutFactors,
        recommendations,
        optimalWorkTime,
        energyPrediction,
        weeklyOutlook
      });
    } catch (error) {
      console.error('Error analyzing predictions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getBurnoutColor = (risk: number) => {
    if (risk < 30) return 'text-emerald-500';
    if (risk < 60) return 'text-amber-500';
    return 'text-red-500';
  };

  const getBurnoutBg = (risk: number) => {
    if (risk < 30) return 'bg-emerald-500';
    if (risk < 60) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const getEnergyIcon = (level: string) => {
    switch (level) {
      case 'high': return <Battery className="h-4 w-4 text-emerald-500" />;
      case 'medium': return <Battery className="h-4 w-4 text-amber-500" />;
      case 'low': return <Battery className="h-4 w-4 text-red-500" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-500" />
            Predictive Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 rounded-lg bg-muted animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  if (!prediction) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-500" />
          Predictive Analytics
        </CardTitle>
        <CardDescription>
          AI-powered insights based on your patterns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Burnout Risk Meter */}
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${getBurnoutColor(prediction.burnoutRisk)}`} />
              <h4 className="font-medium">Burnout Risk Level</h4>
            </div>
            <span className={`text-2xl font-bold ${getBurnoutColor(prediction.burnoutRisk)}`}>
              {prediction.burnoutRisk}%
            </span>
          </div>
          <Progress 
            value={prediction.burnoutRisk} 
            className="h-3"
          />
          {prediction.burnoutFactors.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-muted-foreground font-medium">Contributing factors:</p>
              {prediction.burnoutFactors.map((factor, idx) => (
                <p key={idx} className="text-xs text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-amber-500" />
                  {factor}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg border bg-card text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-xs text-muted-foreground">Optimal Work Time</p>
            <p className="text-sm font-medium">{prediction.optimalWorkTime}</p>
          </div>
          <div className="p-3 rounded-lg border bg-card text-center">
            <div className="flex justify-center mb-1">
              {getEnergyIcon(prediction.energyPrediction)}
            </div>
            <p className="text-xs text-muted-foreground">Tomorrow's Energy</p>
            <p className="text-sm font-medium capitalize">{prediction.energyPrediction}</p>
          </div>
        </div>

        {/* Weekly Outlook */}
        <div className="p-3 rounded-lg bg-muted/50 border">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Weekly Outlook</span>
          </div>
          <p className="text-sm text-muted-foreground">{prediction.weeklyOutlook}</p>
        </div>

        {/* Recommendations */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Recommendations</span>
          </div>
          {prediction.recommendations.map((rec, idx) => (
            <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-card border">
              <Heart className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm">{rec}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
