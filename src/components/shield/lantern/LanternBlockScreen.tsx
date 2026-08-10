/**
 * LanternBlockScreen — the screen shown when a guarded app is opened.
 *
 * It is deliberately NOT an error page. It is a "keeper's pause": the lantern
 * is lit, the room is quiet, and the user is reminded of the reason THEY set
 * this up. Warm ember light on deep ink, one slow breath animation, and a
 * single low-emphasis escape hatch so the default path is to walk away.
 */
import { useEffect, useMemo, useState } from 'react';
import { Flame, ArrowLeft, Clock3 } from 'lucide-react';
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

export function LanternBlockScreen({
  appName = 'This app',
  reason,
  streakDays = 0,
  cooldownSeconds = 15,
  onLeave,
  onBypass,
  className,
}: LanternBlockScreenProps) {
  const [remaining, setRemaining] = useState(cooldownSeconds);

  useEffect(() => {
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining]);

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

  return (
    <div
      className={cn(
        'lantern relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-7 text-center',
        className,
      )}
    >
      {/* Ember light pooling from above */}
      <div className="lantern-pool pointer-events-none absolute inset-x-0 -top-24 h-80" aria-hidden />

      <div className="relative z-10 flex flex-col items-center">
        <div className="lantern-halo relative mb-9 grid h-28 w-28 place-items-center rounded-full">
          <Flame className="lantern-breathe h-11 w-11 text-primary" strokeWidth={1.5} />
        </div>

        <p className="lantern-label mb-3">The lantern is lit</p>

        <h1 className="mb-5 max-w-[16ch] font-bold text-[1.7rem] leading-tight text-foreground">
          {appName} stays closed for now
        </h1>

        <p className="mb-9 max-w-[26ch] text-sm leading-relaxed text-muted-foreground">
          “{savedReason}”
        </p>

        {streakDays > 0 && (
          <div className="mb-10 flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2">
            <span className="font-mono text-lg font-bold tabular-nums text-primary">{streakDays}</span>
            <span className="lantern-label !mb-0">nights kept</span>
          </div>
        )}

        <button
          onClick={onLeave}
          className="mb-4 flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-bold text-primary-foreground transition-transform active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to my evening
        </button>

        {onBypass && (
          <button
            onClick={() => remaining <= 0 && onBypass()}
            disabled={remaining > 0}
            className="flex items-center gap-2 py-2 text-xs font-semibold text-muted-foreground transition-opacity disabled:opacity-45"
          >
            {remaining > 0 ? (
              <>
                <Clock3 className="h-3.5 w-3.5" />
                <span className="font-mono tabular-nums">{remaining}s</span>
                <span>before an override is possible</span>
              </>
            ) : (
              <span className="underline underline-offset-4">Open anyway, just this once</span>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

export default LanternBlockScreen;
