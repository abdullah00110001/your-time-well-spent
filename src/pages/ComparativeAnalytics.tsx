import AppLayout from '@/components/layout/AppLayout';
import { useComparativeAnalytics } from '@/hooks/useComparativeAnalytics';
import { useAppMode } from '@/contexts/AppModeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, TrendingDown, Minus, BarChart3, Calendar, 
  BookOpen, Smartphone, Target, Moon, Heart, Loader2,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';

interface StatCardProps {
  label: string;
  current: number;
  previous: number;
  change: number;
  unit?: string;
  icon: React.ReactNode;
  inverseGood?: boolean; // For metrics where lower is better (e.g., device time)
}

function StatCard({ label, current, previous, change, unit = '', icon, inverseGood = false }: StatCardProps) {
  const isPositive = inverseGood ? change < 0 : change > 0;
  const isNeutral = change === 0;
  
  const getTrendColor = () => {
    if (isNeutral) return 'text-muted-foreground';
    return isPositive ? 'text-emerald-500' : 'text-red-500';
  };

  const getTrendBg = () => {
    if (isNeutral) return 'bg-muted/50';
    return isPositive ? 'bg-emerald-500/10' : 'bg-red-500/10';
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="p-2 rounded-lg bg-primary/10">
            {icon}
          </div>
          <Badge variant="outline" className={`${getTrendBg()} ${getTrendColor()} border-0`}>
            {isNeutral ? (
              <Minus className="h-3 w-3 mr-1" />
            ) : change > 0 ? (
              <ArrowUpRight className="h-3 w-3 mr-1" />
            ) : (
              <ArrowDownRight className="h-3 w-3 mr-1" />
            )}
            {Math.abs(change)}%
          </Badge>
        </div>
        <h3 className="text-sm text-muted-foreground">{label}</h3>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-bold">{current}{unit}</span>
          <span className="text-sm text-muted-foreground">vs {previous}{unit}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ComparativeAnalytics() {
  const { mode } = useAppMode();
  const { weeklyComparison, monthlyComparison, loading } = useComparativeAnalytics();

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const renderComparison = (data: typeof weeklyComparison, periodLabel: string) => {
    if (!data) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Not enough data for {periodLabel.toLowerCase()} comparison</p>
            <p className="text-sm text-muted-foreground">Keep logging your daily entries!</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {/* Summary Banner */}
        <Card className={`border-2 ${mode === 'islamic' ? 'border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20' : 'border-primary/30 bg-primary/5'}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{periodLabel} Summary</h3>
                <p className="text-sm text-muted-foreground">
                  {data.current.entriesCount} entries this {periodLabel.toLowerCase().replace('ly', '')} vs {data.previous.entriesCount} last {periodLabel.toLowerCase().replace('ly', '')}
                </p>
              </div>
              {data.changes.disciplineScore > 0 ? (
                <div className="flex items-center gap-2 text-emerald-500">
                  <TrendingUp className="h-5 w-5" />
                  <span className="font-medium">Improving!</span>
                </div>
              ) : data.changes.disciplineScore < 0 ? (
                <div className="flex items-center gap-2 text-amber-500">
                  <TrendingDown className="h-5 w-5" />
                  <span className="font-medium">Room to grow</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Minus className="h-5 w-5" />
                  <span className="font-medium">Steady</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Study Time"
            current={data.current.studyTime}
            previous={data.previous.studyTime}
            change={data.changes.studyTime}
            unit="h"
            icon={<BookOpen className="h-4 w-4 text-primary" />}
          />
          <StatCard
            label="Device Time"
            current={data.current.deviceTime}
            previous={data.previous.deviceTime}
            change={data.changes.deviceTime}
            unit="h"
            icon={<Smartphone className="h-4 w-4 text-primary" />}
            inverseGood
          />
          <StatCard
            label="Focus Score"
            current={data.current.focusScore}
            previous={data.previous.focusScore}
            change={data.changes.focusScore}
            icon={<Target className="h-4 w-4 text-primary" />}
          />
          <StatCard
            label="Discipline"
            current={data.current.disciplineScore}
            previous={data.previous.disciplineScore}
            change={data.changes.disciplineScore}
            icon={<BarChart3 className="h-4 w-4 text-primary" />}
          />
          {mode === 'islamic' && (
            <>
              <StatCard
                label="Salah On Time"
                current={data.current.salahOnTime}
                previous={data.previous.salahOnTime}
                change={data.changes.salahOnTime}
                icon={<Moon className="h-4 w-4 text-primary" />}
              />
              <StatCard
                label="Quran Days"
                current={data.current.quranDays}
                previous={data.previous.quranDays}
                change={data.changes.quranDays}
                icon={<BookOpen className="h-4 w-4 text-primary" />}
              />
            </>
          )}
          <StatCard
            label="Mood Average"
            current={data.current.moodAverage}
            previous={data.previous.moodAverage}
            change={data.changes.moodAverage}
            icon={<Heart className="h-4 w-4 text-primary" />}
          />
        </div>

        {/* Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Key Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.changes.studyTime > 20 && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4" />
                <span>Great job! Your study time increased significantly.</span>
              </div>
            )}
            {data.changes.deviceTime < -15 && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <TrendingDown className="h-4 w-4" />
                <span>Excellent! You've reduced your screen time.</span>
              </div>
            )}
            {data.changes.deviceTime > 20 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <TrendingUp className="h-4 w-4" />
                <span>Device time is increasing. Consider a digital detox challenge!</span>
              </div>
            )}
            {data.changes.moodAverage < -10 && (
              <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                <TrendingDown className="h-4 w-4" />
                <span>Your mood seems lower. Take time for self-care today.</span>
              </div>
            )}
            {data.changes.focusScore > 15 && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <TrendingUp className="h-4 w-4" />
                <span>Your focus is improving! Keep up the momentum.</span>
              </div>
            )}
            {Object.values(data.changes).every(c => Math.abs(c) < 10) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Minus className="h-4 w-4" />
                <span>Your metrics are stable. Consistency is key!</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-headline font-bold flex items-center gap-2">
            <BarChart3 className={`h-7 w-7 ${mode === 'islamic' ? 'text-emerald-500' : 'text-primary'}`} />
            Comparative Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your progress over time with period comparisons
          </p>
        </div>

        <Tabs defaultValue="weekly" className="space-y-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="weekly" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Weekly
            </TabsTrigger>
            <TabsTrigger value="monthly" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Monthly
            </TabsTrigger>
          </TabsList>

          <TabsContent value="weekly">
            {renderComparison(weeklyComparison, 'Weekly')}
          </TabsContent>

          <TabsContent value="monthly">
            {renderComparison(monthlyComparison, 'Monthly')}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
