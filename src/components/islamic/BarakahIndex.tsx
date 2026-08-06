import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Sun, Moon, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext';

interface BarakahSession {
  time: string;
  duration: number;
  value: number;
  barakahScore: number;
}

interface BarakahIndexProps {
  sessions: BarakahSession[];
  bestTimeSlot: string;
  averageBarakah: number;
}

export default function BarakahIndex({ sessions, bestTimeSlot, averageBarakah }: BarakahIndexProps) {
  const { mode, labels } = useAppMode();
  const primaryColor = mode === 'islamic' ? 'emerald' : 'blue';

  const getTimeIcon = (time: string) => {
    const hour = parseInt(time.split(':')[0]);
    if (hour >= 4 && hour < 7) return Sun;
    if (hour >= 7 && hour < 12) return Sun;
    if (hour >= 12 && hour < 17) return Clock;
    return Moon;
  };

  const getBarakahLevel = (score: number) => {
    if (score >= 8) return { 
      label: mode === 'islamic' ? 'Exceptional Barakah' : 'Exceptional Flow', 
      color: mode === 'islamic' ? 'text-emerald-500' : 'text-blue-500', 
      bg: mode === 'islamic' ? 'bg-emerald-100 dark:bg-emerald-900' : 'bg-blue-100 dark:bg-blue-900' 
    };
    if (score >= 6) return { 
      label: mode === 'islamic' ? 'Good Barakah' : 'Good Flow', 
      color: 'text-cyan-500', 
      bg: 'bg-cyan-100 dark:bg-cyan-900' 
    };
    if (score >= 4) return { 
      label: 'Moderate', 
      color: 'text-amber-500', 
      bg: 'bg-amber-100 dark:bg-amber-900' 
    };
    return { 
      label: mode === 'islamic' ? 'Low Barakah' : 'Low Flow', 
      color: 'text-rose-500', 
      bg: 'bg-rose-100 dark:bg-rose-900' 
    };
  };

  const barakahLevel = getBarakahLevel(averageBarakah);

  const timeSlotAnalysis = {
    fajr: sessions.filter(s => {
      const hour = parseInt(s.time.split(':')[0]);
      return hour >= 4 && hour < 7;
    }),
    morning: sessions.filter(s => {
      const hour = parseInt(s.time.split(':')[0]);
      return hour >= 7 && hour < 12;
    }),
    afternoon: sessions.filter(s => {
      const hour = parseInt(s.time.split(':')[0]);
      return hour >= 12 && hour < 17;
    }),
    evening: sessions.filter(s => {
      const hour = parseInt(s.time.split(':')[0]);
      return hour >= 17 || hour < 4;
    }),
  };

  const getSlotAverage = (slotSessions: BarakahSession[]) => {
    if (slotSessions.length === 0) return 0;
    return slotSessions.reduce((acc, s) => acc + s.barakahScore, 0) / slotSessions.length;
  };

  const timeSlots = mode === 'islamic'
    ? [
        { key: 'fajr', label: 'After Fajr', icon: '🌅' },
        { key: 'morning', label: 'Morning', icon: '☀️' },
        { key: 'afternoon', label: 'Afternoon', icon: '🌤️' },
        { key: 'evening', label: 'Evening', icon: '🌙' },
      ]
    : [
        { key: 'fajr', label: 'Early AM', icon: '🌅' },
        { key: 'morning', label: 'Morning', icon: '☀️' },
        { key: 'afternoon', label: 'Afternoon', icon: '🌤️' },
        { key: 'evening', label: 'Evening', icon: '🌙' },
      ];

  return (
    <Card>
      <CardHeader className="pb-2 p-4 sm:p-6 sm:pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2">
            <Sparkles className={cn("h-3.5 w-3.5 sm:h-4 sm:w-4", mode === 'islamic' ? "text-amber-500" : "text-blue-500")} />
            <span className="truncate">{labels.qualityIndex.title}</span>
          </CardTitle>
          <Badge className={cn("text-[10px] sm:text-xs shrink-0", barakahLevel.bg, barakahLevel.color)}>
            {averageBarakah.toFixed(1)}/10
          </Badge>
        </div>
        <CardDescription className="text-xs sm:text-sm">{labels.qualityIndex.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 p-4 sm:p-6 pt-0">
        <div className="space-y-2">
          <div className="flex justify-between text-xs sm:text-sm">
            <span className="truncate">{barakahLevel.label}</span>
            <span className="text-muted-foreground shrink-0">{(averageBarakah * 10).toFixed(0)}%</span>
          </div>
          <Progress value={averageBarakah * 10} className="h-2 sm:h-3" />
        </div>

        {bestTimeSlot && (
          <div className={cn(
            "p-3 rounded-lg border",
            mode === 'islamic'
              ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
              : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
          )}>
            <p className={cn(
              "text-sm",
              mode === 'islamic' ? "text-emerald-800 dark:text-emerald-200" : "text-blue-800 dark:text-blue-200"
            )}>
              ✨ <strong>{labels.qualityIndex.peakTime}:</strong> Your output is highest {bestTimeSlot}.
              {bestTimeSlot.includes('Fajr') && mode === 'islamic' && (
                <span className="block mt-1 text-xs italic">
                  "The early morning has been blessed for my Ummah" — Hadith
                </span>
              )}
              {bestTimeSlot.includes('Early') && mode === 'regular' && (
                <span className="block mt-1 text-xs italic">
                  "The early morning hours have gold in their mouth" — Proverb
                </span>
              )}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {timeSlots.map(slot => {
            const avg = getSlotAverage(timeSlotAnalysis[slot.key as keyof typeof timeSlotAnalysis]);
            const level = getBarakahLevel(avg);
            return (
              <div 
                key={slot.key}
                className={cn(
                  "p-2 rounded-lg border text-center",
                  avg > 0 ? level.bg : "bg-muted/30"
                )}
              >
                <span className="text-lg">{slot.icon}</span>
                <p className="text-xs font-medium">{slot.label}</p>
                <p className={cn("text-sm font-bold", avg > 0 ? level.color : "text-muted-foreground")}>
                  {avg > 0 ? avg.toFixed(1) : '-'}
                </p>
              </div>
            );
          })}
        </div>

        {sessions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Recent Sessions</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {sessions.slice(0, 5).map((session, idx) => {
                const Icon = getTimeIcon(session.time);
                const level = getBarakahLevel(session.barakahScore);
                return (
                  <div 
                    key={idx}
                    className="flex items-center justify-between text-xs p-2 rounded bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-3 w-3 text-muted-foreground" />
                      <span>{session.time}</span>
                      <span className="text-muted-foreground">({session.duration}min)</span>
                    </div>
                    <Badge variant="outline" className={cn("text-xs", level.color)}>
                      {session.barakahScore.toFixed(1)}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center pt-2 border-t">
          {labels.qualityIndex.formula}
        </p>
      </CardContent>
    </Card>
  );
}
