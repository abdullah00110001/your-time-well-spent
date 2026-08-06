import { AlarmClock, CheckCircle2, Moon, Flame, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WakeEvent } from '@/hooks/useNearbyWakers';

interface Props {
  myEvent: WakeEvent | null;
  streak: number;
  nextAlarmTime?: string | null;
  isFirstInArea?: boolean;
  areaName?: string | null;
  onSetAlarm?: () => void;
}

export function OwnStatusCard({
  myEvent,
  streak,
  nextAlarmTime,
  isFirstInArea,
  areaName,
  onSetAlarm,
}: Props) {
  // Case 1: Already woken up today
  if (myEvent) {
    const time = new Date(myEvent.woke_at).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    return (
      <div className="rounded-xl bg-[#6C63FF]/10 border border-[#6C63FF]/30 p-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-[#00E676]" />
            <span className="text-sm font-semibold text-white">
              আজ {time} এ উঠেছো 🌅
            </span>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-1 text-xs text-[#FFD740]">
              <Flame className="h-3.5 w-3.5" />
              <span>{streak} day</span>
            </div>
          )}
        </div>

        {/* First in area badge */}
        {isFirstInArea && areaName && (
          <div className="flex items-center gap-1.5 text-xs text-[#FFD740]">
            <Star className="h-3.5 w-3.5 fill-[#FFD740]" />
            <span>{areaName}তে আজ প্রথম উঠেছো!</span>
          </div>
        )}

        {/* Status text if set */}
        {myEvent.status_text && (
          <div className="flex items-center gap-2 mt-1">
            {myEvent.status_emoji && (
              <span className="text-base leading-none">{myEvent.status_emoji}</span>
            )}
            <span className="text-xs text-white/60 italic">{myEvent.status_text}</span>
          </div>
        )}
      </div>
    );
  }

  // Case 2: Alarm set but not woken yet
  if (nextAlarmTime) {
    return (
      <div className="rounded-xl bg-[#111118] border border-white/[0.08] p-3">
        <div className="flex items-center gap-2">
          <AlarmClock className="h-4 w-4 text-[#FFD740]" />
          <div>
            <p className="text-sm font-medium text-white/80">এখনো ওঠোনি</p>
            <p className="text-xs text-white/40">
              অ্যালার্ম set আছে {nextAlarmTime} এ
            </p>
          </div>
          {streak > 0 && (
            <div className="ml-auto flex items-center gap-1 text-xs text-[#FFD740]">
              <Flame className="h-3.5 w-3.5" />
              <span>{streak}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Case 3: No alarm set
  return (
    <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Moon className="h-4 w-4 text-white/30" />
          <div>
            <p className="text-sm text-white/50">আজ কোনো অ্যালার্ম নেই</p>
          </div>
        </div>
        {onSetAlarm && (
          <button
            onClick={onSetAlarm}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full font-medium transition-all',
              'bg-[#6C63FF]/20 text-[#6C63FF] hover:bg-[#6C63FF]/30 border border-[#6C63FF]/30'
            )}
          >
            অ্যালার্ম set করো
          </button>
        )}
      </div>
    </div>
  );
}
