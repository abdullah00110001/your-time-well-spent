import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Bell, AlarmClock, Activity, Eye, BatteryCharging, ShieldCheck, MonitorSmartphone,
  Layers, Camera, MapPin, Wifi, Mic, HardDrive, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';

interface Perm {
  icon: any;
  name: string;
  required: string;
  features: string[];
  why: string;
  ifDenied: string;
  scope: string;
}

const PERMISSIONS: Perm[] = [
  {
    icon: Bell,
    name: 'Notifications',
    required: 'Required',
    features: ['Rise alarms', 'Habit reminders', 'Group wake nudges'],
    why: 'To deliver alarms, reminders, and accountability nudges. Without this, reminders silently fail.',
    ifDenied: 'You won\'t receive habit reminders or wake alarms. Core tracking still works.',
    scope: 'Notifications only. We never read existing notifications from other apps.',
  },
  {
    icon: AlarmClock,
    name: 'Exact Alarms (SCHEDULE_EXACT_ALARM)',
    required: 'Required',
    features: ['Rise alarms'],
    why: 'Android Doze can delay normal alarms by minutes or hours. Exact alarms guarantee Rise rings on time, even on locked screens.',
    ifDenied: 'Alarms may be silently delayed or skipped by the OS — the whole Rise feature becomes unreliable.',
    scope: 'Used only for alarms you create. We never schedule background tasks behind your back.',
  },
  {
    icon: Activity,
    name: 'Usage Access (PACKAGE_USAGE_STATS)',
    required: 'Required for Shield',
    features: ['Shield app blocker', 'Screen-time insights'],
    why: 'Shield needs to detect when a blocked app comes to the foreground so it can show the block screen.',
    ifDenied: 'Shield cannot detect or block apps. Screen-time insights stop working.',
    scope: 'We read which app is in the foreground — never message contents, never history beyond the current session.',
  },
  {
    icon: Layers,
    name: 'Display Over Other Apps (SYSTEM_ALERT_WINDOW)',
    required: 'Required for Shield + PureShield',
    features: ['Shield block screen', 'PureShield blur overlay'],
    why: 'To draw the block screen above the distracting app, and to render real-time face/content blur.',
    ifDenied: 'Shield and PureShield cannot function. No overlays appear.',
    scope: 'Only drawn while Shield/PureShield is active. Tap-through is disabled by design.',
  },
  {
    icon: Activity,
    name: 'Accessibility Service',
    required: 'Required for Shield',
    features: ['Shield app blocker', 'PureShield text scan'],
    why: 'The most reliable signal for detecting blocked apps on Android 13+ where Usage Stats is rate-limited.',
    ifDenied: 'Shield falls back to Usage Stats only — less reliable, may miss fast app-switches.',
    scope: 'We only check the package name of the foreground app. We never log keystrokes, never read passwords, never exfiltrate screen content.',
  },
  {
    icon: MonitorSmartphone,
    name: 'Screen Capture (MediaProjection)',
    required: 'Required for PureShield',
    features: ['PureShield visual filter'],
    why: 'PureShield must see what\'s on screen to detect and blur faces or adult imagery — all processed on-device.',
    ifDenied: 'PureShield will not work. Other features are unaffected.',
    scope: 'Frames stay on-device. Nothing is saved, uploaded, or shared. The capture token must be re-granted on each session by Android — by design.',
  },
  {
    icon: ShieldCheck,
    name: 'Device Admin',
    required: 'Optional',
    features: ['Adult content DNS lock', 'Anti-uninstall while Shield active'],
    why: 'To lock the adult-content DNS filter and prevent the app from being uninstalled during a focus session.',
    ifDenied: 'You can still use Shield, but adult DNS filter can be bypassed by changing DNS, and the app can be uninstalled mid-session.',
    scope: 'Limited to force-lock policy. We do not wipe data, manage passwords, or control other apps.',
  },
  {
    icon: BatteryCharging,
    name: 'Ignore Battery Optimization',
    required: 'Required',
    features: ['Shield', 'Rise', 'PureShield'],
    why: 'Aggressive OEM battery savers (Xiaomi, Oppo, Vivo, Samsung) kill foreground services. This permission keeps Shield/Rise alive.',
    ifDenied: 'Shield/Rise may be killed in the background — alarms miss, blocks bypass.',
    scope: 'Only affects this app. Your overall battery management is untouched.',
  },
  {
    icon: Camera,
    name: 'Camera',
    required: 'Optional',
    features: ['Wake-up photo proof', 'Profile picture'],
    why: 'For wake selfie proof and uploading a profile picture.',
    ifDenied: 'You can still use the app fully — just skip selfie proof and use initials as avatar.',
    scope: 'Camera only opens when you tap to take a photo. We never record without explicit action.',
  },
  {
    icon: MapPin,
    name: 'Approximate Location',
    required: 'Optional',
    features: ['Community wake feed', 'Fajr auto-alarm (future)'],
    why: 'To show city-level "people waking up near you" and (in future) auto-set Fajr time.',
    ifDenied: 'Community feed becomes global instead of local. No other impact.',
    scope: 'City-level only. We never store precise GPS coordinates.',
  },
  {
    icon: Mic,
    name: 'Microphone',
    required: 'Not used',
    features: [],
    why: 'Life OS does NOT request microphone access. We don\'t listen, ever.',
    ifDenied: '—',
    scope: 'No mic permission is declared in the app manifest.',
  },
  {
    icon: HardDrive,
    name: 'Storage / Photos',
    required: 'Optional',
    features: ['Export PDF reports', 'Share cards'],
    why: 'To save exported reports and shareable images to your device.',
    ifDenied: 'Exports still work via system share sheet, but cannot save directly to gallery.',
    scope: 'Write-only to a folder you choose. We don\'t scan your photo library.',
  },
  {
    icon: Wifi,
    name: 'Internet',
    required: 'Required',
    features: ['Sync', 'Auth', 'Groups', 'AI insights'],
    why: 'To sync your data with our secure backend (Supabase) and power AI insights.',
    ifDenied: 'App becomes read-only on cached data. No sync, no groups, no AI.',
    scope: 'All traffic is HTTPS. Data is row-level-secured to your account.',
  },
];

