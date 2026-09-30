/**
 * NightArc — SECTION 2: the signature visualization for Sleep to Rise.
 *
 * A gradient arc spans the whole night: moon (target sleep time) on the left,
 * sun (rise alarm) on the right. A glowing dot marks the current time and
 * travels along the arc, updating every 60 seconds. When the current time is
 * outside the sleep→rise range the dot sits dimmed at the nearest edge.
 *
 * All timing comes from `computeNightWindows` / `describeStatus` in timeMath —
 * the same shared functions every other display uses, so nothing can disagree.
 * Honours `prefers-reduced-motion` (no travel animation, no pulsing glow).
 */

import { useEffect, useMemo, useState } from 'react';
import { computeNightWindows, describeStatus, formatClock, parseHM } from './timeMath';
import { cn } from '@/lib/utils';

interface NightArcProps {
  sleepTime: string;
  riseTime: string | null;
  lockBeforeMin: number;
  lockAfterMin: number;
  phase: string;
  /** Optional intermediate target from the Gradual Shift Assistant. */
  shiftTargetTime?: string | null;
  className?: string;
}

const W = 320;
const H = 136;
const ARC_Y = 116;
const ARC_TOP = 26;

function arcPoint(t: number) {
  const p0 = { x: 26, y: ARC_Y };
  const p1 = { x: W / 2, y: ARC_TOP - 46 };
  const p2 = { x: W - 26, y: ARC_Y };
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return reduced;
}

export function NightArc({
  sleepTime, riseTime, lockBeforeMin, lockAfterMin, phase, shiftTargetTime, className,
}: NightArcProps) {
  const [now, setNow] = useState(() => new Date());
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const effectiveSleep = shiftTargetTime || sleepTime;

  const windows = useMemo(
    () => computeNightWindows({
      sleepTime: effectiveSleep, riseTime, lockBeforeMin, lockAfterMin, now,
    }),
    [effectiveSleep, riseTime, lockBeforeMin, lockAfterMin, now],
  );

  const inNight = windows.inNight;
  // Outside the window the marker rests at the nearest edge (dimmed).
  const t = inNight
    ? windows.nightProgress
    : windows.untilSleepGuard <= (1440 - windows.untilSleepGuard) ? 0 : 1;
  const dot = useMemo(() => arcPoint(t), [t]);

  const { primary, secondary } = useMemo(() => describeStatus(windows, phase), [windows, phase]);
  const dawn = phase === 'rise-lock';

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={primary}>
        <defs>
          <linearGradient id="n2r-arc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.45" />
            <stop offset="50%" stopColor="var(--stf-accent)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="hsl(var(--warning))" />
          </linearGradient>
          <radialGradient id="n2r-dot">
            <stop offset="0%" stopColor="var(--stf-accent)" />
            <stop offset="100%" stopColor="var(--stf-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Track */}
        <path
          d={`M 26 ${ARC_Y} Q ${W / 2} ${ARC_TOP - 46} ${W - 26} ${ARC_Y}`}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.5"
        />
        <path
          d={`M 26 ${ARC_Y} Q ${W / 2} ${ARC_TOP - 46} ${W - 26} ${ARC_Y}`}
          fill="none"
          stroke="url(#n2r-arc)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Moon — start of the night */}
        <circle cx="26" cy={ARC_Y} r="10" fill="hsl(var(--card))" stroke="var(--stf-accent)" strokeWidth="1.5" />
        <path d="M 29 112 a 5 5 0 1 1 -5 -5 a 4 4 0 0 0 5 5 z" fill="var(--stf-accent)" />

        {/* Sun — end of the night */}
        <circle cx={W - 26} cy={ARC_Y} r="10" fill="hsl(var(--card))" stroke="hsl(var(--warning))" strokeWidth="1.5" />
        <circle cx={W - 26} cy={ARC_Y} r="4" fill="hsl(var(--warning))" />

        {/* Current-time marker */}
        <g
          style={reducedMotion ? undefined : { transition: 'transform 1.5s ease' }}
          opacity={inNight ? 1 : 0.35}
        >
          <circle
            cx={dot.x} cy={dot.y} r="16"
            fill="url(#n2r-dot)"
            opacity={inNight ? 0.5 : 0.2}
            className={inNight && !reducedMotion ? 'n2r-dawn-glow' : undefined}
          />
          <circle cx={dot.x} cy={dot.y} r="5" fill={dawn ? 'hsl(var(--warning))' : 'var(--stf-accent)'} />
        </g>
      </svg>

      <div className="mt-1 flex items-center justify-between px-1">
        <span className="n2r-mono text-[11px] n2r-muted">{formatClock(parseHM(effectiveSleep))}</span>
        <span className="n2r-mono text-[11px] n2r-muted">{riseTime ? formatClock(parseHM(riseTime)) : 'No alarm'}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="n2r-pill" data-tone={dawn ? 'dawn' : undefined}>{primary}</span>
        <span className="n2r-pill">{secondary}</span>
      </div>
    </div>
  );
}

export default NightArc;
