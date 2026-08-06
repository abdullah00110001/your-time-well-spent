import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { Card, CardContent } from '@/components/ui/card';
import {
  Lock, ShieldCheck, Cpu, Cloud, Eye, Trash2, FileText, Server, Key, Database, Mail, CheckCircle2, XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Privacy() {
  return (
    <MarketingLayout
      eyebrow="Privacy & Data Safety"
      title="Your life. Your data. Always."
      subtitle="Life OS is built on a simple principle: the most personal app on your phone should treat your data like it's sacred."
    >
      <div className="mx-auto max-w-4xl px-4 pb-24 space-y-10">
        {/* Promises */}
        <div className="grid sm:grid-cols-2 gap-4">
          <Promise icon={XCircle} negative title="No ads. Ever." desc="No banner ads. No interstitials. No tracking SDKs. The app makes money only from subscriptions." />
          <Promise icon={XCircle} negative title="We don't sell data." desc="We don't sell, rent, broker, or share your personal data with third parties for marketing." />
          <Promise icon={CheckCircle2} title="On-device ML" desc="PureShield face/content detection runs entirely on your phone. Frames never leave the device." />
          <Promise icon={CheckCircle2} title="You own your data" desc="Export anything as PDF/CSV anytime. Delete your account and we wipe everything within 30 days." />
        </div>

        {/* How data flows */}
        <section>
          <SectionHeader icon={Database} title="What we collect and where it lives" />
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-6 space-y-4 text-sm text-muted-foreground">
              <Row label="Account" value="Email, display name, optional profile photo. Stored in Supabase Auth (encrypted at rest)." />
              <Row label="Daily inputs" value="Habits, salah, mood, sleep, custom fields. Stored in your row, secured by row-level security (RLS). Only you can read it." />
              <Row label="Journal" value="Private text. Encrypted in transit (HTTPS) and isolated per-user via RLS." />
              <Row label="Shield/Rise settings" value="Profiles, schedules, alarms. Synced to your account so it survives reinstalls." />
              <Row label="PureShield frames" value="Never uploaded. Never stored. Processed in RAM on-device, then discarded." />
              <Row label="Groups" value="Only your display name and wake status are visible to group members. Daily inputs are NOT shared." />
              <Row label="Analytics" value="Anonymous, aggregate usage stats (e.g. crash reports). No personally-identifiable content." />
            </CardContent>
          </Card>
        </section>

        {/* Security */}
        <section>
          <SectionHeader icon={ShieldCheck} title="How it stays safe" />
          <div className="grid sm:grid-cols-2 gap-4">
            <SafeCard icon={Lock} title="Encryption" desc="TLS 1.2+ in transit. AES-256 at rest (Supabase managed)." />
            <SafeCard icon={Key} title="Row-Level Security" desc="Postgres RLS on every user table — your data is mathematically isolated from other users." />
            <SafeCard icon={Server} title="Hardened backend" desc="Supabase + edge functions. Secrets stored in vault, never in client code." />
            <SafeCard icon={Cpu} title="On-device vision" desc="TensorFlow Lite models bundled in the app. PureShield frames never touch our servers." />
          </div>
        </section>

        {/* What we don't do */}
        <section>
          <SectionHeader icon={Eye} title="What we never do" />
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-6 grid sm:grid-cols-2 gap-3">
              {[
                'Read other apps\' notifications',
                'Log keystrokes via Accessibility',
                'Record audio or use the microphone',
                'Track precise GPS coordinates',
                'Upload screen-capture frames',
                'Show third-party ads',
                'Share your journal with anyone',
                'Sell data to data brokers',
              ].map((s) => (
                <div key={s} className="flex items-start gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{s}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* Your rights */}
        <section>
          <SectionHeader icon={FileText} title="Your rights" />
          <div className="grid sm:grid-cols-3 gap-4">
            <RightCard icon={Cloud} title="Export" desc="Download your full data as PDF or CSV from Settings → Export." />
            <RightCard icon={Trash2} title="Delete" desc="Delete your account from Settings. All data wiped within 30 days." />
            <RightCard icon={Mail} title="Contact" desc="Privacy questions? Email privacy@lifeos.app or use Contact." />
          </div>
        </section>

        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/50 to-accent/10 p-8 text-center">
          <h2 className="text-xl font-bold mb-3">Read the full Privacy Policy</h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-xl mx-auto">
            The legal version with all the details — data retention, GDPR rights, sub-processors, and how to file a complaint.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild><Link to="/privacy-policy">Privacy Policy</Link></Button>
            <Button asChild variant="outline"><Link to="/terms">Terms of Service</Link></Button>
            <Button asChild variant="outline"><Link to="/permissions">Permissions</Link></Button>
          </div>
        </div>
      </div>
    </MarketingLayout>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
    </div>
  );
}

function Promise({ icon: Icon, title, desc, negative }: any) {
  return (
    <Card className={`border-border/50 bg-card/80 ${negative ? '' : ''}`}>
      <CardContent className="p-5 flex items-start gap-3">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${negative ? 'text-rose-400' : 'text-emerald-500'}`} />
        <div>
          <h4 className="font-semibold mb-1">{title}</h4>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid sm:grid-cols-[160px,1fr] gap-2 pb-3 border-b border-border/30 last:border-0 last:pb-0">
      <p className="font-semibold text-foreground text-xs uppercase tracking-wider">{label}</p>
      <p className="text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

function SafeCard({ icon: Icon, title, desc }: any) {
  return (
    <Card className="border-border/50 bg-card/80">
      <CardContent className="p-5">
        <Icon className="h-6 w-6 text-primary mb-3" />
        <h4 className="font-semibold mb-1">{title}</h4>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

function RightCard({ icon: Icon, title, desc }: any) {
  return (
    <Card className="border-border/50 bg-card/80 text-center">
      <CardContent className="p-5">
        <div className="h-10 w-10 mx-auto rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h4 className="font-semibold mb-1">{title}</h4>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}
