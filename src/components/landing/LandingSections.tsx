import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Heart, ShieldCheck, Sparkles, UserCheck,
  Sunrise, Calendar, BarChart3, BookHeart, Brain, ShieldAlert, Users,
  UserPlus, Activity, TrendingUp,
  HelpCircle,
} from 'lucide-react';

// 1) Why Life OS — value props
export function WhySection() {
  const props = [
    {
      icon: Heart,
      title: 'Anti-Guilt Philosophy',
      desc: 'No streak-shaming. No red marks. Missed a day? Tomorrow is a fresh start — growth is gentle here.',
    },
    {
      icon: ShieldCheck,
      title: 'Your Data, Your Right',
      desc: 'Daily entries lock after 24 hours so your past stays honest. Private by default, always.',
    },
    {
      icon: Sparkles,
      title: 'Built for the Soul',
      desc: 'Dunya and Akhirah, side by side. Habits, salah, gratitude, sleep — one integrated life view.',
    },
    {
      icon: UserCheck,
      title: 'Designed for the Long Run',
      desc: '12-month transformation curriculum, monthly journeys, and a life calendar that sees the bigger picture.',
    },
  ];

  return (
    <section className="py-24 px-4 relative">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Heart className="h-4 w-4" /> Why Life OS
          </div>
          <h2 className="mb-4 text-3xl sm:text-4xl font-bold text-foreground">A different kind of life tracker</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Most habit apps shame you into consistency. Life OS is built on a kinder, deeper philosophy.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {props.map((p, i) => (
            <div key={p.title} className="group relative" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative h-full rounded-2xl border border-border/50 bg-card/70 backdrop-blur-sm p-6 hover:border-primary/30 hover:-translate-y-1 transition-all duration-300">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                  <p.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 font-semibold text-foreground">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 2) Feature deep-dives (alternating)
export function FeatureDeepDive() {
  const deep = [
    {
      icon: Sunrise,
      tag: 'Rise',
      title: 'Wake up like you mean it',
      desc: 'Native exact alarms that pierce through DND and battery savers. Verify your wake with a mission — math, photo, or location. Join groups of early risers and broadcast your wake to friends.',
      bullets: ['Bullet-proof Android alarms', 'Group wake & accountability', 'Wake-up reports & streaks'],
      tone: 'from-amber-500/15 to-orange-500/10 border-amber-500/30',
      iconTone: 'text-amber-500 bg-amber-500/10',
    },
    {
      icon: Calendar,
      tag: 'Life Calendar',
      title: 'Your life, in weeks',
      desc: 'See your entire life as a grid of weeks. Set your birthday and life expectancy. Track milestones, weekly reflections, and watch the bigger picture come into focus.',
      bullets: ['4,000 weeks visualization', 'Weekly notes & reflections', 'Milestone timeline'],
      tone: 'from-primary/15 to-accent/10 border-primary/30',
      iconTone: 'text-primary bg-primary/10',
    },
    {
      icon: ShieldAlert,
      tag: 'Shield',
      title: 'Guard your attention',
      desc: 'PureShield blurs faces in real-time across blocked apps. Block social media, set screen-time limits, and rebuild your focus — with on-device ML, zero cloud.',
      bullets: ['On-device face blur (no cloud)', 'App & website blocking', 'Real productivity score'],
      tone: 'from-slate-500/15 to-primary/10 border-slate-500/30',
      iconTone: 'text-foreground bg-slate-500/10',
    },
    {
      icon: BookHeart,
      tag: 'Islamic Mode',
      title: 'Dunya & Akhirah, unified',
      desc: 'Track salah quality, Quran reading, sadaqah, tahajjud, and your nafs counter. Barakah Index and Akhirah Ratio show how your day balanced this world and the next.',
      bullets: ['Salah quality scoring', 'Quran heatmap', 'Tahajjud analytics'],
      tone: 'from-emerald-500/15 to-primary/10 border-emerald-500/30',
      iconTone: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      icon: BarChart3,
      tag: 'Reports & Stats',
      title: 'Real data, real insights',
      desc: 'Daily, weekly, and monthly reports. See your wake-up trends, sleep duration, focus sessions, salah consistency — all from real Supabase data, never dummies.',
      bullets: ['Daily / Weekly / Monthly tabs', 'Live charts from your data', 'Compare past periods'],
      tone: 'from-accent/15 to-primary/10 border-accent/30',
      iconTone: 'text-accent-foreground bg-accent/10',
    },
    {
      icon: Brain,
      tag: 'AI Insights',
      title: 'Personalized intelligence',
      desc: 'Burnout alerts, mood-productivity correlations, smart goal suggestions, and the Behavioral Rule Engine that nudges you when patterns matter.',
      bullets: ['Burnout & recovery alerts', 'Pattern detection', 'Smart goal adjustment'],
      tone: 'from-violet-500/15 to-primary/10 border-violet-500/30',
      iconTone: 'text-violet-500 bg-violet-500/10',
    },
    {
      icon: Users,
      tag: 'Groups & Community',
      title: 'Grow with others',
      desc: 'Join Rise groups and Shield groups. Chat with members, broadcast wake-ups to your circle, and climb the leaderboard with privacy you control.',
      bullets: ['Real-time group chat', 'Wake broadcasts', 'Privacy-first leaderboard'],
      tone: 'from-rose-500/15 to-primary/10 border-rose-500/30',
      iconTone: 'text-rose-500 bg-rose-500/10',
    },
  ];

  return (
    <section id="features-deep" className="py-24 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-muted/30 to-transparent" />
      <div className="mx-auto max-w-6xl relative">
        <div className="mb-14 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Sparkles className="h-4 w-4" /> Deep Features
          </div>
          <h2 className="mb-4 text-3xl sm:text-4xl font-bold text-foreground">Every tool, beautifully integrated</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Not a collection of widgets — one cohesive operating system for your life.
          </p>
        </div>

        <div className="space-y-16">
          {deep.map((f, i) => {
            const flip = i % 2 === 1;
            return (
              <div key={f.tag} className={`grid lg:grid-cols-2 gap-8 items-center ${flip ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                {/* Visual side */}
                <div className={`relative rounded-3xl border bg-gradient-to-br ${f.tone} p-1`}>
                  <div className="rounded-[22px] bg-card/80 backdrop-blur-sm p-10 min-h-[280px] flex flex-col items-center justify-center text-center">
                    <div className={`h-20 w-20 rounded-3xl ${f.iconTone} border border-current/20 flex items-center justify-center mb-5`}>
                      <f.icon className="h-10 w-10" />
                    </div>
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">{f.tag}</div>
                    <div className="text-lg font-semibold text-foreground/90">{f.title}</div>
                  </div>
                </div>

                {/* Text side */}
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary mb-4">
                    {f.tag}
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-4">{f.title}</h3>
                  <p className="text-base text-muted-foreground leading-relaxed mb-5">{f.desc}</p>
                  <ul className="space-y-2.5">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2.5 text-sm text-foreground/80">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// 3) How It Works — 3 steps
export function HowItWorks() {
  const steps = [
    { icon: UserPlus, n: '01', title: 'Setup your life', desc: 'Sign up, set your birthday and life expectancy, pick the modules you care about — Rise, Shield, Islamic Mode, or all of them.' },
    { icon: Activity, n: '02', title: 'Track with intention', desc: 'Log your day in under 90 seconds. Do your Night Muhasaba. Run a Shield session. Wake up with Rise. The system learns you.' },
    { icon: TrendingUp, n: '03', title: 'Grow over time', desc: 'Watch weekly and monthly reports surface patterns. Follow the 12-month journey curriculum. Become the person you intended to be.' },
  ];

  return (
    <section id="how-it-works" className="py-24 px-4 relative">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <Sparkles className="h-4 w-4" /> How It Works
          </div>
          <h2 className="mb-4 text-3xl sm:text-4xl font-bold text-foreground">Three steps to a deliberate life</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Onboarding takes under 5 minutes. The growth is forever.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 relative">
          {/* connector line */}
          <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          {steps.map((s, i) => (
            <div key={s.n} className="relative">
              <Card className="relative h-full p-7 bg-card/70 backdrop-blur-sm border-border/50 hover:border-primary/30 hover:-translate-y-1 transition-all duration-300">
                <div className="flex items-center justify-between mb-5">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/30 flex items-center justify-center">
                    <s.icon className="h-7 w-7 text-primary" />
                  </div>
                  <span className="text-3xl font-black text-primary/20">{s.n}</span>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 4) FAQ
export function FaqSection() {
  const faqs = [
    { q: 'Is Life OS free to use?', a: 'Yes — the Free plan covers the core habit tracking and daily input forever. Premium unlocks Shield, Rise advanced features, AI insights, and the Intelligence Engine.' },
    { q: 'Will I lose data if I miss a day?', a: 'Never. Life OS uses an Anti-Guilt philosophy — missed days are just missed days, not failures. Your streaks are gentle and your reflection always counts.' },
    { q: 'How is my data stored?', a: 'All your data lives in your private, RLS-protected Supabase account. Daily and Night Muhasaba entries lock after 24 hours so your past stays honest. You can export everything anytime.' },
    { q: 'Does Shield work without internet?', a: 'Yes. PureShield runs entirely on your device — face blurring uses an on-device ML model, no images leave your phone. App blocking continues offline.' },
    { q: 'Will Rise wake me up reliably on Android?', a: 'Yes. Rise uses native exact alarms with overlay + battery + DND bypass permissions, designed specifically for hostile Android OEMs (Xiaomi, Oppo, Vivo, Samsung).' },
    { q: 'Can I use Islamic Mode if I am not Muslim?', a: 'Of course. Islamic Mode is fully optional. Disable it and Life OS becomes a clean, secular life tracker.' },
    { q: 'Is there an Android app?', a: 'Yes — a full native Android app built with Capacitor. It includes native alarms, on-device ML, offline sync, and Google Play Billing for subscriptions.' },
    { q: 'Can I cancel my subscription anytime?', a: 'Anytime. No questions, no friction. Cancel from your account or Google Play and you keep access until the end of your billing period.' },
  ];

  return (
    <section id="faq" className="py-24 px-4 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-muted/40 to-transparent" />
      <div className="mx-auto max-w-3xl relative">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
            <HelpCircle className="h-4 w-4" /> FAQ
          </div>
          <h2 className="mb-4 text-3xl sm:text-4xl font-bold text-foreground">Frequently asked questions</h2>
          <p className="text-lg text-muted-foreground">Everything you need to know before getting started.</p>
        </div>
        <Card className="bg-card/70 backdrop-blur-sm border-border/50 p-2">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border/50 last:border-b-0">
                <AccordionTrigger className="text-left text-base font-semibold hover:text-primary px-4">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed px-4">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Card>
      </div>
    </section>
  );
}