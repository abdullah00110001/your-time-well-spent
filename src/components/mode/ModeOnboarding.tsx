import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppMode, AppMode } from '@/contexts/AppModeContext';
import { Moon, Sun, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModeOnboardingProps {
  isOpen: boolean;
  onComplete: () => void;
}

export default function ModeOnboarding({ isOpen, onComplete }: ModeOnboardingProps) {
  const { setMode } = useAppMode();
  const [selectedMode, setSelectedMode] = useState<AppMode | null>(null);

  const handleConfirm = () => {
    if (selectedMode) {
      setMode(selectedMode);
      localStorage.setItem('mode_onboarding_complete', 'true');
      onComplete();
    }
  };

  const modes = [
    {
      value: 'islamic' as AppMode,
      label: 'Islamic Mode',
      icon: Moon,
      description: 'Faith-centered productivity',
      features: [
        { text: 'Salah & Quran tracking', emoji: '🕌' },
        { text: 'Niyyah (intention) validator', emoji: '📿' },
        { text: 'Tahajjud analytics', emoji: '🌙' },
        { text: 'Akhirah-weighted scoring', emoji: '☪️' },
        { text: 'Quranic mood anchors', emoji: '📖' },
      ],
      gradient: 'from-emerald-500 to-teal-600',
      lightBg: 'bg-emerald-50 dark:bg-emerald-950/30',
      borderActive: 'border-emerald-500',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      buttonClass: 'bg-emerald-600 hover:bg-emerald-700',
    },
    {
      value: 'regular' as AppMode,
      label: 'Regular Mode',
      icon: Sun,
      description: 'Secular productivity',
      features: [
        { text: 'Morning routine tracking', emoji: '⏰' },
        { text: 'Purpose validator', emoji: '🎯' },
        { text: '5 AM Club analytics', emoji: '🌅' },
        { text: 'Legacy-weighted scoring', emoji: '⚖️' },
        { text: 'Stoic wisdom anchors', emoji: '📚' },
      ],
      gradient: 'from-blue-500 to-indigo-600',
      lightBg: 'bg-blue-50 dark:bg-blue-950/30',
      borderActive: 'border-blue-500',
      iconBg: 'bg-blue-100 dark:bg-blue-900/50',
      iconColor: 'text-blue-600 dark:text-blue-400',
      buttonClass: 'bg-blue-600 hover:bg-blue-700',
    },
  ];

  const selectedModeData = modes.find(m => m.value === selectedMode);

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-2xl mx-auto [&>button]:hidden overflow-hidden p-4 sm:p-6">
        {/* Animated background gradient */}
        <div 
          className={cn(
            "absolute inset-0 opacity-10 transition-all duration-700",
            selectedMode === 'islamic' && "bg-gradient-to-br from-emerald-500 to-teal-600",
            selectedMode === 'regular' && "bg-gradient-to-br from-blue-500 to-indigo-600",
            !selectedMode && "bg-gradient-to-br from-primary/20 to-accent/20"
          )}
        />

        <DialogHeader className="text-center relative z-10">
          <div className={cn(
            "mx-auto w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 transition-all duration-500",
            selectedMode 
              ? selectedModeData?.iconBg 
              : "bg-primary/10"
          )}>
            <Sparkles className={cn(
              "h-6 w-6 sm:h-7 sm:w-7 transition-all duration-500",
              selectedMode 
                ? selectedModeData?.iconColor 
                : "text-primary"
            )} />
          </div>
          <DialogTitle className="text-xl sm:text-2xl md:text-3xl font-bold">Choose Your Experience</DialogTitle>
          <DialogDescription className="text-sm sm:text-base md:text-lg">
            Select a mode that aligns with your values. You can change this anytime.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 py-4 sm:py-6 relative z-10 max-h-[50vh] overflow-y-auto">
          {modes.map((m) => {
            const Icon = m.icon;
            const isSelected = selectedMode === m.value;
            return (
              <button
                key={m.value}
                onClick={() => setSelectedMode(m.value)}
                className={cn(
                  "p-3 sm:p-5 rounded-2xl border-2 text-left transition-all duration-300",
                  "hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-ring",
                  "transform hover:scale-[1.02]",
                  isSelected
                    ? cn(m.borderActive, m.lightBg, "shadow-xl scale-[1.02]")
                    : "border-border hover:border-muted-foreground/50 bg-card/50"
                )}
              >
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <div className={cn(
                    "p-2 sm:p-3 rounded-xl transition-all duration-300 shrink-0",
                    isSelected ? m.iconBg : "bg-muted"
                  )}>
                    <Icon className={cn(
                      "h-5 w-5 sm:h-6 sm:w-6 transition-all duration-300",
                      isSelected ? m.iconColor : "text-muted-foreground"
                    )} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-base sm:text-lg truncate">{m.label}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{m.description}</p>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className={cn("h-5 w-5 shrink-0", m.iconColor)} />
                  )}
                </div>
                <ul className="space-y-1.5 sm:space-y-2.5">
                  {m.features.map((feature, idx) => (
                    <li 
                      key={idx} 
                      className={cn(
                        "text-xs sm:text-sm flex items-center gap-2 p-1.5 sm:p-2 rounded-lg transition-all duration-300",
                        isSelected ? "bg-background/60" : "bg-transparent"
                      )}
                    >
                      <span className="text-sm sm:text-base shrink-0">{feature.emoji}</span>
                      <span className={cn(
                        "transition-colors duration-300 truncate",
                        isSelected ? "text-foreground font-medium" : "text-muted-foreground"
                      )}>
                        {feature.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-2 sm:gap-3 relative z-10 pt-2">
          <Button
            size="lg"
            onClick={handleConfirm}
            disabled={!selectedMode}
            className={cn(
              "w-full sm:w-auto sm:min-w-[220px] h-11 sm:h-12 text-sm sm:text-base font-semibold transition-all duration-300",
              selectedMode && selectedModeData?.buttonClass
            )}
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          <p className="text-xs text-muted-foreground">
            You can change this later in Settings
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}