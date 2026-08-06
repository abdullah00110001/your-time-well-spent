import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Scale, Star, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext';

interface AkhirahRatioProps {
  worshipScore: number;
  duniaScore: number;
  salahCompleted: number;
  quranMinutes: number;
  sadaqahDone: boolean;
  studyMinutes: number;
  exerciseMinutes: number;
}

export default function AkhirahRatio({
  worshipScore,
  duniaScore,
  salahCompleted,
  quranMinutes,
  sadaqahDone,
  studyMinutes,
  exerciseMinutes,
}: AkhirahRatioProps) {
  const { mode, labels } = useAppMode();
  const primaryColor = mode === 'islamic' ? 'emerald' : 'blue';

  const akhirahWeight = 0.6;
  const duniaWeight = 0.4;
  
  const weightedTotal = (worshipScore * akhirahWeight) + (duniaScore * duniaWeight);
  
  const isDayFailed = salahCompleted < 3;
  const isDaySuccessful = worshipScore >= 60 && weightedTotal >= 50;

  const getStatusConfig = () => {
    if (isDayFailed) {
      return {
        status: 'Failed Day',
        color: 'text-rose-500',
        bgColor: 'bg-rose-50 dark:bg-rose-950/30',
        borderColor: 'border-rose-300 dark:border-rose-700',
        message: labels.weightedScore.failedDayMessage,
        icon: AlertTriangle,
      };
    }
    if (isDaySuccessful) {
      return {
        status: 'Blessed Day',
        color: mode === 'islamic' ? 'text-emerald-500' : 'text-blue-500',
        bgColor: mode === 'islamic' 
          ? 'bg-emerald-50 dark:bg-emerald-950/30'
          : 'bg-blue-50 dark:bg-blue-950/30',
        borderColor: mode === 'islamic'
          ? 'border-emerald-300 dark:border-emerald-700'
          : 'border-blue-300 dark:border-blue-700',
        message: mode === 'islamic'
          ? 'You prioritized your Akhirah while maintaining worldly duties.'
          : 'You prioritized your core values while maintaining productivity.',
        icon: CheckCircle2,
      };
    }
    return {
      status: 'Average Day',
      color: 'text-amber-500',
      bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      borderColor: 'border-amber-300 dark:border-amber-700',
      message: mode === 'islamic'
        ? 'Room for improvement in worship activities.'
        : 'Room for improvement in core activities.',
      icon: Scale,
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Card className={cn("transition-all", config.borderColor)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Scale className={cn("h-4 w-4", mode === 'islamic' ? "text-indigo-500" : "text-blue-500")} />
            {labels.weightedScore.title}
          </CardTitle>
          <Badge variant="outline" className={cn("text-xs", config.color)}>
            {config.status}
          </Badge>
        </div>
        <CardDescription>{labels.weightedScore.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center py-4">
          <div className="relative inline-block">
            <svg className="w-32 h-32">
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className="text-muted"
              />
              <circle
                cx="64"
                cy="64"
                r="56"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                strokeDasharray={352}
                strokeDashoffset={352 - (352 * weightedTotal / 100)}
                className={cn(
                  "transform -rotate-90 origin-center transition-all duration-1000",
                  isDayFailed ? "text-rose-500" : 
                  isDaySuccessful 
                    ? mode === 'islamic' ? "text-emerald-500" : "text-blue-500"
                    : "text-amber-500"
                )}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-3xl font-bold", config.color)}>
                {weightedTotal.toFixed(0)}
              </span>
              <span className="text-xs text-muted-foreground">weighted</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className={cn(
            "p-3 rounded-lg border",
            mode === 'islamic'
              ? "bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800"
              : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
          )}>
            <div className="flex items-center justify-between mb-2">
              <span className={cn(
                "text-xs font-medium",
                mode === 'islamic' ? "text-indigo-700 dark:text-indigo-300" : "text-blue-700 dark:text-blue-300"
              )}>{labels.weightedScore.worshipLabel}</span>
              <Star className={cn("h-4 w-4", mode === 'islamic' ? "text-indigo-500" : "text-blue-500")} />
            </div>
            <p className={cn(
              "text-2xl font-bold",
              mode === 'islamic' ? "text-indigo-600 dark:text-indigo-400" : "text-blue-600 dark:text-blue-400"
            )}>
              {worshipScore.toFixed(0)}
            </p>
            <Progress value={worshipScore} className="h-1.5 mt-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{mode === 'islamic' ? `Salah: ${salahCompleted}/5` : `Routine: ${salahCompleted}/5`}</span>
              <span>{mode === 'islamic' ? `Quran: ${quranMinutes}m` : `Reading: ${quranMinutes}m`}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                {labels.weightedScore.worldLabel}
              </span>
              <Scale className="h-4 w-4 text-slate-500" />
            </div>
            <p className="text-2xl font-bold text-slate-600 dark:text-slate-400">
              {duniaScore.toFixed(0)}
            </p>
            <Progress value={duniaScore} className="h-1.5 mt-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Study: {studyMinutes}m</span>
              <span>Exercise: {exerciseMinutes}m</span>
            </div>
          </div>
        </div>

        <Alert className={cn(config.bgColor, config.borderColor)}>
          <Icon className={cn("h-4 w-4", config.color)} />
          <AlertDescription className={cn("text-sm", config.color)}>
            {config.message}
          </AlertDescription>
        </Alert>

        <div className="p-2 bg-muted/30 rounded text-center">
          <p className="text-xs text-muted-foreground">
            Score = ({mode === 'islamic' ? 'Worship' : 'Core Values'} × 0.6) + (Work/Study × 0.4)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            = ({worshipScore.toFixed(0)} × 0.6) + ({duniaScore.toFixed(0)} × 0.4) = <strong>{weightedTotal.toFixed(0)}</strong>
          </p>
        </div>

        <p className="text-xs text-muted-foreground text-center italic">
          {mode === 'islamic' 
            ? '"But seek, through that which Allah has given you, the home of the Hereafter; and [yet], do not forget your share of the world." — Al-Qasas 28:77'
            : '"First things first: attend to the vital few before the trivial many." — Eisenhower'}
        </p>
      </CardContent>
    </Card>
  );
}
