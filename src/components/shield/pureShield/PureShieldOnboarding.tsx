// Focus Shield V2.0 - Unique Light Ritual Design. No Blue. No Clone.
// 3-step first-run onboarding for PureShield.

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { EyeOff, ListChecks, Gauge, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const GOLD = 'hsl(var(--primary))';
const EMBER = 'hsl(var(--primary))';

interface Props {
  open: boolean;
  /** `dontShowAgain` is true when the user ticked the checkbox. */
  onFinish: (dontShowAgain: boolean) => void;
  /** Real installed apps from the native bridge. */
  installedApps?: { packageName: string; appName: string }[];
  /** Packages PureShield is currently targeting. */
  targetApps?: string[];
  /** Persists the selection natively. */
  onToggleApp?: (pkg: string) => void | Promise<void>;
}

export function PureShieldOnboarding({
  open,
  onFinish,
  installedApps = [],
  targetApps = [],
  onToggleApp,
}: Props) {
  const [step, setStep] = useState(0);
  const [dontShow, setDontShow] = useState(false);

  // Only the first few apps — the full picker lives in the Apps tab.
  const appList = installedApps.slice(0, 6);

  const steps = [
    {
      icon: EyeOff,
      title: 'PureShield: AI Garden Filter',
      text: 'We blur 18+ content to protect your attention.',
      body: <BlurredFaceArt />,
    },
    {
      icon: ListChecks,
      title: 'Select Apps First',
      text: 'Choose which apps PureShield will run on.',
      body: appList.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
          No installed apps detected yet. Open the <span className="font-medium text-foreground">Apps</span> tab
          after this setup to pick the apps PureShield should watch.
        </div>
      ) : (
        <div className="space-y-2">
          {appList.map((app) => {
            const on = targetApps.includes(app.packageName);
            return (
              <button
                key={app.packageName}
                type="button"
                onClick={() => onToggleApp?.(app.packageName)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors',
                  on ? 'border-[hsl(var(--primary))]/60 bg-[hsl(var(--primary))]/10' : 'border-border/60 bg-muted/30',
                )}
              >
                <span
                  className={cn(
                    'h-5 w-5 rounded-md flex items-center justify-center border',
                    on ? 'border-transparent' : 'border-border',
                  )}
                  style={on ? { background: GOLD } : undefined}
                >
                  {on && <Check className="h-3.5 w-3.5 text-black" />}
                </span>
                <span className="font-medium truncate">{app.appName}</span>
              </button>
            );
          })}
        </div>
      ),
    },

    {
      icon: Gauge,
      title: 'Performance Tip',
      text: 'If phone feels slow, go to Settings > PureShield > Performance Mode > Low.',
      body: (
        <div className="rounded-xl border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 p-3 text-xs leading-relaxed">
          Low mode samples fewer frames and detects fewer faces per frame — noticeably
          lighter on older devices. You can change it any time.
        </div>
      ),
    },
  ];

  const current = steps[step];
  const Icon = current.icon;
  const isLast = step === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onFinish(dontShow)}>
      <DialogContent className="max-w-[360px] rounded-2xl border-border/60 p-0 overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="h-11 w-11 rounded-xl flex items-center justify-center bg-primary/10"
            >
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-base leading-tight">{current.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{current.text}</p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.25 }}
            >
              {current.body}
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center gap-1.5 justify-center pt-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: i === step ? 20 : 6,
                  background: i === step ? GOLD : 'hsl(var(--muted-foreground) / 0.3)',
                }}
              />
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={dontShow} onCheckedChange={(v) => setDontShow(!!v)} />
            Don&apos;t show again
          </label>

          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" className="flex-1" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            )}
            <Button
              className="flex-1 font-semibold"
              onClick={() => (isLast ? onFinish(dontShow) : setStep((s) => s + 1))}
            >
              {isLast ? 'Got it' : 'Next'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Inline SVG of a blurred face — no external images. */
function BlurredFaceArt() {
  return (
    <svg viewBox="0 0 200 120" className="w-full h-28" role="img" aria-label="Blurred face illustration">
      <defs>
        <filter id="ps-blur"><feGaussianBlur stdDeviation="6" /></filter>
        <linearGradient id="ps-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={GOLD} />
          <stop offset="100%" stopColor={EMBER} />
        </linearGradient>
      </defs>
      <rect width="200" height="120" rx="12" fill="hsl(var(--muted))" />
      <g filter="url(#ps-blur)">
        <circle cx="100" cy="52" r="26" fill="url(#ps-gold)" opacity="0.85" />
        <ellipse cx="100" cy="106" rx="44" ry="24" fill="url(#ps-gold)" opacity="0.5" />
      </g>
      <rect x="62" y="24" width="76" height="60" rx="10" fill="none" stroke={GOLD} strokeWidth="2" strokeDasharray="6 5" />
    </svg>
  );
}

export default PureShieldOnboarding;
