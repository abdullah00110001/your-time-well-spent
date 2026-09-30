import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Rocket, AlarmClock, X, Settings, Bell, MessageSquare,
  ShieldCheck, BatteryMedium, Volume2, Smartphone, ChevronRight,
  Shield, Zap, Lock, Moon, Globe, Music, Vibrate, Clock, TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { isNative } from '@/lib/capacitor/platform';
import { requestAllAlarmPermissions } from '@/lib/capacitor/nativeAlarm';
import { requestNotificationPermission, openBatterySettings } from '@/lib/capacitor/permissions';
import { useGroupSettings } from '@/hooks/useGroupSettings';
import { toast } from 'sonner';
import { NightToRiseCard } from './night-to-rise/NightToRiseCard';
import { Preferences } from '@capacitor/preferences';
import { Slider } from '@/components/ui/slider';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { RingtonePicker } from './RingtonePicker';
import { pickDeviceRingtone } from '@/lib/capacitor/nativeRingtonePicker';

/* ---------------------------------------------------------------------------
 * Persistence — keys MUST match AlarmSettingsPreferences.java on Android.
 * Capacitor's Preferences plugin writes into SharedPreferences("CapacitorStorage"),
 * so the same Java class can read these at alarm-trigger time.
 * ------------------------------------------------------------------------- */
const PK = {
  useBuiltInSpeaker:        'alarm.useBuiltInSpeaker',
  showNextAlarmNotif:       'alarm.showNextAlarmNotification',
  preventLastMinuteEdits:   'alarm.preventLastMinuteEdits',
  preventUninstall:         'alarm.preventUninstall',
  autoDismissMinutes:       'alarm.autoDismissMinutes',
  muteDuringMission:        'alarm.muteDuringMission',
  muteLimit:                'alarm.muteLimit',
  // Sound & vibration (read on Android by AlarmSettingsPreferences.java)
  ringtoneUri:              'alarm.ringtoneUri',
  ringtoneName:             'alarm.ringtoneName',
  volumePct:                'alarm.volumePct',
  vibrate:                  'alarm.vibrate',
  snoozeMinutes:            'alarm.snoozeMinutes',
  crescendo:                'alarm.crescendo',
} as const;

const DEFAULTS = {
  useBuiltInSpeaker:      true,
  showNextAlarmNotif:     false,
  preventLastMinuteEdits: false,
  preventUninstall:       false,
  autoDismissMinutes:     0,    // 0 = never
  muteDuringMission:      true,
  muteLimit:              3,
  ringtoneUri:            '',
  ringtoneName:           'Default',
  volumePct:              100,
  vibrate:                true,
  snoozeMinutes:          5,
  crescendo:              false,
};

const SNOOZE_PRESETS = [1, 3, 5, 10, 15];

async function loadBool(key: string, fallback: boolean): Promise<boolean> {
  const { value } = await Preferences.get({ key });
  if (value == null) return fallback;
  return value.trim().toLowerCase() === 'true';
}
async function loadInt(key: string, fallback: number): Promise<number> {
  const { value } = await Preferences.get({ key });
  if (value == null || value === '') return fallback;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}
async function loadStr(key: string, fallback: string): Promise<string> {
  const { value } = await Preferences.get({ key });
  return value ?? fallback;
}
async function saveStr(key: string, value: string) {
  await Preferences.set({ key, value });
}

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  value?: string;
  hasChevron?: boolean;
  hasSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  onClick?: () => void;
  iconColor?: string;
}

