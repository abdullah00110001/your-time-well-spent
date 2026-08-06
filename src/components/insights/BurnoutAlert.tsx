import { AlertTriangle, Heart, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface BurnoutAlertProps {
  riskLevel: 'none' | 'mild' | 'moderate' | 'high';
  daysAtRisk: number;
  warning: string | null;
  onDismiss?: () => void;
}

export default function BurnoutAlert({ riskLevel, daysAtRisk, warning, onDismiss }: BurnoutAlertProps) {
  const [dismissed, setDismissed] = useState(false);

  if (riskLevel === 'none' || dismissed) return null;

  const getBgColor = () => {
    switch (riskLevel) {
      case 'mild': return 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800';
      case 'moderate': return 'bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800';
      case 'high': return 'bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800';
    }
  };

  const getIconColor = () => {
    switch (riskLevel) {
      case 'mild': return 'text-amber-600';
      case 'moderate': return 'text-orange-600';
      case 'high': return 'text-red-600';
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <Card className={cn("border", getBgColor())}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className={cn("text-sm font-medium flex items-center gap-2", getIconColor())}>
            <AlertTriangle className="h-4 w-4" />
            Burnout Risk: {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">{warning}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Heart className="h-3 w-3" />
          <span>{daysAtRisk} days of low energy/sleep/focus detected</span>
        </div>
        {riskLevel !== 'mild' && (
          <div className="p-3 rounded-lg bg-background/80">
            <p className="text-xs font-medium mb-2">Recovery suggestions:</p>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>• Prioritize 8 hours of sleep tonight</li>
              <li>• Reduce workload by 50% for 2-3 days</li>
              <li>• Take a 20-minute walk outside</li>
              <li>• Engage in dhikr and du'a for peace of mind</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
