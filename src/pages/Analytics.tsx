import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStreak } from '@/hooks/useStreak';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { Loader2, TrendingUp, Target, Calendar, Flame } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface WeeklyData {
  day: string;
  completed: number;
  total: number;
}

export default function Analytics() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { currentStreak, loading: streakLoading } = useStreak();
  const [loading, setLoading] = useState(true);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [stats, setStats] = useState({
    totalCompletions: 0,
    averageDaily: 0,
    bestDay: '',
  });

  useEffect(() => {
    if (user) fetchAnalytics();
  }, [user]);

  const fetchAnalytics = async () => {
    const today = new Date();
    const weekStart = format(startOfWeek(today), 'yyyy-MM-dd');
    const weekEnd = format(endOfWeek(today), 'yyyy-MM-dd');
    const last30Days = format(subDays(today, 30), 'yyyy-MM-dd');

    // Fetch habits count
    const { count: habitsCount } = await supabase
      .from('habits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .eq('is_active', true);

    // Fetch entries for the week
    const { data: weekEntries } = await supabase
      .from('habit_entries')
      .select('date, completed')
      .eq('user_id', user!.id)
      .gte('date', weekStart)
      .lte('date', weekEnd);

    // Fetch entries for last 30 days
    const { data: monthEntries } = await supabase
      .from('habit_entries')
      .select('date, completed')
      .eq('user_id', user!.id)
      .gte('date', last30Days)
      .eq('completed', true);

    // Process weekly data
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekData: WeeklyData[] = days.map((day, index) => {
      const date = new Date(startOfWeek(today));
      date.setDate(date.getDate() + index);
      const dateStr = format(date, 'yyyy-MM-dd');
      
      const dayEntries = weekEntries?.filter((e) => e.date === dateStr) || [];
      const completed = dayEntries.filter((e) => e.completed).length;

      return {
        day,
        completed,
        total: habitsCount || 0,
      };
    });

    setWeeklyData(weekData);

    // Calculate stats
    const totalCompletions = monthEntries?.length || 0;
    const averageDaily = totalCompletions / 30;
    
    const dayCompletions = weekData.reduce((max, curr) => 
      curr.completed > (max?.completed || 0) ? curr : max
    , weekData[0]);

    setStats({
      totalCompletions,
      averageDaily: Math.round(averageDaily * 10) / 10,
      bestDay: dayCompletions?.day || '-',
    });

    setLoading(false);
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-headline font-bold tracking-tight">{t('analytics.title')}</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {t('analytics.subtitle')}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="mb-6 sm:mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-caption font-medium text-muted-foreground">
                    Monthly Completions
                  </CardTitle>
                  <Target className="h-4 w-4 text-primary shrink-0" />
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-title font-bold">{stats.totalCompletions}</div>
                  <p className="text-caption text-muted-foreground">last 30 days</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-caption font-medium text-muted-foreground">
                    Daily Average
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-secondary shrink-0" />
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-title font-bold">{stats.averageDaily}</div>
                  <p className="text-caption text-muted-foreground">habits per day</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-caption font-medium text-muted-foreground">
                    Best Day
                  </CardTitle>
                  <Calendar className="h-4 w-4 text-accent shrink-0" />
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-title font-bold">{stats.bestDay}</div>
                  <p className="text-caption text-muted-foreground">most productive</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between p-3 sm:p-4 pb-1 sm:pb-2">
                  <CardTitle className="text-caption font-medium text-muted-foreground">
                    {t('dashboard.currentStreak')}
                  </CardTitle>
                  <Flame className="h-4 w-4 text-secondary shrink-0" />
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-0">
                  <div className="text-title font-bold">
                    {streakLoading ? '...' : currentStreak} <span className="text-body">{t('dashboard.days')}</span>
                  </div>
                  <p className="text-caption text-muted-foreground">{t('dashboard.keepGoing')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Weekly Chart */}
            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-subtitle">{t('analytics.weeklyProgress')}</CardTitle>
                <CardDescription className="text-caption">Daily habit completions for the current week</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="day" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Bar 
                        dataKey="completed" 
                        fill="hsl(var(--primary))" 
                        radius={[4, 4, 0, 0]}
                        name="Completed"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
