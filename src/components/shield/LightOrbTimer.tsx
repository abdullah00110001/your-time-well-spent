// Focus Shield V2.0 - Unique Light Ritual Design. No Blue. No Clone.
// "Light Orb Timer" — a draggable golden orb, not a Stay-Focused clone.
// Tap to expand: Pause / Stop / Add 5 min. Subtle pulse under 5 minutes.

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, Square, Plus } from 'lucide-react';
import { loadOrb, saveOrb, type OrbTimerSettings } from '@/lib/shield/settingsStore';

const GOLD = '#FFD166';
const EMBER = '#FF8C42';

interface Props {
  /** Seconds remaining. Owned by the caller so it survives navigation. */
  remainingSeconds: number;
  running: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onAddMinutes: (minutes: number) => void;
}

function fmt(total: number, showSeconds: boolean) {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}`;
  return showSeconds ? `${m}:${String(sec).padStart(2, '0')}` : `${m}m`;
}

export function LightOrbTimer({
  remainingSeconds, running, onPause, onResume, onStop, onAddMinutes,
}: Props) {
  const [settings, setSettings] = useState<OrbTimerSettings>(loadOrb);
  const [expanded, setExpanded] = useState(false);
  const [pos, setPos] = useState({ x: settings.x, y: settings.y });
  const dragged = useRef(false);

  // Keep in sync with the Timer settings screen.
  useEffect(() => {
    const sync = () => {
      const next = loadOrb();
      setSettings(next);
      setPos({ x: next.x, y: next.y });
    };
    window.addEventListener('shield:settings', sync);
    return () => window.removeEventListener('shield:settings', sync);
  }, []);

  const persistPos = useCallback((x: number, y: number) => {
    const next = { ...loadOrb(), x, y };
    saveOrb(next);
  }, []);

  if (!settings.enabled) return null;

  const lowTime = remainingSeconds > 0 && remainingSeconds <= 300;
  const pulsing = lowTime && settings.pulseAtFiveMin;
  const size = settings.size;

  return (
    <motion.div
      drag
      dragMomentum={false}
      dragElastic={0.06}
      onDragStart={() => { dragged.current = true; }}
      onDragEnd={(_, info) => {
        const x = pos.x - info.offset.x; // right-anchored
        const y = pos.y + info.offset.y;
        const clamped = { x: Math.max(4, x), y: Math.max(4, y) };
        setPos(clamped);
        persistPos(clamped.x, clamped.y);
        setTimeout(() => { dragged.current = false; }, 0);
      }}
      onClick={() => { if (!dragged.current) setExpanded((e) => !e); }}
      className="fixed z-[60] select-none touch-none cursor-grab active:cursor-grabbing"
      style={{ right: pos.x, top: pos.y, opacity: settings.opacity }}
      role="button"
      aria-label="Focus timer orb"
    >
      <motion.div
        animate={pulsing ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={pulsing ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.2 }}
        className="rounded-full flex items-center justify-center font-bold text-black"
        style={{
          width: size,
          height: size,
          fontSize: Math.max(11, size * 0.24),
          background: `radial-gradient(circle at 35% 30%, #FFF0C4, ${GOLD} 55%, ${EMBER} 100%)`,
          boxShadow: `0 0 ${lowTime ? 34 : 22}px ${lowTime ? EMBER : GOLD}99, inset 0 0 12px #ffffff66`,
        }}
      >
        {fmt(remainingSeconds, settings.showSeconds)}
      </motion.div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.94 }}
            transition={{ duration: 0.2 }}
            className="mt-2 flex items-center gap-1 rounded-full border border-white/10 bg-black/80 px-2 py-1.5 backdrop-blur"
            onClick={(e) => e.stopPropagation()}
          >
            <OrbBtn label={running ? 'Pause' : 'Resume'} onClick={running ? onPause : onResume}>
              {running ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </OrbBtn>
            <OrbBtn label="Stop" onClick={onStop}>
              <Square className="h-3.5 w-3.5" />
            </OrbBtn>
            <OrbBtn label="Add 5 min" onClick={() => onAddMinutes(5)}>
              <Plus className="h-3.5 w-3.5" />
            </OrbBtn>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function OrbBtn({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="h-7 w-7 rounded-full flex items-center justify-center text-black transition-transform active:scale-90"
      style={{ background: GOLD }}
    >
      {children}
    </button>
  );
}

export default LightOrbTimer;
