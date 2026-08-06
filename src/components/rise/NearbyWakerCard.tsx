import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { MapPin, MoreVertical, Flag, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import type { WakerProfile } from '@/hooks/useNearbyWakers';

interface Props {
  waker: WakerProfile;
  showDistance?: boolean;
  isCurrentUser?: boolean;
  showAlarmLabel?: boolean;
}

function ringStyle(woke_at: string, hasStatus: boolean) {
  const ageMin = (Date.now() - new Date(woke_at).getTime()) / 60000;
  if (ageMin > 120) return { ring: 'ring-white/10', glow: '', dot: 'bg-white/30' };
  if (hasStatus) return {
    ring: 'ring-2 ring-[#00E676]',
    glow: 'shadow-[0_0_12px_rgba(0,230,118,0.4)]',
    dot: 'bg-[#00E676]',
  };
  return {
    ring: 'ring-2 ring-[#FFD740]',
    glow: 'shadow-[0_0_12px_rgba(255,215,64,0.3)]',
    dot: 'bg-[#FFD740]',
  };
}

export function NearbyWakerCard({ waker, showDistance, isCurrentUser, showAlarmLabel = true }: Props) {
  const { user } = useAuth();
  const [reported, setReported] = useState(false);
  const hasStatus = !!waker.status_text;
  const { ring, glow, dot } = ringStyle(waker.woke_at, hasStatus);
  const ageMin = (Date.now() - new Date(waker.woke_at).getTime()) / 60000;
  const isNew = ageMin < 5;
  const time = new Date(waker.woke_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const initial = (waker.display_name || '?').charAt(0).toUpperCase();
  const locLine = waker.is_anonymous
    ? `Someone in ${waker.city || 'unknown'}${waker.distance_km != null ? ` • ${waker.distance_km} km` : ''}`
    : showDistance && waker.distance_km != null
      ? `${waker.city || ''} • ${waker.distance_km} km`
      : waker.city || waker.country || '—';

  const handleReport = async () => {
    if (!user || reported) return;
    const { error } = await supabase
      .from('rise_wake_reports' as any)
      .insert({ event_id: waker.id, reporter_id: user.id, reason: 'inappropriate' });
    if (!error) {
      setReported(true);
      toast({ title: 'Reported', description: 'Thanks. Reviewers will look at this.' });
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-xl bg-[#111118] border border-white/[0.06] transition-all',
        'animate-in fade-in slide-in-from-bottom-2',
        isCurrentUser && 'border-[#6C63FF]/40 bg-[#6C63FF]/5',
        waker.first_in_thana && 'ring-1 ring-[#FFD740]/40',
      )}
    >
      <div className={cn('relative')}>
        {waker.is_anonymous ? (
          <div className={cn('h-12 w-12 rounded-full ring-offset-2 ring-offset-[#111118]', ring, glow,
            'bg-gradient-to-br from-[#6C63FF] to-[#FF5252] flex items-center justify-center text-white font-bold')}>
            ?
          </div>
        ) : (
          <Avatar className={cn('h-12 w-12 ring-offset-2 ring-offset-[#111118]', ring, glow)}>
            {waker.avatar_url ? <AvatarImage src={waker.avatar_url} alt="" /> : null}
            <AvatarFallback className="bg-[#6C63FF]/20 text-[#6C63FF] font-bold">{initial}</AvatarFallback>
          </Avatar>
        )}
        <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#111118]', dot)} />
        {waker.first_in_thana && (
          <span
            title="Thana এ আজ প্রথম"
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#FFD740] text-black flex items-center justify-center shadow-[0_0_10px_rgba(255,215,64,0.6)]"
          >
            <Star className="h-3 w-3 fill-current" />
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn('font-semibold text-sm truncate', waker.is_anonymous && 'text-white/70')}>
              {isCurrentUser ? 'You' : (waker.is_anonymous ? 'Anonymous' : waker.display_name)}
            </span>
            {isNew && (
              <Badge className="h-4 px-1.5 text-[9px] bg-[#00E676] text-black hover:bg-[#00E676]">NEW</Badge>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-white/40">{time}</span>
            {!isCurrentUser && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-white/40 hover:text-white">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-[#111118] border-white/10 text-white">
                  <DropdownMenuItem
                    onClick={handleReport}
                    disabled={reported}
                    className="text-[#FF5252] focus:text-[#FF5252] focus:bg-[#FF5252]/10"
                  >
                    <Flag className="h-3.5 w-3.5 mr-2" />
                    {reported ? 'Reported' : 'Report'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-white/50 mt-0.5">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{locLine}</span>
        </div>
        {showAlarmLabel && waker.alarm_label && (
          <div className="mt-1 text-xs text-[#6C63FF] truncate">"{waker.alarm_label}"</div>
        )}
        {hasStatus && (
          <div className="mt-1.5 flex items-center gap-2">
            {waker.status_emoji && <span className="text-lg leading-none">{waker.status_emoji}</span>}
            <span className="text-sm italic text-white/75">{waker.status_text}</span>
          </div>
        )}
        <div className="mt-1 flex items-center gap-2">
          {waker.mission_type && (
            <Badge variant="outline" className="h-5 text-[10px] border-white/10 text-white/60">
              {waker.mission_type} ✓
            </Badge>
          )}
          <span className="text-[10px] text-white/30">{formatDistanceToNow(new Date(waker.woke_at), { addSuffix: true })}</span>
        </div>
      </div>
    </div>
  );
}
