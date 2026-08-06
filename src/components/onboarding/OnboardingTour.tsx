import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Sparkles, Target, Calendar, ArrowRight, ArrowLeft, CheckCircle2, Rocket,
  Moon, Dumbbell, Brain, Shield, Users, Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext';

interface OnboardingTourProps {
  isOpen: boolean;
  onComplete: () => void;
}

const tourSteps = [
  {
    id: 'welcome',
    title: 'Welcome to Your Journey! 🎉',
    description: 'Oporajeyo helps you track every aspect of your life — spirituality, study, health, and discipline. Let us show you around!',
    icon: Sparkles,
    tip: 'Takes only 3 minutes',
  },
  {
    id: 'daily-input',
    title: 'Daily Life Input 📝',
    description: 'The heart of your tracking. Log everything about your day in one place — from salah to study hours to sleep quality.',
    icon: Calendar,
    tip: 'Best done every evening before sleep',
    features: [
      'Track all 5 daily prayers with on-time status',
      'Log study, revision & skill-learning hours',
      'Record Quran reading (surah, ayah range, type)',
      'Track screen time, social media & reels usage',
      'Exercise, sleep, mood & energy levels',
      'Daily reflection & biggest time leak',
    ],
  },
  {
    id: 'salah-tracking',
    title: 'Salah & Spiritual Growth 🕌',
    description: 'Track your spiritual journey with detailed salah logging, Quran progress, and khushu levels.',
    icon: Moon,
    tip: 'Consistency matters more than perfection',
    features: [
      'Mark each prayer: On-time, Qaza, or Missed',
      'Rate your khushu (concentration) level 1-5',
      'Track Quran reading type: Tilawat, Hifz, Tafsir',
      'Islamic dashboard with Akhirah/Dunya scores',
    ],
  },
  {
    id: 'health-fitness',
    title: 'Health & Fitness 💪',
    description: 'Monitor your physical well-being with exercise tracking, sleep analysis, and energy monitoring.',
    icon: Dumbbell,
    tip: 'Even 15 minutes of exercise counts',
    features: [
      'Log exercise type, intensity & duration',
      'Track sleep hours and quality (1-5 scale)',
      'Monitor energy and focus levels daily',
      'View correlations between sleep & productivity',
    ],
  },
  {
    id: 'habits-goals',
    title: 'Habits & Goals 🎯',
    description: 'Create custom habits tied to your yearly goals. Track streaks and build consistency.',
    icon: Target,
    tip: 'Start with 3-5 habits, add more later',
    features: [
      'Set yearly goals and break into habits',
      'Daily/weekly habit frequency options',
      'Streak tracking with visual heatmaps',
      'Quarterly goal reviews & adjustments',
    ],
  },
  {
    id: 'insights-analytics',
    title: 'Smart Insights & Analytics 📊',
    description: 'Understand your patterns with AI-powered insights, burnout detection, and life balance scoring.',
    icon: Brain,
    tip: 'Check weekly for best results',
    features: [
      'Mood-productivity correlation analysis',
      'Burnout detection & recovery suggestions',
      'Life balance score across all areas',
      'Comparative analytics: week vs week',
      'Predictive analytics for goal completion',
    ],
  },
  {
    id: 'shield-rise',
    title: 'Shield & Rise ⚡',
    description: 'Shield blocks distractions during focus time. Rise ensures you wake up for Fajr with smart alarms.',
    icon: Shield,
    tip: 'Use Shield during study sessions',
    features: [
      'Block distracting apps & websites',
      'Focus timer with discipline scoring',
      'Smart Fajr alarm with group wake-up',
      'Accountability partner system',
    ],
  },
  {
    id: 'community',
    title: 'Community & Challenges 👥',
    description: 'Join challenges, compete on leaderboards, and stay accountable with your group.',
    icon: Users,
    tip: 'Accountability partners boost success by 65%',
    features: [
      'Weekly & monthly community challenges',
      'Global leaderboard rankings',
      'Accountability groups & group wake-ups',
      'Share progress cards with friends',
    ],
  },
  {
    id: 'premium',
    title: 'Premium Features 👑',
    description: 'Unlock advanced analytics, AI coaching, unlimited features, and priority support.',
    icon: Crown,
    tip: 'Free trial available for all plans',
    features: [
      'Advanced AI-powered insights',
      'Unlimited habit & goal tracking',
      'Priority support & early features',
      'PDF tools & data export',
    ],
  },
  {
    id: 'ready',
    title: "You're All Set! 🚀",
    description: 'Start your journey today. Begin with Daily Input — log your first day and see the magic of tracking compound over time. Remember: consistency beats perfection.',
    icon: Rocket,
    tip: 'Start with Daily Input right now!',
  },
];