const STATUS_STYLES: Record<string, string> = {
  Required: 'border-amber-500/30 text-amber-500 bg-amber-500/10',
  'Required for Shield': 'border-violet-500/30 text-violet-400 bg-violet-500/10',
  'Required for Shield + PureShield': 'border-violet-500/30 text-violet-400 bg-violet-500/10',
  'Required for PureShield': 'border-violet-500/30 text-violet-400 bg-violet-500/10',
  Optional: 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10',
  'Not used': 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10',
};

export default function Permissions() {
  return (
    <MarketingLayout
      eyebrow="Transparency first"
      title="Permissions, explained"
      subtitle="Every permission Life OS requests, why we need it, what happens if you deny it, and exactly what we can and cannot see."
    >
      <div className="mx-auto max-w-5xl px-4 pb-24">
        {/* Principles */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card/60 to-accent/5 mb-10">
          <CardContent className="p-6 grid sm:grid-cols-3 gap-5">
            <Principle icon={CheckCircle2} title="Asked when needed" desc="Permissions are requested only when you turn on the feature that uses them — never upfront." />
            <Principle icon={Eye} title="On-device by default" desc="Vision features (PureShield) run entirely on your phone. Frames never leave the device." />
            <Principle icon={XCircle} title="Easy to revoke" desc="Every permission can be revoked from Android Settings. The app degrades gracefully." />
          </CardContent>
        </Card>

        <div className="space-y-4">
          {PERMISSIONS.map((p) => (
            <Card key={p.name} className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <p.icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">{p.name}</h3>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[p.required] || ''}`}>
                        {p.required}
                      </Badge>
                    </div>
                    {p.features.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {p.features.map((f) => (
                          <span key={f} className="text-[11px] px-2 py-0.5 rounded-md bg-muted/50 text-muted-foreground border border-border/40">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="grid sm:grid-cols-3 gap-3 text-sm">
                      <Block label="Why we need it" value={p.why} />
                      <Block label="If you deny" value={p.ifDenied} accent="amber" />
                      <Block label="What we can see" value={p.scope} accent="emerald" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-10 border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-6 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Android-only.</strong> The iOS build (when released)
              uses a different permission model — Screen Time API, Notification Auth, and Focus modes —
              and will have its own documentation.
            </p>
          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
}

function Principle({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div>
      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h4 className="font-semibold mb-1">{title}</h4>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function Block({ label, value, accent }: { label: string; value: string; accent?: 'amber' | 'emerald' }) {
  const color =
    accent === 'amber' ? 'text-amber-500' : accent === 'emerald' ? 'text-emerald-500' : 'text-primary';
  return (
    <div>
      <p className={`text-[10px] uppercase tracking-wider font-semibold mb-1 ${color}`}>{label}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">{value}</p>
    </div>
  );
}
