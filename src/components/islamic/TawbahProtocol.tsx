import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RefreshCw, Sun, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext';

interface TawbahProtocolProps {
  currentScore: number;
  targetScore: number;
  currentHour: number;
  dayResetUsed: boolean;
  onReset: () => void;
}

export default function TawbahProtocol({ 
  currentScore, 
  targetScore, 
  currentHour, 
  dayResetUsed,
  onReset 
}: TawbahProtocolProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { mode, labels } = useAppMode();

  const scorePercentage = (currentScore / targetScore) * 100;
  const isLowScore = scorePercentage < 40;
  const isAfternoon = currentHour >= 15; // 3:00 PM
  const canReset = isLowScore && isAfternoon && !dayResetUsed;

  const remainingHours = 24 - currentHour;
  const potentialRecovery = Math.min(100, scorePercentage + (remainingHours * 5));

  const primaryColor = mode === 'islamic' ? 'emerald' : 'blue';

  const handleReset = () => {
    setIsResetting(true);
    setTimeout(() => {
      onReset();
      setShowConfirmation(false);
      setIsResetting(false);
    }, 1500);
  };

  if (!isAfternoon) {
    return null;
  }

  return (
    <>
      <Card className={cn(
        "transition-all duration-300",
        canReset 
          ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20" 
          : mode === 'islamic'
            ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/20"
            : "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/20"
      )}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className={cn(
                "h-4 w-4",
                canReset ? "text-amber-500" : mode === 'islamic' ? "text-emerald-500" : "text-blue-500"
              )} />
              {labels.dayReset.title}
            </CardTitle>
            <Badge variant="outline" className={cn(
              "text-xs",
              scorePercentage >= 70 
                ? mode === 'islamic' ? "border-emerald-500 text-emerald-600" : "border-blue-500 text-blue-600"
                : scorePercentage >= 40 ? "border-amber-500 text-amber-600"
                : "border-rose-500 text-rose-600"
            )}>
              {scorePercentage.toFixed(0)}% Today
            </Badge>
          </div>
          <CardDescription>
            {canReset 
              ? labels.dayReset.description
              : dayResetUsed 
                ? labels.dayReset.activeMessage
                : labels.dayReset.onTrackMessage}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Day Progress</span>
              <span className="text-muted-foreground">{currentScore}/{targetScore} points</span>
            </div>
            <Progress value={scorePercentage} className="h-2" />
          </div>

          <div className="p-3 bg-background/50 rounded-lg border space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Sun className="h-4 w-4 text-amber-500" />
              <span className="font-medium">{remainingHours} hours remaining today</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Potential recovery: Up to {potentialRecovery.toFixed(0)}% if you stay focused
            </p>
          </div>

          {canReset ? (
            <>
              <div className={cn(
                "p-3 rounded-lg border",
                mode === 'islamic'
                  ? "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700"
                  : "bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700"
              )}>
                <p className={cn(
                  "text-sm",
                  mode === 'islamic' ? "text-amber-800 dark:text-amber-200" : "text-slate-800 dark:text-slate-200"
                )}>
                  {mode === 'islamic' && <strong>Allah's Mercy:</strong>} {mode === 'islamic' 
                    ? "The believer is tested. What matters is how you finish, not how you started."
                    : "What matters is not the fall, but how you rise. The day isn't over."}
                </p>
                <p className={cn(
                  "text-xs mt-1 italic",
                  mode === 'islamic' ? "text-amber-700 dark:text-amber-300" : "text-slate-600 dark:text-slate-400"
                )}>
                  {labels.dayReset.quote}
                </p>
              </div>

              <Button 
                onClick={() => setShowConfirmation(true)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                {labels.dayReset.buttonText}
              </Button>
            </>
          ) : dayResetUsed ? (
            <div className={cn(
              "p-3 rounded-lg border text-center",
              mode === 'islamic'
                ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700"
                : "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700"
            )}>
              <p className={cn(
                "text-sm",
                mode === 'islamic' ? "text-emerald-800 dark:text-emerald-200" : "text-blue-800 dark:text-blue-200"
              )}>
                ✨ Fresh start is active. Your afternoon score is being tracked separately.
              </p>
            </div>
          ) : (
            <div className={cn(
              "p-3 rounded-lg border text-center",
              mode === 'islamic'
                ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700"
                : "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700"
            )}>
              <p className={cn(
                "text-sm",
                mode === 'islamic' ? "text-emerald-800 dark:text-emerald-200" : "text-blue-800 dark:text-blue-200"
              )}>
                👍 You're doing well! Keep up the momentum.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader>
            <DialogTitle className="text-center">
              {labels.dayReset.confirmTitle}
            </DialogTitle>
            <DialogDescription className="text-center">
              This will dim your morning's struggles and start a fresh progress bar for the remaining hours.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <AlertCircle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
              <p className="text-sm">
                <strong>Note:</strong> Your morning data is still saved. This is a psychological reset, not a data deletion.
              </p>
            </div>

            <div className={cn(
              "p-3 rounded-lg border",
              mode === 'islamic'
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
            )}>
              <p className={cn(
                "text-sm italic",
                mode === 'islamic' ? "text-emerald-800 dark:text-emerald-200" : "text-blue-800 dark:text-blue-200"
              )}>
                {labels.dayReset.hadith}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={() => setShowConfirmation(false)}
              className="flex-1"
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleReset}
              className={cn(
                "flex-1",
                mode === 'islamic' ? "bg-emerald-500 hover:bg-emerald-600" : "bg-blue-500 hover:bg-blue-600"
              )}
              disabled={isResetting}
            >
              {isResetting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reset & Renew
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
