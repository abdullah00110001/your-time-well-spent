import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Target, CheckCircle2, BarChart3, Calendar, Brain, BookHeart, Shield, Flame,
  AlarmClock, Users, Sparkles, Eye, Heart, Trophy, FileText, Bell, Lock,
  Sunrise, ShieldCheck, ArrowRight, BookOpen, Star,
} from 'lucide-react';

interface Feature {
  icon: any;
  title: string;
  tagline: string;
  description: string;
  highlights: string[];
  badge?: string;
}

const FEATURES: { group: string; items: Feature[] }[] = [
  {
    group: 'Core Tracking',
    items: [
      {
        icon: Target,
        title: 'Yearly & Quarterly Goals',
        tagline: 'Plan the year, ship the quarter.',
        description:
          'Define ambitious yearly outcomes, break them into quarterly milestones, and watch them roll up into a single live progress score.',
        highlights: ['Yearly + Quarterly + Monthly planning', 'Auto-rollup progress', 'Visual goal trees'],
      },
      {
        icon: CheckCircle2,
        title: 'Habits & Streaks',
        tagline: 'Tiny wins, compounded daily.',
        description:
          'Track daily habits with smart reminders, streak protection, and a heatmap that makes consistency addictive.',
        highlights: ['Streak heatmap', 'Smart reminders', 'Recovery mode after missed days'],
      },
      {
        icon: FileText,
        title: 'Daily Input',
        tagline: 'One page. Your whole day.',
        description:
          'Log salah, sleep, mood, water, workouts, and custom fields in under a minute. Auto-syncs to insights and scores.',
        highlights: ['Custom fields', 'Salah & spiritual tracking', 'Mood & energy'],
      },
      {
        icon: BookHeart,
        title: 'Journal & Reflections',
        tagline: 'Think on paper.',
        description:
          'Daily, weekly, and night Muhasaba prompts. Quiet, private, and surprisingly powerful when reviewed in Insights.',
        highlights: ['Guided prompts', 'Weekly + monthly reviews', 'Night Muhasaba (Islamic mode)'],
      },
    ],
  },
  {
    group: 'Discipline Systems',
    items: [
      {
        icon: Shield,
        title: 'Shield — App Blocker',
        tagline: 'Block what breaks you.',
        description:
          'Distraction-grade blocker with tiered strictness, schedules, and emergency bypass. Works across social media, games, and adult content.',
        highlights: ['Profile-based blocking', 'Strictness tiers', 'DNS adult filter (Device Admin)'],
        badge: 'Premium',
      },
      {
        icon: Eye,
        title: 'PureShield — Visual Filter',
        tagline: 'On-device face & content blur.',
        description:
          'Native ML face detection that blurs faces and adult imagery in real time — all processed on your phone. Nothing leaves the device.',
        highlights: ['On-device ML (no cloud)', 'Frosted / pixel blur styles', 'Tiered for low → high-end phones'],
        badge: 'Premium',
      },
      {
        icon: AlarmClock,
        title: 'Rise — Intention Alarms',
        tagline: 'Wake with a purpose.',
        description:
          'Alarms that bypass Doze, demand intention to dismiss, and ring even on hard-killed apps. Optional group wake with friends.',
        highlights: ['Exact alarms (Doze-proof)', 'Mission-based dismissal', 'Group wake-up'],
      },
      {
        icon: Users,
        title: 'Accountability Groups',
        tagline: 'Show up, together.',
        description:
          'Join or create small groups, nudge each other awake, share wake status, and climb a daily leaderboard.',
        highlights: ['Group wake signals', 'Live presence', 'Daily roll-call'],
      },
    ],
  },
  {
    group: 'Intelligence',
    items: [
      {
        icon: Brain,
        title: 'AI Insights',
        tagline: 'Your data, finally readable.',
        description:
          'Pattern detection, burnout alerts, cognitive load meter, and weekly AI-generated recaps tailored to you.',
        highlights: ['Burnout & recovery alerts', 'Mood-productivity correlation', 'Smart goal suggestions'],
        badge: 'Ultimate',
      },
      {
        icon: BarChart3,
        title: 'Analytics & Reports',
        tagline: 'See the year in one screen.',
        description:
          'Heatmaps, trends, comparative analytics across months, and exportable PDF reports.',
        highlights: ['Multi-month comparisons', 'Quran heatmap', 'PDF export'],
      },
      {
        icon: Calendar,
        title: 'Life Calendar',
        tagline: 'Every week of your life.',
        description:
          'A lifetime grid that turns abstract time into urgent reality. Mark milestones. Plan the next chapter.',
        highlights: ['Lifetime week grid', 'Milestones & timeline', 'Hayat Battery'],
      },
      {
        icon: Sparkles,
        title: 'Year in Review',
        tagline: 'A Spotify Wrapped for your life.',
        description:
          'Beautiful end-of-year recap of your habits, growth, top wins, and lessons — share-ready.',
        highlights: ['Animated story format', 'Share cards', 'Personal stats'],
      },
    ],
  },
  {
    group: 'Islamic Mode',
    items: [
      {
        icon: Sunrise,
        title: 'Salah & Quran Tracking',
        tagline: 'Five pillars, daily.',
        description:
          'Track all five salah, Quran pages, dhikr, sadaqah, and tahajjud. The whole app shifts terminology when Islamic mode is on.',
        highlights: ['5 salah + qadha', 'Quran heatmap', 'Sadaqah tracker'],
      },
      {
        icon: Heart,
        title: 'Niyyah & Muhasaba',
        tagline: 'Intention in. Reflection out.',
        description:
          'Set daily niyyah and end the day with Muhasaba prompts — guilt-free accountability built on Islamic principles.',
        highlights: ['Niyyah validator', 'Night Muhasaba', 'Tawbah protocol'],
      },
      {
        icon: BookOpen,
        title: 'Akhirah-aware Metrics',
        tagline: 'Beyond productivity.',
        description:
          'Akhirah ratio, Barakah index, Ghaflah meter, and Mawt mode — metrics designed for a believer\'s life.',
        highlights: ['Akhirah Ratio', 'Barakah Index', 'Mawt Mode'],
      },
      {
        icon: Trophy,
        title: 'Spiritual Scores',
        tagline: 'Deen & Discipline, measured.',
        description:
          'Daily deen, discipline, focus, and productivity scores — derived from your real inputs, not guesses.',
        highlights: ['Deen score', 'Discipline score', 'Focus & productivity'],
      },
    ],
  },
  {
    group: 'Engagement',
    items: [
      {
        icon: Flame,
        title: 'Challenges & Gamification',
        tagline: 'Make discipline a game.',
        description:
          'Personal and global challenges, badges, levels, and a leaderboard to keep momentum across weeks.',
        highlights: ['Global challenges', 'Badges & levels', 'Leaderboard'],
      },
      {
        icon: Bell,
        title: 'Smart Notifications',
        tagline: 'Reminders that respect you.',
        description:
          'Context-aware nudges — not spam. Quiet hours, do-not-disturb, and intent-aware delivery.',
        highlights: ['Quiet hours', 'Push + local fallback', 'Per-feature controls'],
      },
      {
        icon: ShieldCheck,
        title: 'Privacy by Default',
        tagline: 'Your life, your data.',
        description:
          'Row-level security on every table. Vision features run on-device. No selling, no ads, no tracking.',
        highlights: ['Supabase RLS', 'On-device ML', 'No ads, no tracking'],
      },
      {
        icon: Star,
        title: 'Beautiful by Design',
        tagline: 'Glass, glacier, calm.',
        description:
          'Dark-first, glassmorphic, calm. Designed to reduce friction and feel like a sanctuary, not a dashboard.',
        highlights: ['Dark glacier theme', 'Soft glassmorphism', 'Mobile-first'],
      },
    ],
  },
];

