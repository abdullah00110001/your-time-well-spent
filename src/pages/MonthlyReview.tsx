import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subMonths } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { 
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, 
  BookOpen, Clock, Target, AlertTriangle, Flame, Moon
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface MonthlyStats {
  totalStudyHours: number;
  avgDiscipline: number;
  salahConsistency: number;
  quranDays: number;
  avgSleepHours: number;
  avgDeviceHours: number;
  avgRating: number;
  burnoutRisk: 'low' | 'medium' | 'high';
  bestDay: string;
  worstDay: string;
  totalDaysTracked: number;
}

interface DailyData {
  date: string;
  rating: number;
  study: number;
  discipline: number;
}

export default function MonthlyReview() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchMonthlyData();
  }, [user, selectedMonth]);

  const fetchMonthlyData = async () => {
    if (!user) return;
    setLoading(true);

    const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

    const { data: entries } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', monthStart)
      .lte('date', monthEnd)
      .order('date');

    if (!entries || entries.length === 0) {
      setStats(null);
      setDailyData([]);
      setLoading(false);
      return;
    }

    // Calculate stats
    const totalStudyMinutes = entries.reduce((sum, e) => 
      sum + (e.focused_study_minutes || 0) + (e.revision_minutes || 0) + (e.skill_learning_minutes || 0), 0);
    
    const avgDiscipline = entries.reduce((sum, e) => sum + (e.discipline_level || 0), 0) / entries.length;
    
    const salahCount = entries.reduce((sum, e) => {
      const count = [e.fajr_completed, e.dhuhr_completed, e.asr_completed, e.maghrib_completed, e.isha_completed]
        .filter(Boolean).length;
      return sum + count;
    }, 0);
    const salahConsistency = (salahCount / (entries.length * 5)) * 100;

    const quranDays = entries.filter(e => e.quran_read).length;
    
    const avgSleep = entries.reduce((sum, e) => sum + (e.sleep_duration_minutes || 0), 0) / entries.length / 60;
    const avgDevice = entries.reduce((sum, e) => sum + (e.device_time_minutes || 0), 0) / entries.length / 60;
    const avgRating = entries.reduce((sum, e) => sum + (e.overall_day_rating || 0), 0) / entries.length;

    // Find best and worst days
    const sortedByRating = [...entries].sort((a, b) => (b.overall_day_rating || 0) - (a.overall_day_rating || 0));
    const bestDay = sortedByRating[0]?.date || '';
    const worstDay = sortedByRating[sortedByRating.length - 1]?.date || '';

    // Calculate burnout risk
    const lowEnergyDays = entries.filter(e => (e.energy_level || 0) <= 2).length;
    const burnoutRisk = lowEnergyDays > entries.length * 0.4 ? 'high' : 
                        lowEnergyDays > entries.length * 0.2 ? 'medium' : 'low';

    setStats({
      totalStudyHours: Math.round(totalStudyMinutes / 60 * 10) / 10,
      avgDiscipline: Math.round(avgDiscipline * 10) / 10,
      salahConsistency: Math.round(salahConsistency),
      quranDays,
      avgSleepHours: Math.round(avgSleep * 10) / 10,
      avgDeviceHours: Math.round(avgDevice * 10) / 10,
      avgRating: Math.round(avgRating * 10) / 10,
      burnoutRisk,
      bestDay,
      worstDay,
      totalDaysTracked: entries.length,
    });

    // Prepare chart data
    const chartData = entries.map(e => ({
      date: format(new Date(e.date), 'd'),
      rating: e.overall_day_rating || 0,
      study: Math.round(((e.focused_study_minutes || 0) + (e.revision_minutes || 0)) / 60 * 10) / 10,
      discipline: e.discipline_level || 0,
    }));

    setDailyData(chartData);
    setLoading(false);
  };

  const navigateMonth = (direction: number) => {
    setSelectedMonth(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const getBurnoutColor = (risk: string) => {
    switch (risk) {
      case 'low': return 'text-green-500';
      case 'medium': return 'text-yellow-500';
      case 'high': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getInsight = () => {
    if (!stats) return '';
    
    const insights = [];
    
    if (stats.salahConsistency < 60) {
      insights.push(language === 'bn' 
        ? 'নামাজে আরও নিয়মিত হওয়া দরকার।'
        : 'Focus on improving Salah consistency.');
    }
    
    if (stats.avgDeviceHours > 4) {
      insights.push(language === 'bn'
        ? 'ডিভাইস ব্যবহার কমানোর চেষ্টা করুন।'
        : 'Try to reduce device usage.');
    }
    
    if (stats.avgSleepHours < 6) {
      insights.push(language === 'bn'
        ? 'পর্যাপ্ত ঘুম নিশ্চিত করুন।'
        : 'Ensure adequate sleep for better performance.');
    }
    
    if (stats.burnoutRisk === 'high') {
      insights.push(language === 'bn'
        ? '⚠️ বার্নআউটের ঝুঁকি বেশি। বিশ্রাম নিন।'
        : '⚠️ High burnout risk detected. Take rest.');
    }

    if (stats.quranDays >= 20) {
      insights.push(language === 'bn'
        ? '✨ কুরআনের সাথে চমৎকার সংযোগ!'
        : '✨ Excellent Quran consistency!');
    }

    return insights.length > 0 ? insights[0] : (language === 'bn' ? 'চালিয়ে যান!' : 'Keep up the good work!');
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">
              {language === 'bn' ? 'মাসিক পর্যালোচনা' : 'Monthly Review'}
            </h1>
            <p className="text-muted-foreground">
              {language === 'bn' ? 'আপনার মাসিক অগ্রগতি বিশ্লেষণ' : 'Analyze your monthly progress'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => navigateMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center font-medium">
              {format(selectedMonth, 'MMMM yyyy')}
            </span>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigateMonth(1)}
              disabled={selectedMonth >= startOfMonth(new Date())}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : !stats ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              {language === 'bn' ? 'এই মাসে কোন ডেটা নেই' : 'No data for this month'}
            </p>
          </Card>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {language === 'bn' ? 'মোট পড়াশোনা' : 'Total Study'}
                  </CardTitle>
                  <Clock className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalStudyHours}h</div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'bn' ? `${stats.totalDaysTracked} দিন ট্র্যাক করা হয়েছে` : `${stats.totalDaysTracked} days tracked`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {language === 'bn' ? 'নামাজ ধারাবাহিকতা' : 'Salah Consistency'}
                  </CardTitle>
                  <Target className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.salahConsistency}%</div>
                  <Progress value={stats.salahConsistency} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {language === 'bn' ? 'কুরআনের দিন' : 'Quran Days'}
                  </CardTitle>
                  <BookOpen className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.quranDays}</div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'bn' ? 'দিন' : 'days this month'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {language === 'bn' ? 'গড় রেটিং' : 'Avg Rating'}
                  </CardTitle>
                  <Flame className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.avgRating}/10</div>
                  <p className="text-xs text-muted-foreground">
                    {language === 'bn' ? 'দৈনিক গড়' : 'daily average'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Discipline Curve */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === 'bn' ? 'শৃঙ্খলা বক্ররেখা' : 'Discipline Curve'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'bn' ? 'দৈনিক শৃঙ্খলা স্তর' : 'Daily discipline levels'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis domain={[0, 5]} className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="discipline" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Study Hours Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {language === 'bn' ? 'দৈনিক পড়াশোনা' : 'Daily Study Hours'}
                  </CardTitle>
                  <CardDescription>
                    {language === 'bn' ? 'ঘণ্টায় পড়াশোনার সময়' : 'Study time in hours'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar 
                          dataKey="study" 
                          fill="hsl(var(--secondary))" 
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    {language === 'bn' ? 'সেরা দিন' : 'Best Day'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold">
                    {stats.bestDay ? format(new Date(stats.bestDay), 'MMMM d') : '-'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-red-500" />
                    {language === 'bn' ? 'দুর্বল দিন' : 'Weak Day'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-semibold">
                    {stats.worstDay ? format(new Date(stats.worstDay), 'MMMM d') : '-'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className={`h-4 w-4 ${getBurnoutColor(stats.burnoutRisk)}`} />
                    {language === 'bn' ? 'বার্নআউট ঝুঁকি' : 'Burnout Risk'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`font-semibold capitalize ${getBurnoutColor(stats.burnoutRisk)}`}>
                    {stats.burnoutRisk}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Insight Card */}
            <Card className="bg-primary/5 border-primary/20">
              <CardHeader>
                <CardTitle className="text-lg">
                  💡 {language === 'bn' ? 'মাসিক অন্তর্দৃষ্টি' : 'Monthly Insight'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg">{getInsight()}</p>
              </CardContent>
            </Card>

            {/* Additional Stats */}
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Moon className="h-5 w-5" />
                    {language === 'bn' ? 'ঘুম ও ডিভাইস' : 'Sleep & Device'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      {language === 'bn' ? 'গড় ঘুম' : 'Avg Sleep'}
                    </span>
                    <span className="font-semibold">{stats.avgSleepHours}h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      {language === 'bn' ? 'গড় ডিভাইস সময়' : 'Avg Device Time'}
                    </span>
                    <span className="font-semibold">{stats.avgDeviceHours}h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">
                      {language === 'bn' ? 'গড় শৃঙ্খলা' : 'Avg Discipline'}
                    </span>
                    <span className="font-semibold">{stats.avgDiscipline}/5</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    📊 {language === 'bn' ? 'মাসের সারসংক্ষেপ' : 'Month Summary'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {language === 'bn' 
                      ? `আপনি এই মাসে ${stats.totalDaysTracked} দিন ট্র্যাক করেছেন, ${stats.totalStudyHours} ঘণ্টা পড়াশোনা করেছেন এবং ${stats.quranDays} দিন কুরআন পড়েছেন।`
                      : `You tracked ${stats.totalDaysTracked} days this month, studied for ${stats.totalStudyHours} hours, and read Quran on ${stats.quranDays} days.`
                    }
                  </p>
                  {stats.salahConsistency >= 80 && (
                    <p className="text-sm text-green-600">
                      ✅ {language === 'bn' ? 'নামাজে দুর্দান্ত ধারাবাহিকতা!' : 'Great Salah consistency!'}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
