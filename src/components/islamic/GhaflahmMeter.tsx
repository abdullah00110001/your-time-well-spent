import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, AlertTriangle, Brain, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext';

interface GhaflahMeterProps {
  activeLearningMinutes: number;
  mindlessScrollingMinutes: number;
  onGrayscaleChange?: (enabled: boolean) => void;
}

export default function GhaflahMeter({ 
  activeLearningMinutes, 
  mindlessScrollingMinutes,
  onGrayscaleChange 
}: GhaflahMeterProps) {
  const [grayscaleEnabled, setGrayscaleEnabled] = useState(false);
  const { mode, labels } = useAppMode();

  const totalScreenTime = activeLearningMinutes + mindlessScrollingMinutes;
  const mindlessPercentage = totalScreenTime > 0 
    ? (mindlessScrollingMinutes / totalScreenTime) * 100 
    : 0;
  
  const ghaflahLevel = mindlessScrollingMinutes > 120 ? 'critical' :
                       mindlessScrollingMinutes > 60 ? 'high' :
                       mindlessScrollingMinutes > 30 ? 'moderate' : 'low';

  const primaryColor = mode === 'islamic' ? 'emerald' : 'blue';

  useEffect(() => {
    const shouldEnableGrayscale = mindlessScrollingMinutes > 60;
    if (shouldEnableGrayscale !== grayscaleEnabled) {
      setGrayscaleEnabled(shouldEnableGrayscale);
      onGrayscaleChange?.(shouldEnableGrayscale);
      
      if (shouldEnableGrayscale) {
        document.body.style.filter = 'grayscale(80%)';
        document.body.style.transition = 'filter 2s ease';
      } else {
        document.body.style.filter = 'none';
      }
    }

    return () => {
      document.body.style.filter = 'none';
    };
  }, [mindlessScrollingMinutes, grayscaleEnabled, onGrayscaleChange]);

  const getLevelConfig = () => {
    switch (ghaflahLevel) {
      case 'critical':
        return {
          color: 'text-rose-500',
          bgColor: 'bg-rose-50 dark:bg-rose-950/30',
          borderColor: 'border-rose-200 dark:border-rose-800',
          label: mode === 'islamic' ? 'Critical Ghaflah' : 'Critical Overload',
          icon: EyeOff,
          message: labels.dopamineMeter.criticalMessage,
        };
      case 'high':
        return {
          color: 'text-amber-500',
          bgColor: 'bg-amber-50 dark:bg-amber-950/30',
          borderColor: 'border-amber-200 dark:border-amber-800',
          label: mode === 'islamic' ? 'High Ghaflah' : 'High Overload',
          icon: AlertTriangle,
          message: `${labels.dopamineMeter.warningLabel}: Dashboard entering grayscale.`,
        };
      case 'moderate':
        return {
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
          borderColor: 'border-yellow-200 dark:border-yellow-800',
          label: 'Moderate',
          icon: Eye,
          message: 'Watch your screen time. Stay mindful.',
        };
      default:
        return {
          color: mode === 'islamic' ? 'text-emerald-500' : 'text-blue-500',
          bgColor: mode === 'islamic' 
            ? 'bg-emerald-50 dark:bg-emerald-950/30'
            : 'bg-blue-50 dark:bg-blue-950/30',
          borderColor: mode === 'islamic'
            ? 'border-emerald-200 dark:border-emerald-800'
            : 'border-blue-200 dark:border-blue-800',
          label: 'Mindful',
          icon: Brain,
          message: 'Great balance! Keep using your time wisely.',
        };
    }
  };

  const config = getLevelConfig();
  const Icon = config.icon;

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <Card className={cn("transition-all duration-300", config.borderColor)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon className={cn("h-4 w-4", config.color)} />
            {labels.dopamineMeter.title}
          </CardTitle>
          <Badge variant="outline" className={cn("text-xs", config.color)}>
            {config.label}
          </Badge>
        </div>
        <CardDescription>{labels.dopamineMeter.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1">
                <Brain className={cn("h-3 w-3", mode === 'islamic' ? "text-emerald-500" : "text-blue-500")} />
                {labels.dopamineMeter.activeLearning}
              </span>
              <span className={cn("font-medium", mode === 'islamic' ? "text-emerald-600" : "text-blue-600")}>
                {formatTime(activeLearningMinutes)}
              </span>
            </div>
            <Progress value={totalScreenTime > 0 ? (activeLearningMinutes / totalScreenTime) * 100 : 0} className="h-2" />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="flex items-center gap-1">
                <Smartphone className="h-3 w-3 text-rose-500" />
                {labels.dopamineMeter.mindlessScrolling}
              </span>
              <span className="font-medium text-rose-600">{formatTime(mindlessScrollingMinutes)}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-rose-500 transition-all duration-500"
                style={{ width: `${mindlessPercentage}%` }}
              />
            </div>
          </div>
        </div>

        <div className={cn("p-3 rounded-lg", config.bgColor)}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Mindfulness Ratio</span>
            <span className={cn("text-lg font-bold", config.color)}>
              {totalScreenTime > 0 
                ? `${(100 - mindlessPercentage).toFixed(0)}%`
                : '-'}
            </span>
          </div>
          <p className={cn("text-xs mt-1", config.color)}>{config.message}</p>
        </div>

        {grayscaleEnabled && (
          <Alert className="bg-rose-100 dark:bg-rose-900/30 border-rose-300 dark:border-rose-700">
            <EyeOff className="h-4 w-4 text-rose-600" />
            <AlertDescription className="text-rose-800 dark:text-rose-200 text-sm">
              <strong>Dopamine Detox Active:</strong> Dashboard is in grayscale to reduce dopamine appeal. 
              Reduce mindless scrolling to restore colors.
            </AlertDescription>
          </Alert>
        )}

        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
          <p>💡 <strong>Tip:</strong> For every 30 min of passive consumption, do 15 min of active learning.</p>
          {mindlessScrollingMinutes > 30 && (
            <p className="text-amber-600 dark:text-amber-400">
              {mode === 'islamic' 
                ? '⚠️ "Verily, the hearing, sight, and heart - all of them will be questioned." — Al-Isra 17:36'
                : '⚠️ "It is not that we have a short time to live, but that we waste a lot of it." — Seneca'}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
