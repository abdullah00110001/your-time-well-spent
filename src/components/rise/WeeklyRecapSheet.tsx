import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Flame, Clock, Star, Users, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface WeeklyRecapData {
  daysWoken: number;
  totalDays: number;
  avgWakeTime: string;
  bestDay: string;
  currentStreak: number;
  cityTotalWakers: number;
  cityEarliestWake: string;
  cityMostActiveDay: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: WeeklyRecapData | null;
}

function StatRow({
  icon,
  label,
  value,
  color = '#6C63FF',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/[0.06] last:border-0">
      <div className="flex items-center gap-2 text-white/60 text-sm">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

export function WeeklyRecapSheet({ open, onOpenChange, data }: Props) {
  if (!data) return null;

  const handleShare = async () => {
    const text = `🌅 এই সপ্তাহে Rise এ ${data.daysWoken}/${data.totalDays} দিন উঠেছি!\nAvg: ${data.avgWakeTime} • Streak: 🔥${data.currentStreak} days\n#RiseApp #WakeWithPurpose`;
    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  const pct = Math.round((data.daysWoken / data.totalDays) * 100);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-[#0A0A0F] border-white/10 text-white rounded-t-3xl max-h-[88vh] overflow-y-auto"
      >
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="text-white text-xl">📊 এই সপ্তাহের Recap</SheetTitle>
        </SheetHeader>

        {/* Progress ring style summary */}
        <div className="flex items-center gap-4 my-4 p-4 rounded-2xl bg-[#111118] border border-white/[0.06]">
          <div className="relative h-16 w-16 flex-shrink-0">
            <svg viewBox="0 0 64 64" className="rotate-[-90deg]">
              <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
              <circle
                cx="32"
                cy="32"
                r="26"
                fill="none"
                stroke="#6C63FF"
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - pct / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{pct}%</span>
            </div>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">
              {data.daysWoken}
              <span className="text-white/40 text-base font-normal">/{data.totalDays} দিন</span>
            </p>
            <p className="text-xs text-white/50 mt-0.5">এই সপ্তাহে উঠেছো</p>
            <div className="flex items-center gap-1 mt-1 text-[#FFD740] text-xs">
              <Flame className="h-3 w-3" />
              <span>{data.currentStreak} day streak</span>
            </div>
          </div>
        </div>

        {/* Personal stats */}
        <div className="rounded-2xl bg-[#111118] border border-white/[0.06] px-4 py-1 mb-3">
          <p className="text-xs text-white/40 pt-3 pb-1 uppercase tracking-widest">তোমার Stats</p>
          <StatRow icon={<Clock className="h-3.5 w-3.5" />} label="Avg wake time" value={data.avgWakeTime} />
          <StatRow icon={<Star className="h-3.5 w-3.5" />} label="Best day" value={data.bestDay} color="#FFD740" />
          <StatRow icon={<Flame className="h-3.5 w-3.5" />} label="Current streak" value={`${data.currentStreak} days`} color="#FF6B6B" />
        </div>

        {/* City stats */}
        <div className="rounded-2xl bg-[#111118] border border-white/[0.06] px-4 py-1 mb-5">
          <p className="text-xs text-white/40 pt-3 pb-1 uppercase tracking-widest">তোমার শহরে</p>
          <StatRow icon={<Users className="h-3.5 w-3.5" />} label="মোট wakers" value={`${data.cityTotalWakers} জন`} />
          <StatRow icon={<Clock className="h-3.5 w-3.5" />} label="সবচেয়ে early" value={data.cityEarliestWake} />
          <StatRow icon={<Star className="h-3.5 w-3.5" />} label="Most active day" value={data.cityMostActiveDay} color="#FFD740" />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleShare}
            className="flex-1 bg-[#6C63FF] hover:bg-[#5b52ff] text-white gap-2"
          >
            <Share2 className="h-4 w-4" /> Share করো
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 border-white/10 text-white hover:bg-white/5"
          >
            Close
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
