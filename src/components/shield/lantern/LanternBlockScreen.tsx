/**
 * LanternBlockScreen — the screen shown when a guarded app is opened.
 *
 * It is deliberately NOT an error page and NOT a punishment. It is the
 * containment field doing its job: the app you reached for enters at the
 * centre and is *magnetically repelled* outward past a ring that visibly
 * holds. Repeated attempts ripple the field instead of shaming you, and the
 * override cooldown is drawn as an arc depleting around the button so the
 * wait is felt rather than read.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck, ArrowLeft, Clock3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LanternBlockScreenProps {
  appName?: string;
  reason?: string;
  streakDays?: number;
  /** Seconds the user must sit with the pause before the bypass unlocks. */
  cooldownSeconds?: number;
  onLeave?: () => void;
  onBypass?: () => void;
  className?: string;
}

const RING_R = 46;
const RING_C = 2 * Math.PI * RING_R;
const EASE_HARD = [0.4, 0, 0.2, 1] as const;

export function LanternBlockScreen({
  appName = 'This app',
  reason,
  streakDays = 0,
  cooldownSeconds = 15,
  onLeave,
  onBypass,
  className,
}: LanternBlockScreenProps) {
  const reduce = useReducedMotion();
  const [remaining, setRemaining] = useState(cooldownSeconds);
  const [ripple, setRipple] = useState(0);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

  // Each breach attempt sends a ripple through the field — visible persistence,
  // no shaming copy.
  const pulseField = useCallback(() => setRipple((n) => n + 1), []);

  const savedReason = useMemo(() => {
    if (reason) return reason;
    try {
      return (
        localStorage.getItem('shield_block_screen_text') ||
        'You asked me to keep this door shut so the evening stays yours.'
      );
    } catch {
      return 'You asked me to keep this door shut.';
    }
  }, [reason]);

  const cooldownPct = cooldownSeconds > 0 ? remaining / cooldownSeconds : 0;

  return (
    <div
      className={cn(
        'shield-os relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-7 text-center',
        className,
      )}
      onClick={pulseField}
    >
      <div className="relative z-10 flex flex-col items-center">
        {/* The containment field */}
        <div className="relative mb-9 grid h-40 w-40 place-items-center">
          <motion.span
            key={ripple}
            className={cn(
              'absolute inset-0 rounded-full border border-primary/50',
              ripple > 0 && !reduce && 'shield-ripple',
            )}
            aria-hidden
          />
          <span className="absolute inset-2 rounded-full border border-border" aria-hidden />
          <span className="absolute inset-6 rounded-full border border-border/70" aria-hidden />

          {/* the repelled app, pushed out past the ring */}
          <motion.span
            className="absolute rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold text-muted-foreground"
            initial={reduce ? false : { scale: 1, y: 0, opacity: 1 }}
            animate={{ scale: 0.86, y: 74, opacity: 0 }}
            transition={{ duration: 0.75, ease: EASE_HARD, delay: 0.15 }}
          >
            {appName}
          </motion.span>

          <motion.div
            className="grid h-[104px] w-[104px] place-items-center rounded-full border border-primary/40 bg-primary/10"
            initial={reduce ? false : { scale: 0.94, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.22, ease: EASE_HARD }}
          >
            <ShieldCheck className="h-9 w-9 text-primary" strokeWidth={1.6} />
          </motion.div>
        </div>

        <p className="lantern-label mb-3">The field is holding</p>

        <h1 className="mb-5 max-w-[16ch] text-[1.7rem] font-bold leading-tight text-foreground">
          {appName} stays closed for now
        </h1>

        <p className="mb-9 max-w-[26ch] text-sm leading-relaxed text-muted-foreground">
          “{savedReason}”
        </p>

        {streakDays > 0 && (
          <div className="mb-10 flex items-center gap-2 rounded-lg border border-border bg-card/70 px-4 py-2">
            <span className="font-mono text-lg font-bold tabular-nums text-primary">{streakDays}</span>
            <span className="lantern-label !mb-0">nights kept</span>
          </div>
        )}

        <button
          onClick={onLeave}
          className="mb-4 flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to my evening
        </button>

        {onBypass && (
          <div className="relative grid place-items-center">
            {remaining > 0 && (
              <svg
                viewBox="0 0 110 110"
                className="pointer-events-none absolute h-24 w-24 -rotate-90"
                aria-hidden
              >
                <circle cx="55" cy="55" r={RING_R} fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
                <circle
                  cx="55"
                  cy="55"
                  r={RING_R}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - cooldownPct)}
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                />
              </svg>
            )}
            <button
              onClick={() => (remaining <= 0 ? onBypass() : pulseField())}
              className="relative flex items-center gap-2 px-4 py-3 text-xs font-semibold text-muted-foreground"
            >
              {remaining > 0 ? (
                <>
                  <Clock3 className="h-3.5 w-3.5" />
                  <span className="font-mono tabular-nums">{remaining}s</span>
                </>
              ) : (
                <span className="underline underline-offset-4">Open anyway, just this once</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LanternBlockScreen;
