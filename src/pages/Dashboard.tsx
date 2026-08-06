import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppMode } from '@/contexts/AppModeContext';
import { useStreak } from '@/hooks/useStreak';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Target, CheckCircle2, Flame, Plus, Sparkles, Compass } from 'lucide-react';
import { format } from 'date-fns';
import TimeAwareness from '@/components/dashboard/TimeAwareness';
import SmallWinsWidget from '@/components/dashboard/SmallWinsWidget';
import LifeDistributionWidget from '@/components/dashboard/LifeDistributionWidget';
import UnifiedQuotes from '@/components/dashboard/UnifiedQuotes';
import ModeOnboarding from '@/components/mode/ModeOnboarding';
import OnboardingTour from '@/components/onboarding/OnboardingTour';
import GuidedOnboarding from '@/components/onboarding/GuidedOnboarding';
import AdminFeedbackNotifications from '@/components/dashboard/AdminFeedbackNotifications';
import PushNotificationPrompt from '@/components/notifications/PushNotificationPrompt';
import { SkeletonStats, SkeletonCard, SkeletonHero } from '@/components/ui/skeleton-card';
import { isAndroid } from '@/lib/capacitor/platform';

interface DashboardStats {
  totalGoals: number;
  totalHabits: number;
  todayCompleted: number;
  todayTotal: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { mode, isLoading: modeLoading } = useAppMode();
  const { currentStreak, consistencyScore, loading: streakLoading } = useStreak();
  const [stats, setStats] = useState<DashboardStats>({
    totalGoals: 0,
    totalHabits: 0,
    todayCompleted: 0,
    todayTotal: 0,
  });
  const [recentHabits, setRecentHabits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModeOnboarding, setShowModeOnboarding] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [showGuidedOnboarding, setShowGuidedOnboarding] = useState(false);
  // Check if onboarding is needed
  useEffect(() => {
    if (!modeLoading && user) {
      const guidedComplete = localStorage.getItem('guided_onboarding_complete');
      const modeComplete = localStorage.getItem('mode_onboarding_complete');
      const tourComplete = localStorage.getItem('onboarding_tour_complete');
      
      if (!guidedComplete) {
        setShowGuidedOnboarding(true);
      } else if (!modeComplete) {
        setShowModeOnboarding(true);
      } else if (!tourComplete) {
        setShowTour(true);
      }
    }
  }, [modeLoading, user]);
  useEffect(() => {
    if (user?.id) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchDashboardData = async () => {
    if (!user) { setLoading(false); return; }
    
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      const [goalsResult, habitsResult, entriesResult] = await Promise.all([
        supabase.from('goals').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('habits').select('*', { count: 'exact' }).eq('user_id', user.id).eq('is_active', true).limit(5),
        supabase.from('habit_entries').select('*').eq('user_id', user.id).eq('date', today),
      ]);

      const completedToday = entriesResult.data?.filter(e => e.completed).length || 0;

      setStats({
        totalGoals: goalsResult.count || 0,
        totalHabits: habitsResult.count || 0,
        todayCompleted: completedToday,
        todayTotal: habitsResult.count || 0,
      });

      setRecentHabits(habitsResult.data || []);
    } catch (err) {
      console.error('[Dashboard] fetchDashboardData error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greeting.morning');
    if (hour < 18) return t('dashboard.greeting.afternoon');
    return t('dashboard.greeting.evening');
  };

  const completionRate = stats.todayTotal > 0 
    ? Math.round((stats.todayCompleted / stats.todayTotal) * 100) 
    : 0;
  const pageShellClass = isAndroid
    ? 'px-4 pt-2 pb-24 sm:p-6 lg:p-8 max-w-7xl mx-auto lg:pb-8'
    : 'p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8';

  const handleModeComplete = () => {
    setShowModeOnboarding(false);
    // Show tour after mode selection
    const tourComplete = localStorage.getItem('onboarding_tour_complete');
    if (!tourComplete) {
      setTimeout(() => setShowTour(true), 500);
    }
  };

  // Show loading skeleton while data loads
  if (loading && !stats.totalHabits && !recentHabits.length) {
    return (
      <AppLayout>
        <div className={pageShellClass}>
          <div className="mb-4 sm:mb-6 space-y-2">
            <div className="h-8 w-64 bg-muted rounded-lg animate-pulse" />
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
          <SkeletonHero />
          <div className="my-6">
            <SkeletonStats />
          </div>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <SkeletonCard lines={5} />
            <SkeletonCard lines={5} />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Guided Onboarding (first-time) */}
      <GuidedOnboarding
        isOpen={showGuidedOnboarding}
        onComplete={(selectedMode) => {
          setShowGuidedOnboarding(false);
          localStorage.setItem('mode_onboarding_complete', 'true');
          localStorage.setItem('onboarding_tour_complete', 'true');
        }}
      />

      {/* Mode Onboarding Dialog */}
      <ModeOnboarding 
        isOpen={showModeOnboarding} 
        onComplete={handleModeComplete} 
      />

      {/* Feature Tour */}
      <OnboardingTour
        isOpen={showTour}
        onComplete={() => setShowTour(false)}
      />
      <div className={pageShellClass}>
        {/* Header */}
        <div className="mb-3 sm:mb-4">
          <h1 className="text-headline font-bold tracking-tight break-words">
            {getGreeting()}, {user?.email?.split('@')[0]}!
          </h1>
          <p className="mt-1 text-body text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        {/* Quick Access to Unified Dashboard */}
        <Card className={`mb-4 sm:mb-6 border-2 ${mode === 'islamic' ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20'}`}>
          <CardContent className="py-3 sm:py-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full shrink-0 ${mode === 'islamic' ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
                  <Compass className={`h-5 w-5 ${mode === 'islamic' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm sm:text-base">{mode === 'islamic' ? 'Islamic Dashboard' : 'Life Dashboard'}</p>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">
                    {mode === 'islamic' ? 'Faith-centered productivity tools' : 'Secular productivity tools'}
                  </p>
                </div>
              </div>
              <Button asChild size="sm" className={`w-full sm:w-auto ${mode === 'islamic' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                <Link to="/unified-dashboard">Open Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Admin Feedback Notifications */}
        <AdminFeedbackNotifications />

        {/* Push Notification Prompt */}
        <PushNotificationPrompt variant="banner" className="mb-4" />

        {/* Unified Daily Inspiration (merged quotes) */}
        <UnifiedQuotes />

        {/* Time Awareness Hero */}
        <TimeAwareness />

        {/* Stats Grid */}
        <div className="mb-6 sm:mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
              <CardTitle className="text-caption font-medium text-muted-foreground">
                {t('dashboard.todayProgress')}
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-title font-bold">{stats.todayCompleted}/{stats.todayTotal}</div>
              <Progress value={completionRate} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
              <CardTitle className="text-caption font-medium text-muted-foreground">
                {t('dashboard.activeGoals')}
              </CardTitle>
              <Target className="h-4 w-4 text-secondary shrink-0" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-title font-bold">{stats.totalGoals}</div>
              <p className="text-caption text-muted-foreground">{t('common.for')} {new Date().getFullYear()}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
              <CardTitle className="text-caption font-medium text-muted-foreground truncate">
                {t('dashboard.currentStreak')}
              </CardTitle>
              <Flame className="h-4 w-4 text-secondary shrink-0" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-title font-bold">
                {streakLoading ? '...' : currentStreak} <span className="text-body">{t('dashboard.days')}</span>
              </div>
              <p className="text-caption text-muted-foreground truncate">{t('dashboard.keepGoing')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
              <CardTitle className="text-caption font-medium text-muted-foreground">
                {t('dashboard.consistency')}
              </CardTitle>
              <Sparkles className="h-4 w-4 text-accent shrink-0" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="text-title font-bold">{streakLoading ? '...' : consistencyScore}%</div>
              <p className="text-caption text-muted-foreground">Last 30 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions & Recent Habits */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Today's Habits */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-subtitle">{t('dashboard.todayHabits')}</CardTitle>
                  <CardDescription className="text-caption">{t('dashboard.completeDaily')}</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                  <Link to="/habits">{t('dashboard.viewAll')}</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {recentHabits.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center">
                  <div className="mb-3 sm:mb-4 rounded-full bg-muted p-3">
                    <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">{t('dashboard.noHabits')}</p>
                  <Button asChild className="mt-3 sm:mt-4" size="sm">
                    <Link to="/habits/new">
                      <Plus className="mr-2 h-4 w-4" />
                      {t('dashboard.createFirst')}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {recentHabits.map((habit) => (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between rounded-lg border p-2 sm:p-3"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div
                          className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full shrink-0"
                          style={{ backgroundColor: habit.color }}
                        />
                        <span className="font-medium text-sm sm:text-base truncate">{habit.name}</span>
                      </div>
                      <Button variant="ghost" size="sm" className="shrink-0">
                        <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Goals Overview */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-subtitle">{t('dashboard.goalsOverview')}</CardTitle>
                  <CardDescription className="text-caption">{t('dashboard.yearlyObjectives')}</CardDescription>
                </div>
                <Button asChild variant="outline" size="sm" className="w-full sm:w-auto">
                  <Link to="/goals">{t('dashboard.viewAll')}</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {stats.totalGoals === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center">
                  <div className="mb-3 sm:mb-4 rounded-full bg-muted p-3">
                    <Target className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">{t('dashboard.noGoals')}</p>
                  <Button asChild className="mt-3 sm:mt-4" size="sm">
                    <Link to="/goals/new">
                      <Plus className="mr-2 h-4 w-4" />
                      {t('dashboard.setFirst')}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6 sm:py-8">
                  <p className="text-xs sm:text-sm text-muted-foreground text-center">
                    You have {stats.totalGoals} active goal{stats.totalGoals !== 1 ? 's' : ''}
                  </p>
                  <Button asChild className="mt-3 sm:mt-4" size="sm">
                    <Link to="/goals">
                      <Target className="mr-2 h-4 w-4" />
                      {t('dashboard.viewAll')}
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Small Wins & Life Distribution */}
        <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 lg:grid-cols-2">
          <SmallWinsWidget />
          <LifeDistributionWidget />
        </div>
      </div>
    </AppLayout>
  );
}