function SettingItem({ icon, title, description, value, hasChevron, hasSwitch, switchValue, onSwitchChange, onClick, iconColor = 'text-muted-foreground' }: SettingItemProps) {
  return (
    <button className="w-full flex items-center justify-between p-4 bg-card rounded-xl hover:bg-muted/50 transition-colors" onClick={onClick}>
      <div className="flex items-center gap-3">
        <span className={iconColor}>{icon}</span>
        <div className="text-left">
          <p className="font-medium text-sm">{title}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-sm text-primary">{value}</span>}
        {hasSwitch && <Switch checked={switchValue} onCheckedChange={onSwitchChange} onClick={(e) => e.stopPropagation()} />}
        {hasChevron && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
    </button>
  );
}

export function RiseSettings() {
  const navigate = useNavigate();
  const { settings, updateSettings } = useGroupSettings();

  // Persisted in Capacitor Preferences (= Android SharedPreferences "CapacitorStorage").
  const [useBuiltInSpeaker, setUseBuiltInSpeakerState] = useState(DEFAULTS.useBuiltInSpeaker);
  const [showNextAlarmNotification, setShowNextAlarmNotificationState] = useState(DEFAULTS.showNextAlarmNotif);
  const [preventLastMinuteEdits, setPreventLastMinuteEditsState] = useState(DEFAULTS.preventLastMinuteEdits);
  const [preventUninstall, setPreventUninstallState] = useState(DEFAULTS.preventUninstall);
  const [autoDismissMinutes, setAutoDismissMinutesState] = useState(DEFAULTS.autoDismissMinutes);
  const [muteDuringMission, setMuteDuringMissionState] = useState(DEFAULTS.muteDuringMission);
  const [muteLimit, setMuteLimitState] = useState(DEFAULTS.muteLimit);

  // Sound & vibration
  const [ringtoneUri, setRingtoneUriState] = useState(DEFAULTS.ringtoneUri);
  const [ringtoneName, setRingtoneNameState] = useState(DEFAULTS.ringtoneName);
  const [volumePct, setVolumePctState] = useState(DEFAULTS.volumePct);
  const [vibrate, setVibrateState] = useState(DEFAULTS.vibrate);
  const [snoozeMinutes, setSnoozeMinutesState] = useState(DEFAULTS.snoozeMinutes);
  const [crescendo, setCrescendoState] = useState(DEFAULTS.crescendo);
  const [ringtoneSheetOpen, setRingtoneSheetOpen] = useState(false);
  const [optimizationOpen, setOptimizationOpen] = useState(false);
  const [dndOpen, setDndOpen] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [cityInput, setCityInput] = useState(settings.city);

  // Hydrate from native/web persistence on mount
  useEffect(() => {
    (async () => {
      const [a, b, c, d, e, f, g, rUri, rName, vol, vib, snz, cre] = await Promise.all([
        loadBool(PK.useBuiltInSpeaker, DEFAULTS.useBuiltInSpeaker),
        loadBool(PK.showNextAlarmNotif, DEFAULTS.showNextAlarmNotif),
        loadBool(PK.preventLastMinuteEdits, DEFAULTS.preventLastMinuteEdits),
        loadBool(PK.preventUninstall, DEFAULTS.preventUninstall),
        loadInt(PK.autoDismissMinutes, DEFAULTS.autoDismissMinutes),
        loadBool(PK.muteDuringMission, DEFAULTS.muteDuringMission),
        loadInt(PK.muteLimit, DEFAULTS.muteLimit),
        loadStr(PK.ringtoneUri, DEFAULTS.ringtoneUri),
        loadStr(PK.ringtoneName, DEFAULTS.ringtoneName),
        loadInt(PK.volumePct, DEFAULTS.volumePct),
        loadBool(PK.vibrate, DEFAULTS.vibrate),
        loadInt(PK.snoozeMinutes, DEFAULTS.snoozeMinutes),
        loadBool(PK.crescendo, DEFAULTS.crescendo),
      ]);
      setUseBuiltInSpeakerState(a);
      setShowNextAlarmNotificationState(b);
      setPreventLastMinuteEditsState(c);
      setPreventUninstallState(d);
      setAutoDismissMinutesState(e);
      setMuteDuringMissionState(f);
      setMuteLimitState(g);
      setRingtoneUriState(rUri);
      setRingtoneNameState(rName);
      setVolumePctState(vol);
      setVibrateState(vib);
      setSnoozeMinutesState(snz);
      setCrescendoState(cre);
    })().catch((err) => console.warn('[RiseSettings] load failed', err));
  }, []);

  // Setter wrappers — persist to Capacitor Preferences immediately.
  const setUseBuiltInSpeaker = (v: boolean) => { setUseBuiltInSpeakerState(v); saveStr(PK.useBuiltInSpeaker, String(v)); };
  const setShowNextAlarmNotification = (v: boolean) => { setShowNextAlarmNotificationState(v); saveStr(PK.showNextAlarmNotif, String(v)); };
  const setPreventLastMinuteEdits = (v: boolean) => { setPreventLastMinuteEditsState(v); saveStr(PK.preventLastMinuteEdits, String(v)); };
  const setPreventUninstall = (v: boolean) => { setPreventUninstallState(v); saveStr(PK.preventUninstall, String(v)); };
  const setAutoDismissMinutes = (v: number) => { setAutoDismissMinutesState(v); saveStr(PK.autoDismissMinutes, String(v)); };
  const setMuteDuringMission = (v: boolean) => { setMuteDuringMissionState(v); saveStr(PK.muteDuringMission, String(v)); };
  const setMuteLimit = (v: number) => { setMuteLimitState(v); saveStr(PK.muteLimit, String(v)); };

  const setRingtone = (uri: string, name: string) => {
    setRingtoneUriState(uri);
    setRingtoneNameState(name);
    void saveStr(PK.ringtoneUri, uri);
    void saveStr(PK.ringtoneName, name);
  };
  const setVolumePct = (v: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(v)));
    setVolumePctState(clamped);
    void saveStr(PK.volumePct, String(clamped));
  };
  const setVibrate = (v: boolean) => { setVibrateState(v); void saveStr(PK.vibrate, String(v)); };
  const setCrescendo = (v: boolean) => { setCrescendoState(v); void saveStr(PK.crescendo, String(v)); };
  const cycleSnooze = () => {
    const idx = SNOOZE_PRESETS.indexOf(snoozeMinutes);
    const next = SNOOZE_PRESETS[(idx + 1) % SNOOZE_PRESETS.length];
    setSnoozeMinutesState(next);
    void saveStr(PK.snoozeMinutes, String(next));
    toast.success(`Snooze: ${next} min`);
  };

  const openRingtonePicker = async () => {
    // On native, prefer the system ringtone picker (fast, no network).
    if (isNative) {
      try {
        const picked = await pickDeviceRingtone({
          title: 'Choose default alarm sound',
          existingUri: ringtoneUri || null,
        });
        if (picked?.uri) {
          const name = (picked.title || '').trim() || 'Device ringtone';
          setRingtone(picked.uri, name);
          toast.success(`Default alarm sound: ${name}`);
          return;
        }
      } catch (e) {
        console.warn('[RiseSettings] device picker failed, opening in-app picker', e);
      }
    }
    setRingtoneSheetOpen(true);
  };

  // Auto-dismiss preset cycle: Off → 1m → 5m → 10m → 30m → Off
  const cycleAutoDismiss = () => {
    const presets = [0, 1, 5, 10, 30];
    const idx = presets.indexOf(autoDismissMinutes);
    const next = presets[(idx + 1) % presets.length];
    setAutoDismissMinutes(next);
    toast.success(next === 0 ? 'Auto-dismiss turned off' : `Auto-dismiss after ${next} min`);
  };
  // Mute-limit cycle: 1 → 3 → 5 → 10 → 1
  const cycleMuteLimit = () => {
    const presets = [1, 3, 5, 10];
    const idx = presets.indexOf(muteLimit);
    const next = presets[(idx + 1) % presets.length];
    setMuteLimit(next);
    toast.success(`Mute limit: ${next} time${next === 1 ? '' : 's'}`);
  };
  // Last-minute-edits is a binary toggle exposed via the chevron row.
  const togglePreventLastMinuteEdits = () => {
    const next = !preventLastMinuteEdits;
    setPreventLastMinuteEdits(next);
    toast.success(next ? 'Last-minute edits blocked' : 'Last-minute edits allowed');
  };

  // Pull next Rise alarm time from local storage if available
  let nextAlarmTime: string | null = null;
  try {
    const raw = localStorage.getItem('local_alarms');
    if (raw) {
      const list = JSON.parse(raw) as Array<{ enabled?: boolean; time?: string }>;
      const enabled = list.find((a) => a.enabled && a.time);
      if (enabled?.time) nextAlarmTime = enabled.time;
    }
  } catch {}

  const autoDismissLabel = autoDismissMinutes === 0 ? 'Off' : `${autoDismissMinutes}m`;

  return (
    <div className="space-y-4">
      <NightToRiseCard onOpen={() => navigate('/rise/night-to-rise')} riseAlarmTime={nextAlarmTime} />

      <Collapsible open={dndOpen} onOpenChange={setDndOpen}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:border-primary/30 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="h-5 w-5 text-primary" />
                <div>
                  <span className="font-medium">Do Not Disturb</span>
                  {settings.dndEnabled && <p className="text-xs text-destructive">Enabled</p>}
                </div>
              </div>
              <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', dndOpen && 'rotate-90')} />
            </CardContent>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Card className="bg-muted/30">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">DND mode</p>
                  <p className="text-xs text-muted-foreground">Other members will not be able to send wake signals</p>
                </div>
                <Switch checked={settings.dndEnabled} onCheckedChange={(v) => updateSettings({ dndEnabled: v })} />
              </div>
              {settings.dndEnabled && (
                <div className="space-y-2">
                  <Label>Reason shown to the group</Label>
                  <Input placeholder="Example: Sick today" value={settings.dndReason} onChange={(e) => updateSettings({ dndReason: e.target.value })} />
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={locationOpen} onOpenChange={setLocationOpen}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:border-primary/30 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-primary" />
                <div>
                  <span className="font-medium">Location sharing</span>
                  {settings.locationOptIn && <p className="text-xs text-emerald-500">{settings.city || 'Enabled'}</p>}
                </div>
              </div>
              <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', locationOpen && 'rotate-90')} />
            </CardContent>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <Card className="bg-muted/30">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Show me in the community feed</p>
                  <p className="text-xs text-muted-foreground">Only your city will be shared</p>
                </div>
                <Switch checked={settings.locationOptIn} onCheckedChange={(v) => updateSettings({ locationOptIn: v })} />
              </div>
              {settings.locationOptIn && (
                <div className="space-y-2">
                  <Label>Your city</Label>
                  <div className="flex gap-2">
                    <Input placeholder="Example: Dhaka" value={cityInput} onChange={(e) => setCityInput(e.target.value)} />
                    <Button size="sm" onClick={() => { updateSettings({ city: cityInput.trim() }); toast.success('City saved'); }}>Save</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={optimizationOpen} onOpenChange={setOptimizationOpen}>
        <CollapsibleTrigger asChild>
          <Card className="cursor-pointer hover:border-primary/30 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Rocket className="h-5 w-5 text-primary" />
                <span className="font-medium">Alarm reliability</span>
              </div>
              <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', optimizationOpen && 'rotate-90')} />
            </CardContent>
          </Card>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-2">
          <Card className="bg-muted/30">
            <CardContent className="p-4 space-y-4">
              <div>
                <h3 className="font-bold text-lg mb-2">Alarm not ringing?</h3>
                <p className="text-sm text-muted-foreground">Grant notification access, allow alarms, and disable battery restrictions for best results.</p>
              </div>
              <Button className="w-full" onClick={async () => {
                const granted = await requestAllAlarmPermissions();
                if (granted) toast.success('Alarm permissions granted');
                else toast.error('Alarm permissions are still blocked');
              }}>
                <ShieldCheck className="h-4 w-4 mr-2" />Grant alarm permissions
              </Button>
              <Button variant="outline" className="w-full" onClick={async () => {
                const result = await requestNotificationPermission();
                if (result === 'granted') toast.success('Notifications enabled');
                else toast.error('Notification permission denied');
              }}>
                <Bell className="h-4 w-4 mr-2" />Enable notifications
              </Button>
              {isNative && (
                <Button variant="outline" className="w-full" onClick={() => { openBatterySettings(); toast.success('Opening battery settings'); }}>
                  <BatteryMedium className="h-4 w-4 mr-2" />Open battery settings
                </Button>
              )}
              <Button variant="outline" className="w-full"><MessageSquare className="h-4 w-4 mr-2" />Send feedback</Button>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Music className="h-4 w-4" />Sound & vibration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingItem
            icon={<Music className="h-5 w-5" />}
            title="Default alarm sound"
            description={ringtoneName || 'Default'}
            hasChevron
            onClick={openRingtonePicker}
            iconColor="text-primary"
          />

          <div className="p-4 bg-card rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Volume2 className="h-5 w-5 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-medium text-sm">Alarm volume</p>
                  <p className="text-xs text-muted-foreground">{volumePct}%</p>
                </div>
              </div>
            </div>
            <Slider
              value={[volumePct]}
              min={0}
              max={100}
              step={5}
              onValueChange={(v) => setVolumePct(v[0] ?? 100)}
              aria-label="Alarm volume"
            />
          </div>

          <SettingItem
            icon={<Vibrate className="h-5 w-5" />}
            title="Vibrate on alarm"
            description="Phone will vibrate while ringing"
            hasSwitch
            switchValue={vibrate}
            onSwitchChange={setVibrate}
          />
          <SettingItem
            icon={<TrendingUp className="h-5 w-5" />}
            title="Gradually increase volume"
            description="Start quiet, ramp to full over 30s"
            hasSwitch
            switchValue={crescendo}
            onSwitchChange={setCrescendo}
          />
          <SettingItem
            icon={<Clock className="h-5 w-5" />}
            title="Snooze duration"
            value={`${snoozeMinutes} min`}
            hasChevron
            onClick={cycleSnooze}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><AlarmClock className="h-4 w-4" />Alarm settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <SettingItem icon={<Volume2 className="h-5 w-5" />} title="Use built-in speaker" description="Prefer device speaker for alarms" hasSwitch switchValue={useBuiltInSpeaker} onSwitchChange={setUseBuiltInSpeaker} />
          <SettingItem icon={<Smartphone className="h-5 w-5" />} title="Show next alarm notification" hasSwitch switchValue={showNextAlarmNotification} onSwitchChange={setShowNextAlarmNotification} />
          <SettingItem icon={<Lock className="h-5 w-5" />} title="Prevent last-minute edits" value={preventLastMinuteEdits ? 'On' : 'Off'} hasChevron onClick={togglePreventLastMinuteEdits} iconColor="text-primary" />
          <SettingItem icon={<Shield className="h-5 w-5" />} title="Discourage uninstall during alarm" hasSwitch switchValue={preventUninstall} onSwitchChange={setPreventUninstall} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><X className="h-4 w-4" />Dismiss and mission</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <SettingItem icon={<Zap className="h-5 w-5" />} title="Auto dismiss" description="Stop after a timeout if you do not respond" value={autoDismissLabel} hasChevron onClick={cycleAutoDismiss} />
          <SettingItem icon={<Volume2 className="h-5 w-5" />} title="Mute during mission" hasSwitch switchValue={muteDuringMission} onSwitchChange={setMuteDuringMission} />
          <SettingItem icon={<Settings className="h-5 w-5" />} title="Mute limit" description="Mute will be ignored after the limit" value={`${muteLimit} time${muteLimit === 1 ? '' : 's'}`} hasChevron onClick={cycleMuteLimit} />
        </CardContent>
      </Card>

      <Sheet open={ringtoneSheetOpen} onOpenChange={setRingtoneSheetOpen}>
        <SheetContent side="bottom" className="h-[85vh] p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
            <SheetTitle>Choose alarm sound</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <RingtonePicker
              selectedId={ringtoneUri}
              onSelect={(uri, rt) => {
                setRingtone(uri, rt.name);
                setRingtoneSheetOpen(false);
              }}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
