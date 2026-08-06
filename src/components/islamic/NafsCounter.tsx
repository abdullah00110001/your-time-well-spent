import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAppMode, stoicQuotes } from '@/contexts/AppModeContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const warningAyahs = [
  { text: "And I do not acquit myself. Indeed, the soul is a persistent enjoiner of evil.", source: "Yusuf 12:53" },
  { text: "Indeed, Satan is an enemy to you; so take him as an enemy.", source: "Fatir 35:6" },
  { text: "And whoever turns away from My remembrance - indeed, he will have a depressed life.", source: "Ta-Ha 20:124" },
  { text: "Has the time not come for those who have believed that their hearts should become humbly submissive?", source: "Al-Hadid 57:16" },
  { text: "Every soul will taste death. And you will only be given your full compensation on the Day of Resurrection.", source: "Ali Imran 3:185" },
  { text: "Know that the life of this world is but amusement and diversion and adornment.", source: "Al-Hadid 57:20" },
  { text: "So flee to Allah. Indeed, I am to you from Him a clear warner.", source: "Adh-Dhariyat 51:50" },
  { text: "O you who believe, enter into Islam completely and do not follow the footsteps of Satan.", source: "Al-Baqarah 2:208" },
];

interface NafsCounterProps {
  urgesResisted: number;
  urgesSuccumbed: number;
  onUpdate?: () => void;
}

