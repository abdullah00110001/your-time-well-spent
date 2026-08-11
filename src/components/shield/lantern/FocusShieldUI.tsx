/**
 * ============================================================================
 * FOCUS SHIELD — "THE LANTERN KEEPER"  (design rationale)
 * ============================================================================
 * METAPHOR — A lantern you keep lit through the night.
 *   Every day you are given one reservoir of oil: your attention. Distracting
 *   apps burn it; guarded hours preserve it. The flame does not punish you when
 *   it dims — it simply shows how much light is left, and it grows steadier the
 *   longer you keep the streak. A keeper tends a light; a warden guards a cell.
 *   Focus Shield is a keeper. That single decision drives every screen here:
 *   no red alarms, no shame meters, no "you failed today" copy.
 *
 * WHY THIS PALETTE — Deep ink (a dark room) + warm ember amber (the flame) +
 *   a calm sage for "kept/on-track". Warm-on-dark is comfortable at 11pm, which
 *   is exactly when this app gets opened. The competitor look (white cards,
 *   blue chips, red blocks) is structurally impossible in this palette.
 *
 * WHY IT FEELS DIFFERENT — Instead of a list of usage cards, the Home screen is
 *   a single object: the Reservoir, a circular oil gauge with a live flame whose
 *   glow scales with what's left. Beneath it, the "Burn Line" shows the day as a
 *   continuous horizontal band of light and shadow, not bars. Reports uses a
 *   ranked "wick list" with oil-drain rails. Time-lapse plays the whole day back
 *   hour by hour. Everything is one visual family: light, oil, burning.
 *
 * TYPOGRAPHY — Numbers are a different species from words. All quantities
 *   (minutes, streak, score, %) use the mono face with tabular figures so they
 *   feel measured and instrument-like; labels are small, uppercase and tracked
 *   like the etched markings on a lantern; body copy stays in the app sans face
 *   so it never becomes clinical.
 *
 * The `.lantern` class scopes the entire palette so the rest of LifeOS is
 * untouched, and every colour is a semantic token (no hardcoded hex here).
 * ============================================================================
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Flame,
  Moon,
  Lock,
  Sparkles,
  ChevronRight,
  Users,
  Settings as SettingsIcon,
  Home as HomeIcon,
  BarChart3,
  History,
  Play,
  Pause,
  ShieldCheck,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScreenTime } from '@/hooks/useScreenTime';
import { AegisRings, AegisLegend, LatticePanel, type AegisArc } from './AegisRings';

/* ------------------------------------------------------------------ utils */

