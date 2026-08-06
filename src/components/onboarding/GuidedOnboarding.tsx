import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Target, Moon, Sun, CheckCircle2, 
  ArrowRight, ArrowLeft, Rocket, BookOpen, Shield,
  Bell, BarChart3, Heart
} from 'lucide-react';

interface GuidedOnboardingProps {
  isOpen: boolean;
  onComplete: (mode: 'islamic' | 'dunya') => void;
}

const steps = [
  {
    id: 'welcome',
    title: 'Welcome to Life OS 🚀',
    subtitle: 'Your personal operating system for life',
    description: 'Track habits, build discipline, and transform your life — one day at a time.',
    icon: Rocket,
    gradient: 'from-primary to-accent',
  },
  {
    id: 'mode',
    title: 'Choose Your Path',
    subtitle: 'How would you like to use Life OS?',
    description: 'This personalizes your entire experience.',
    icon: Heart,
    gradient: 'from-emerald-500 to-teal-500',
    isChoice: true,
  },
  {
    id: 'features',
    title: 'What You Get',
    subtitle: 'Powerful tools at your fingertips',
    icon: Sparkles,
    gradient: 'from-purple-500 to-pink-500',
    features: [
      { icon: Target, label: 'Weighted Habit Engine', desc: 'Build, Reduce, Replace habits with scoring' },
      { icon: BarChart3, label: 'Life Calendar', desc: '4000-week grid of your entire life' },
      { icon: Shield, label: 'Shield Mode', desc: 'Block distractions and stay focused' },
      { icon: Bell, label: 'Smart Alerts', desc: 'Streak danger, prayer reminders, nudges' },
    ],
  },
  {
    id: 'ready',
    title: "You're All Set! 🎉",
    subtitle: 'Start your transformation today',
    description: 'Begin with daily input — consistency compounds over time.',
    icon: CheckCircle2,
    gradient: 'from-emerald-500 to-green-500',
  },
];

export default function GuidedOnboarding({ isOpen, onComplete }: GuidedOnboardingProps) {
  const [step, setStep] = useState(0);
  const [selectedMode, setSelectedMode] = useState<'islamic' | 'dunya' | null>(null);

  const current = steps[step];
  const Icon = current.icon;
  const progress = ((step + 1) / steps.length) * 100;

  const handleNext = () => {
    if (current.id === 'mode' && !selectedMode) return;
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem('guided_onboarding_complete', 'true');
      onComplete(selectedMode || 'dunya');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden [&>button]:hidden border-0">
        {/* Progress */}
        <div className="h-1 bg-muted">
          <motion.div 
            className="h-full bg-gradient-to-r from-primary to-accent"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="p-6"
          >
            {/* Icon */}
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5',
              `bg-gradient-to-br ${current.gradient}`
            )}>
              <Icon className="h-8 w-8 text-white" />
            </div>

            {/* Content */}
            <div className="text-center space-y-2 mb-6">
              <h2 className="text-xl font-bold">{current.title}</h2>
              <p className="text-sm text-muted-foreground">{current.subtitle}</p>
              {current.description && (
                <p className="text-xs text-muted-foreground">{current.description}</p>
              )}
            </div>

            {/* Mode Selection */}
            {current.isChoice && (
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  onClick={() => setSelectedMode('islamic')}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all text-center',
                    selectedMode === 'islamic'
                      ? 'border-emerald-500 bg-emerald-500/10'
                      : 'border-border hover:border-emerald-500/50'
                  )}
                >
                  <Moon className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                  <span className="font-semibold text-sm block">Islamic Mode</span>
                  <span className="text-[10px] text-muted-foreground">Salah, Quran, Akhirah focus</span>
                </button>
                <button
                  onClick={() => setSelectedMode('dunya')}
                  className={cn(
                    'p-4 rounded-xl border-2 transition-all text-center',
                    selectedMode === 'dunya'
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-border hover:border-blue-500/50'
                  )}
                >
                  <Sun className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                  <span className="font-semibold text-sm block">Productivity</span>
                  <span className="text-[10px] text-muted-foreground">Goals, habits, analytics</span>
                </button>
              </div>
            )}

            {/* Features List */}
            {current.features && (
              <div className="space-y-2 mb-6">
                {current.features.map((f, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/50"
                  >
                    <f.icon className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{f.label}</p>
                      <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between p-4 border-t">
          <div>
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => { 
                localStorage.setItem('guided_onboarding_complete', 'true');
                onComplete('dunya');
              }}>
                Skip
              </Button>
            )}
          </div>
          
          <div className="flex gap-1">
            {steps.map((_, i) => (
              <div key={i} className={cn(
                'h-1.5 rounded-full transition-all',
                i === step ? 'w-6 bg-primary' : i < step ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-muted-foreground/30'
              )} />
            ))}
          </div>

          <Button 
            size="sm" 
            onClick={handleNext}
            disabled={current.isChoice && !selectedMode}
          >
            {step === steps.length - 1 ? 'Start' : 'Next'}
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
