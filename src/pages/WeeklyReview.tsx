import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, subWeeks, eachDayOfInterval } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Calendar, BookOpen, Smartphone, Target } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface DailyEntry {
  date: string;
  focused_study_minutes: number;
  device_time_minutes: number;
  fajr_completed: boolean;
  dhuhr_completed: boolean;
  asr_completed: boolean;
  maghrib_completed: boolean;
  isha_completed: boolean;
  quran_read: boolean;
  focus_level: number;
  overall_day_rating: number;
}

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--info))'];

export default function WeeklyReview() {
  const { user } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const currentWeekStart = startOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 });
  const currentWeekEnd = endOfWeek(subWeeks(new Date(), weekOffset), { weekStartsOn: 1 });

  useEffect(() => {
    if (user) fetchWeeklyData();
  }, [user, weekOffset]);

  const fetchWeeklyData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', format(currentWeekStart, 'yyyy-MM-dd'))
        .lte('date', format(currentWeekEnd, 'yyyy-MM-dd'))
        .order('date', { ascending: true });

      if (error) throw error;
      setEntries((data || []) as DailyEntry[]);
    } catch (error) {
      console.error('Error fetching weekly data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate statistics
  const totalStudyMinutes = entries.reduce((sum, e) => sum + (e.focused_study_minutes || 0), 0);
  const totalDeviceMinutes = entries.reduce((sum, e) => sum + (e.device_time_minutes || 0), 0);
  const studyDeviceRatio = totalDeviceMinutes > 0 ? (totalStudyMinutes / totalDeviceMinutes).toFixed(2) : 'N/A';

  const salahCount = entries.reduce((sum, e) => {
    return sum + (e.fajr_completed ? 1 : 0) + (e.dhuhr_completed ? 1 : 0) + 
           (e.asr_completed ? 1 : 0) + (e.maghrib_completed ? 1 : 0) + (e.isha_completed ? 1 : 0);
  }, 0);
  const salahPercentage = entries.length > 0 ? Math.round((salahCount / (entries.length * 5)) * 100) : 0;

  const quranDays = entries.filter(e => e.quran_read).length;
  const quranPercentage = entries.length > 0 ? Math.round((quranDays / entries.length) * 100) : 0;

  const avgFocus = entries.length > 0 
    ? (entries.reduce((sum, e) => sum + (e.focus_level || 0), 0) / entries.length).toFixed(1)
    : 0;

  const avgRating = entries.length > 0
    ? (entries.reduce((sum, e) => sum + (e.overall_day_rating || 0), 0) / entries.length).toFixed(1)
    : 0;

  // Best and worst days
  const sortedByRating = [...entries].sort((a, b) => (b.overall_day_rating || 0) - (a.overall_day_rating || 0));
  const bestDay = sortedByRating[0];
  const worstDay = sortedByRating[sortedByRating.length - 1];

  // Chart data
  const dailyChartData = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd }).map(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    const entry = entries.find(e => e.date === dateStr);
    return {
      day: format(day, 'EEE'),
      study: entry ? Math.round(entry.focused_study_minutes / 60 * 10) / 10 : 0,
      device: entry ? Math.round(entry.device_time_minutes / 60 * 10) / 10 : 0,
      rating: entry?.overall_day_rating || 0,
    };
  });

  const focusTrendData = entries.map(e => ({
    date: format(new Date(e.date), 'EEE'),
    focus: e.focus_level || 0,
  }));

  // Generate AI advice
  const getAdvice = () => {
    const advice = [];
    if (salahPercentage < 80) {
      advice.push("🕌 Focus on improving Salah consistency. Try setting reminders.");
    }
    if (totalDeviceMinutes > totalStudyMinutes * 2) {
      advice.push("📱 Your device time is significantly higher than study time. Consider digital detox.");
    }
    if (quranPercentage < 50) {
      advice.push("📖 You missed Qur'an on several days. Even 5 minutes daily builds consistency.");
    }
    if (parseFloat(avgFocus as string) < 3) {
      advice.push("🎯 Your focus levels are low. Try the Pomodoro technique or remove distractions.");
    }
    if (advice.length === 0) {
      advice.push("🌟 Great week! Keep up the excellent work and maintain your momentum!");
    }
    return advice;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header with Week Navigation */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Weekly Review</h1>
            <p className="text-muted-foreground">
              {format(currentWeekStart, 'MMM d')} - {format(currentWeekEnd, 'MMM d, yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekOffset(prev => prev + 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setWeekOffset(0)}
              disabled={weekOffset === 0}
            >
              This Week
            </Button>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
              disabled={weekOffset === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {entries.length === 0 ? (
          <Card className="p-12 text-center">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No Data This Week</h3>
            <p className="text-muted-foreground">Start logging your daily entries to see weekly insights.</p>
          </Card>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Salah Consistency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{salahPercentage}%</div>
                  <Progress value={salahPercentage} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">{salahCount} / {entries.length * 5} prayers</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Study vs Device</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{studyDeviceRatio}x</div>
                  <div className="flex gap-2 mt-2 text-xs">
                    <span className="text-primary">📚 {Math.round(totalStudyMinutes / 60)}h</span>
                    <span className="text-destructive">📱 {Math.round(totalDeviceMinutes / 60)}h</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Qur'an Days</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-primary">{quranDays}/{entries.length}</div>
                  <Progress value={quranPercentage} className="mt-2" />
                  <p className="text-xs text-muted-foreground mt-1">{quranPercentage}% consistency</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg Day Rating</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgRating}/10</div>
                  <div className="flex items-center gap-1 mt-1 text-sm">
                    <span className="text-muted-foreground">Focus: {avgFocus}/5</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Best & Worst Days */}
            <div className="grid gap-4 md:grid-cols-2">
              {bestDay && (
                <Card className="border-primary/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-primary">
                      <TrendingUp className="h-5 w-5" />
                      Best Day
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{format(new Date(bestDay.date), 'EEEE, MMM d')}</p>
                    <p className="text-sm text-muted-foreground">Rating: {bestDay.overall_day_rating}/10</p>
                  </CardContent>
                </Card>
              )}
              {worstDay && entries.length > 1 && (
                <Card className="border-destructive/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-destructive">
                      <TrendingDown className="h-5 w-5" />
                      Needs Improvement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{format(new Date(worstDay.date), 'EEEE, MMM d')}</p>
                    <p className="text-sm text-muted-foreground">Rating: {worstDay.overall_day_rating}/10</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Charts */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Study vs Device Time</CardTitle>
                  <CardDescription>Hours per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={dailyChartData}>
                      <XAxis dataKey="day" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Bar dataKey="study" fill="hsl(var(--primary))" name="Study" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="device" fill="hsl(var(--destructive))" name="Device" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Daily Ratings Trend</CardTitle>
                  <CardDescription>Overall day performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={dailyChartData}>
                      <XAxis dataKey="day" fontSize={12} />
                      <YAxis domain={[0, 10]} fontSize={12} />
                      <Tooltip />
                      <Line 
                        type="monotone" 
                        dataKey="rating" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        dot={{ fill: 'hsl(var(--primary))' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* AI Advice */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Weekly Insights & Advice
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {getAdvice().map((advice, index) => (
                    <li key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <span>{advice}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}