export default function Features() {
  return (
    <MarketingLayout
      eyebrow="Every feature, explained"
      title="Everything inside Life OS"
      subtitle="A complete operating system for your habits, focus, faith, and growth — engineered for the long game."
    >
      <div className="mx-auto max-w-6xl px-4 pb-24 space-y-20">
        {FEATURES.map((group) => (
          <section key={group.group}>
            <div className="mb-8 flex items-center gap-3">
              <div className="h-px flex-1 bg-border/50" />
              <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                {group.group}
              </h2>
              <div className="h-px flex-1 bg-border/50" />
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {group.items.map((f) => (
                <Card
                  key={f.title}
                  className="group relative border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300"
                >
                  <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center">
                        <f.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground">{f.title}</h3>
                          {f.badge && (
                            <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                              {f.badge}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-primary/80 italic mb-2">{f.tagline}</p>
                        <p className="text-sm text-muted-foreground mb-4">{f.description}</p>
                        <ul className="space-y-1.5">
                          {f.highlights.map((h) => (
                            <li key={h} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}

        {/* CTA */}
        <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/50 to-accent/10 p-10 text-center backdrop-blur-sm">
          <Lock className="h-10 w-10 text-primary mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Curious how permissions work?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
            Every feature lists exactly which device permissions it asks for, why, and what happens if you say no.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button asChild>
              <Link to="/permissions" className="gap-2">See Permissions <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/privacy">Privacy & Data</Link>
            </Button>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
}
