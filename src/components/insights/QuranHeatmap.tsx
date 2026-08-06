import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfYear, endOfYear, addDays, startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';

interface QuranDayData {
  date: string;
  read: boolean;
  minutes: number;
}

export default function QuranHeatmap({ year = new Date().getFullYear() }: { year?: number }) {
  const { user } = useAuth();
  const [dayData, setDayData] = useState<Map<string, QuranDayData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalDays: 0, currentStreak: 0, longestStreak: 0 });

  useEffect(() => {
    if (user) fetchQuranData();
  }, [user, year]);

  const fetchQuranData = async () => {
    setLoading(true);

    const yearStart = format(startOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');
    const yearEnd = format(endOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');

    const { data: entries } = await supabase
      .from('daily_entries')
      .select('date, quran_read, quran_minutes')
      .eq('user_id', user!.id)
      .gte('date', yearStart)
      .lte('date', yearEnd)
      .order('date', { ascending: true });

    const dataMap = new Map<string, QuranDayData>();
    let totalDays = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    entries?.forEach((entry) => {
      dataMap.set(entry.date, {
        date: entry.date,
        read: entry.quran_read || false,
        minutes: entry.quran_minutes || 0,
      });

      if (entry.quran_read) {
        totalDays++;
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    });

    // Calculate current streak from today backwards
    const today = format(new Date(), 'yyyy-MM-dd');
    let checkDate = new Date();
    while (true) {
      const dateStr = format(checkDate, 'yyyy-MM-dd');
      const dayEntry = dataMap.get(dateStr);
      if (dayEntry?.read) {
        currentStreak++;
        checkDate = addDays(checkDate, -1);
      } else {
        break;
      }
    }

    setDayData(dataMap);
    setStats({ totalDays, currentStreak, longestStreak });
    setLoading(false);
  };

  const getIntensityClass = (data: QuranDayData | undefined) => {
    if (!data || !data.read) return 'bg-muted';
    const minutes = data.minutes || 5;
    if (minutes >= 30) return 'bg-emerald-600';
    if (minutes >= 20) return 'bg-emerald-500';
    if (minutes >= 10) return 'bg-emerald-400';
    return 'bg-emerald-300';
  };

  // Generate calendar
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
  if (currentWeek.length > 0) weeks.push(currentWeek);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2 px-3 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <BookOpen className="h-5 w-5 text-emerald-600" />
          Qur'an Consistency
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">365-day heatmap of your Qur'an engagement</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-3 sm:px-6">
        {/* Stats - Mobile Optimized */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
          <div className="p-2 sm:p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
            <p className="text-lg sm:text-2xl font-bold text-emerald-600">{stats.totalDays}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Total Days</p>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-primary/10">
            <p className="text-lg sm:text-2xl font-bold text-primary">{stats.currentStreak}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Current Streak</p>
          </div>
          <div className="p-2 sm:p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
            <p className="text-lg sm:text-2xl font-bold text-amber-600">{stats.longestStreak}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Best Streak</p>
          </div>
        </div>

        {/* Heatmap - Scrollable on mobile */}
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 touch-scroll">
          <div className="min-w-[600px] sm:min-w-[700px]">
            {/* Month labels */}
            <div className="mb-1 flex">
              <div className="w-4 sm:w-5" />
              <div className="flex flex-1">
                {months.map((month) => (
                  <div key={month} className="flex-1 text-center text-[8px] sm:text-[10px] text-muted-foreground">
                    {month}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-[2px]">
              {/* Day labels */}
              <div className="flex w-4 sm:w-5 flex-col gap-[2px]">
                {days.map((day, i) => (
                  <div key={i} className="flex h-2 sm:h-[10px] items-center text-[6px] sm:text-[8px] text-muted-foreground">
                    {i % 2 === 1 ? day : ''}
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="flex flex-1 gap-[1px] sm:gap-[2px]">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="flex flex-col gap-[1px] sm:gap-[2px]">
                    {week.map((day) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const isCurrentYear = day.getFullYear() === year;
                      const data = dayData.get(dateStr);

                      return (
                        <Tooltip key={dateStr}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'h-2 w-2 sm:h-[10px] sm:w-[10px] rounded-sm transition-colors',
                                isCurrentYear ? getIntensityClass(data) : 'bg-transparent'
                              )}
                            />
                          </TooltipTrigger>
                          {isCurrentYear && (
                            <TooltipContent>
                              <p className="text-xs font-medium">{format(day, 'MMM d, yyyy')}</p>
                              <p className="text-xs text-muted-foreground">
                                {data?.read ? `✅ ${data.minutes || 0} min` : '❌ No Qur\'an'}
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
            <div className="mt-3 flex items-center justify-end gap-1 text-[8px] sm:text-[10px] text-muted-foreground">
              <span>Less</span>
              <div className="flex gap-[1px] sm:gap-[2px]">
                <div className="h-2 w-2 sm:h-[10px] sm:w-[10px] rounded-sm bg-muted" />
                <div className="h-2 w-2 sm:h-[10px] sm:w-[10px] rounded-sm bg-emerald-300" />
                <div className="h-2 w-2 sm:h-[10px] sm:w-[10px] rounded-sm bg-emerald-400" />
                <div className="h-2 w-2 sm:h-[10px] sm:w-[10px] rounded-sm bg-emerald-500" />
                <div className="h-2 w-2 sm:h-[10px] sm:w-[10px] rounded-sm bg-emerald-600" />
              </div>
              <span>More</span>
            </div>
          </div>
        </div>

        {/* Mobile tip */}
        <p className="text-[10px] text-muted-foreground text-center sm:hidden">
          ← Scroll to see full year →
        </p>
      </CardContent>
    </Card>
  );
}
