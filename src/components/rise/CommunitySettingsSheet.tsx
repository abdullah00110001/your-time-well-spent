import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Eye, ShieldOff, MapPin, Tag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCommunitySettings } from '@/hooks/useCommunitySettings';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const RADII = [
  { v: 5, label: '5 km' },
  { v: 10, label: '10 km' },
  { v: 9999, label: 'পুরো শহর' },
];

function Row({ icon, title, subtitle, right }: { icon: React.ReactNode; title: string; subtitle: string; right: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-3 border-b border-border last:border-0">
      <div className="flex items-start gap-3 min-w-0">
        <div className="text-muted-foreground mt-0.5">{icon}</div>
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>
        </div>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

export function CommunitySettingsSheet({ open, onOpenChange }: Props) {
  const { settings, update } = useCommunitySettings();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[88vh] overflow-y-auto">
        <SheetHeader className="text-left pb-2">
          <SheetTitle className="text-lg">Community Settings</SheetTitle>
        </SheetHeader>

        <div className="rounded-2xl bg-muted/40 border border-border px-4 mt-2">
          <Row
            icon={<Eye className="h-4 w-4" />}
            title="Community তে দেখাও"
            subtitle="OFF করলে feed এ দেখাবে না"
            right={<Switch checked={settings.show_in_community} onCheckedChange={(v) => update({ show_in_community: v })} />}
          />
          <Row
            icon={<ShieldOff className="h-4 w-4" />}
            title="Anonymous mode"
            subtitle="OFF করলে নাম+ছবি দেখাবে (next wake থেকে)"
            right={<Switch checked={settings.anonymous_mode} onCheckedChange={(v) => update({ anonymous_mode: v })} />}
          />
          <Row
            icon={<Tag className="h-4 w-4" />}
            title="Alarm label দেখাও"
            subtitle="কেন উঠছো — feed এ দেখাবে কিনা"
            right={<Switch checked={settings.show_alarm_label} onCheckedChange={(v) => update({ show_alarm_label: v })} />}
          />
        </div>

        <div className="rounded-2xl bg-muted/40 border border-border p-4 mt-3">
          <div className="flex items-center gap-2 text-sm font-medium mb-3 text-foreground">
            <MapPin className="h-4 w-4 text-muted-foreground" /> Nearby radius
          </div>
          <div className="grid grid-cols-3 gap-2">
            {RADII.map((r) => {
              const active = settings.nearby_radius_km === r.v;
              return (
                <button
                  key={r.v}
                  onClick={() => update({ nearby_radius_km: r.v })}
                  className={cn(
                    'py-2 rounded-xl text-xs font-medium transition-all border',
                    active
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card text-muted-foreground hover:text-foreground border-border',
                  )}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/70 text-center mt-4 mb-2">
          Changes apply instantly. কোনো save button লাগবে না।
        </p>
      </SheetContent>
    </Sheet>
  );
}
