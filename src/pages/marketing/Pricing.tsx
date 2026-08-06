import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Zap, Star, Crown, Check, Clock } from 'lucide-react';

const PLANS = [
  {
    name: 'Free', price: '0', period: 'forever', desc: 'Get started with basic tracking', icon: Zap,
    features: ['Basic habit tracking', 'Daily check-ins', 'Simple analytics', 'Calendar view', 'Up to 5 goals'],
    cta: 'Get Started Free', popular: false,
  },
  {
    name: 'Premium', price: '4.99', period: '/mo', desc: 'Everything you need to grow', icon: Star, trial: '3-day free trial',
    features: [
      'Unlimited goals & habits', 'Advanced analytics', 'AI-powered insights', 'Islamic mode (full)',
      'Shield app blocker', 'PureShield visual filter', 'Rise group wake', 'Weekly & Monthly reviews', 'Priority support',
    ],
    cta: 'Start Free Trial', popular: true,
  },
  {
    name: 'Ultimate', price: '9.99', period: '/mo', desc: 'For the most dedicated', icon: Crown, trial: '7-day free trial',
    features: [
      'Everything in Premium', 'Intelligence Engine', 'Comparative analytics', 'PDF & CSV export',
      'Life calendar full', 'Accountability groups (unlimited)', 'Year in Review wrapped', 'Early access to features',
    ],
    cta: 'Start Free Trial', popular: false,
  },
];

const COMPARE: { feature: string; free: boolean | string; premium: boolean | string; ultimate: boolean | string }[] = [
  { feature: 'Daily habit tracking', free: true, premium: true, ultimate: true },
  { feature: 'Goals', free: '5', premium: 'Unlimited', ultimate: 'Unlimited' },
  { feature: 'Custom daily fields', free: '3', premium: 'Unlimited', ultimate: 'Unlimited' },
  { feature: 'Islamic Mode', free: 'Basic', premium: 'Full', ultimate: 'Full' },
  { feature: 'Shield app blocker', free: false, premium: true, ultimate: true },
  { feature: 'PureShield visual filter', free: false, premium: true, ultimate: true },
  { feature: 'Rise alarms', free: '1', premium: 'Unlimited', ultimate: 'Unlimited' },
  { feature: 'Accountability groups', free: 'Join 1', premium: 'Join 3', ultimate: 'Unlimited' },
  { feature: 'AI insights', free: false, premium: 'Weekly', ultimate: 'Daily + custom' },
  { feature: 'Intelligence Engine', free: false, premium: false, ultimate: true },
  { feature: 'Comparative analytics', free: false, premium: false, ultimate: true },
  { feature: 'PDF / CSV export', free: false, premium: false, ultimate: true },
  { feature: 'Priority support', free: false, premium: true, ultimate: true },
];

export default function Pricing() {
  return (
    <MarketingLayout eyebrow="Simple pricing" title="Start free, upgrade when you're ready" subtitle="No hidden fees. Cancel anytime. 14-day refund, no questions asked.">
      <div className="mx-auto max-w-6xl px-4 pb-24">
        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {PLANS.map((p) => (
            <Card key={p.name} className={`relative border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden hover:-translate-y-1 transition-all ${p.popular ? 'border-primary/50 ring-2 ring-primary/20 shadow-lg shadow-primary/10' : ''}`}>
              {p.popular && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />}
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${p.popular ? 'bg-primary/15 border border-primary/30' : 'bg-muted/50 border border-border/50'}`}>
                    <p.icon className={`h-5 w-5 ${p.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <h3 className="font-bold">{p.name}</h3>
                    {p.popular && <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">Most Popular</Badge>}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">{p.desc}</p>
                <div className="mb-4">
                  <span className="text-3xl font-bold">${p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                {p.trial && <div className="flex items-center gap-1.5 text-xs text-primary mb-4"><Clock className="h-3 w-3" /> {p.trial}</div>}
                <Button asChild className="w-full mb-5" variant={p.popular ? 'default' : 'outline'}>
                  <Link to="/auth">{p.cta}</Link>
                </Button>
                <div className="space-y-2.5">
                  {p.features.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Comparison */}
        <Card className="border-border/50 bg-card/80 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30">
                  <tr>
                    <th className="text-left p-4 font-semibold">Feature</th>
                    <th className="p-4 font-semibold">Free</th>
                    <th className="p-4 font-semibold text-primary">Premium</th>
                    <th className="p-4 font-semibold">Ultimate</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((row, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="p-4 text-muted-foreground">{row.feature}</td>
                      <td className="p-4 text-center">{renderCell(row.free)}</td>
                      <td className="p-4 text-center bg-primary/[0.03]">{renderCell(row.premium)}</td>
                      <td className="p-4 text-center">{renderCell(row.ultimate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="mt-10 grid sm:grid-cols-3 gap-4 text-center">
          <Stat title="14-day refund" desc="No questions asked." />
          <Stat title="Cancel anytime" desc="One tap from Settings." />
          <Stat title="Regional pricing" desc="Adjusted for South Asia & more." />
        </div>
      </div>
    </MarketingLayout>
  );
}

function renderCell(v: boolean | string) {
  if (v === true) return <Check className="h-4 w-4 text-primary mx-auto" />;
  if (v === false) return <span className="text-muted-foreground/40">—</span>;
  return <span className="text-foreground text-xs">{v}</span>;
}

function Stat({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-5">
      <p className="font-semibold mb-1">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
