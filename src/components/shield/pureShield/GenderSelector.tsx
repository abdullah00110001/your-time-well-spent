import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BlurGender } from './types';

interface GenderSelectorProps {
  selectedGender: BlurGender;
  onGenderChange: (g: BlurGender) => void;
}

const OPTIONS: { value: BlurGender; emoji: string; label: string; ring: string; bg: string }[] = [
  { value: 'FEMALE', emoji: '👩', label: 'Female', ring: 'ring-pink-500/60', bg: 'bg-pink-500/10' },
  { value: 'MALE', emoji: '👨', label: 'Male', ring: 'ring-blue-500/60', bg: 'bg-blue-500/10' },
  { value: 'BOTH', emoji: '👥', label: 'Both', ring: 'ring-violet-500/60', bg: 'bg-violet-500/10' },
];

export function GenderSelector({ selectedGender, onGenderChange }: GenderSelectorProps) {
  return (
    <div className="grid grid-cols-3 gap-2.5" role="radiogroup" aria-label="Gender to blur">
      {OPTIONS.map((opt) => {
        const selected = selectedGender === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onGenderChange(opt.value)}
            className={cn(
              'relative rounded-2xl p-4 border text-center transition-all duration-200 active:scale-[0.97]',
              selected
                ? `border-transparent ring-2 ${opt.ring} ${opt.bg}`
                : 'border-border/50 bg-card hover:border-border',
            )}
          >
            {selected && (
              <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </span>
            )}
            <div className="text-3xl mb-1.5" aria-hidden>{opt.emoji}</div>
            <div className="text-xs font-medium">{opt.label}</div>
          </button>
        );
      })}
    </div>
  );
}

export default GenderSelector;
