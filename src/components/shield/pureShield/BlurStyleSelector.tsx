import { cn } from '@/lib/utils';
import type { BlurStyle } from './types';

interface BlurStyleSelectorProps {
  selectedStyle: BlurStyle;
  onStyleChange: (s: BlurStyle) => void;
}

const STYLES: { value: BlurStyle; icon: string; label: string; description: string; preview: string }[] = [
  {
    value: 'BLUR',
    icon: '◉',
    label: 'Blur',
    description: 'Soft gaussian',
    preview: 'bg-gradient-radial from-white/90 via-blue-100/70 to-blue-200/60 backdrop-blur-xl',
  },
  {
    value: 'PIXELATE',
    icon: '▦',
    label: 'Pixel',
    description: 'Blocky pixels',
    preview: '[background-image:linear-gradient(45deg,#d2aa82_25%,#b99169_25%,#b99169_50%,#d2aa82_50%,#d2aa82_75%,#b99169_75%)] [background-size:8px_8px]',
  },
  {
    value: 'SMUDGE',
    icon: '≋',
    label: 'Smudge',
    description: 'Smear effect',
    preview: '[background:repeating-linear-gradient(-35deg,rgba(160,165,175,0.55)_0px,rgba(160,165,175,0.55)_3px,rgba(248,250,255,0.9)_3px,rgba(248,250,255,0.9)_9px,rgba(140,148,165,0.45)_9px,rgba(140,148,165,0.45)_12px,rgba(248,250,255,0.9)_12px,rgba(248,250,255,0.9)_18px)]',
  },
  {
    value: 'DOTS',
    icon: '⁙',
    label: 'Dots',
    description: 'Dot grid',
    preview: 'bg-slate-100 [background-image:radial-gradient(circle,rgba(60,80,120,0.8)_1.5px,transparent_1.5px)] [background-size:7px_7px]',
  },
  {
    value: 'FROSTED',
    icon: '❄️',
    label: 'Frosted',
    description: 'Glass blur',
    preview: 'bg-gradient-to-br from-white/70 via-blue-100/50 to-blue-200/60 backdrop-blur',
  },
  {
    value: 'MOSAIC',
    icon: '◈',
    label: 'Mosaic',
    description: 'Tile mosaic',
    preview: '[background-image:linear-gradient(45deg,#0f172a_25%,#08919e_25%,#08919e_50%,#1e3a8a_50%,#1e3a8a_75%,#334155_75%)] [background-size:10px_10px]',
  },
  {
    value: 'SOLID',
    icon: '■',
    label: 'Solid',
    description: 'Dark solid',
    preview: 'bg-slate-900',
  },
];

export function BlurStyleSelector({ selectedStyle, onStyleChange }: BlurStyleSelectorProps) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2" role="radiogroup" aria-label="Blur style">
      {STYLES.map((s) => {
        const selected = selectedStyle === s.value;
        return (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onStyleChange(s.value)}
            className={cn(
              'rounded-2xl p-2.5 border text-center transition-all duration-200 active:scale-[0.97]',
              selected
                ? 'border-primary ring-2 ring-primary/40 bg-primary/5 shadow-[0_0_24px_-12px] shadow-primary/40'
                : 'border-border/50 bg-card hover:border-border',
            )}
          >
            {/* Preview box */}
            <div
              className={cn(
                'h-11 w-full rounded-lg mb-1.5 overflow-hidden flex items-center justify-center',
                s.preview,
              )}
            >
              {/* BLUR — soft radial preview */}
              {s.value === 'BLUR' && (
                <div className="w-full h-full rounded-lg bg-gradient-radial from-white via-blue-50/80 to-blue-200/70 flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-white/60 blur-sm" />
                </div>
              )}
              {/* SOLID — shield icon */}
              {s.value === 'SOLID' && (
                <span className="text-white/70 text-base">🛡</span>
              )}
            </div>

            <div className="text-[11px] font-semibold leading-tight">{s.label}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{s.description}</div>
          </button>
        );
      })}
    </div>
  );
}

export default BlurStyleSelector;
