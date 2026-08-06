import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Scale } from 'lucide-react';

interface LifeBalanceProps {
  score: number;
  status: 'low' | 'medium' | 'high';
  daily: number;
  weekly: number;
  monthly: number;
}

export default function LifeBalanceScore({ score, status, daily, weekly, monthly }: LifeBalanceProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'high': return 'text-emerald-500';
      case 'medium': return 'text-amber-500';
      case 'low': return 'text-red-500';
    }
  };

  const getStatusBg = () => {
    switch (status) {
      case 'high': return 'bg-emerald-50 dark:bg-emerald-950/30';
      case 'medium': return 'bg-amber-50 dark:bg-amber-950/30';
      case 'low': return 'bg-red-50 dark:bg-red-950/30';
    }
  };

  const getBarColor = (val: number) => {
    if (val >= 70) return 'bg-emerald-500';
    if (val >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Scale className="h-4 w-4 text-primary" />
          Life Balance Score
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Score */}
        <div className={cn("text-center p-4 rounded-xl", getStatusBg())}>
          <p className={cn("text-5xl font-bold", getStatusColor())}>{score}</p>
          <p className="text-sm text-muted-foreground mt-1 capitalize">{status} Balance</p>
        </div>

        {/* Formula */}
        <p className="text-xs text-muted-foreground text-center">
          (Study + Salah + Sleep + Exercise) ÷ Device Time
        </p>

        {/* Breakdown */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Today</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full transition-all", getBarColor(daily))} style={{ width: `${daily}%` }} />
              </div>
              <span className="text-sm font-medium w-8">{daily}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">This Week</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full transition-all", getBarColor(weekly))} style={{ width: `${weekly}%` }} />
              </div>
              <span className="text-sm font-medium w-8">{weekly}</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">This Month</span>
            <div className="flex items-center gap-2">
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div className={cn("h-full transition-all", getBarColor(monthly))} style={{ width: `${monthly}%` }} />
              </div>
              <span className="text-sm font-medium w-8">{monthly}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
