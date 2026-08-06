import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, subMonths, addMonths, startOfYear, endOfYear, startOfWeek, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, Grid3X3, Flame, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStreak } from '@/hooks/useStreak';

interface DayData {
  date: string;
  completed: number;
  total: number;
}

export default function Calendar() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [year, setYear] = useState(new Date().getFullYear());
  const [dayData, setDayData] = useState<Map<string, DayData>>(new Map());
  const [yearData, setYearData] = useState<Map<string, DayData>>(new Map());
  const [habits, setHabits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'calendar' | 'heatmap'>('calendar');
  const { currentStreak, bestStreak, totalActiveDays, consistencyScore } = useStreak();

  useEffect(() => {
    if (user) {
      if (view === 'calendar') {
        fetchCalendarData();
      } else {
        fetchYearData();
      }
    }
  }, [user, currentMonth, year, view]);

  const fetchCalendarData = async () => {
    setLoading(true);
    
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

    const { data: habitsData } = await supabase
      .from('habits')
      .select('id, name, color')
      .eq('user_id', user!.id)
      .eq('is_active', true);

    const { data: entriesData } = await supabase
      .from('habit_entries')
      .select('date, completed')
      .eq('user_id', user!.id)
      .gte('date', start)
      .lte('date', end);

    setHabits(habitsData || []);

    const dataMap = new Map<string, DayData>();
    const totalHabits = habitsData?.length || 0;

    entriesData?.forEach((entry) => {
      const existing = dataMap.get(entry.date) || { date: entry.date, completed: 0, total: totalHabits };
      if (entry.completed) {
        existing.completed += 1;
      }
      dataMap.set(entry.date, existing);
    });

    setDayData(dataMap);
    setLoading(false);
  };

  const fetchYearData = async () => {
    setLoading(true);

    const yearStart = format(startOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');
    const yearEnd = format(endOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');

    const { count } = await supabase
      .from('habits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .eq('is_active', true);

    setHabits(Array(count || 0).fill({}));

    const { data: entries } = await supabase
      .from('habit_entries')
      .select('date, completed')
      .eq('user_id', user!.id)
      .gte('date', yearStart)
      .lte('date', yearEnd);

    const dataMap = new Map<string, DayData>();
    entries?.forEach((entry) => {
      const existing = dataMap.get(entry.date) || { date: entry.date, completed: 0, total: count || 0 };
      if (entry.completed) {
        existing.completed += 1;
      }
      dataMap.set(entry.date, existing);
    });

    setYearData(dataMap);
    setLoading(false);
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getCompletionColor = (completed: number, total: number) => {
    if (total === 0) return 'bg-muted';
    const ratio = completed / total;
    if (ratio === 1) return 'bg-primary';
    if (ratio >= 0.75) return 'bg-primary/75';
    if (ratio >= 0.5) return 'bg-primary/50';
    if (ratio >= 0.25) return 'bg-primary/25';
    if (ratio > 0) return 'bg-primary/10';
    return 'bg-muted';
  };

  const getIntensityClass = (completed: number, total: number) => {
    if (total === 0 || completed === 0) return 'bg-muted';
    const ratio = completed / total;
    if (ratio === 1) return 'bg-primary';
    if (ratio >= 0.75) return 'bg-primary/80';
    if (ratio >= 0.5) return 'bg-primary/60';
    if (ratio >= 0.25) return 'bg-primary/40';
    return 'bg-primary/20';
  };

  // Generate heatmap weeks
  const yearStartDate = startOfYear(new Date(year, 0, 1));
  const yearEndDate = endOfYear(new Date(year, 0, 1));
  const calendarStart = startOfWeek(yearStartDate, { weekStartsOn: 0 });
  
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  let currentDate = calendarStart;

  while (currentDate <= yearEndDate || currentWeek.length > 0) {
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    
    if (currentDate <= yearEndDate) {
      currentWeek.push(currentDate);
      currentDate = addDays(currentDate, 1);
    } else if (currentWeek.length > 0 && currentWeek.length < 7) {
      currentWeek.push(currentDate);
      currentDate = addDays(currentDate, 1);
    } else {
      break;
    }
  }
  
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            {language === 'bn' ? 'ক্যালেন্ডার ও হিটম্যাপ' : 'Calendar & Heatmap'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {language === 'bn' ? 'আপনার অভ্যাস ট্র্যাকিং ভিজুয়ালাইজ করুন' : 'Visualize your habit tracking progress'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-secondary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{t('dashboard.currentStreak')}</p>
                <p className="text-xl font-bold">{currentStreak} <span className="text-xs font-normal">{t('dashboard.days')}</span></p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{language === 'bn' ? 'সর্বোচ্চ স্ট্রিক' : 'Best Streak'}</p>
                <p className="text-xl font-bold">{bestStreak} <span className="text-xs font-normal">{t('dashboard.days')}</span></p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-accent shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{language === 'bn' ? 'মোট দিন' : 'Total Days'}</p>
                <p className="text-xl font-bold">{totalActiveDays}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <div className="text-primary text-sm font-bold shrink-0">%</div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{t('dashboard.consistency')}</p>
                <p className="text-xl font-bold">{consistencyScore}%</p>
              </div>
            </div>
          </Card>
        </div>

        {/* View Toggle */}
        <Tabs value={view} onValueChange={(v) => setView(v as 'calendar' | 'heatmap')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              <span className="hidden sm:inline">{language === 'bn' ? 'মাসিক ক্যালেন্ডার' : 'Monthly Calendar'}</span>
              <span className="sm:hidden">{language === 'bn' ? 'মাসিক' : 'Monthly'}</span>
            </TabsTrigger>
            <TabsTrigger value="heatmap" className="gap-2">
              <Grid3X3 className="h-4 w-4" />
              <span className="hidden sm:inline">{language === 'bn' ? 'বার্ষিক হিটম্যাপ' : 'Yearly Heatmap'}</span>
              <span className="sm:hidden">{language === 'bn' ? 'হিটম্যাপ' : 'Heatmap'}</span>
            </TabsTrigger>
          </TabsList>

          {/* Monthly Calendar View */}
          <TabsContent value="calendar">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setCurrentMonth(new Date())}
                    >
                      {t('calendar.today')}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* Day headers */}
                    <div className="mb-2 grid grid-cols-7 gap-1">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                        <div key={day} className="py-2 text-center text-xs font-medium text-muted-foreground">
                          <span className="hidden sm:inline">{day}</span>
                          <span className="sm:hidden">{day[0]}</span>
                        </div>
                      ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square" />
                      ))}

                      {days.map((day) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const data = dayData.get(dateStr);
                        const completed = data?.completed || 0;
                        const total = habits.length;

                        return (
                          <div
                            key={dateStr}
                            className={cn(
                              'relative flex aspect-square flex-col items-center justify-center rounded-lg transition-colors',
                              getCompletionColor(completed, total),
                              isToday(day) && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
                            )}
                          >
                            <span
                              className={cn(
                                'text-xs sm:text-sm font-medium',
                                completed === total && total > 0 ? 'text-primary-foreground' : 'text-foreground'
                              )}
                            >
                              {format(day, 'd')}
                            </span>
                            {total > 0 && (
                              <span
                                className={cn(
                                  'text-[10px] hidden sm:inline',
                                  completed === total ? 'text-primary-foreground/80' : 'text-muted-foreground'
                                )}
                              >
                                {completed}/{total}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded bg-muted" />
                        <span className="text-muted-foreground">{t('calendar.noHabits')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded bg-primary/25" />
                        <span className="text-muted-foreground">{t('calendar.some')}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded bg-primary" />
                        <span className="text-muted-foreground">{t('calendar.allDone')}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Yearly Heatmap View */}
          <TabsContent value="heatmap">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-lg">{year}</CardTitle>
                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setYear(year - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => setYear(new Date().getFullYear())}
                      disabled={year === new Date().getFullYear()}
                    >
                      {t('calendar.today')}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setYear(year + 1)}
                      disabled={year >= new Date().getFullYear()}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="min-w-[700px] px-4 sm:px-0">
                      {/* Month labels */}
                      <div className="mb-1 flex">
                        <div className="w-6" />
                        <div className="flex flex-1">
                          {months.map((month) => (
                            <div key={month} className="flex-1 text-center text-[10px] text-muted-foreground">
                              {month}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-[2px]">
                        {/* Day labels */}
                        <div className="flex w-6 flex-col gap-[2px]">
                          {dayLabels.map((day, i) => (
                            <div key={i} className="flex h-[10px] items-center text-[9px] text-muted-foreground">
                              {i % 2 === 1 ? day : ''}
                            </div>
                          ))}
                        </div>

                        {/* Calendar grid */}
                        <div className="flex flex-1 gap-[2px]">
                          {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="flex flex-col gap-[2px]">
                              {week.map((day) => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const isCurrentYear = day.getFullYear() === year;
                                const data = yearData.get(dateStr);
                                const completed = data?.completed || 0;
                                const total = habits.length;

                                return (
                                  <Tooltip key={dateStr}>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={cn(
                                          'h-[10px] w-[10px] rounded-[2px] transition-colors',
                                          isCurrentYear
                                            ? getIntensityClass(completed, total)
                                            : 'bg-transparent'
                                        )}
                                      />
                                    </TooltipTrigger>
                                    {isCurrentYear && (
                                      <TooltipContent>
                                        <p className="text-xs font-medium">
                                          {format(day, 'MMM d, yyyy')}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground">
                                          {completed}/{total} {language === 'bn' ? 'অভ্যাস' : 'habits'}
                                        </p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="mt-3 flex items-center justify-end gap-1.5">
                        <span className="text-[10px] text-muted-foreground">{language === 'bn' ? 'কম' : 'Less'}</span>
                        <div className="flex gap-[2px]">
                          <div className="h-[10px] w-[10px] rounded-[2px] bg-muted" />
                          <div className="h-[10px] w-[10px] rounded-[2px] bg-primary/20" />
                          <div className="h-[10px] w-[10px] rounded-[2px] bg-primary/40" />
                          <div className="h-[10px] w-[10px] rounded-[2px] bg-primary/60" />
                          <div className="h-[10px] w-[10px] rounded-[2px] bg-primary/80" />
                          <div className="h-[10px] w-[10px] rounded-[2px] bg-primary" />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{language === 'bn' ? 'বেশি' : 'More'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
