import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import type { BlurStyle } from './types';

interface TestBlurDemoProps {
  open: boolean;
  onClose: () => void;
  style?: BlurStyle;
}

/**
 * Pure UI demo — no actual face detection.
 * Shows a stylized "person" silhouette and applies the selected blur style on top
 * to communicate what filtering will look like.
 */
export function TestBlurDemo({ open, onClose, style = 'PIXELATE' }: TestBlurDemoProps) {
  const [intensity, setIntensity] = useState(70);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setPulse((p) => p + 1), 1800);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;

  const overlayClass = cn(
    'absolute inset-0 transition-all duration-300',
    style === 'PIXELATE' && '[background-image:repeating-linear-gradient(0deg,hsl(var(--primary)/0.6)_0_4px,transparent_4px_8px),repeating-linear-gradient(90deg,hsl(var(--primary)/0.6)_0_4px,transparent_4px_8px)] [background-size:10px_10px]',
    style === 'FROSTED' && 'backdrop-blur-xl bg-white/30 dark:bg-white/10',
    style === 'SOLID' && 'bg-foreground',
    style === 'MOSAIC' && '[background-image:radial-gradient(circle_at_30%_30%,hsl(var(--primary)/0.7)_2px,transparent_3px),radial-gradient(circle_at_70%_60%,hsl(var(--violet-500)/0.6)_2px,transparent_3px)] [background-size:14px_14px] bg-foreground/40',
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div>
          <h2 className="font-semibold text-base">Test Blur Preview</h2>
          <p className="text-[11px] text-muted-foreground">Style: {style}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close demo">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <div className="relative w-64 h-80 rounded-3xl overflow-hidden bg-gradient-to-br from-amber-100 via-orange-100 to-rose-100 dark:from-amber-950/40 dark:via-orange-950/40 dark:to-rose-950/40 border border-border/50">
          {/* Mock "person" silhouette */}
          <div className="absolute inset-0 flex items-end justify-center">
            <div className="w-44 h-56 rounded-t-[100px] bg-gradient-to-b from-amber-300/60 to-amber-500/40 dark:from-amber-700/40 dark:to-amber-900/40" />
          </div>
          {/* Face circle */}
          <motion.div
            key={pulse}
            initial={{ scale: 0.95, opacity: 0.85 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="absolute top-10 left-1/2 -translate-x-1/2 w-32 h-32"
          >
            <div className="relative w-full h-full rounded-full bg-amber-400/80 dark:bg-amber-700/60 border-2 border-primary shadow-[0_0_24px_-6px] shadow-primary/50">
              <div
                className={overlayClass}
                style={{ opacity: intensity / 100, borderRadius: '9999px' }}
              />
              {/* Bounding box hint */}
              <div className="absolute -inset-1 rounded-full ring-2 ring-primary/40" />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-mono text-primary bg-background/80 px-2 py-0.5 rounded-full whitespace-nowrap">
                face · {intensity}%
              </div>
            </div>
          </motion.div>
        </div>

        <div className="w-full max-w-sm space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Blur intensity</span>
            <span className="font-medium text-primary">{intensity}%</span>
          </div>
          <Slider
            min={20}
            max={100}
            step={5}
            value={[intensity]}
            onValueChange={([v]) => setIntensity(v)}
            aria-label="Demo blur intensity"
          />
          <Button variant="outline" className="w-full" onClick={() => setPulse((p) => p + 1)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Replay detection
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">
            This is a UI preview. Real filtering runs only when PureShield is active inside target apps.
          </p>
        </div>
      </div>
    </div>
  );
}

export default TestBlurDemo;
