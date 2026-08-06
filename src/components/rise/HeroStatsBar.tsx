import { useEffect, useRef } from 'react';
import { Globe, Building2, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FilterMode } from '@/hooks/useNearbyWakers';

interface Props {
  globalCount: number;
  cityCount: number;
  nearbyCount: number;
  activeFilter: FilterMode;
  onTabClick: (mode: FilterMode) => void;
}

function AnimatedCount({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const start = prev.current;
    const end = value;
    if (start === end) return;
    prev.current = end;
    const duration = 600;
    const startTime = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(start + (end - start) * ease).toLocaleString();
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);

  return <span ref={ref}>{value.toLocaleString()}</span>;
}

export function HeroStatsBar({ globalCount, cityCount, nearbyCount, activeFilter, onTabClick }: Props) {
  const stats = [
    {
      mode: 'global' as FilterMode,
      icon: Globe,
      label: 'সারা বিশ্বে',
      count: globalCount,
      color: '#6C63FF',
      alwaysShow: true,
    },
    {
      mode: 'city' as FilterMode,
      icon: Building2,
      label: 'শহরে',
      count: cityCount,
      color: '#FFD740',
      alwaysShow: false,
    },
    {
      mode: 'nearby' as FilterMode,
      icon: MapPin,
      label: 'কাছে',
      count: nearbyCount,
      color: '#00E676',
      alwaysShow: false,
    },
  ].filter(s => s.alwaysShow || s.count > 0);

  return (
    <div className="flex items-center gap-2 px-1 py-0.5">
      {stats.map((s) => {
        const isActive = activeFilter === s.mode;
        return (
          <button
            key={s.mode}
            onClick={() => onTabClick(s.mode)}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-2.5 px-2 rounded-xl transition-all duration-200',
              isActive
                ? 'bg-white/[0.08] shadow-inner'
                : 'hover:bg-white/[0.04]'
            )}
            style={{
              borderBottom: isActive ? `2px solid ${s.color}` : '2px solid transparent',
            }}
          >
            <div className="flex items-center gap-1">
              <s.icon
                className="h-3 w-3"
                style={{ color: isActive ? s.color : 'rgba(255,255,255,0.4)' }}
              />
              <span
                className="text-base font-bold tabular-nums"
                style={{ color: isActive ? s.color : 'rgba(255,255,255,0.75)' }}
              >
                <AnimatedCount value={s.count} />
              </span>
            </div>
            <span
              className="text-[10px]"
              style={{ color: isActive ? s.color : 'rgba(255,255,255,0.35)' }}
            >
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
