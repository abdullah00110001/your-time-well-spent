import { useState, useEffect } from 'react';
import { AlertTriangle, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HabitFrictionProps {
  type: 'warning' | 'positive';
  trigger: 'high_device' | 'bad_habit' | 'good_habit_complete' | 'salah_complete' | 'quran_complete';
  value?: number;
  onDismiss: () => void;
}

const messages = {
  high_device: {
    title: "Moment of Reflection",
    message: "If you continue this, what are you losing? Your time, your potential, your connection with Allah...",
    subtext: "Every minute on screens could be a minute of dhikr, study, or rest.",
  },
  bad_habit: {
    title: "Gentle Warning",
    message: "This habit takes more than it gives. What truly matters to you?",
    subtext: "Ask yourself: Will this bring me closer to my goals?",
  },
  good_habit_complete: {
    title: "MashaAllah! ✨",
    message: "You've completed a positive habit. This is the person you're becoming.",
    subtext: "Small consistent actions build extraordinary results.",
  },
  salah_complete: {
    title: "Barakallahu Feek 🕌",
    message: "You've honored your prayer. The connection with Allah strengthens you.",
    subtext: "\"Indeed, prayer prohibits immorality and wrongdoing.\" (29:45)",
  },
  quran_complete: {
    title: "SubhanAllah 📖",
    message: "You've engaged with the Qur'an today. Light upon light.",
    subtext: "The Qur'an is guidance and healing for the believers.",
  },
};

export default function HabitFrictionSystem({ type, trigger, value, onDismiss }: HabitFrictionProps) {
  const [isVisible, setIsVisible] = useState(true);
  const content = messages[trigger];

  useEffect(() => {
    if (type === 'positive') {
      const timer = setTimeout(() => {
        setIsVisible(false);
        onDismiss();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [type, onDismiss]);

  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50 rounded-xl p-4 shadow-lg animate-in slide-in-from-bottom-4",
        type === 'warning' 
          ? "bg-amber-50 dark:bg-amber-950/90 border border-amber-200 dark:border-amber-800" 
          : "bg-emerald-50 dark:bg-emerald-950/90 border border-emerald-200 dark:border-emerald-800"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-full shrink-0",
          type === 'warning' ? "bg-amber-100 dark:bg-amber-900" : "bg-emerald-100 dark:bg-emerald-900"
        )}>
          {type === 'warning' ? (
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          ) : (
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className={cn(
              "font-semibold text-sm",
              type === 'warning' ? "text-amber-800 dark:text-amber-200" : "text-emerald-800 dark:text-emerald-200"
            )}>
              {content.title}
            </h4>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 shrink-0 opacity-70 hover:opacity-100"
              onClick={() => { setIsVisible(false); onDismiss(); }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className={cn(
            "text-sm mt-1",
            type === 'warning' ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"
          )}>
            {content.message}
          </p>
          <p className={cn(
            "text-xs mt-2 opacity-80",
            type === 'warning' ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
          )}>
            {content.subtext}
          </p>
          {value && type === 'warning' && (
            <p className="text-xs mt-2 font-medium text-amber-800 dark:text-amber-200">
              Current: {Math.round(value / 60)}h {value % 60}m screen time today
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
