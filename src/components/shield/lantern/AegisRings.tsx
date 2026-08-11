/**
 * AegisRings — Shield's identity object.
 *
 * A concentric containment field: the user sits at the centre and every active
 * protection is a lit arc of armour around them. Unlike a list of toggles, one
 * glance answers the only question that matters — "how much of me is covered?"
 *
 * Motion grammar is deliberately the opposite of Rise: nothing bounces, arcs
 * sweep closed in a beat and settle hard. Engaging a protection *builds* the
 * ring; sealing the field snaps every ring and passes a scanline over it.
 */
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface AegisArc {
  id: string;
  label: string;
  active: boolean;
  /** 0 = outer perimeter, 1 = mid (app locks), 2 = inner (session) */
  ring: 0 | 1 | 2;
  onClick?: () => void;
}

const RADII = [86, 66, 46];
const EASE_HARD = [0.4, 0, 0.2, 1] as const;

export function AegisRings({
  arcs,
  sealed = false,
  centerLabel,
  centerValue,
  centerUnit,
  onPanic,
}: {
  arcs: AegisArc[];
  sealed?: boolean;
  centerLabel: string;
  centerValue: string;
  centerUnit?: string;
  /** Drag the core outward to raise everything at once. */
  onPanic?: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="relative mx-auto grid h-[248px] w-[248px] place-items-center">
      <motion.svg
        viewBox="0 0 200 200"
        className="absolute inset-0 h-full w-full -rotate-90"
        animate={sealed && !reduce ? { rotate: [-90, -84, -90] } : { rotate: -90 }}
        transition={{ duration: 0.7, ease: EASE_HARD }}
      >
        {RADII.map((r, ringIndex) => {
          const ringArcs = arcs.filter((a) => a.ring === ringIndex);
          const C = 2 * Math.PI * r;
          const n = Math.max(1, ringArcs.length);
          const gap = 6;
          const seg = C / n - gap;
          return (
            <g key={r}>
              <circle
                cx="100"
                cy="100"
                r={r}
                fill="none"
                stroke="hsl(var(--border))"
                strokeWidth={ringIndex === 0 ? 7 : 5}
              />
              {ringArcs.map((a, i) => (
                <motion.circle
                  key={a.id}
                  cx="100"
                  cy="100"
                  r={r}
                  fill="none"
                  stroke={a.active ? 'hsl(var(--primary))' : 'transparent'}
                  strokeWidth={ringIndex === 0 ? 7 : 5}
                  strokeLinecap="butt"
                  strokeDasharray={`${seg} ${C}`}
                  strokeDashoffset={-((C / n) * i)}
                  initial={false}
                  animate={{ pathLength: a.active ? 1 : 0, opacity: a.active ? 1 : 0 }}
                  transition={{ duration: a.active ? 0.32 : 0.2, ease: EASE_HARD }}
                />
              ))}
            </g>
          );
        })}
      </motion.svg>

      {/* generous invisible tap sectors, one per arc */}
      <div className="absolute inset-0">
        {arcs.map((a, i) => {
          const r = RADII[a.ring];
          const ringArcs = arcs.filter((x) => x.ring === a.ring);
          const idx = ringArcs.findIndex((x) => x.id === a.id);
          const angle = ((idx + 0.5) / ringArcs.length) * Math.PI * 2 - Math.PI / 2;
          const x = 50 + (Math.cos(angle) * r) / 2;
          const y = 50 + (Math.sin(angle) * r) / 2;
          if (!a.onClick) return null;
          return (
            <button
              key={a.id}
              onClick={a.onClick}
              aria-label={a.label}
              className="absolute h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{ left: `${x}%`, top: `${y}%` }}
            />
          );
        })}
      </div>

      {sealed && !reduce && <span className="shield-scanline" aria-hidden />}

      <motion.div
        drag={onPanic && !reduce ? true : false}
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        dragElastic={0.3}
        onDragEnd={(_, info) => {
          if (Math.hypot(info.offset.x, info.offset.y) > 60) onPanic?.();
        }}
        className={cn(
          'relative z-10 grid h-[104px] w-[104px] cursor-grab place-items-center rounded-full border text-center active:cursor-grabbing',
          sealed ? 'border-primary/50 bg-primary/10' : 'border-border bg-card',
        )}
      >
        <div>
          <p className="font-mono text-2xl font-bold leading-none tabular-nums text-foreground">
            {centerValue}
            {centerUnit && <span className="text-sm text-muted-foreground">{centerUnit}</span>}
          </p>
          <p className="lantern-label mt-1.5 !mb-0 text-[10px]">{centerLabel}</p>
        </div>
      </motion.div>
    </div>
  );
}

export function AegisLegend({ arcs }: { arcs: AegisArc[] }) {
  return (
    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
      {arcs.map((a) => (
        <span key={a.id} className="flex items-center gap-1.5">
          <span
            className={cn(
              'h-2 w-2 rounded-[2px]',
              a.active ? 'bg-primary' : 'bg-muted-foreground/30',
            )}
          />
          <span
            className={cn(
              'text-[11px]',
              a.active ? 'font-semibold text-foreground' : 'text-muted-foreground',
            )}
          >
            {a.label}
          </span>
        </span>
      ))}
    </div>
  );
}

export function LatticePanel({
  index = 0,
  children,
  className,
}: {
  index?: number;
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      className={cn('shield-plate p-4', className)}
      initial={reduce ? false : { opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.18, delay: index * 0.04, ease: EASE_HARD }}
    >
      {children}
    </motion.section>
  );
}

export default AegisRings;
