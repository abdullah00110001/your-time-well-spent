import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const MILESTONES = [100, 1_000, 10_000, 100_000];

function getLocalShownKey(count: number) {
  const today = new Date().toISOString().split('T')[0];
  return `rise_milestone_${count}_${today}`;
}

interface Props {
  globalCount: number;
}

export function MilestoneBanner({ globalCount }: Props) {
  const [visible, setVisible] = useState(false);
  const [milestone, setMilestone] = useState<number | null>(null);

  useEffect(() => {
    for (const m of MILESTONES) {
      if (globalCount >= m) {
        const key = getLocalShownKey(m);
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          setMilestone(m);
          setVisible(true);
          // auto-dismiss after 5s
          const t = setTimeout(() => setVisible(false), 5000);
          return () => clearTimeout(t);
        }
      }
    }
  }, [globalCount]);

  if (!visible || !milestone) return null;

  return (
    <div
      className={cn(
        'fixed top-4 left-4 right-4 z-50 mx-auto max-w-sm',
        'rounded-2xl bg-[#1a1a2e] border border-[#6C63FF]/40',
        'p-4 flex items-center gap-3',
        'shadow-[0_0_30px_rgba(108,99,255,0.3)]',
        'animate-in slide-in-from-top-4 duration-300'
      )}
    >
      <span className="text-2xl">🎉</span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">
          আজ Rise এ {milestone.toLocaleString()} জন উঠেছে!
        </p>
        <p className="text-xs text-white/50 mt-0.5">তুমিও এর একজন 🌅</p>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-white/30 hover:text-white/60 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
