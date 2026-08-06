import { useState, useEffect } from 'react';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { 
  Brain, TrendingUp, TrendingDown, Target, Zap, 
  AlertTriangle, CheckCircle2, Clock, BookOpen,
  Smartphone, Moon, Activity, Sparkles
} from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface InsightData {
  productivityScore: number;
  deenScore: number;
  disciplineScore: number;
  focusScore: number;
  consistencyScore: number;
  moodTrend: 'improving' | 'stable' | 'declining';
  topHabit: string;
  harmfulPattern: string;
  focusDropDetected: boolean;
  recommendations: string[];
  weeklyTrend: { day: string; score: number }[];
}

interface RadarDataPoint {
  subject: string;
  value: number;
  fullMark: number;
}

export default function IntelligenceEngine() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [radarData, setRadarData] = useState<RadarDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) analyzeData();
  }, [user]);

  const analyzeData = async () => {
    if (!user) return;
    setLoading(true);

    const last30Days = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const last7Days = format(subDays(new Date(), 7), 'yyyy-MM-dd');

    // Fetch recent entries
    const { data: entries } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', last30Days)
      .order('date', { ascending: false });

    // Fetch user scores
    const { data: scores } = await supabase
      .from('user_scores')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', last7Days)
      .order('date', { ascending: false });

    if (!entries || entries.length === 0) {
      setInsights(null);
      setLoading(false);
      return;
    }

    // Calculate productivity score (0-100)
    const avgStudy = entries.reduce((sum, e) => 
      sum + (e.focused_study_minutes || 0) + (e.revision_minutes || 0), 0) / entries.length;
    const avgDevice = entries.reduce((sum, e) => sum + (e.device_time_minutes || 0), 0) / entries.length;
    const productivityScore = Math.min(100, Math.max(0, 
      Math.round((avgStudy / 3) - (avgDevice / 10) + 50)
    ));

    // Calculate deen score
    const avgSalah = entries.reduce((sum, e) => {
      const count = [e.fajr_completed, e.dhuhr_completed, e.asr_completed, e.maghrib_completed, e.isha_completed]
        .filter(Boolean).length;
      return sum + count;
    }, 0) / entries.length;
    const quranDays = entries.filter(e => e.quran_read).length;
    const deenScore = Math.round((avgSalah / 5 * 70) + (quranDays / entries.length * 30));

    // Calculate discipline score
    const avgDiscipline = entries.reduce((sum, e) => sum + (e.discipline_level || 0), 0) / entries.length;
    const disciplineScore = Math.round(avgDiscipline * 20);

    // Calculate focus score
    const avgFocus = entries.reduce((sum, e) => sum + (e.focus_level || 0), 0) / entries.length;
    const focusScore = Math.round(avgFocus * 20);

    // Calculate consistency
    const daysTracked = entries.length;
    const consistencyScore = Math.round((daysTracked / 30) * 100);

    // Mood/Energy trend analysis
    const recentEntries = entries.slice(0, 7);
    const olderEntries = entries.slice(7, 14);
    const recentAvgEnergy = recentEntries.reduce((sum, e) => sum + (e.energy_level || 0), 0) / (recentEntries.length || 1);
    const olderAvgEnergy = olderEntries.length > 0 
      ? olderEntries.reduce((sum, e) => sum + (e.energy_level || 0), 0) / olderEntries.length 
      : recentAvgEnergy;
    
    const moodTrend: 'improving' | 'stable' | 'declining' = 
      recentAvgEnergy > olderAvgEnergy + 0.5 ? 'improving' :
      recentAvgEnergy < olderAvgEnergy - 0.5 ? 'declining' : 'stable';

    // Detect focus drop
    const focusDropDetected = recentEntries.some((e, i) => 
      i > 0 && (e.focus_level || 0) < (recentEntries[i-1]?.focus_level || 0) - 2
    );

    // Identify patterns
    const topHabit = quranDays > entries.length * 0.7 ? (language === 'bn' ? 'কুরআন পাঠ' : 'Quran Reading') :
                     avgSalah > 4 ? (language === 'bn' ? 'নামাজ' : 'Salah') :
                     avgStudy > 120 ? (language === 'bn' ? 'পড়াশোনা' : 'Study') : 
                     (language === 'bn' ? 'ধারাবাহিকতা' : 'Consistency');

    const harmfulPattern = avgDevice > 180 ? (language === 'bn' ? 'অতিরিক্ত স্ক্রিন টাইম' : 'Excessive screen time') :
                          entries.filter(e => (e.shorts_reels_minutes || 0) > 30).length > entries.length * 0.5 
                            ? (language === 'bn' ? 'শর্টস/রিলস অভ্যাস' : 'Shorts/Reels habit') :
                          (language === 'bn' ? 'কোন বড় সমস্যা নেই' : 'No major issues');

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (avgSalah < 4) {
      recommendations.push(language === 'bn' 
        ? '🕌 প্রতিদিন ৫ ওয়াক্ত নামাজ পড়ার চেষ্টা করুন'
        : '🕌 Try to complete all 5 daily prayers');
    }
    
    if (avgDevice > 180) {
      recommendations.push(language === 'bn'
        ? '📱 দৈনিক স্ক্রিন টাইম ৩ ঘণ্টার নিচে রাখুন'
        : '📱 Keep daily screen time under 3 hours');
    }
    
    if (avgStudy < 60) {
      recommendations.push(language === 'bn'
        ? '📚 প্রতিদিন কমপক্ষে ১ ঘণ্টা মনোযোগী পড়াশোনা করুন'
        : '📚 Aim for at least 1 hour of focused study daily');
    }
    
    if (quranDays < entries.length * 0.5) {
      recommendations.push(language === 'bn'
        ? '📖 প্রতিদিন অন্তত কিছু আয়াত তিলাওয়াত করুন'
        : '📖 Read at least a few verses of Quran daily');
    }

    if (focusDropDetected) {
      recommendations.push(language === 'bn'
        ? '⚠️ ফোকাস হ্রাস সনাক্ত হয়েছে। বিশ্রাম নিন।'
        : '⚠️ Focus drop detected. Consider taking breaks.');
    }

    // Weekly trend data
    const weeklyTrend = recentEntries.slice(0, 7).reverse().map(e => ({
      day: format(new Date(e.date), 'EEE'),
      score: Math.round(((e.focus_level || 0) + (e.discipline_level || 0) + (e.energy_level || 0)) / 3 * 20)
    }));

    setInsights({
      productivityScore,
      deenScore,
      disciplineScore,
      focusScore,
      consistencyScore,
      moodTrend,
      topHabit,
      harmfulPattern,
      focusDropDetected,
      recommendations: recommendations.slice(0, 4),
      weeklyTrend,
    });

    setRadarData([
      { subject: language === 'bn' ? 'উৎপাদনশীলতা' : 'Productivity', value: productivityScore, fullMark: 100 },
      { subject: language === 'bn' ? 'দ্বীন' : 'Deen', value: deenScore, fullMark: 100 },
      { subject: language === 'bn' ? 'শৃঙ্খলা' : 'Discipline', value: disciplineScore, fullMark: 100 },
      { subject: language === 'bn' ? 'ফোকাস' : 'Focus', value: focusScore, fullMark: 100 },
      { subject: language === 'bn' ? 'ধারাবাহিকতা' : 'Consistency', value: consistencyScore, fullMark: 100 },
    ]);

    setLoading(false);
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'declining': return <TrendingDown className="h-5 w-5 text-red-500" />;
      default: return <Activity className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getTrendText = (trend: string) => {
    if (language === 'bn') {
      return trend === 'improving' ? 'উন্নতি হচ্ছে 📈' : trend === 'declining' ? 'হ্রাস পাচ্ছে 📉' : 'স্থিতিশীল ➡️';
    }
    return trend === 'improving' ? 'Improving 📈' : trend === 'declining' ? 'Declining 📉' : 'Stable ➡️';
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-green-500/10 border-green-500/20';
    if (score >= 40) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 pb-24 lg:pb-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            {language === 'bn' ? 'ইন্টেলিজেন্স ইঞ্জিন' : 'Intelligence Engine'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {language === 'bn' ? '🤖 AI-চালিত অন্তর্দৃষ্টি ও বিশ্লেষণ' : '🤖 AI-powered insights and analysis'}
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground">
              {language === 'bn' ? 'ডেটা বিশ্লেষণ করা হচ্ছে...' : 'Analyzing your data...'}
            </p>
          </div>
        ) : !insights ? (
          <Card className="p-8 sm:p-12 text-center">
            <Brain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {language === 'bn' ? 'পর্যাপ্ত ডেটা নেই' : 'Not Enough Data'}
            </h3>
            <p className="text-muted-foreground text-sm">
              {language === 'bn' 
                ? 'বিশ্লেষণের জন্য পর্যাপ্ত ডেটা নেই। দৈনিক এন্ট্রি জমা দিন।'
                : 'Not enough data for analysis. Submit daily entries to see insights.'}
            </p>
          </Card>
        ) : (
          <>
            {/* Score Cards with Animation */}
            <div className="grid gap-2 sm:gap-3 grid-cols-2 lg:grid-cols-5">
              {[
                { label: language === 'bn' ? 'উৎপাদনশীলতা' : 'Productivity', score: insights.productivityScore, icon: '🎯' },
                { label: language === 'bn' ? 'দ্বীন স্কোর' : 'Deen Score', score: insights.deenScore, icon: '🕌' },
                { label: language === 'bn' ? 'শৃঙ্খলা' : 'Discipline', score: insights.disciplineScore, icon: '💪' },
                { label: language === 'bn' ? 'ফোকাস' : 'Focus', score: insights.focusScore, icon: '🎯' },
                { label: language === 'bn' ? 'ধারাবাহিকতা' : 'Consistency', score: insights.consistencyScore, icon: '🔥', suffix: '%' },
              ].map((item, i) => (
                <Card 
                  key={i} 
                  className={cn(
                    "border animate-fade-in",
                    getScoreBg(item.score)
                  )}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <CardContent className="pt-3 sm:pt-4 pb-2 sm:pb-3 px-3 sm:px-4">
                    <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1">{item.icon} {item.label}</p>
                    <div className={`text-xl sm:text-2xl lg:text-3xl font-bold ${getScoreColor(item.score)}`}>
                      {item.score}{item.suffix || ''}
                    </div>
                    <Progress value={item.score} className="mt-1.5 sm:mt-2 h-1 sm:h-1.5" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts Grid */}
            <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
              {/* Radar Chart with Animation */}
              <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {language === 'bn' ? 'পারফরম্যান্স রাডার' : 'Performance Radar'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[200px] sm:h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid strokeDasharray="3 3" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8 }} />
                        <Radar 
                          name="Score" 
                          dataKey="value" 
                          stroke="hsl(var(--primary))" 
                          fill="hsl(var(--primary))" 
                          fillOpacity={0.3}
                          strokeWidth={2}
                          animationDuration={1000}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Weekly Trend with Animation */}
              {insights.weeklyTrend.length > 0 && (
                <Card className="animate-fade-in">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      {language === 'bn' ? 'সাপ্তাহিক প্রবণতা' : 'Weekly Trend'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[250px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={insights.weeklyTrend}>
                          <defs>
                            <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <Tooltip 
                            contentStyle={{ 
                              borderRadius: '8px',
                              border: '1px solid hsl(var(--border))',
                              backgroundColor: 'hsl(var(--background))',
                              fontSize: '12px'
                            }}
                            animationDuration={200}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="score" 
                            stroke="hsl(var(--primary))" 
                            fillOpacity={1} 
                            fill="url(#colorScore)" 
                            strokeWidth={2}
                            animationDuration={1000}
                            animationBegin={200}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Pattern Analysis */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {language === 'bn' ? '📊 প্যাটার্ন বিশ্লেষণ' : '📊 Pattern Analysis'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Mood Trend */}
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                  <div>
                    <p className="font-medium text-sm">
                      {language === 'bn' ? 'এনার্জি ট্রেন্ড' : 'Energy Trend'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {language === 'bn' ? 'গত সপ্তাহে' : 'Last 7 days'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(insights.moodTrend)}
                    <span className="font-medium text-sm">{getTrendText(insights.moodTrend)}</span>
                  </div>
                </div>

                {/* Top Habit */}
                <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-xl">
                  <p className="font-medium text-sm text-green-700 dark:text-green-400">
                    {language === 'bn' ? '🌟 সেরা অভ্যাস' : '🌟 Top Habit'}
                  </p>
                  <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-500/50">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {insights.topHabit}
                  </Badge>
                </div>

                {/* Harmful Pattern */}
                <div className="flex items-center justify-between p-3 bg-red-500/10 rounded-xl">
                  <p className="font-medium text-sm text-red-700 dark:text-red-400">
                    {language === 'bn' ? '⚠️ উন্নতির জায়গা' : '⚠️ Area to Improve'}
                  </p>
                  <Badge variant="outline" className="text-red-700 dark:text-red-400 border-red-500/50">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {insights.harmfulPattern}
                  </Badge>
                </div>

                {/* Focus Alert */}
                {insights.focusDropDetected && (
                  <div className="flex items-center gap-3 p-3 bg-yellow-500/10 rounded-xl">
                    <Zap className="h-5 w-5 text-yellow-600 shrink-0" />
                    <p className="text-sm text-yellow-700 dark:text-yellow-400">
                      {language === 'bn' 
                        ? 'সম্প্রতি ফোকাস হ্রাস সনাক্ত হয়েছে'
                        : 'Focus drop detected recently'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Recommendations */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-purple-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Zap className="h-5 w-5 text-primary" />
                  {language === 'bn' ? '🤖 AI সুপারিশ' : '🤖 AI Recommendations'}
                </CardTitle>
                <CardDescription className="text-xs">
                  {language === 'bn' 
                    ? 'আপনার ডেটা বিশ্লেষণের উপর ভিত্তি করে'
                    : 'Based on your data analysis'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {insights.recommendations.map((rec, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-background rounded-xl border">
                      <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {index + 1}
                      </div>
                      <p className="text-sm">{rec}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
