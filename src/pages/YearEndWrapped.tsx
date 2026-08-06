import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  Calendar,
  Target,
  Book,
  Smile,
  PieChart,
  Trophy,
  Share2,
  Download
} from 'lucide-react';
import { format, startOfYear, endOfYear, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';

interface WrappedStats {
  totalDaysTracked: number;
  mostProductiveMonth: { month: string; count: number };
  moodBreakdown: { mood: string; count: number; percentage: number }[];
  topTags: { name: string; hours: number; percentage: number; color: string }[];
  totalBooks: number;
  totalCourses: number;
  totalMovies: number;
  quarterlyGoalsCompleted: number;
  quarterlyGoalsTotal: number;
  totalSmallWins: number;
  longestStreak: number;
  totalHoursLogged: number;
}

const defaultStats: WrappedStats = {
  totalDaysTracked: 0,
  mostProductiveMonth: { month: '-', count: 0 },
  moodBreakdown: [],
  topTags: [],
  totalBooks: 0,
  totalCourses: 0,
  totalMovies: 0,
  quarterlyGoalsCompleted: 0,
  quarterlyGoalsTotal: 0,
  totalSmallWins: 0,
  longestStreak: 0,
  totalHoursLogged: 0,
};

export default function YearEndWrapped() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<WrappedStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [animating, setAnimating] = useState(false);

  const currentYear = new Date().getFullYear();
  const slides = [
    'intro',
    'overview',
    'moods',
    'activities',
    'knowledge',
    'goals',
    'wins',
    'finale'
  ];

  useEffect(() => {
    if (user) fetchWrappedStats();
  }, [user]);

  const fetchWrappedStats = async () => {
    const year = currentYear;
    const yearStart = format(startOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');
    const yearEnd = format(endOfYear(new Date(year, 11, 31)), 'yyyy-MM-dd');

    // Fetch daily logs for moods and tracking
    const { data: dailyLogs } = await supabase
      .from('daily_logs')
      .select('*, activity_tags(name, name_bn, color)')
      .eq('user_id', user!.id)
      .gte('date', yearStart)
      .lte('date', yearEnd);

    // Fetch knowledge items
    const { data: knowledgeItems } = await supabase
      .from('knowledge_items')
      .select('*')
      .eq('user_id', user!.id)
      .gte('created_at', yearStart);

    // Fetch quarterly goals
    const { data: quarterlyGoals } = await supabase
      .from('quarterly_goals')
      .select('*')
      .eq('user_id', user!.id)
      .eq('year', year);

    // Fetch small wins
    const { data: smallWins } = await supabase
      .from('small_wins')
      .select('*')
      .eq('user_id', user!.id)
      .gte('date', yearStart)
      .lte('date', yearEnd);

    // Fetch habit entries for streak calculation
    const { data: habitEntries } = await supabase
      .from('habit_entries')
      .select('date, completed')
      .eq('user_id', user!.id)
      .eq('completed', true)
      .gte('date', yearStart)
      .lte('date', yearEnd)
      .order('date');

    // Calculate stats
    const totalDaysTracked = new Set(dailyLogs?.map(log => log.date)).size;

    // Most productive month
    const monthCounts: Record<string, number> = {};
    dailyLogs?.forEach(log => {
      const month = format(new Date(log.date), 'MMMM');
      monthCounts[month] = (monthCounts[month] || 0) + 1;
    });
    const mostProductiveMonth = Object.entries(monthCounts).reduce(
      (max, [month, count]) => count > max.count ? { month, count } : max,
      { month: '-', count: 0 }
    );

    // Mood breakdown
    const moodCounts: Record<string, number> = {};
    dailyLogs?.forEach(log => {
      if (log.mood) {
        moodCounts[log.mood] = (moodCounts[log.mood] || 0) + 1;
      }
    });
    const totalMoods = Object.values(moodCounts).reduce((a, b) => a + b, 0);
    const moodBreakdown = Object.entries(moodCounts)
      .map(([mood, count]) => ({
        mood,
        count,
        percentage: Math.round((count / totalMoods) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    // Top tags
    const tagHours: Record<string, { hours: number; color: string; name: string }> = {};
    dailyLogs?.forEach(log => {
      if (log.activity_tags) {
        const tag = log.activity_tags as { name: string; name_bn: string; color: string };
        const tagName = language === 'bn' ? tag.name_bn : tag.name;
        if (!tagHours[tagName]) {
          tagHours[tagName] = { hours: 0, color: tag.color, name: tagName };
        }
        tagHours[tagName].hours += Number(log.hours) || 0;
      }
    });
    const totalTagHours = Object.values(tagHours).reduce((sum, t) => sum + t.hours, 0);
    const topTags = Object.values(tagHours)
      .map(tag => ({
        ...tag,
        percentage: totalTagHours > 0 ? Math.round((tag.hours / totalTagHours) * 100) : 0
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    // Knowledge items breakdown
    const totalBooks = knowledgeItems?.filter(item => item.type === 'book').length || 0;
    const totalCourses = knowledgeItems?.filter(item => item.type === 'course').length || 0;
    const totalMovies = knowledgeItems?.filter(item => item.type === 'movie').length || 0;

    // Quarterly goals
    const quarterlyGoalsCompleted = quarterlyGoals?.filter(g => g.completed).length || 0;
    const quarterlyGoalsTotal = quarterlyGoals?.length || 0;

    // Calculate longest streak
    let longestStreak = 0;
    let currentStreak = 0;
    let prevDate: Date | null = null;

    habitEntries?.forEach(entry => {
      const entryDate = new Date(entry.date);
      if (prevDate && differenceInDays(entryDate, prevDate) === 1) {
        currentStreak++;
      } else {
        currentStreak = 1;
      }
      longestStreak = Math.max(longestStreak, currentStreak);
      prevDate = entryDate;
    });

    setStats({
      totalDaysTracked,
      mostProductiveMonth,
      moodBreakdown,
      topTags,
      totalBooks,
      totalCourses,
      totalMovies,
      quarterlyGoalsCompleted,
      quarterlyGoalsTotal,
      totalSmallWins: smallWins?.length || 0,
      longestStreak,
      totalHoursLogged: totalTagHours,
    });
    setLoading(false);
  };

  const nextSlide = () => {
    if (currentSlide < slides.length - 1) {
      setAnimating(true);
      setTimeout(() => {
        setCurrentSlide(prev => prev + 1);
        setAnimating(false);
      }, 300);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setAnimating(true);
      setTimeout(() => {
        setCurrentSlide(prev => prev - 1);
        setAnimating(false);
      }, 300);
    }
  };

  const getMoodEmoji = (mood: string) => {
    const emojis: Record<string, string> = {
      great: '😄',
      good: '🙂',
      okay: '😐',
      bad: '😔',
      terrible: '😢',
    };
    return emojis[mood] || '😐';
  };

  const getMoodLabel = (mood: string) => {
    const labels: Record<string, { en: string; bn: string }> = {
      great: { en: 'Great', bn: 'দুর্দান্ত' },
      good: { en: 'Good', bn: 'ভালো' },
      okay: { en: 'Okay', bn: 'ঠিক আছে' },
      bad: { en: 'Bad', bn: 'খারাপ' },
      terrible: { en: 'Terrible', bn: 'খুব খারাপ' },
    };
    return labels[mood]?.[language] || mood;
  };

  const slideContent = {
    intro: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-primary/30 via-accent/30 to-secondary/30 blur-3xl rounded-full" />
          <Sparkles className="relative h-24 w-24 text-primary animate-bounce" />
        </div>
        <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent">
          {currentYear}
        </h1>
        <h2 className="text-2xl md:text-3xl font-semibold">
          {language === 'bn' ? 'বছরের সারসংক্ষেপ' : 'Year in Review'}
        </h2>
        <p className="text-muted-foreground max-w-md">
          {language === 'bn' 
            ? 'আপনার সম্পূর্ণ বছরের যাত্রা এক নজরে দেখুন' 
            : "Let's look back at your incredible journey this year"}
        </p>
      </div>
    ),
    overview: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
        <Calendar className="h-16 w-16 text-primary" />
        <h2 className="text-3xl md:text-4xl font-bold">
          {language === 'bn' ? 'আপনি ট্র্যাক করেছেন' : 'You tracked'}
        </h2>
        <div className="text-7xl md:text-9xl font-bold text-primary animate-pulse">
          {stats.totalDaysTracked}
        </div>
        <p className="text-xl text-muted-foreground">
          {language === 'bn' ? 'দিন এই বছর' : 'days this year'}
        </p>
        <div className="flex items-center gap-4 mt-8">
          <div className="text-center p-4 bg-muted/50 rounded-xl">
            <div className="text-2xl font-bold text-secondary">{stats.mostProductiveMonth.month}</div>
            <div className="text-sm text-muted-foreground">
              {language === 'bn' ? 'সবচেয়ে সক্রিয় মাস' : 'Most Active Month'}
            </div>
          </div>
          <div className="text-center p-4 bg-muted/50 rounded-xl">
            <div className="text-2xl font-bold text-accent">{stats.longestStreak}</div>
            <div className="text-sm text-muted-foreground">
              {language === 'bn' ? 'সেরা স্ট্রিক' : 'Best Streak'}
            </div>
          </div>
        </div>
      </div>
    ),
    moods: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
        <Smile className="h-16 w-16 text-secondary" />
        <h2 className="text-3xl md:text-4xl font-bold">
          {language === 'bn' ? 'আপনার মেজাজের যাত্রা' : 'Your Mood Journey'}
        </h2>
        {stats.moodBreakdown.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl">
            {stats.moodBreakdown.map((mood, index) => (
              <div 
                key={mood.mood}
                className="p-4 bg-muted/50 rounded-xl animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="text-4xl mb-2">{getMoodEmoji(mood.mood)}</div>
                <div className="text-xl font-bold">{mood.count} {language === 'bn' ? 'দিন' : 'days'}</div>
                <div className="text-sm text-muted-foreground">{getMoodLabel(mood.mood)}</div>
                <div className="text-xs text-primary mt-1">{mood.percentage}%</div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            {language === 'bn' ? 'কোন মেজাজ ডেটা নেই' : 'No mood data recorded'}
          </p>
        )}
      </div>
    ),
    activities: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
        <PieChart className="h-16 w-16 text-accent" />
        <h2 className="text-3xl md:text-4xl font-bold">
          {language === 'bn' ? 'আপনার সময় কোথায় গেছে' : 'Where Your Time Went'}
        </h2>
        <div className="text-5xl font-bold text-primary">
          {Math.round(stats.totalHoursLogged)} {language === 'bn' ? 'ঘণ্টা' : 'hours'}
        </div>
        {stats.topTags.length > 0 ? (
          <div className="space-y-3 w-full max-w-md">
            {stats.topTags.map((tag, index) => (
              <div 
                key={tag.name}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: tag.color }}
                />
                <span className="flex-1 text-left font-medium">{tag.name}</span>
                <span className="text-muted-foreground">{Math.round(tag.hours)}h</span>
                <span className="text-primary font-bold">{tag.percentage}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">
            {language === 'bn' ? 'কোন কার্যকলাপ ডেটা নেই' : 'No activity data recorded'}
          </p>
        )}
      </div>
    ),
    knowledge: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
        <Book className="h-16 w-16 text-primary" />
        <h2 className="text-3xl md:text-4xl font-bold">
          {language === 'bn' ? 'জ্ঞান আনলক করেছেন' : 'Knowledge Unlocked'}
        </h2>
        <div className="grid grid-cols-3 gap-6">
          <div className="p-6 bg-gradient-to-br from-primary/20 to-primary/5 rounded-2xl">
            <div className="text-5xl font-bold text-primary">{stats.totalBooks}</div>
            <div className="text-sm text-muted-foreground mt-2">
              {language === 'bn' ? 'বই' : 'Books'}
            </div>
          </div>
          <div className="p-6 bg-gradient-to-br from-secondary/20 to-secondary/5 rounded-2xl">
            <div className="text-5xl font-bold text-secondary">{stats.totalCourses}</div>
            <div className="text-sm text-muted-foreground mt-2">
              {language === 'bn' ? 'কোর্স' : 'Courses'}
            </div>
          </div>
          <div className="p-6 bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl">
            <div className="text-5xl font-bold text-accent">{stats.totalMovies}</div>
            <div className="text-sm text-muted-foreground mt-2">
              {language === 'bn' ? 'মুভি' : 'Movies'}
            </div>
          </div>
        </div>
        <p className="text-muted-foreground">
          {language === 'bn' 
            ? `মোট ${stats.totalBooks + stats.totalCourses + stats.totalMovies}টি আইটেম সম্পন্ন!`
            : `${stats.totalBooks + stats.totalCourses + stats.totalMovies} items completed in total!`}
        </p>
      </div>
    ),
    goals: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
        <Target className="h-16 w-16 text-secondary" />
        <h2 className="text-3xl md:text-4xl font-bold">
          {language === 'bn' ? 'লক্ষ্য অর্জন' : 'Goals Achieved'}
        </h2>
        <div className="relative w-48 h-48">
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="hsl(var(--muted))"
              strokeWidth="12"
              fill="none"
            />
            <circle
              cx="96"
              cy="96"
              r="88"
              stroke="hsl(var(--primary))"
              strokeWidth="12"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 88}
              strokeDashoffset={
                2 * Math.PI * 88 * (1 - (stats.quarterlyGoalsTotal > 0 
                  ? stats.quarterlyGoalsCompleted / stats.quarterlyGoalsTotal 
                  : 0))
              }
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold">{stats.quarterlyGoalsCompleted}</span>
            <span className="text-sm text-muted-foreground">
              / {stats.quarterlyGoalsTotal}
            </span>
          </div>
        </div>
        <p className="text-muted-foreground max-w-md">
          {language === 'bn' 
            ? 'ত্রৈমাসিক লক্ষ্য সম্পন্ন করেছেন'
            : 'Quarterly goals completed'}
        </p>
      </div>
    ),
    wins: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
        <Trophy className="h-16 w-16 text-secondary animate-bounce" />
        <h2 className="text-3xl md:text-4xl font-bold">
          {language === 'bn' ? 'ছোট জয়গুলো' : 'Small Wins'}
        </h2>
        <div className="text-7xl md:text-9xl font-bold bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
          {stats.totalSmallWins}
        </div>
        <p className="text-xl text-muted-foreground max-w-md">
          {language === 'bn' 
            ? 'মুহূর্ত উদযাপন করেছেন যা গুরুত্বপূর্ণ'
            : 'moments celebrated that mattered'}
        </p>
      </div>
    ),
    finale: (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-8">
        <div className="relative">
          <div className="absolute inset-0 animate-ping bg-primary/20 blur-xl rounded-full" />
          <Sparkles className="relative h-20 w-20 text-primary" />
        </div>
        <h2 className="text-3xl md:text-5xl font-bold">
          {language === 'bn' ? 'অসাধারণ বছর!' : 'What a Year!'}
        </h2>
        <p className="text-muted-foreground max-w-md text-lg">
          {language === 'bn' 
            ? 'আপনি এই বছর অনেক কিছু অর্জন করেছেন। গর্বিত হোন!'
            : "You've accomplished so much this year. Be proud!"}
        </p>
        <div className="flex gap-4 pt-4">
          <Button variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" />
            {language === 'bn' ? 'শেয়ার করুন' : 'Share'}
          </Button>
          <Button className="gap-2">
            <Download className="h-4 w-4" />
            {language === 'bn' ? 'ডাউনলোড' : 'Download'}
          </Button>
        </div>
      </div>
    ),
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="relative h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-br from-background via-background to-muted/30">
        {/* Progress dots */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setAnimating(true);
                setTimeout(() => {
                  setCurrentSlide(index);
                  setAnimating(false);
                }, 300);
              }}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentSlide 
                  ? "bg-primary w-6" 
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
        </div>

        {/* Slide content */}
        <div 
          className={cn(
            "h-full p-6 md:p-12 transition-all duration-300",
            animating ? "opacity-0 scale-95" : "opacity-100 scale-100"
          )}
        >
          {slideContent[slides[currentSlide] as keyof typeof slideContent]}
        </div>

        {/* Navigation buttons */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-between px-6">
          <Button
            variant="ghost"
            size="lg"
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-5 w-5" />
            {language === 'bn' ? 'আগে' : 'Back'}
          </Button>
          <Button
            variant="default"
            size="lg"
            onClick={nextSlide}
            disabled={currentSlide === slides.length - 1}
            className="gap-2"
          >
            {language === 'bn' ? 'পরবর্তী' : 'Next'}
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