export default function NafsCounter({ urgesResisted, urgesSuccumbed, onUpdate }: NafsCounterProps) {
  const { user } = useAuth();
  const { mode, labels } = useAppMode();
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [currentQuote, setCurrentQuote] = useState<{ text: string; source: string }>(
    mode === 'islamic' 
      ? { text: warningAyahs[0].text, source: warningAyahs[0].source }
      : { text: stoicQuotes[0].text, source: stoicQuotes[0].author }
  );
  const [isResisting, setIsResisting] = useState(false);

  const total = urgesResisted + urgesSuccumbed;
  const resistanceRate = total > 0 ? (urgesResisted / total) * 100 : 100;

  const handleUrgePress = useCallback(() => {
    if (mode === 'islamic') {
      const randomAyah = warningAyahs[Math.floor(Math.random() * warningAyahs.length)];
      setCurrentQuote({ text: randomAyah.text, source: randomAyah.source });
    } else {
      const randomQuote = stoicQuotes[Math.floor(Math.random() * stoicQuotes.length)];
      setCurrentQuote({ text: randomQuote.text, source: randomQuote.author });
    }
    setCountdown(10);
    setShowCountdown(true);
    setIsResisting(true);
  }, [mode]);

  const logUrge = useCallback(async (resisted: boolean) => {
    if (!user) return;

    try {
      await supabase.from('nafs_logs').insert({
        user_id: user.id,
        resisted,
        ayah_shown: `${currentQuote.text} — ${currentQuote.source}`,
      });

      if (resisted) {
        toast.success(labels.impulseControl.successMessage);
      } else {
        toast.info(labels.impulseControl.failMessage);
      }

      onUpdate?.();
    } catch (error) {
      console.error('Error logging urge:', error);
    }
  }, [user, currentQuote, onUpdate, labels]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    
    if (showCountdown && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    } else if (showCountdown && countdown === 0 && isResisting) {
      // Successfully resisted
      logUrge(true);
      setShowCountdown(false);
      setIsResisting(false);
    }

    return () => clearTimeout(timer);
  }, [showCountdown, countdown, isResisting, logUrge]);

  const handleSuccumb = () => {
    logUrge(false);
    setShowCountdown(false);
    setIsResisting(false);
  };

  const handleClose = () => {
    if (isResisting) {
      // User closed during countdown = resisted
      logUrge(true);
    }
    setShowCountdown(false);
    setIsResisting(false);
  };

  const modeColor = mode === 'islamic' ? 'amber' : 'indigo';
  const borderClass = mode === 'islamic' 
    ? 'border-amber-200 dark:border-amber-800' 
    : 'border-indigo-200 dark:border-indigo-800';

  return (
    <>
      <Card className={borderClass}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Shield className={cn("h-4 w-4", mode === 'islamic' ? 'text-amber-500' : 'text-indigo-500')} />
              {labels.impulseControl.title}
            </CardTitle>
            <Badge variant="outline" className={cn(
              "text-xs",
              resistanceRate >= 80 ? "border-emerald-500 text-emerald-600" :
              resistanceRate >= 50 ? "border-amber-500 text-amber-600" :
              "border-rose-500 text-rose-600"
            )}>
              {resistanceRate.toFixed(0)}% Resistance
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{labels.impulseControl.subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-center">
              <CheckCircle2 className="h-5 w-5 mx-auto text-emerald-500 mb-1" />
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{urgesResisted}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400">{labels.impulseControl.resistedLabel}</p>
            </div>
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-lg text-center">
              <X className="h-5 w-5 mx-auto text-rose-500 mb-1" />
              <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{urgesSuccumbed}</p>
              <p className="text-xs text-rose-600 dark:text-rose-400">{labels.impulseControl.succumbedLabel}</p>
            </div>
          </div>

          {/* Resistance Progress */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Self-Control Level</span>
              <span>{resistanceRate.toFixed(0)}%</span>
            </div>
            <Progress value={resistanceRate} className="h-2" />
          </div>

          {/* Panic Button */}
          <Button 
            onClick={handleUrgePress}
            variant="outline"
            className={cn(
              "w-full h-14 text-base border-2 border-dashed",
              mode === 'islamic' 
                ? "border-amber-400 hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                : "border-indigo-400 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
            )}
          >
            <AlertTriangle className={cn("h-5 w-5 mr-2", mode === 'islamic' ? 'text-amber-500' : 'text-indigo-500')} />
            {labels.impulseControl.buttonText}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            {mode === 'islamic' 
              ? 'Press when tempted. Wait 10 seconds with the Quranic reminder.'
              : 'Press when tempted. Wait 10 seconds with the Stoic wisdom.'}
          </p>
        </CardContent>
      </Card>

      {/* Countdown Dialog */}
      <Dialog open={showCountdown} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md text-center" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-center text-xl">
              🛡️ {labels.impulseControl.title}
            </DialogTitle>
          </DialogHeader>

          <div className="py-6 space-y-6">
            {/* Countdown Circle */}
            <div className="relative w-32 h-32 mx-auto">
              <svg className="w-full h-full transform -rotate-90">
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
                  strokeDashoffset={352 - (352 * (countdown / 10))}
                  className={cn(
                    "transition-all duration-1000",
                    mode === 'islamic' ? 'text-emerald-500' : 'text-blue-500'
                  )}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-4xl font-bold">{countdown}</span>
              </div>
            </div>

            {/* Quote Display */}
            <div className="p-4 bg-muted/50 rounded-lg border">
              <p className="text-sm italic leading-relaxed">
                "{currentQuote.text}"
              </p>
              <p className="text-xs text-muted-foreground mt-2">— {currentQuote.source}</p>
            </div>

            {countdown > 0 ? (
              <p className={cn(
                "text-sm",
                mode === 'islamic' ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
              )}>
                {labels.impulseControl.countdownText} {countdown}s
              </p>
            ) : (
              <div className={cn(
                "p-3 rounded-lg",
                mode === 'islamic' ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'bg-blue-50 dark:bg-blue-950/30'
              )}>
                <CheckCircle2 className={cn(
                  "h-8 w-8 mx-auto mb-2",
                  mode === 'islamic' ? 'text-emerald-500' : 'text-blue-500'
                )} />
                <p className={cn(
                  "font-medium",
                  mode === 'islamic' ? 'text-emerald-700 dark:text-emerald-300' : 'text-blue-700 dark:text-blue-300'
                )}>
                  {labels.impulseControl.successMessage} 🎉
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            {countdown > 0 && (
              <Button 
                variant="destructive" 
                onClick={handleSuccumb}
                className="flex-1"
              >
                I gave in...
              </Button>
            )}
            <Button 
              onClick={handleClose}
              className="flex-1"
              variant={countdown > 0 ? "outline" : "default"}
            >
              {countdown > 0 ? "I'm okay now" : "Close"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
