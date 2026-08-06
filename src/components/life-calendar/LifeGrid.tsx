import { useCallback, useRef, memo } from 'react';
import { cn } from '@/lib/utils';
import { type WeekInfo } from '@/hooks/useLifeCalendar';

interface LifeGridProps {
  totalYears: number;
  getWeekInfo: (year: number, week: number) => WeekInfo;
  onWeekClick: (weekInfo: WeekInfo) => void;
  currentAgeYears: number;
}

const WEEKS_PER_YEAR = 52;

function getWeekColor(weekInfo: WeekInfo): string {
  if (weekInfo.status === 'future') return 'bg-muted/40';
  if (weekInfo.status === 'current') return 'bg-primary ring-2 ring-primary ring-offset-1 ring-offset-background';
  
  // Past weeks — color by discipline score
  const score = weekInfo.data?.discipline_score ?? 0;
  if (score >= 80) return 'bg-emerald-500 dark:bg-emerald-600';
  if (score >= 60) return 'bg-sky-500 dark:bg-sky-600';
  if (score >= 40) return 'bg-amber-400 dark:bg-amber-500';
  if (score >= 20) return 'bg-orange-400 dark:bg-orange-500';
  if (score > 0) return 'bg-red-400 dark:bg-red-500';
  
  // Past but no data
  return 'bg-muted-foreground/20';
}

const WeekBlock = memo(({ weekInfo, onClick }: { weekInfo: WeekInfo; onClick: () => void }) => (
  <button
    onClick={onClick}
    className={cn(
      'w-[6px] h-[6px] rounded-[1px] transition-colors hover:opacity-80 active:scale-150',
      getWeekColor(weekInfo),
      weekInfo.status === 'current' && 'animate-pulse'
    )}
    aria-label={`Age ${weekInfo.year}, week ${weekInfo.weekInYear}`}
  />
));
WeekBlock.displayName = 'WeekBlock';

const YearRow = memo(({ year, getWeekInfo, onWeekClick, isCurrentYear }: {
  year: number;
  getWeekInfo: (y: number, w: number) => WeekInfo;
  onWeekClick: (w: WeekInfo) => void;
  isCurrentYear: boolean;
}) => (
  <div className="flex items-center gap-[1px]">
    <span className={cn(
      'w-7 text-[8px] text-right pr-1 shrink-0 tabular-nums',
      isCurrentYear ? 'text-primary font-bold' : 'text-muted-foreground'
    )}>
      {year}
    </span>
    {Array.from({ length: WEEKS_PER_YEAR }, (_, w) => {
      const wi = getWeekInfo(year, w + 1);
      return <WeekBlock key={w} weekInfo={wi} onClick={() => onWeekClick(wi)} />;
    })}
  </div>
));
YearRow.displayName = 'YearRow';

export default function LifeGrid({ totalYears, getWeekInfo, onWeekClick, currentAgeYears }: LifeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentYear = Math.floor(currentAgeYears);

  // Scroll to current age on mount
  const scrollToCurrentRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      // Small delay to ensure render
      setTimeout(() => {
        const row = node.querySelector(`[data-year="${currentYear}"]`);
        if (row) {
          row.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
      }, 100);
    }
  }, [currentYear]);

  return (
    <div className="relative">
      {/* Decade labels */}
      <div className="overflow-x-auto pb-2">
        <div
          ref={scrollToCurrentRef}
          className="overflow-y-auto max-h-[60vh] space-y-[1px] px-2"
        >
          {Array.from({ length: totalYears }, (_, y) => (
            <div key={y} data-year={y}>
              {y % 10 === 0 && y > 0 && (
                <div className="text-[9px] text-muted-foreground font-medium pl-8 py-1 border-t border-border/50">
                  Decade {y / 10}
                </div>
              )}
              <YearRow
                year={y}
                getWeekInfo={getWeekInfo}
                onWeekClick={onWeekClick}
                isCurrentYear={y === currentYear}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-3 pt-3 flex-wrap">
        <span className="text-[9px] text-muted-foreground">Less</span>
        <div className="flex gap-1">
          <div className="w-3 h-3 rounded-sm bg-muted-foreground/20" />
          <div className="w-3 h-3 rounded-sm bg-red-400 dark:bg-red-500" />
          <div className="w-3 h-3 rounded-sm bg-orange-400 dark:bg-orange-500" />
          <div className="w-3 h-3 rounded-sm bg-amber-400 dark:bg-amber-500" />
          <div className="w-3 h-3 rounded-sm bg-sky-500 dark:bg-sky-600" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500 dark:bg-emerald-600" />
        </div>
        <span className="text-[9px] text-muted-foreground">More</span>
        <div className="flex items-center gap-1 ml-2">
          <div className="w-3 h-3 rounded-sm bg-primary animate-pulse" />
          <span className="text-[9px] text-muted-foreground">Now</span>
        </div>
      </div>
    </div>
  );
}
