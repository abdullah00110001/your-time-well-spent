import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfYear, endOfYear, eachDayOfInterval, getDay, startOfWeek, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface DayData {
  date: string;
  completed: number;
  total: number;
}

export default function HeatmapCalendar({ year = new Date().getFullYear() }: { year?: number }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [dayData, setDayData] = useState<Map<string, DayData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [habitsCount, setHabitsCount] = useState(0);

  useEffect(() => {
    if (user) fetchYearData();
  }, [user, year]);

  const fetchYearData = async () => {
    setLoading(true);

    const yearStart = format(startOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');
    const yearEnd = format(endOfYear(new Date(year, 0, 1)), 'yyyy-MM-dd');

    // Fetch habits count
    const { count } = await supabase
      .from('habits')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user!.id)
      .eq('is_active', true);

    setHabitsCount(count || 0);

    // Fetch all entries for the year
    const { data: entries } = await supabase
      .from('habit_entries')
      .select('date, completed')
      .eq('user_id', user!.id)
      .gte('date', yearStart)
      .lte('date', yearEnd);

    // Group by date
    const dataMap = new Map<string, DayData>();
    entries?.forEach((entry) => {
      const existing = dataMap.get(entry.date) || { date: entry.date, completed: 0, total: count || 0 };
      if (entry.completed) {
        existing.completed += 1;
      }
      dataMap.set(entry.date, existing);
    });

    setDayData(dataMap);
    setLoading(false);
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

  // Generate all days of the year
  const yearStartDate = startOfYear(new Date(year, 0, 1));
  const yearEndDate = endOfYear(new Date(year, 0, 1));
  
  // Start from the first Sunday of the year or the week containing Jan 1
  const calendarStart = startOfWeek(yearStartDate, { weekStartsOn: 0 });
  
  // Generate weeks
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
      // Pad the last week
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
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Month labels */}
        <div className="mb-2 flex">
          <div className="w-8" /> {/* Spacer for day labels */}
          <div className="flex flex-1">
            {months.map((month, i) => (
              <div key={month} className="flex-1 text-center text-xs text-muted-foreground">
                {month}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-1">
          {/* Day labels */}
          <div className="flex w-8 flex-col gap-[3px]">
            {days.map((day, i) => (
              <div key={day} className="flex h-3 items-center text-[10px] text-muted-foreground">
                {i % 2 === 1 ? day.slice(0, 1) : ''}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="flex flex-1 gap-[3px]">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[3px]">
                {week.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isCurrentYear = day.getFullYear() === year;
                  const data = dayData.get(dateStr);
                  const completed = data?.completed || 0;

                  return (
                    <Tooltip key={dateStr}>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'h-3 w-3 rounded-sm transition-colors',
                            isCurrentYear
                              ? getIntensityClass(completed, habitsCount)
                              : 'bg-transparent'
                          )}
                        />
                      </TooltipTrigger>
                      {isCurrentYear && (
                        <TooltipContent>
                          <p className="text-sm font-medium">
                            {format(day, 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {completed}/{habitsCount} habits completed
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
        <div className="mt-4 flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">{t('heatmap.less')}</span>
          <div className="flex gap-1">
            <div className="h-3 w-3 rounded-sm bg-muted" />
            <div className="h-3 w-3 rounded-sm bg-primary/20" />
            <div className="h-3 w-3 rounded-sm bg-primary/40" />
            <div className="h-3 w-3 rounded-sm bg-primary/60" />
            <div className="h-3 w-3 rounded-sm bg-primary/80" />
            <div className="h-3 w-3 rounded-sm bg-primary" />
          </div>
          <span className="text-xs text-muted-foreground">{t('heatmap.more')}</span>
        </div>
      </div>
    </div>
  );
}
