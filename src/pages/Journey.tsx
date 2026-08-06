import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { monthlyThemes, getMonthName } from '@/data/monthlyThemes';
import { 
  Rocket, Moon, Dumbbell, Eye, BookOpen, Heart, 
  Zap, Repeat, Focus, Scale, TrendingUp, RefreshCw,
  CheckCircle2, Circle, ChevronRight, Sparkles, Star
} from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, any> = {
  Rocket, Moon, Dumbbell, Eye, BookOpen, Heart,
  Zap, Repeat, Focus, Scale, TrendingUp, RefreshCw
};

// Joyful gradient colors for each month
const joyfulColors = [
  { bg: 'from-rose-500/20 to-pink-500/20', border: 'border-rose-400/30', text: 'text-rose-600 dark:text-rose-400', iconBg: 'bg-gradient-to-br from-rose-400 to-pink-500' },
  { bg: 'from-purple-500/20 to-violet-500/20', border: 'border-purple-400/30', text: 'text-purple-600 dark:text-purple-400', iconBg: 'bg-gradient-to-br from-purple-400 to-violet-500' },
  { bg: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-400/30', text: 'text-blue-600 dark:text-blue-400', iconBg: 'bg-gradient-to-br from-blue-400 to-cyan-500' },
  { bg: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-400/30', text: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-gradient-to-br from-emerald-400 to-teal-500' },
  { bg: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-400/30', text: 'text-amber-600 dark:text-amber-400', iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500' },
  { bg: 'from-pink-500/20 to-rose-500/20', border: 'border-pink-400/30', text: 'text-pink-600 dark:text-pink-400', iconBg: 'bg-gradient-to-br from-pink-400 to-rose-500' },
  { bg: 'from-indigo-500/20 to-blue-500/20', border: 'border-indigo-400/30', text: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-gradient-to-br from-indigo-400 to-blue-500' },
  { bg: 'from-teal-500/20 to-emerald-500/20', border: 'border-teal-400/30', text: 'text-teal-600 dark:text-teal-400', iconBg: 'bg-gradient-to-br from-teal-400 to-emerald-500' },
  { bg: 'from-orange-500/20 to-red-500/20', border: 'border-orange-400/30', text: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-gradient-to-br from-orange-400 to-red-500' },
  { bg: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan-400/30', text: 'text-cyan-600 dark:text-cyan-400', iconBg: 'bg-gradient-to-br from-cyan-400 to-blue-500' },
  { bg: 'from-violet-500/20 to-purple-500/20', border: 'border-violet-400/30', text: 'text-violet-600 dark:text-violet-400', iconBg: 'bg-gradient-to-br from-violet-400 to-purple-500' },
  { bg: 'from-yellow-500/20 to-amber-500/20', border: 'border-yellow-400/30', text: 'text-yellow-600 dark:text-yellow-400', iconBg: 'bg-gradient-to-br from-yellow-400 to-amber-500' },
];

export default function Journey() {
  const { language, t } = useLanguage();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  const selectedTheme = monthlyThemes.find(theme => theme.month === selectedMonth);
  const selectedColor = joyfulColors[(selectedMonth - 1) % 12];

  const getMonthStatus = (month: number) => {
    if (month < currentMonth) return 'completed';
    if (month === currentMonth) return 'current';
    return 'upcoming';
  };

  const progressPercentage = Math.round((currentMonth / 12) * 100);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        {/* Header with celebration */}
        <div className="mb-6 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
            <Sparkles className="h-6 w-6 text-yellow-500 animate-pulse" />
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              {language === 'bn' ? '১২ মাসের যাত্রা' : '12-Month Journey'}
            </h1>
            <Sparkles className="h-6 w-6 text-yellow-500 animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">
            {language === 'bn' 
              ? '✨ প্রতি মাসে একটি নতুন টার্গেট, সারা বছর ধরে ট্রান্সফরমেশন ✨' 
              : '✨ One new target each month, transformation throughout the year ✨'}
          </p>
        </div>

        {/* Year Progress with celebration */}
        <Card className="mb-6 bg-gradient-to-r from-primary/5 via-purple-500/5 to-pink-500/5 border-primary/20">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                {language === 'bn' ? 'বছরের অগ্রগতি' : 'Year Progress'}
              </span>
              <span className="text-sm text-muted-foreground">
                {currentMonth}/12 {language === 'bn' ? 'মাস' : 'months'} 🎯
              </span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
            <p className="mt-2 text-xs text-muted-foreground text-center">
              🌟 {language === 'bn' 
                ? `এখন চলছে: ${getMonthName(currentMonth, 'bn')} - ${monthlyThemes[currentMonth - 1]?.titleBn}`
                : `Currently: ${getMonthName(currentMonth, 'en')} - ${monthlyThemes[currentMonth - 1]?.titleEn}`} 🌟
            </p>
          </CardContent>
        </Card>

        {/* Mobile Month Selector - Horizontal Scroll with joyful design */}
        <div className="mb-6 lg:hidden">
          <h3 className="text-sm font-medium mb-3 text-muted-foreground flex items-center gap-2">
            <span>🎨</span>
            {language === 'bn' ? 'মাস নির্বাচন করুন' : 'Select Month'}
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-3 -mx-4 px-4 scrollbar-hide">
            {monthlyThemes.map((theme, index) => {
              const status = getMonthStatus(theme.month);
              const Icon = iconMap[theme.icon] || Circle;
              const color = joyfulColors[index % 12];
              
              return (
                <button
                  key={theme.month}
                  onClick={() => setSelectedMonth(theme.month)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 p-3 rounded-2xl border min-w-[72px] transition-all shadow-sm",
                    selectedMonth === theme.month 
                      ? `bg-gradient-to-br ${color.bg} ${color.border} shadow-lg scale-105` 
                      : "border-border bg-card/80 hover:bg-muted/50 hover:scale-102"
                  )}
                >
                  <div 
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-md",
                      status === 'completed' ? color.iconBg : status === 'current' ? color.iconBg : "bg-muted"
                    )}
                  >
                    {status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Icon className={cn("h-5 w-5", status === 'upcoming' && "text-muted-foreground")} />
                    )}
                  </div>
                  <span className={cn("text-xs font-semibold", selectedMonth === theme.month && color.text)}>
                    {String(theme.month).padStart(2, '0')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Timeline Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Month Selector - Desktop Only */}
          <Card className="hidden lg:block lg:col-span-1 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-purple-500/5 pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <span>🎯</span>
                {language === 'bn' ? 'মাসিক টার্গেট' : 'Monthly Targets'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y max-h-[500px] overflow-y-auto">
                {monthlyThemes.map((theme, index) => {
                  const status = getMonthStatus(theme.month);
                  const Icon = iconMap[theme.icon] || Circle;
                  const color = joyfulColors[index % 12];
                  
                  return (
                    <button
                      key={theme.month}
                      onClick={() => setSelectedMonth(theme.month)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 text-left transition-all hover:bg-muted/50",
                        selectedMonth === theme.month && `bg-gradient-to-r ${color.bg}`
                      )}
                    >
                      <div 
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
                          status === 'completed' ? color.iconBg : status === 'current' ? `${color.iconBg} ring-2 ring-offset-2 ring-primary/50` : "bg-muted"
                        )}
                      >
                        {status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Icon className={cn("h-5 w-5", status === 'upcoming' && "text-muted-foreground")} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {language === 'bn' ? `টার্গেট ${String(theme.month).padStart(2, '0')}` : `Target ${String(theme.month).padStart(2, '0')}`}
                          </span>
                          {status === 'current' && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 animate-pulse">
                              🔥 {language === 'bn' ? 'চলমান' : 'Active'}
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm truncate">
                          {language === 'bn' ? theme.titleBn : theme.titleEn}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Selected Month Detail */}
          <Card className={cn("lg:col-span-2 overflow-hidden border-2", selectedColor.border)}>
            {selectedTheme && (
              <>
                <CardHeader className={cn("pb-4 bg-gradient-to-br", selectedColor.bg)}>
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div 
                      className={cn(
                        "flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg",
                        selectedColor.iconBg
                      )}
                    >
                      {(() => {
                        const Icon = iconMap[selectedTheme.icon] || Circle;
                        return <Icon className="h-8 w-8" />;
                      })()}
                    </div>
                    <div className="flex-1 w-full">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge 
                          variant="outline"
                          className={cn("font-semibold", selectedColor.text, selectedColor.border)}
                        >
                          🎯 {language === 'bn' 
                            ? `টার্গেট ${String(selectedTheme.month).padStart(2, '0')}`
                            : `Target ${String(selectedTheme.month).padStart(2, '0')}`}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {getMonthName(selectedTheme.month, language)}
                        </span>
                      </div>
                      <CardTitle className="text-xl sm:text-2xl">
                        {language === 'bn' ? selectedTheme.titleBn : selectedTheme.titleEn}
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <p className="text-base text-muted-foreground leading-relaxed">
                      {language === 'bn' ? selectedTheme.descriptionBn : selectedTheme.descriptionEn}
                    </p>
                  </div>

                  {/* Status Card */}
                  <div 
                    className={cn(
                      "mt-6 rounded-2xl p-4 sm:p-5 bg-gradient-to-br",
                      selectedColor.bg,
                      "border",
                      selectedColor.border
                    )}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      {getMonthStatus(selectedTheme.month) === 'completed' ? (
                        <>
                          <CheckCircle2 className={cn("h-6 w-6", selectedColor.text)} />
                          <span className={cn("font-semibold", selectedColor.text)}>
                            🎉 {language === 'bn' ? 'সম্পন্ন!' : 'Completed!'}
                          </span>
                        </>
                      ) : getMonthStatus(selectedTheme.month) === 'current' ? (
                        <>
                          <Zap className={cn("h-6 w-6 animate-pulse", selectedColor.text)} />
                          <span className={cn("font-semibold", selectedColor.text)}>
                            🔥 {language === 'bn' ? 'চলমান টার্গেট' : 'Active Target'}
                          </span>
                        </>
                      ) : (
                        <>
                          <Circle className={cn("h-6 w-6", selectedColor.text)} />
                          <span className={cn("font-semibold", selectedColor.text)}>
                            ⏳ {language === 'bn' ? 'আসন্ন' : 'Upcoming'}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getMonthStatus(selectedTheme.month) === 'current'
                        ? (language === 'bn' 
                            ? '💪 এই মাসের টার্গেটে ফোকাস করুন এবং Goals পেজে গিয়ে সংশ্লিষ্ট লক্ষ্য সেট করুন।'
                            : '💪 Focus on this month\'s target and set related goals on the Goals page.')
                        : getMonthStatus(selectedTheme.month) === 'completed'
                          ? (language === 'bn'
                              ? '🌟 এই মাসের টার্গেট শেষ। আপনার অগ্রগতি দেখতে Analytics পেজে যান।'
                              : '🌟 This month\'s target is complete. Visit Analytics to see your progress.')
                          : (language === 'bn'
                              ? '🚀 এই টার্গেট শীঘ্রই আসছে। প্রস্তুতি নিন!'
                              : '🚀 This target is coming soon. Get ready!')}
                    </p>
                  </div>

                  {/* Suggested Habits */}
                  <div className="mt-6">
                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                      <span>💡</span>
                      {language === 'bn' ? 'প্রস্তাবিত অভ্যাস' : 'Suggested Habits'}
                    </h4>
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                      {getSuggestedHabits(selectedTheme.month, language).map((habit, index) => (
                        <div 
                          key={index}
                          className={cn(
                            "flex items-center gap-2 rounded-xl border p-3 transition-all hover:scale-[1.02]",
                            selectedColor.border,
                            "bg-gradient-to-r",
                            selectedColor.bg
                          )}
                        >
                          <div 
                            className={cn(
                              "h-2.5 w-2.5 rounded-full shrink-0",
                              selectedColor.iconBg
                            )}
                          />
                          <span className="text-sm">{habit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

function getSuggestedHabits(month: number, language: 'en' | 'bn'): string[] {
  const habits: Record<number, { en: string[]; bn: string[] }> = {
    1: {
      en: ['Wake up at fixed time', 'Make daily to-do list', 'Track all habits', 'Evening review'],
      bn: ['নির্দিষ্ট সময়ে ঘুম থেকে ওঠা', 'দৈনিক টু-ডু লিস্ট তৈরি', 'সব অভ্যাস ট্র্যাক করা', 'সন্ধ্যায় রিভিউ করা']
    },
    2: {
      en: ['Sleep by 11 PM', '7-8 hours sleep', 'No phone before bed', 'Morning sunlight'],
      bn: ['রাত ১১টায় ঘুমানো', '৭-৮ ঘণ্টা ঘুম', 'ঘুমের আগে ফোন না', 'সকালে সূর্যের আলো']
    },
    3: {
      en: ['10K steps daily', 'Morning stretching', 'Take stairs', 'Evening walk'],
      bn: ['দৈনিক ১০ হাজার পদক্ষেপ', 'সকালে স্ট্রেচিং', 'সিঁড়ি ব্যবহার', 'সন্ধ্যায় হাঁটা']
    },
    4: {
      en: ['2 hour screen limit', 'No phone first hour', 'App blockers on', 'Digital sunset'],
      bn: ['২ ঘণ্টা স্ক্রিন লিমিট', 'প্রথম ঘণ্টা ফোন না', 'অ্যাপ ব্লকার চালু', 'ডিজিটাল সানসেট']
    },
    5: {
      en: ['Read 30 min daily', 'Note key learnings', 'Discuss ideas', 'Library visit weekly'],
      bn: ['দৈনিক ৩০ মিনিট পড়া', 'মূল শিক্ষা নোট করা', 'আইডিয়া আলোচনা', 'সাপ্তাহিক লাইব্রেরি']
    },
    6: {
      en: ['5 min meditation', 'Gratitude journal', 'Weekly review', 'Nature time'],
      bn: ['৫ মিনিট মেডিটেশন', 'কৃতজ্ঞতা জার্নাল', 'সাপ্তাহিক রিভিউ', 'প্রকৃতিতে সময়']
    },
    7: {
      en: ['1 hour skill practice', 'Online course', 'Build projects', 'Share learnings'],
      bn: ['১ ঘণ্টা স্কিল প্র্যাক্টিস', 'অনলাইন কোর্স', 'প্রজেক্ট তৈরি', 'শেখা শেয়ার করা']
    },
    8: {
      en: ['Never miss twice', 'Habit stacking', 'Environment design', 'Track streaks'],
      bn: ['দুইবার মিস না করা', 'হ্যাবিট স্ট্যাকিং', 'পরিবেশ ডিজাইন', 'স্ট্রিক ট্র্যাক করা']
    },
    9: {
      en: ['2 hour deep work', 'Pomodoro technique', 'Single-tasking', 'Batch similar tasks'],
      bn: ['২ ঘণ্টা ডিপ ওয়ার্ক', 'পমোডোরো টেকনিক', 'একটা কাজে ফোকাস', 'একই ধরণের কাজ একসাথে']
    },
    10: {
      en: ['Family dinner', 'Hobby time', 'Friend meetup', 'Self-care day'],
      bn: ['পরিবারের সাথে খাবার', 'শখের সময়', 'বন্ধুদের সাথে দেখা', 'সেলফ-কেয়ার ডে']
    },
    11: {
      en: ['Face one fear', 'Public speaking', 'New challenges', 'Celebrate wins'],
      bn: ['একটা ভয় জয় করা', 'পাবলিক স্পিকিং', 'নতুন চ্যালেঞ্জ', 'সাফল্য উদযাপন']
    },
    12: {
      en: ['Year review', 'Lessons learned', 'Next year goals', 'Gratitude list'],
      bn: ['বছর রিভিউ', 'শেখা পাঠ', 'আগামী বছরের লক্ষ্য', 'কৃতজ্ঞতা তালিকা']
    }
  };

  return habits[month]?.[language] || habits[1][language];
}
