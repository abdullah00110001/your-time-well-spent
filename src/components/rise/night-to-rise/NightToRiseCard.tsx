import { Moon, ChevronRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNightToRise } from './useNightToRise';

interface Props {
  onOpen: () => void;
  riseAlarmTime?: string | null;
}

function fmt12(t: string) {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${period}`;
}

export function NightToRiseCard({ onOpen, riseAlarmTime }: Props) {
  const { config, status } = useNightToRise(riseAlarmTime);

  const isLocked = status.phase === 'sleep-lock' || status.phase === 'rise-lock';
  const showPulse = !config.configured;

  return (
    <button
      onClick={onOpen}
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl text-left',
        'bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950',
        'border border-indigo-500/20 shadow-lg',
        'p-4 transition-all hover:shadow-xl hover:border-indigo-400/40',
      )}
    >
      <div className="pointer-events-none absolute -top-12 -right-12 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-12 h-32 w-32 rounded-full bg-purple-500/20 blur-3xl" />

      <div className="relative flex items-start gap-3">
        <div className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          'bg-gradient-to-br from-indigo-500/30 to-purple-500/30 ring-1 ring-indigo-300/30',
          showPulse && 'animate-pulse',
        )}>
          <Moon className="h-5 w-5 text-indigo-200" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-white">Sleep to Rise</h3>
              <p className="text-xs text-indigo-200/70">Sleep & Wake Protection</p>
            </div>
            <StatusPill phase={status.phase} configured={config.configured} enabled={config.enabled} />
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-xs text-indigo-100/80">
              {!config.configured
                ? 'Tap to set up'
                : isLocked
                  ? <span className="inline-flex items-center gap-1 font-medium text-emerald-300"><Lock className="h-3 w-3" /> Lock active now</span>
                  : `Sleep ${fmt12(config.sleepTime)} · Rise +${config.riseLockMinutesAfter}m`}
            </p>
            <ChevronRight className="h-4 w-4 text-indigo-200/70 transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>
      </div>
    </button>
  );
}

function StatusPill({ phase, configured, enabled }: { phase: string; configured: boolean; enabled: boolean }) {
  if (!configured) {
    return <span className="rounded-full bg-indigo-400/20 px-2 py-0.5 text-[10px] font-semibold text-indigo-100">Set up</span>;
  }
  if (!enabled) {
    return <span className="rounded-full bg-slate-500/30 px-2 py-0.5 text-[10px] font-semibold text-slate-200">Off</span>;
  }
  if (phase === 'sleep-lock' || phase === 'rise-lock') {
    return <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-400/40">Locked</span>;
  }
  if (phase === 'paused') {
    return <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">Paused</span>;
  }
  return <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-400/40">Active</span>;
}
