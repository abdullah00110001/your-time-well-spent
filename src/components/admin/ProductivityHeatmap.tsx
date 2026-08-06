import { useMemo } from 'react';
import { format, subDays, eachDayOfInterval, getDay } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface HeatmapData {
  date: string;
  value: number;
  studyMinutes: number;
  salahCount: number;
  deviceMinutes: number;
}

interface ProductivityHeatmapProps {
  data: HeatmapData[];
  onDayClick?: (date: string) => void;
}

export default function ProductivityHeatmap({ data, onDayClick }: ProductivityHeatmapProps) {
  const days = useMemo(() => {
    const endDate = new Date();
    const startDate = subDays(endDate, 364);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, []);

  const dataMap = useMemo(() => {
    const map = new Map<string, HeatmapData>();
    data.forEach(d => map.set(d.date, d));
    return map;
  }, [data]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    let currentWeek: Date[] = [];
    
    // Pad the first week
    const firstDay = getDay(days[0]);
    for (let i = 0; i < firstDay; i++) {
      currentWeek.push(null as any);
    }
    
    days.forEach(day => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        result.push(currentWeek);
        currentWeek = [];
      }
    });
    
    if (currentWeek.length > 0) {
      result.push(currentWeek);
    }
    
    return result;
  }, [days]);

  const getColorClass = (value: number | undefined) => {
    if (value === undefined || value === 0) return 'bg-muted';
    if (value >= 80) return 'bg-emerald-500';
    if (value >= 60) return 'bg-emerald-400';
    if (value >= 40) return 'bg-emerald-300';
    if (value >= 20) return 'bg-emerald-200';
    return 'bg-emerald-100';
  };

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-2">
      {/* Month labels */}
      <div className="flex gap-1 text-xs text-muted-foreground pl-8">
        {months.map((month, i) => (
          <div key={i} className="w-[52px] text-center">{month}</div>
        ))}
      </div>

      <div className="flex gap-1">
        {/* Day labels */}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground pr-2">
          <div className="h-3">Sun</div>
          <div className="h-3">Mon</div>
          <div className="h-3">Tue</div>
          <div className="h-3">Wed</div>
          <div className="h-3">Thu</div>
          <div className="h-3">Fri</div>
          <div className="h-3">Sat</div>
        </div>

        {/* Heatmap grid */}
        <div className="flex gap-[2px] overflow-x-auto">
          <TooltipProvider>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-[2px]">
                {week.map((day, dayIndex) => {
                  if (!day) {
                    return <div key={dayIndex} className="w-3 h-3" />;
                  }
                  
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayData = dataMap.get(dateStr);
                  
                  return (
                    <Tooltip key={dayIndex}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => onDayClick?.(dateStr)}
                          className={cn(
                            "w-3 h-3 rounded-sm transition-all hover:ring-2 hover:ring-primary/50",
                            getColorClass(dayData?.value)
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">
                        <div className="space-y-1">
                          <p className="font-medium">{format(day, 'MMM d, yyyy')}</p>
                          {dayData ? (
                            <>
                              <p>Score: {dayData.value}%</p>
                              <p>Study: {Math.round(dayData.studyMinutes / 60)}h</p>
                              <p>Salah: {dayData.salahCount}/5</p>
                              <p>Device: {Math.round(dayData.deviceMinutes / 60)}h</p>
                            </>
                          ) : (
                            <p className="text-muted-foreground">No data</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </TooltipProvider>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="w-3 h-3 rounded-sm bg-muted" />
        <div className="w-3 h-3 rounded-sm bg-emerald-100" />
        <div className="w-3 h-3 rounded-sm bg-emerald-200" />
        <div className="w-3 h-3 rounded-sm bg-emerald-300" />
        <div className="w-3 h-3 rounded-sm bg-emerald-400" />
        <div className="w-3 h-3 rounded-sm bg-emerald-500" />
        <span>More</span>
      </div>
    </div>
  );
}
