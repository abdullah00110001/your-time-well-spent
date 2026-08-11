/**
 * AscentRail / AscentNode — the "Ascent Column".
 *
 * Rise reads bottom → top: night below you, the day above. The rail is a
 * vertical meridian that draws itself upward on mount; each alarm is a node
 * clipped onto it. Nothing in Rise ever enters from the side — every element
 * stands up from below, so the screen itself models the act of rising.
 */
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const EASE_RISE = [0.16, 1, 0.3, 1] as const;

export function AscentRail({
  children,
  sweep = false,
  className,
}: {
  children: ReactNode;
  /** Pulse a light up the rail (fired when the user commits to tomorrow). */
  sweep?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <div className={cn('relative pl-7', className)}>
      {/* the meridian */}
      <div className="pointer-events-none absolute bottom-0 left-[10px] top-0 w-px overflow-hidden">
        <motion.div
          className="rise-rail h-full w-px origin-bottom"
          initial={reduce ? false : { scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.7, ease: EASE_RISE }}
        />
        {sweep && !reduce && <span className="rise-rail-sweep" />}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

export function AscentNode({
  index = 0,
  active = false,
  children,
  onSwipeUp,
  onSwipeDown,
  className,
}: {
  index?: number;
  /** Lit node marker — used for the next alarm. */
  active?: boolean;
  children: ReactNode;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const draggable = !!(onSwipeUp || onSwipeDown) && !reduce;

  return (
    <motion.div
      className={cn('relative', className)}
      initial={reduce ? false : { opacity: 0, y: 24, scaleY: 0.94 }}
      animate={{ opacity: 1, y: 0, scaleY: 1 }}
      transition={{ duration: 0.5, delay: 0.25 + index * 0.06, ease: EASE_RISE }}
      style={{ transformOrigin: 'bottom' }}
      drag={draggable ? 'y' : false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={0.18}
      onDragEnd={(_, info) => {
        if (info.offset.y < -56) onSwipeUp?.();
        else if (info.offset.y > 56) onSwipeDown?.();
      }}
    >
      {/* connector + node marker on the rail */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[-17px] top-7 h-px w-[13px] bg-border"
      />
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-[-21px] top-[22px] h-[9px] w-[9px] rounded-full border-2',
          active
            ? 'rise-node-live border-primary bg-primary'
            : 'border-border bg-background',
        )}
      />
      {children}
    </motion.div>
  );
}

export default AscentRail;
