import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Heart, Briefcase, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppMode } from '@/contexts/AppModeContext';

interface NiyyahValidatorProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (niyyah: string, multiplier: number) => void;
  sessionType?: string;
}

export default function NiyyahValidator({ isOpen, onClose, onConfirm, sessionType = 'study' }: NiyyahValidatorProps) {
  const [selectedNiyyah, setSelectedNiyyah] = useState<string>('');
  const { mode, labels } = useAppMode();

  const niyyahOptions = [
    {
      value: 'divine',
      label: labels.intentionValidator.optionDivine,
      description: mode === 'islamic' 
        ? 'Seeking knowledge to serve Allah and the Ummah'
        : 'Working toward your greater purpose and mission',
      multiplier: 2,
      icon: Heart,
      color: mode === 'islamic' ? 'text-emerald-500' : 'text-blue-500',
      bgColor: mode === 'islamic' 
        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
        : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    },
    {
      value: 'career',
      label: labels.intentionValidator.optionWorld,
      description: mode === 'islamic'
        ? 'Building skills for worldly success'
        : 'Developing career and professional growth',
      multiplier: 1,
      icon: Briefcase,
      color: 'text-slate-500',
      bgColor: 'bg-slate-50 dark:bg-slate-950/30 border-slate-200 dark:border-slate-800',
    },
    {
      value: 'ego',
      label: labels.intentionValidator.optionEgo,
      description: mode === 'islamic'
        ? 'Seeking recognition from people'
        : 'Working primarily for external validation',
      multiplier: 0,
      icon: Crown,
      color: 'text-rose-500',
      bgColor: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800',
    },
  ];

  const handleConfirm = () => {
    const option = niyyahOptions.find(o => o.value === selectedNiyyah);
    if (option) {
      onConfirm(option.value, option.multiplier);
      setSelectedNiyyah('');
    }
  };

  const selectedOption = niyyahOptions.find(o => o.value === selectedNiyyah);
  const primaryColor = mode === 'islamic' ? 'emerald' : 'blue';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">
            {mode === 'islamic' ? '🕋' : '🎯'} {labels.intentionValidator.title}
          </DialogTitle>
          <DialogDescription className="text-center">
            {labels.intentionValidator.subtitle}
            <br />
            <span className="text-muted-foreground italic">
              {labels.intentionValidator.quote}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-center text-lg font-medium mb-4">{labels.intentionValidator.question}</p>
          
          <RadioGroup value={selectedNiyyah} onValueChange={setSelectedNiyyah} className="space-y-3">
            {niyyahOptions.map((option) => {
              const Icon = option.icon;
              return (
                <div key={option.value}>
                  <RadioGroupItem
                    value={option.value}
                    id={option.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={option.value}
                    className={cn(
                      "flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all",
                      "hover:shadow-md",
                      selectedNiyyah === option.value ? option.bgColor : "border-border"
                    )}
                  >
                    <Icon className={cn("h-6 w-6", option.color)} />
                    <div className="flex-1">
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                    <div className={cn(
                      "px-2 py-1 rounded text-xs font-bold",
                      option.multiplier === 2 
                        ? mode === 'islamic'
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : option.multiplier === 1 
                          ? "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
                    )}>
                      {option.multiplier}x
                    </div>
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {selectedOption && selectedOption.multiplier === 0 && (
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-800 dark:text-amber-200 text-center">
                ⚠️ {labels.intentionValidator.egoWarning}
              </p>
            </div>
          )}

          {selectedOption && selectedOption.multiplier === 2 && (
            <div className={cn(
              "mt-4 p-3 rounded-lg border",
              mode === 'islamic'
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
            )}>
              <p className={cn(
                "text-sm text-center",
                mode === 'islamic'
                  ? "text-emerald-800 dark:text-emerald-200"
                  : "text-blue-800 dark:text-blue-200"
              )}>
                ✨ {labels.intentionValidator.divineBonus}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!selectedNiyyah}
            className={cn(
              "flex-1",
              mode === 'islamic' && "bg-emerald-600 hover:bg-emerald-700",
              mode === 'regular' && "bg-blue-600 hover:bg-blue-700"
            )}
          >
            {labels.intentionValidator.confirmButton}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
