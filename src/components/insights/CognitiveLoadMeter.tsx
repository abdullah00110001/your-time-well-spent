import { Brain, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface CognitiveLoadMeterProps {
  score: number;
  status: 'low' | 'medium' | 'high' | 'overload';
  warning: string | null;
}

export default function CognitiveLoadMeter({ score, status, warning }: CognitiveLoadMeterProps) {
  const getStatusColor = () => {
    switch (status) {
      case 'low': return 'text-emerald-500';
      case 'medium': return 'text-amber-500';
      case 'high': return 'text-orange-500';
      case 'overload': return 'text-red-500';
    }
  };

  const getProgressColor = () => {
    switch (status) {
      case 'low': return 'bg-emerald-500';
      case 'medium': return 'bg-amber-500';
      case 'high': return 'bg-orange-500';
      case 'overload': return 'bg-red-500';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'low': return 'Calm';
      case 'medium': return 'Moderate';
      case 'high': return 'High Load';
      case 'overload': return 'Overload!';
    }
  };

  return (
    <Card className={cn(
      "transition-all",
      status === 'overload' && "border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20"
    )}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className={cn("h-4 w-4", getStatusColor())} />
          Cognitive Load
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className={cn("text-2xl font-bold", getStatusColor())}>
            {score}%
          </span>
          <span className={cn("text-sm font-medium", getStatusColor())}>
            {getStatusLabel()}
          </span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div 
            className={cn("h-full transition-all", getProgressColor())}
            style={{ width: `${score}%` }}
          />
        </div>
        {warning && (
          <div className="flex items-start gap-2 p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-sm">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-300 text-xs">{warning}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Based on sleep, focus, and task load
        </p>
      </CardContent>
    </Card>
  );
}