export default function OnboardingTour({ isOpen, onComplete }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { mode } = useAppMode();
  const isIslamic = mode === 'islamic';

  const step = tourSteps[currentStep];
  const Icon = step.icon;
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      localStorage.setItem('onboarding_tour_complete', 'true');
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleSkip = () => {
    localStorage.setItem('onboarding_tour_complete', 'true');
    onComplete();
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg [&>button]:hidden max-h-[90vh] overflow-y-auto">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-muted rounded-t-lg overflow-hidden">
          <div 
            className={cn("h-full transition-all duration-500 ease-out", isIslamic ? "bg-emerald-500" : "bg-primary")}
            style={{ width: `${progress}%` }}
          />
        </div>

        <DialogHeader className="text-center pt-4">
          <div className={cn(
            "mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300",
            isIslamic ? "bg-emerald-100 dark:bg-emerald-900/50" : "bg-primary/10"
          )}>
            <Icon className={cn("h-8 w-8 transition-all duration-300", isIslamic ? "text-emerald-600 dark:text-emerald-400" : "text-primary")} />
          </div>
          <DialogTitle className="text-xl sm:text-2xl">{step.title}</DialogTitle>
          <DialogDescription className="text-base mt-2">{step.description}</DialogDescription>
        </DialogHeader>

        {/* Features list */}
        {step.features && (
          <div className="py-3">
            <div className="space-y-1.5">
              {step.features.map((feature, idx) => (
                <div key={idx} className={cn("flex items-center gap-3 p-2.5 rounded-xl transition-all duration-300", "bg-muted/50 hover:bg-muted")}>
                  <CheckCircle2 className={cn("h-4 w-4 shrink-0", isIslamic ? "text-emerald-500" : "text-primary")} />
                  <span className="text-sm">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tip badge */}
        <div className={cn(
          "flex items-center justify-center gap-2 py-2 px-4 rounded-full mx-auto w-fit",
          isIslamic ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "bg-primary/10 text-primary"
        )}>
          <Sparkles className="h-4 w-4" />
          <span className="text-sm font-medium">{step.tip}</span>
        </div>

        {/* Step counter */}
        <p className="text-center text-xs text-muted-foreground">
          {currentStep + 1} / {tourSteps.length}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {currentStep > 0 ? (
              <Button variant="ghost" size="sm" onClick={handlePrev} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
                Skip tour
              </Button>
            )}
          </div>
          
          <div className="flex gap-1">
            {tourSteps.map((_, idx) => (
              <div
                key={idx}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  idx === currentStep 
                    ? cn("w-4", isIslamic ? "bg-emerald-500" : "bg-primary")
                    : idx < currentStep 
                      ? cn("w-1.5", isIslamic ? "bg-emerald-300" : "bg-primary/50")
                      : "w-1.5 bg-muted-foreground/30"
                )}
              />
            ))}
          </div>

          <Button 
            onClick={handleNext} size="sm"
            className={cn("gap-2", isIslamic && "bg-emerald-600 hover:bg-emerald-700")}
          >
            {currentStep === tourSteps.length - 1 ? 'Get Started' : 'Next'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
