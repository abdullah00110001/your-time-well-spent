import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Globe, Building2, MapPin, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWakeLocation, type LocationMode } from '@/hooks/useWakeLocation';
import { toast } from 'sonner';

const OPTIONS: { mode: LocationMode; icon: any; title: string; sub1: string; sub2: string }[] = [
  { mode: 'global',  icon: Globe,      title: '🌍 Global',      sub1: 'সারা বিশ্বের feed এ দেখাবে', sub2: 'শহরের নাম দেখাবে' },
  { mode: 'city',    icon: Building2,  title: '🏙️ City Only',   sub1: 'শুধু আপনার শহরে দেখাবে',     sub2: 'GPS লাগবে না' },
  { mode: 'nearby',  icon: MapPin,     title: '📍 Nearby (5km)', sub1: 'কাছের মানুষ দেখতে পাবে',    sub2: 'GPS permission লাগবে' },
  { mode: 'private', icon: Lock,       title: '🔒 Private',      sub1: 'কেউ দেখতে পাবে না',          sub2: 'কোনো feed-এ দেখাবে না' },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

export function LocationPrivacySheet({ open, onOpenChange, onSaved }: Props) {
  const { locationSettings, saveLocationSettings, requestGPSPermission } = useWakeLocation();
  const [mode, setMode] = useState<LocationMode>('city');
  const [anon, setAnon] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (locationSettings) {
      setMode(locationSettings.location_mode);
      setAnon(locationSettings.is_anonymous);
    }
  }, [locationSettings, open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'nearby') {
        const granted = await requestGPSPermission();
        if (!granted) {
          toast.error('GPS permission denied — switching to City mode');
          await saveLocationSettings('city', anon);
          onSaved?.();
          onOpenChange(false);
          return;
        }
      }
      await saveLocationSettings(mode, anon);
      toast.success('Location preference saved');
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="bg-[#0A0A0F] border-white/10 text-white rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="text-white text-xl">📍 Location Sharing</SheetTitle>
          <p className="text-sm text-white/60">কিভাবে share করতে চান?</p>
        </SheetHeader>

        <div className="space-y-2 mt-4">
          {OPTIONS.map(opt => {
            const selected = mode === opt.mode;
            return (
              <button
                key={opt.mode}
                onClick={() => setMode(opt.mode)}
                className={cn(
                  'w-full text-left p-4 rounded-xl border transition-all',
                  selected
                    ? 'border-[#6C63FF] bg-[#6C63FF]/10 shadow-[0_0_18px_rgba(108,99,255,0.35)]'
                    : 'border-white/10 bg-[#111118] hover:bg-white/5'
                )}
              >
                <div className="font-semibold">{opt.title}</div>
                <div className="text-xs text-white/60 mt-1">{opt.sub1}</div>
                <div className="text-xs text-white/40">{opt.sub2}</div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between mt-5 p-4 rounded-xl bg-[#111118] border border-white/10">
          <div>
            <div className="font-medium text-sm">Anonymous mode</div>
            <div className="text-xs text-white/50">নাম লুকিয়ে রাখুন</div>
          </div>
          <Switch checked={anon} onCheckedChange={setAnon} />
        </div>

        <div className="flex items-center gap-2 mt-3 text-xs text-white/50">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          আপনার exact location কখনো দেখানো হয় না
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full mt-4 bg-[#6C63FF] hover:bg-[#5b52ff] text-white">
          {saving ? 'Saving…' : 'Save করুন'}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