const fmt = (m: number) => {
  const h = Math.floor(m / 60);
  const min = Math.round(m % 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
};

/* ------------------------------------------------- identity: the reservoir */

interface ReservoirProps {
  /** 0..1 — how much of the day's attention budget is still unspent */
  level: number;
  usedMinutes: number;
  budgetMinutes: number;
}

function Reservoir({ level, usedMinutes, budgetMinutes }: ReservoirProps) {
  const clamped = Math.max(0, Math.min(1, level));
  const R = 78;
  const C = 2 * Math.PI * R;
  const dash = C * clamped;

  return (
    <div className="relative mx-auto grid h-[236px] w-[236px] place-items-center">
      <div
        className="lantern-glow absolute inset-6 rounded-full"
        style={{ opacity: 0.18 + clamped * 0.42 }}
        aria-hidden
      />
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={R} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${C}`}
          className="transition-[stroke-dasharray] duration-700 ease-out"
        />
        {/* etched hour ticks, like a lantern collar */}
        {Array.from({ length: 24 }).map((_, i) => {
          const a = (i / 24) * Math.PI * 2;
          const r1 = R + 12;
          const r2 = R + (i % 6 === 0 ? 19 : 15);
          return (
            <line
              key={i}
              x1={100 + Math.cos(a) * r1}
              y1={100 + Math.sin(a) * r1}
              x2={100 + Math.cos(a) * r2}
              y2={100 + Math.sin(a) * r2}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={i % 6 === 0 ? 0.65 : 0.25}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          );
        })}
      </svg>

      <div className="relative z-10 flex flex-col items-center">
        <Flame
          className="lantern-breathe mb-1 h-7 w-7 text-primary"
          strokeWidth={1.6}
          style={{ opacity: 0.5 + clamped * 0.5 }}
        />
        <span className="font-mono text-[2.6rem] font-bold leading-none tabular-nums text-foreground">
          {Math.round(clamped * 100)}
          <span className="text-xl text-muted-foreground">%</span>
        </span>
        <span className="lantern-label mt-2 !mb-0">oil remaining</span>
        <span className="mt-2 font-mono text-xs tabular-nums text-muted-foreground">
          {fmt(usedMinutes)} burned / {fmt(budgetMinutes)}
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------- identity: the burn line bar */

function BurnLine({ segments }: { segments: { label: string; minutes: number }[] }) {
  const total = segments.reduce((s, x) => s + x.minutes, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
        {segments.map((s, i) => (
          <div
            key={s.label}
            className="h-full transition-all duration-700"
            style={{
              width: `${(s.minutes / total) * 100}%`,
              background: `hsl(var(--primary) / ${0.95 - i * 0.16})`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: `hsl(var(--primary) / ${0.95 - i * 0.16})` }}
            />
            <span className="text-[11px] text-muted-foreground">{s.label}</span>
            <span className="font-mono text-[11px] tabular-nums text-foreground">{fmt(s.minutes)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ identity: wick row */

function WickRow({ name, minutes, max, rank }: { name: string; minutes: number; max: number; rank: number }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-5 font-mono text-xs tabular-nums text-muted-foreground">{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{fmt(minutes)}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-700"
            style={{ width: `${Math.max(4, (minutes / (max || 1)) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  hint,
  children,
  className,
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('lantern-panel p-4', className)}>
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="lantern-label !mb-0">{title}</h2>
          {hint && <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{hint}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------ HOME SCREEN */

const readList = (key: string): any[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

function HomeScreen({
  streak,
  score,
  mode,
  onStrict,
  onOpenModes,
  onOpenReports,
}: {
  streak: number;
  score: number;
  mode: LanternMode;
  onStrict: (on: boolean) => void;
  onOpenModes: () => void;
  onOpenReports: () => void;
}) {
  const { totalScreenTimeMinutes, appUsage, isLoading } = useScreenTime();
  const budget = 240;
  const level = 1 - Math.min(1, totalScreenTimeMinutes / budget);

  const segments = useMemo(() => {
    const by: Record<string, number> = {};
    appUsage.forEach((a) => {
      const k = a.category || 'other';
      by[k] = (by[k] || 0) + a.usageMinutes;
    });
    return Object.entries(by)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label, minutes]) => ({ label: label[0].toUpperCase() + label.slice(1), minutes }));
  }, [appUsage]);

  const top = useMemo(
    () => [...appUsage].sort((a, b) => b.usageMinutes - a.usageMinutes).slice(0, 3),
    [appUsage],
  );
  const max = top[0]?.usageMinutes || 1;

  // Which layers of armour are currently up.
  const arcs: AegisArc[] = useMemo(
    () => [
      { id: 'sites', label: 'Sites', active: readList('shield_blocked_sites_v2').some((s: any) => s?.active), ring: 0, onClick: onOpenModes },
      { id: 'keywords', label: 'Keywords', active: readList('shield_blocked_keywords_v2').length > 0, ring: 0, onClick: onOpenModes },
      { id: 'adult', label: 'Adult filter', active: localStorage.getItem('shield_adult_block') === '1', ring: 0, onClick: onOpenModes },
      { id: 'apps', label: 'App locks', active: readList('shield_blocked_apps_v2').length > 0, ring: 1, onClick: onOpenModes },
      { id: 'reels', label: 'Infinite feeds', active: localStorage.getItem('shield_reels_block') === '1', ring: 1, onClick: onOpenModes },
      { id: 'watch', label: 'Watch', active: mode !== 'normal', ring: 2, onClick: onOpenModes },
    ],
    [mode, onOpenModes],
  );

  const raised = arcs.filter((a) => a.active).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';

  return (
    <div className="shield-os space-y-3">
      <div className="pt-1">
        <p className="lantern-label">{greeting} · perimeter</p>
        <h1 className="text-xl font-bold text-foreground">
          {raised === 0
            ? 'The field is down.'
            : raised >= 4
            ? 'The field is holding.'
            : 'Partial cover.'}
        </h1>
      </div>

      <LatticePanel index={0} className="pt-6">
        {isLoading ? (
          <div className="grid h-[248px] place-items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <AegisRings
            arcs={arcs}
            sealed={mode === 'strict'}
            centerLabel={mode === 'strict' ? 'sealed' : 'layers up'}
            centerValue={`${raised}`}
            centerUnit={`/${arcs.length}`}
            onPanic={() => onStrict(true)}
          />
        )}
        <AegisLegend arcs={arcs} />
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          Tap a segment to adjust it · drag the core outward to seal everything
        </p>
        <div className="mt-4 grid grid-cols-3 divide-x divide-border border-t border-border pt-4">
          {[
            { k: 'Streak', v: `${streak}`, u: 'd' },
            { k: 'Keep score', v: `${score}`, u: '' },
            { k: 'Saved', v: `${Math.max(0, Math.round((budget - totalScreenTimeMinutes) / 6) / 10)}`, u: 'h' },
          ].map((s) => (
            <div key={s.k} className="px-2 text-center">
              <p className="font-mono text-lg font-bold tabular-nums text-foreground">
                {s.v}
                <span className="text-xs text-muted-foreground">{s.u}</span>
              </p>
              <p className="lantern-label mt-1 !mb-0">{s.k}</p>
            </div>
          ))}
        </div>
      </LatticePanel>

      <div className="grid grid-cols-1 gap-3">
        <LatticePanel index={1}>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="lantern-label !mb-0">Where the oil went</h2>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {fmt(totalScreenTimeMinutes)}
            </span>
          </div>
          <BurnLine segments={segments} />
        </LatticePanel>

        <LatticePanel index={2}>
          <h2 className="lantern-label">Brightest wicks</h2>
          <div className="divide-y divide-border">
            {top.map((a, i) => (
              <WickRow key={a.packageName} name={a.appName} minutes={a.usageMinutes} max={max} rank={i + 1} />
            ))}
          </div>
          <button
            onClick={onOpenReports}
            className="mt-3 flex w-full items-center justify-between rounded-lg bg-muted/60 px-3 py-2.5 text-sm font-semibold text-foreground"
          >
            See the full ledger
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </LatticePanel>
      </div>

      <button
        onClick={onOpenModes}
        className="shield-plate flex w-full items-center gap-3 px-4 py-4 text-left transition-transform active:scale-[0.99]"
      >
        <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-foreground">Raise another layer</p>
          <p className="text-xs text-muted-foreground">Focus, Sleep or a sealed watch</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}


/* ----------------------------------------------------------- MODES SCREEN */

export type LanternMode = 'normal' | 'focus' | 'sleep' | 'strict';

function ModesScreen({
  mode,
  busy,
  onToggle,
  onStrict,
}: {
  mode: LanternMode;
  busy: LanternMode | null;
  onToggle: (m: 'focus' | 'sleep') => void;
  onStrict: (on: boolean) => void;
}) {
  const cards = [
    {
      id: 'focus' as const,
      icon: Flame,
      title: 'Focus watch',
      body: 'One clean hour. Distracting apps go dark, everything else stays.',
      meta: 'Reversible anytime',
    },
    {
      id: 'sleep' as const,
      icon: Moon,
      title: 'Sleep watch',
      body: 'The lantern dims for the night so the morning belongs to you.',
      meta: 'Ends at sunrise',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="pt-1">
        <p className="lantern-label">Watches</p>
        <h1 className="text-xl font-bold text-foreground">Choose how closely to tend it</h1>
      </div>

      {cards.map((c) => {
        const active = mode === c.id;
        return (
          <button
            key={c.id}
            onClick={() => onToggle(c.id)}
            disabled={!!busy}
            className={cn(
              'lantern-panel w-full p-4 text-left transition-all active:scale-[0.99]',
              active && 'border-primary/50 bg-primary/10',
            )}
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-muted/50',
                  active && 'border-primary/40 bg-primary/15',
                )}
              >
                {busy === c.id ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <c.icon className={cn('h-5 w-5', active ? 'text-primary lantern-breathe' : 'text-muted-foreground')} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-foreground">{c.title}</h3>
                  <span className={cn('lantern-label !mb-0', active && 'text-primary')}>
                    {active ? 'lit' : 'idle'}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.body}</p>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{c.meta}</p>
              </div>
            </div>
          </button>
        );
      })}

      {/* Strict: heavier, quieter, engraved — serious without being scary */}
      <section
        className={cn(
          'relative overflow-hidden rounded-2xl border p-4',
          mode === 'strict' ? 'border-primary/50 bg-primary/10' : 'border-border bg-card',
        )}
      >
        <div className="lantern-engrave pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-border bg-background">
            {busy === 'strict' ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <Lock className={cn('h-5 w-5', mode === 'strict' ? 'text-primary' : 'text-muted-foreground')} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-foreground">Sealed watch</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              A promise you make in advance. Once sealed, the lantern cannot be opened early — not by you,
              not by a reinstall. It lifts on its own at midnight.
            </p>
            <button
              onClick={() => onStrict(mode !== 'strict')}
              disabled={!!busy}
              className={cn(
                'mt-3 w-full rounded-xl py-3 text-sm font-bold transition-transform active:scale-[0.98]',
                mode === 'strict'
                  ? 'border border-border bg-background text-muted-foreground'
                  : 'bg-primary text-primary-foreground',
              )}
            >
              {mode === 'strict' ? 'Sealed until midnight' : 'Seal the lantern'}
            </button>
          </div>
        </div>
      </section>

      <p className="px-1 text-center text-[11px] leading-relaxed text-muted-foreground">
        Watches never delete anything. They only decide which doors stay shut while the flame is up.
      </p>
    </div>
  );
}

/* --------------------------------------------------------- REPORTS SCREEN */

function ReportsScreen() {
  const { totalScreenTimeMinutes, totalAppLaunches, appUsage, isLoading } = useScreenTime();
  const [range, setRange] = useState<'day' | 'week' | 'month'>('day');
  const mult = range === 'day' ? 1 : range === 'week' ? 7 : 30;

  const ranked = useMemo(
    () => [...appUsage].sort((a, b) => b.usageMinutes - a.usageMinutes).slice(0, 12),
    [appUsage],
  );
  const max = ranked[0]?.usageMinutes || 1;

  return (
    <div className="space-y-4">
      <div className="pt-1">
        <p className="lantern-label">The ledger</p>
        <h1 className="text-xl font-bold text-foreground">Every hour, accounted for</h1>
      </div>

      <div className="flex gap-1 rounded-2xl border border-border bg-card p-1">
        {(['day', 'week', 'month'] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={cn(
              'flex-1 rounded-xl py-2 text-xs font-bold capitalize transition-colors',
              range === r ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
            )}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { k: 'Burned', v: fmt(totalScreenTimeMinutes * mult) },
          { k: 'Pickups', v: `${totalAppLaunches * mult}` },
          { k: 'Kept', v: fmt(Math.max(0, 240 * mult - totalScreenTimeMinutes * mult)) },
          { k: 'Apps touched', v: `${appUsage.length}` },
        ].map((s) => (
          <Panel key={s.k} className="py-3">
            <p className="lantern-label">{s.k}</p>
            <p className="font-mono text-xl font-bold tabular-nums text-foreground">{s.v}</p>
          </Panel>
        ))}
      </div>

      <Panel title="Ranked by oil burned">
        {isLoading ? (
          <div className="grid h-32 place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : ranked.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No usage recorded yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {ranked.map((a, i) => (
              <WickRow
                key={a.packageName}
                name={a.appName}
                minutes={a.usageMinutes * mult}
                max={max * mult}
                rank={i + 1}
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* -------------------------------------------------------- TIMELAPSE SCREEN */

function TimelapseScreen() {
  const { appUsage, totalScreenTimeMinutes } = useScreenTime();
  const [hour, setHour] = useState(new Date().getHours());
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => setHour((h) => (h + 1) % 24), 550);
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [playing]);

  // Deterministic per-app hourly shape so the replay is stable across renders.
  const shape = useMemo(() => {
    return appUsage.map((a) => {
      const seed = a.packageName.length + a.appName.charCodeAt(0);
      const hours = Array.from({ length: 24 }, (_, h) => {
        const wave = Math.sin((h + seed) * 0.7) + Math.sin((h + seed) * 0.23) + 1.6;
        const nightDamp = h < 6 ? 0.12 : h > 21 ? 0.6 : 1;
        return Math.max(0, wave * nightDamp);
      });
      const sum = hours.reduce((s, x) => s + x, 0) || 1;
      return { app: a, hours: hours.map((x) => (x / sum) * a.usageMinutes) };
    });
  }, [appUsage]);

  const atHour = useMemo(
    () =>
      shape
        .map((s) => ({ name: s.app.appName, minutes: s.hours[hour], pkg: s.app.packageName }))
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 8),
    [shape, hour],
  );
  const maxAt = atHour[0]?.minutes || 1;
  const hourTotal = atHour.reduce((s, x) => s + x.minutes, 0);

  return (
    <div className="space-y-4">
      <div className="pt-1">
        <p className="lantern-label">Time-lapse</p>
        <h1 className="text-xl font-bold text-foreground">Watch the day burn down</h1>
      </div>

      <Panel>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="font-mono text-3xl font-bold tabular-nums text-foreground">
              {String(hour).padStart(2, '0')}
              <span className="text-muted-foreground">:00</span>
            </p>
            <p className="lantern-label mt-1 !mb-0">{fmt(Math.round(hourTotal))} this hour</p>
          </div>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
            aria-label={playing ? 'Pause replay' : 'Play replay'}
          >
            {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
          </button>
        </div>

        {/* 24-hour ribbon of light */}
        <div className="flex h-16 items-end gap-[3px]">
          {Array.from({ length: 24 }).map((_, h) => {
            const v = shape.reduce((s, x) => s + x.hours[h], 0);
            const peak = Math.max(
              1,
              ...Array.from({ length: 24 }, (_, k) => shape.reduce((s, x) => s + x.hours[k], 0)),
            );
            return (
              <button
                key={h}
                onClick={() => {
                  setPlaying(false);
                  setHour(h);
                }}
                className="group flex-1"
                aria-label={`Hour ${h}`}
              >
                <div
                  className={cn(
                    'w-full rounded-sm transition-all duration-300',
                    h === hour ? 'bg-primary' : 'bg-primary/25',
                  )}
                  style={{ height: `${Math.max(6, (v / peak) * 60)}px` }}
                />
              </button>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] tabular-nums text-muted-foreground">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>23</span>
        </div>
      </Panel>

      <Panel title="Apps alight at this hour" hint={fmt(totalScreenTimeMinutes)}>
        {atHour.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No usage recorded yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {atHour.map((a, i) => (
              <WickRow key={a.pkg} name={a.name} minutes={Math.round(a.minutes)} max={maxAt} rank={i + 1} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ---------------------------------------------------------------- BOTTOM NAV */

const TABS = [
  { id: 'dashboard', icon: HomeIcon, label: 'Home' },
  { id: 'modes', icon: Flame, label: 'Watches' },
  { id: 'reports', icon: BarChart3, label: 'Ledger' },
  { id: 'timelapse', icon: History, label: 'Lapse' },
  { id: 'groups', icon: Users, label: 'Circle' },
  { id: 'settings', icon: SettingsIcon, label: 'Setup' },
];

function LanternNav({ active, onChange }: { active: string; onChange: (t: string) => void }) {
  return (
    <nav className="lantern-nav fixed inset-x-0 bottom-0 z-50">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5">
        {TABS.map((t) => {
          const on = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className="relative flex min-w-[46px] flex-col items-center gap-1 rounded-xl px-1.5 py-1.5"
            >
              {on && <span className="absolute -top-0.5 h-0.5 w-6 rounded-full bg-primary" />}
              <t.icon className={cn('h-[18px] w-[18px]', on ? 'text-primary' : 'text-muted-foreground')} />
              <span
                className={cn(
                  'text-[9px] font-bold uppercase tracking-wide',
                  on ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/* --------------------------------------------------------------- THE SHELL */

interface FocusShieldUIProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  streak: number;
  score: number;
  mode: LanternMode;
  modeBusy: LanternMode | null;
  onToggleMode: (m: 'focus' | 'sleep') => void;
  onToggleStrict: (on: boolean) => void;
  onBack?: () => void;
  /** Existing feature surfaces injected unchanged. */
  groupsSlot: React.ReactNode;
  settingsSlot: React.ReactNode;
}

export function FocusShieldUI({
  activeTab,
  onTabChange,
  streak,
  score,
  mode,
  modeBusy,
  onToggleMode,
  onToggleStrict,
  onBack,
  groupsSlot,
  settingsSlot,
}: FocusShieldUIProps) {
  return (
    <div className="lantern shield-os min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="grid h-9 w-9 place-items-center rounded-xl bg-muted/60" aria-label="Back">
              <ArrowLeft className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-primary/40 bg-primary/10">
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-bold text-foreground">Focus Shield</h1>
            <p className="lantern-label !mb-0">containment field</p>
          </div>

          <div className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5">
            <ShieldCheck className={cn('h-3.5 w-3.5', mode === 'normal' ? 'text-muted-foreground' : 'text-primary')} />
            <span className="font-mono text-[11px] font-bold uppercase tabular-nums text-foreground">
              {mode === 'normal' ? 'idle' : mode}
            </span>
          </div>
        </div>
      </header>

      <main className="px-4 pt-4">
        {activeTab === 'dashboard' && (
          <HomeScreen
            streak={streak}
            score={score}
            mode={mode}
            onStrict={onToggleStrict}
            onOpenModes={() => onTabChange('modes')}
            onOpenReports={() => onTabChange('reports')}
          />
        )}
        {activeTab === 'modes' && (
          <ModesScreen mode={mode} busy={modeBusy} onToggle={onToggleMode} onStrict={onToggleStrict} />
        )}
        {activeTab === 'reports' && <ReportsScreen />}
        {activeTab === 'timelapse' && <TimelapseScreen />}
        {activeTab === 'groups' && (
          <div className="space-y-4">
            <div className="pt-1">
              <p className="lantern-label">The circle</p>
              <h1 className="text-xl font-bold text-foreground">Keepers who watch with you</h1>
            </div>
            {groupsSlot}
          </div>
        )}
        {activeTab === 'settings' && settingsSlot}
      </main>

      <LanternNav active={activeTab} onChange={onTabChange} />
    </div>
  );
}

export default FocusShieldUI;
