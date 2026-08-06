import { useGroupPresence, usePresenceHeartbeat, PresenceStatus } from '@/hooks/useLifeosLive';
import { cn } from '@/lib/utils';

const STATUS_META: Record<PresenceStatus, { label: string; dot: string; ring: string }> = {
  sleeping:        { label: 'Sleeping',   dot: 'bg-indigo-500',  ring: 'ring-indigo-500/40' },
  waking:          { label: 'Waking',     dot: 'bg-amber-500',   ring: 'ring-amber-500/40' },
  in_rise_mission: { label: 'Rise',       dot: 'bg-orange-500',  ring: 'ring-orange-500/40' },
  deep_work:       { label: 'Deep Work',  dot: 'bg-emerald-500', ring: 'ring-emerald-500/50' },
  shield_focus:    { label: 'Shield',     dot: 'bg-cyan-500',    ring: 'ring-cyan-500/40' },
  distracted:      { label: 'Distracted', dot: 'bg-rose-500',    ring: 'ring-rose-500/40' },
  idle:            { label: 'Idle',       dot: 'bg-muted-foreground/50', ring: 'ring-border' },
  offline:         { label: 'Offline',    dot: 'bg-muted-foreground/30', ring: 'ring-border' },
};

export function LivePresenceStrip({ groupId, selfStatus }: { groupId: string; selfStatus?: PresenceStatus }) {
  usePresenceHeartbeat(groupId, selfStatus ?? 'idle');
  const { data: presence = [] } = useGroupPresence(groupId);

  const online = presence.filter(p => p.status !== 'offline');
  const list = [...online, ...presence.filter(p => p.status === 'offline')].slice(0, 24);

  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold tracking-wide uppercase text-muted-foreground">Live Presence</h3>
        <span className="text-[10px] font-semibold text-emerald-500">{online.length} online</span>
      </div>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">No members yet</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map(p => {
            const meta = STATUS_META[p.status] ?? STATUS_META.offline;
            const initials = (p.display_name || 'M').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={p.user_id} className="flex flex-col items-center gap-1 w-14" title={`${p.display_name} • ${meta.label}`}>
                <div className={cn('relative h-10 w-10 rounded-full ring-2 flex items-center justify-center bg-gradient-to-br from-primary/40 to-primary/10 text-[11px] font-bold', meta.ring)}>
                  {initials}
                  <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card', meta.dot)} />
                </div>
                <span className="text-[9px] text-muted-foreground truncate w-full text-center leading-tight">{meta.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}