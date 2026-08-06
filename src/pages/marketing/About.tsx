import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, Target, Compass, Sparkles, Mail, MapPin, Code2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function About() {
  const values = [
    { icon: Heart, title: 'Anti-guilt', desc: 'Tracking should heal, not shame. Missed a day? Recovery mode. Hit a streak? Celebrate quietly.' },
    { icon: Compass, title: 'Intention over output', desc: 'Niyyah first. Numbers second. We measure depth, not just clicks.' },
    { icon: Target, title: 'Long-game design', desc: 'No dopamine traps. No streak-anxiety hooks. Built for the next 10 years, not the next 10 minutes.' },
    { icon: Sparkles, title: 'Beautiful by default', desc: 'Calm, glass, glacier. The app should feel like a sanctuary, not a dashboard.' },
  ];

  return (
    <MarketingLayout eyebrow="About Life OS" title="A life operating system, built with care" subtitle="We're building the most personal app on your phone — and we treat that responsibility seriously.">
      <div className="mx-auto max-w-4xl px-4 pb-24 space-y-12">
        {/* Mission */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-card/60 to-accent/5">
          <CardContent className="p-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">Our mission</p>
            <h2 className="text-2xl sm:text-3xl font-bold mb-4 leading-tight">
              Help one million people live deliberately — with their habits, their focus, and their faith aligned.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Most productivity apps optimize for engagement metrics. We optimize for whether you felt your day was
              meaningful. That single shift changes everything — from how we design notifications to what we refuse
              to build.
            </p>
          </CardContent>
        </Card>

        {/* Story */}
        <section>
          <h2 className="text-xl font-bold mb-4">The story</h2>
          <div className="prose prose-invert max-w-none text-muted-foreground space-y-4 text-sm leading-relaxed">
            <p>
              Life OS started as a personal frustration. We tried every habit tracker, every focus app, every Islamic
              companion — and none of them spoke to the whole person. Habits were divorced from prayer. Focus tools
              had no soul. Spiritual apps ignored discipline.
            </p>
            <p>
              So we built one that does it all — and does it without selling you out. No ads. No data brokers. Vision
              features that never leave your phone. A dual-mode design that honors Islamic life when you want it, and
              steps back when you don't.
            </p>
            <p>
              Today, Life OS is used daily by people in 40+ countries — students, professionals, parents, founders,
              and seekers. We're a small, focused team, and every line of code is written with that audience in mind.
            </p>
          </div>
        </section>

        {/* Values */}
        <section>
          <h2 className="text-xl font-bold mb-5">What we believe</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {values.map((v) => (
              <Card key={v.title} className="border-border/50 bg-card/80">
                <CardContent className="p-5 flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <v.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">{v.title}</h4>
                    <p className="text-xs text-muted-foreground">{v.desc}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Stack */}
        <section>
          <h2 className="text-xl font-bold mb-5">How it's built</h2>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-6 grid sm:grid-cols-2 gap-5 text-sm">
              <Tech icon={Code2} label="Frontend" value="React 18 · Vite · Tailwind · shadcn/ui · Framer Motion" />
              <Tech icon={Code2} label="Mobile" value="Capacitor 6 · Native Java plugins · TensorFlow Lite" />
              <Tech icon={Code2} label="Backend" value="Supabase · Postgres + RLS · Edge Functions" />
              <Tech icon={Code2} label="AI" value="On-device ML + Lovable AI Gateway for insights" />
            </CardContent>
          </Card>
        </section>

        {/* Contact CTA */}
        <Card className="border-primary/20 bg-gradient-to-br from-primary/10 via-card/50 to-accent/10">
          <CardContent className="p-8 text-center">
            <Mail className="h-10 w-10 text-primary mx-auto mb-3" />
            <h2 className="text-2xl font-bold mb-3">Want to talk?</h2>
            <p className="text-muted-foreground mb-5 max-w-xl mx-auto text-sm">
              Press, partnerships, feedback, bugs — we read every email.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <Button asChild><Link to="/contact">Contact Us</Link></Button>
              <Button asChild variant="outline"><Link to="/roadmap">See Roadmap</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
}

function Tech({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="h-4 w-4 text-primary mt-1 shrink-0" />
      <div>
        <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-0.5">{label}</p>
        <p className="text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}
