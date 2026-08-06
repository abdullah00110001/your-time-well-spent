import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Clock, Sparkles } from 'lucide-react';

interface Item {
  status: 'shipped' | 'in-progress' | 'planned';
  quarter: string;
  title: string;
  desc: string;
}

const ROADMAP: Item[] = [
  { status: 'shipped', quarter: 'Q1 2026', title: 'PureShield on-device vision', desc: 'TensorFlow Lite face detection with tiered low/mid/high-end models, frosted blur, anti-flicker smoothing.' },
  { status: 'shipped', quarter: 'Q1 2026', title: 'Rise group wake', desc: 'FCM push nudges between group members, daily roll-call, accountability streaks.' },
  { status: 'shipped', quarter: 'Q4 2025', title: 'Islamic Mode dual-system', desc: 'Full app re-themes around Islamic life — salah, Quran, niyyah, Muhasaba, Barakah Index.' },
  { status: 'in-progress', quarter: 'Q2 2026', title: 'Wake-up photo proof', desc: 'Optional selfie at dismissal to prove you actually got up.' },
  { status: 'in-progress', quarter: 'Q2 2026', title: 'Fajr auto-alarm', desc: 'Location-based prayer-time alarm that updates automatically.' },
  { status: 'in-progress', quarter: 'Q2 2026', title: 'Group leaderboard v2', desc: 'Daily wake-on-time ranking + weekly champions inside each accountability group.' },
  { status: 'planned', quarter: 'Q3 2026', title: 'iOS native app', desc: 'Capacitor iOS build with Screen Time API integration for Shield.' },
  { status: 'planned', quarter: 'Q3 2026', title: 'Streak protection', desc: 'Auto-detect missed days, offer 1 free streak freeze per week.' },
  { status: 'planned', quarter: 'Q3 2026', title: 'Sleep estimation', desc: 'Bedtime detection → predicted sleep duration → warn if alarm gives <6h.' },
  { status: 'planned', quarter: 'Q4 2026', title: 'Voice journaling', desc: 'Speak your reflection, on-device transcription, never uploaded.' },
  { status: 'planned', quarter: 'Q4 2026', title: 'Family plans', desc: 'Shared Premium for up to 5 family members.' },
];

const STATUS = {
  shipped: { label: 'Shipped', icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  'in-progress': { label: 'In Progress', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30' },
  planned: { label: 'Planned', icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted/30 border-border/50' },
};

export default function Roadmap() {
  return (
    <MarketingLayout eyebrow="Public roadmap" title="What's shipping next" subtitle="We build in the open. Here's what's done, what's in progress, and what's coming.">
      <div className="mx-auto max-w-3xl px-4 pb-24">
        <div className="space-y-4">
          {ROADMAP.map((item, i) => {
            const s = STATUS[item.status];
            return (
              <Card key={i} className={`border-border/50 bg-card/80 ${item.status === 'in-progress' ? 'border-amber-500/30' : ''}`}>
                <CardContent className="p-5 flex items-start gap-4">
                  <div className={`h-10 w-10 rounded-xl border flex items-center justify-center shrink-0 ${s.bg}`}>
                    <s.icon className={`h-5 w-5 ${s.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold">{item.title}</h3>
                      <Badge variant="outline" className={`text-[10px] ${s.bg} ${s.color}`}>{s.label}</Badge>
                      <span className="text-[11px] text-muted-foreground ml-auto">{item.quarter}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="mt-10 border-primary/20 bg-gradient-to-br from-primary/10 via-card/50 to-accent/10">
          <CardContent className="p-6 flex items-start gap-4">
            <Sparkles className="h-6 w-6 text-primary mt-1" />
            <div>
              <h3 className="font-bold mb-1">Have a feature request?</h3>
              <p className="text-sm text-muted-foreground">
                The best features come from users. Email us at{' '}
                <a href="mailto:hello@lifeos.app" className="text-primary hover:underline">hello@lifeos.app</a>{' '}
                or use the in-app feedback widget.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
}
