import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode } from '@/contexts/AppModeContext';
import { useDashboardData, calculateScores } from '@/hooks/useDashboardData';
import ModeOnboarding from '@/components/mode/ModeOnboarding';
import AppLayout from '@/components/layout/AppLayout';
import NiyyahValidator from '@/components/islamic/NiyyahValidator';
import BarakahIndex from '@/components/islamic/BarakahIndex';
import NafsCounter from '@/components/islamic/NafsCounter';
import TawbahProtocol from '@/components/islamic/TawbahProtocol';
import GhaflahMeter from '@/components/islamic/GhaflahmMeter';
import SadaqahTracker from '@/components/islamic/SadaqahTracker';
import QuranicAnchorSystem from '@/components/islamic/QuranicAnchor';
import MawtMode from '@/components/islamic/MawtMode';
import TahajjudAnalytics from '@/components/islamic/TahajjudAnalytics';
import AkhirahRatio from '@/components/islamic/AkhirahRatio';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Moon, Sun, RefreshCw, AlertCircle, TrendingUp, Clock, Zap, BookOpen, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function UnifiedDashboard() {
  const { user } = useAuth();
  const { mode, labels, isLoading: modeLoading } = useAppMode();
  const { 
    todayEntry, 
    recentEntries, 
    studySessions, 
    serviceLogs, 
    nafsLogs,
    tahajjudData,
    loading: dataLoading, 
    error,
    refetch 
  } = useDashboardData();
  const navigate = useNavigate();
  
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMawtMode, setShowMawtMode] = useState(false);

  // Check if onboarding needed
  useEffect(() => {
    const onboardingComplete = localStorage.getItem('mode_onboarding_complete');
    if (!onboardingComplete && user) {
      setShowOnboarding(true);
    }
  }, [user]);

  // Check if Friday for Mawt mode
  useEffect(() => {
    const today = new Date();
    const isFriday = today.getDay() === 5;
    const lastMawtCheck = localStorage.getItem('last_mawt_check');
    const todayStr = today.toISOString().split('T')[0];
    
    if (isFriday && lastMawtCheck !== todayStr) {
      setShowMawtMode(true);
    }
  }, []);

  const handleMawtSubmit = async (preparedness: number) => {
    localStorage.setItem('last_mawt_check', new Date().toISOString().split('T')[0]);
    
    if (user && todayEntry) {
      await supabase
        .from('daily_entries')
        .update({ mawt_preparedness: preparedness })
        .eq('id', todayEntry.date)
        .eq('user_id', user.id);
    }
    
    toast.success(mode === 'islamic' ? 'May Allah grant you readiness' : 'Reflection recorded');
  };

  const handleDayReset = async () => {
    if (!user) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('daily_entries')
        .upsert({
          user_id: user.id,
          date: today,
          day_reset_used: true,
          day_reset_time: new Date().toISOString(),
        }, {
          onConflict: 'user_id,date'
        });

      if (error) throw error;
      
      toast.success(mode === 'islamic' ? 'Tawbah activated! Fresh start granted.' : 'Day reset! Fresh start activated.');
      refetch();
    } catch (error) {
      console.error('Error resetting day:', error);
      toast.error('Failed to reset day');
    }
  };

  const handleTahajjudToggle = async (performed: boolean) => {
    if (!user) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from('daily_entries')
        .upsert({
          user_id: user.id,
          date: today,
          tahajjud_performed: performed,
        }, {
          onConflict: 'user_id,date'
        });

      if (error) throw error;
      
      if (performed) {
        toast.success(mode === 'islamic' ? 'Tahajjud recorded! May it be accepted.' : 'Early rising recorded!');
      }
      refetch();
    } catch (error) {
      console.error('Error updating tahajjud:', error);
    }
  };

  const handleLogService = async (data: { type: string; hours: number; beneficiary?: string }) => {
    if (!user) return;
    
    try {
      const { error } = await supabase.from('service_logs').insert({
        user_id: user.id,
        service_type: data.type,
        hours: data.hours,
        beneficiary: data.beneficiary || null,
      });

      if (error) throw error;
      
      toast.success(mode === 'islamic' ? 'Sadaqah logged! May it weigh heavy on your scale.' : 'Contribution recorded!');
      refetch();
    } catch (error) {
      console.error('Error logging service:', error);
      toast.error('Failed to log service');
    }
  };

  // Calculate scores from actual data
  const scores = calculateScores(todayEntry);
  
  // Calculate nafs stats from real data
  const todayNafsLogs = nafsLogs.filter(l => l.date === new Date().toISOString().split('T')[0]);
  const urgesResisted = todayNafsLogs.filter(l => l.resisted).length;
  const urgesSuccumbed = todayNafsLogs.filter(l => !l.resisted).length;

  // Calculate service hours
  const totalServiceHours = serviceLogs.reduce((sum, log) => sum + Number(log.hours), 0);

  // Get today's entry data or defaults
  const activeLearningMinutes = (todayEntry?.focused_study_minutes || 0) + (todayEntry?.quran_minutes || 0);
  const mindlessScrollingMinutes = todayEntry?.mindless_scrolling_minutes || 0;
  const currentScore = todayEntry?.weighted_daily_score || scores.overallScore;
  const currentHour = new Date().getHours();
  const dayResetUsed = todayEntry?.day_reset_used || false;

  // Calculate best time slot from study sessions
  const sessionsByHour = studySessions.reduce((acc, session) => {
    const hour = new Date(session.started_at).getHours();
    const slot = hour < 6 ? 'Pre-Dawn' : hour < 9 ? 'Morning' : hour < 12 ? 'Late Morning' : 
                 hour < 15 ? 'Afternoon' : hour < 18 ? 'Evening' : 'Night';
    acc[slot] = (acc[slot] || 0) + session.duration_minutes;
    return acc;
  }, {} as Record<string, number>);
  
  const bestTimeSlot = Object.entries(sessionsByHour).sort((a, b) => b[1] - a[1])[0]?.[0] || 
    (mode === 'islamic' ? 'After Fajr' : 'Early Morning');

  // Calculate average barakah from sessions
  const avgBarakah = studySessions.length > 0 
    ? studySessions.reduce((sum, s) => sum + (s.barakah_score || 0), 0) / studySessions.length 
    : 0;

  // Calculate weekly stats
  const last7Days = recentEntries.slice(0, 7);
  const weeklyAvgScore = last7Days.length > 0 
    ? Math.round(last7Days.reduce((sum, e) => sum + (e.weighted_daily_score || 0), 0) / last7Days.length)
    : 0;
  const weeklyStudyMinutes = last7Days.reduce((sum, e) => sum + (e.focused_study_minutes || 0), 0);
  const weeklyQuranMinutes = last7Days.reduce((sum, e) => sum + (e.quran_minutes || 0), 0);

  const isLoading = modeLoading || dataLoading;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8">
          {/* Mobile-first skeleton layout */}
          <div className="mb-4">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-3">
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-6 w-12" />
              </Card>
            ))}
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8">
          <Card className="border-destructive">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 py-6">
              <AlertCircle className="h-8 w-8 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Failed to load dashboard data</p>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
              <Button onClick={refetch} variant="outline" className="w-full sm:w-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Map study sessions to BarakahIndex format
  const barakhSessions = studySessions.map(s => ({
    time: new Date(s.started_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    duration: s.duration_minutes,
    value: s.barakah_score || 0,
    barakahScore: s.barakah_score || (s.duration_minutes * s.niyyah_multiplier / 10),
  }));

  // Map tahajjud data to TahajjudAnalytics format
  const mappedTahajjudData = tahajjudData.map(t => ({
    date: t.date,
    tahajjud: t.performed,
    energyLevel: t.energyLevel,
    productivityScore: t.energyLevel * 10,
  }));

  // Map service logs to SadaqahTracker format
  const mappedServiceLogs = serviceLogs.map(s => ({
    date: s.date,
    hours: Number(s.hours),
    type: s.service_type,
    moodBefore: s.mood_before || 5,
    moodAfter: s.mood_after || 5,
  }));

  return (
    <AppLayout>
      <ModeOnboarding 
        isOpen={showOnboarding} 
        onComplete={() => setShowOnboarding(false)} 
      />
      
      <MawtMode
        isOpen={showMawtMode}
        onClose={() => setShowMawtMode(false)}
        onSubmit={handleMawtSubmit}
      />

      <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
        {/* Mobile-optimized Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight flex items-center gap-2">
                {mode === 'islamic' ? <Moon className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 shrink-0" /> : <Sun className="h-5 w-5 sm:h-6 sm:w-6 text-amber-500 shrink-0" />}
                <span className="truncate">{mode === 'islamic' ? 'Islamic Dashboard' : 'Life Dashboard'}</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-1">
                {mode === 'islamic' 
                  ? 'Track your spiritual and worldly progress'
                  : 'Track your goals, habits, and performance'}
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button onClick={refetch} variant="ghost" size="icon" className="h-8 w-8">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Badge variant="outline" className={cn(
                "text-xs px-2 py-0.5 hidden sm:flex",
                mode === 'islamic' 
                  ? "border-emerald-500 text-emerald-600" 
                  : "border-blue-500 text-blue-600"
              )}>
                {labels.modeName}
              </Badge>
            </div>
          </div>
        </div>

        {/* Quick Stats Row - Mobile Optimized */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Target className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Today's Score</p>
                  <p className="text-lg sm:text-xl font-bold text-primary">{currentScore}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                    {mode === 'islamic' ? "Qur'an" : 'Reading'}
                  </p>
                  <p className="text-lg sm:text-xl font-bold text-emerald-600">{todayEntry?.quran_minutes || 0}m</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Focus Time</p>
                  <p className="text-lg sm:text-xl font-bold text-blue-600">{todayEntry?.focused_study_minutes || 0}m</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground truncate">Week Avg</p>
                  <p className="text-lg sm:text-xl font-bold text-amber-600">{weeklyAvgScore}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Weekly Progress Bar */}
        <Card className="mb-4 sm:mb-6">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs sm:text-sm font-medium">Weekly Progress</span>
              <span className="text-xs text-muted-foreground">{weeklyStudyMinutes} min study • {weeklyQuranMinutes} min {mode === 'islamic' ? "Qur'an" : 'reading'}</span>
            </div>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
                const entry = last7Days[6 - dayIndex];
                const hasEntry = !!entry;
                const score = entry?.weighted_daily_score || 0;
                const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
                const today = new Date();
                const dayOfWeek = (today.getDay() - 6 + dayIndex + 7) % 7;
                
                return (
                  <div key={dayIndex} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className={cn(
                        "w-full h-2 sm:h-3 rounded-full transition-all",
                        !hasEntry && "bg-muted",
                        hasEntry && score >= 70 && "bg-emerald-500",
                        hasEntry && score >= 40 && score < 70 && "bg-amber-500",
                        hasEntry && score < 40 && "bg-red-400"
                      )}
                    />
                    <span className="text-[10px] text-muted-foreground">{dayNames[dayOfWeek]}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Main Grid - Responsive */}
        <div className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {/* Weighted Score */}
          <AkhirahRatio
            worshipScore={scores.worshipScore}
            duniaScore={scores.productivityScore}
            salahCompleted={scores.salahCompleted}
            quranMinutes={todayEntry?.quran_minutes || 0}
            sadaqahDone={(todayEntry?.service_hours || 0) > 0}
            studyMinutes={todayEntry?.focused_study_minutes || 0}
            exerciseMinutes={(todayEntry as any)?.exercise_duration_minutes || 0}
          />

          {/* Quality Index */}
          <BarakahIndex
            sessions={barakhSessions}
            bestTimeSlot={bestTimeSlot}
            averageBarakah={avgBarakah}
          />

          {/* Impulse Control */}
          <NafsCounter
            urgesResisted={urgesResisted}
            urgesSuccumbed={urgesSuccumbed}
            onUpdate={refetch}
          />

          {/* Early Rising */}
          <TahajjudAnalytics
            data={mappedTahajjudData}
            tahajjudPerformed={todayEntry?.tahajjud_performed || false}
            onTahajjudToggle={handleTahajjudToggle}
          />

          {/* Dopamine Meter */}
          <GhaflahMeter
            activeLearningMinutes={activeLearningMinutes}
            mindlessScrollingMinutes={mindlessScrollingMinutes}
          />

          {/* Emotional Anchor */}
          <QuranicAnchorSystem />

          {/* Service Tracker */}
          <SadaqahTracker
            totalHours={totalServiceHours}
            serviceLogs={mappedServiceLogs}
            onLogService={handleLogService}
          />

          {/* Day Reset */}
          <TawbahProtocol
            currentScore={currentScore}
            targetScore={100}
            currentHour={currentHour}
            dayResetUsed={dayResetUsed}
            onReset={handleDayReset}
          />
        </div>
      </div>
    </AppLayout>
  );
}
