/**
 * NightArc — the signature visualization for Sleep to Rise.
 *
 * A thin gradient arc spans the whole night: moon (target sleep time) on the
 * left, sun (rise alarm) on the right. A glowing dot marks the current time
 * and travels along the arc in real time. Below it, two small pills describe
 * what happens next ("Sleep in 2h 10m" / "Rise Guard active — 18m left").
 */

import { useEffect, useMemo, useState } from 'react';

interface NightArcProps {
  /** "HH:MM" target sleep time. */
  sleepTime: string;
  /** "HH:MM" rise alarm time, or null when none is set. */
  riseTime: string | null;
  /** Minutes the lock starts before the target sleep time. */
  lockBeforeMin: number;
  /** Minutes the lock stays on after the alarm. */
  lockAfterMin: number;
  phase: string;
}

const W = 320;
const H = 132;
const ARC_Y = 116;
const ARC_TOP = 26;

function parseHM(s: string) {
  const [h, m] = s.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Point on the quadratic arc for t in [0,1]. */
function arcPoint(t: number) {
  const p0 = { x: 24, y: ARC_Y };
  const p1 = { x: W / 2, y: ARC_TOP - 44 };
  const p2 = { x: W - 24, y: ARC_Y };
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function fmtGap(mins: number) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtClock(hm: number) {
  const h = Math.floor(hm / 60) % 24;
  const m = hm % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export function NightArc({ sleepTime, riseTime, lockBeforeMin, lockAfterMin, phase }: NightArcProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 20_000);
    return () => clearInterval(t);
  }, []);

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = (parseHM(sleepTime) - lockBeforeMin + 1440) % 1440;
  const endMin = riseTime ? (parseHM(riseTime) + lockAfterMin) % 1440 : (parseHM(sleepTime) + 570) % 1440;

  const span = (endMin - startMin + 1440) % 1440 || 1440;
  const elapsed = (nowMin - startMin + 1440) % 1440;
  const inWindow = elapsed < span;
  const t = inWindow ? elapsed / span : 0;

  const dot = useMemo(() => arcPoint(t), [t]);

  const { primary, secondary } = useMemo(() => {
    if (phase === 'rise-lock') {
      const left = riseTime ? ((parseHM(riseTime) + lockAfterMin - nowMin + 1440) % 1440) : lockAfterMin;
      return { primary: `Rise Guard active — ${fmtGap(left)} left`, secondary: 'Screens stay closed a little longer' };
    }
    if (phase === 'sleep-lock') {
      const left = (endMin - nowMin + 1440) % 1440;
      return { primary: `Sleep Guard active — ${fmtGap(left)} left`, secondary: 'Rest now, the phone can wait' };
    }
    if (phase === 'paused') return { primary: 'Paused tonight', secondary: 'Protection resumes tomorrow' };
    if (phase === 'inactive-day') return { primary: 'Not scheduled tonight', secondary: 'No lock will run' };
    if (phase === 'off') return { primary: 'Protection off', secondary: 'Turn it on to begin' };
    const until = (startMin - nowMin + 1440) % 1440;
    return { primary: `Sleep Guard in ${fmtGap(until)}`, secondary: `Wind-down starts at ${fmtClock(startMin)}` };
  }, [phase, nowMin, startMin, endMin, riseTime, lockAfterMin]);

  const dawn = phase === 'rise-lock';

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={primary}>
        <defs>
          <linearGradient id="n2r-arc" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#8FA8CC" stopOpacity="0.55" />
            <stop offset="45%" stopColor="#4A3B6B" stopOpacity="0.9" />
            <stop offset="80%" stopColor="#FF9B71" />
            <stop offset="100%" stopColor="#FFC978" />
          </linearGradient>
          <radialGradient id="n2r-dot">
            <stop offset="0%" stopColor="#F5F1E8" />
            <stop offset="100%" stopColor="#F5F1E8" stopOpacity="0" />
          </radialGradient>
        </defs>

        <path
          d={`M 24 ${ARC_Y} Q ${W / 2} ${ARC_TOP - 44} ${W - 24} ${ARC_Y}`}
          fill="none"
          stroke="url(#n2r-arc)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* Moon — start of the night */}
        <circle cx="24" cy={ARC_Y} r="9" fill="#161B33" stroke="#8FA8CC" strokeWidth="1.5" />
        <path d="M 27 112 a 5 5 0 1 1 -5 -5 a 4 4 0 0 0 5 5 z" fill="#8FA8CC" />

        {/* Sun — end of the night */}
        <circle cx={W - 24} cy={ARC_Y} r="9" fill="#161B33" stroke="#FFC978" strokeWidth="1.5" />
        <circle cx={W - 24} cy={ARC_Y} r="4" fill="#FFC978" />

        {/* Current time marker */}
        {inWindow && (
          <g style={{ transition: 'transform 1.5s ease' }}>
            <circle cx={dot.x} cy={dot.y} r="14" fill="url(#n2r-dot)" opacity="0.45" />
            <circle cx={dot.x} cy={dot.y} r="4.5" fill={dawn ? '#FFC978' : '#F5F1E8'} />
          </g>
        )}
      </svg>

      <div className="mt-1 flex items-center justify-between px-1">
        <span className="n2r-mono text-[11px] n2r-muted">{fmtClock(parseHM(sleepTime))}</span>
        <span className="n2r-mono text-[11px] n2r-muted">{riseTime ? fmtClock(parseHM(riseTime)) : 'No alarm'}</span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="n2r-pill" data-tone={dawn ? 'dawn' : undefined}>{primary}</span>
        <span className="n2r-pill">{secondary}</span>
      </div>
    </div>
  );
}

export default NightArc;
