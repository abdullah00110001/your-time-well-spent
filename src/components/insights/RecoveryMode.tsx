import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Shield, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RecoveryModeProps {
  isActive: boolean;
  missedDays: number;
  recoveryPlan: string[];
  streakProtected: boolean;
}

export default function RecoveryMode({ isActive, missedDays, recoveryPlan, streakProtected }: RecoveryModeProps) {
  if (!isActive) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2 text-amber-700 dark:text-amber-300">
            <RefreshCw className="h-4 w-4" />
            Recovery Mode Active
          </CardTitle>
          {streakProtected && (
            <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-600">
              <Shield className="h-3 w-3 mr-1" />
              Streak Protected
            </Badge>
          )}
        </div>
        <CardDescription className="text-amber-600 dark:text-amber-400">
          {missedDays} day{missedDays !== 1 ? 's' : ''} missed — No punishment, just gentle recovery
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Life happens. Here's your simple recovery plan for the next 2-3 days:
        </p>
        <ul className="space-y-2">
          {recoveryPlan.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <span className="text-amber-900 dark:text-amber-100">{item}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-amber-600 dark:text-amber-400 pt-2 border-t border-amber-200 dark:border-amber-700">
          "Indeed, with hardship comes ease." — Qur'an 94:6
        </p>
      </CardContent>
    </Card>
  );
}
