import { Switch } from '@/components/ui/switch';
import { ChevronRight, Camera, Calculator, Smartphone, QrCode, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical } from 'lucide-react';

interface RiseAlarm {
  id: string;
  alarm_time: string;
  days_of_week: number[];
  alarm_type: string;
  is_enabled: boolean;
  intention: string | null;
  label: string | null;
  verification_type: string;
  snooze_limit: number;
  sound_type?: string;
}

interface RiseAlarmCardProps {
  alarm: RiseAlarm;
  onToggle: (id: string, enabled: boolean) => void;
  onEdit: (alarm: RiseAlarm) => void;
  onDelete: (id: string) => void;
  onDuplicate: (alarm: RiseAlarm) => void;
}

const MISSION_ICONS: Record<string, any> = {
  photo: Camera,
  math: Calculator,
  shake: Smartphone,
  qr: QrCode,
  barcode: QrCode,
};

const MISSION_NAMES: Record<string, string> = {
  photo: 'Photo',
  math: 'Math',
  shake: 'Shake',
  qr: 'QR Code',
  barcode: 'Barcode',
  none: 'Tap to dismiss',
};

export function RiseAlarmCard({
  alarm,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
}: RiseAlarmCardProps) {
  const [hStr, mStr] = alarm.alarm_time.split(':');
  const h = parseInt(hStr);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const isDaily = alarm.days_of_week.length === 7;
  const daysSummary = isDaily
    ? 'Every day'
    : alarm.days_of_week.length === 0
    ? 'Once'
    : alarm.days_of_week.map((d) => dayLabels[d]).join(' · ');

  const MissionIcon = MISSION_ICONS[alarm.verification_type];

  return (
    <div
      onClick={() => onEdit(alarm)}
      className={cn(
        'group relative rounded-2xl overflow-hidden cursor-pointer transition-all',
        'bg-card border border-border shadow-sm hover:border-foreground/20',
        !alarm.is_enabled && 'opacity-50'
      )}
    >
      {alarm.is_enabled && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
      )}

      <div className="p-4 pl-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-3xl md:text-4xl font-black tabular-nums tracking-tight text-foreground">
                {displayHour}:{mStr}
              </span>
              <span className="text-base font-semibold text-muted-foreground">{ampm}</span>
            </div>

            {alarm.label && (
              <p className="text-sm font-medium text-foreground/90 truncate mb-1.5">
                {alarm.label}
              </p>
            )}

            <p className="text-xs text-muted-foreground mb-2">{daysSummary}</p>

            {/* Day pills */}
            <div className="flex gap-1 mb-2">
              {dayLabels.map((d, i) => {
                const active = alarm.days_of_week.includes(i);
                return (
                  <span
                    key={i}
                    className={cn(
                      'h-5 w-5 text-[10px] font-bold flex items-center justify-center rounded-full',
                      active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground/50'
                    )}
                  >
                    {d}
                  </span>
                );
              })}
            </div>

            {MissionIcon && (
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-medium">
                <MissionIcon className="h-3 w-3" />
                {MISSION_NAMES[alarm.verification_type] || 'Mission'}
              </div>
            )}
          </div>

          <div
            className="flex flex-col items-end gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Switch
              checked={alarm.is_enabled}
              onCheckedChange={(c) => onToggle(alarm.id, c)}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(alarm)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(alarm)}>Duplicate</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(alarm.id)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}
