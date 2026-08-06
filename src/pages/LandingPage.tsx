import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, CheckCircle2, BarChart3, Calendar, ArrowRight, Sparkles, Zap, Shield, TrendingUp, Star, ChevronRight, Crown, Check, Clock, Brain, BookHeart, Flame, Download, Menu, X, Lock, FileText, MessageCircle, Map, History, Receipt, ScrollText, Users, HelpCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isNative } from '@/lib/capacitor/platform';
import { WhySection, FeatureDeepDive, HowItWorks, FaqSection } from '@/components/landing/LandingSections';
import { LifeOSLogo } from '@/components/LifeOSLogo';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (isNative) {
      if (user) {
        navigate('/dashboard', { replace: true });
      } else {
        const seen = localStorage.getItem('hasSeenWelcome') === '1';
        navigate(seen ? '/auth' : '/welcome', { replace: true });
      }
      return;
    }
    if (!loading && user) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  // Prevent landing-page flash:
  // - On native: never render landing UI; we always redirect.
  // - On web: while auth is loading, render nothing (avoid flashing landing then redirecting).
  // - On web: if a user is already logged in, we're redirecting to /dashboard — render nothing.
  if (isNative) return null;
  if (loading) return null;
  if (user) return null;

  const features = [
    { icon: Target, title: 'Set Yearly Goals', description: 'Define ambitious goals for the year and break them into actionable habits.', gradient: 'from-primary/20 to-accent/20' },
    { icon: CheckCircle2, title: 'Track Daily Progress', description: 'Check off habits each day and build momentum with streaks.', gradient: 'from-accent/20 to-primary/20' },
    { icon: Calendar, title: 'Visual Calendar', description: 'See your progress at a glance with a beautiful calendar view.', gradient: 'from-primary/20 to-secondary/20' },
    { icon: BarChart3, title: 'Detailed Analytics', description: 'Understand your patterns with insights and charts.', gradient: 'from-secondary/20 to-primary/20' },
    { icon: Brain, title: 'AI Intelligence', description: 'Smart suggestions and burnout alerts powered by your data.', gradient: 'from-accent/20 to-secondary/20' },
    { icon: Flame, title: 'Challenges & Gamification', description: 'Compete with yourself and others through fun challenges.', gradient: 'from-primary/20 to-accent/20' },
    { icon: BookHeart, title: 'Islamic Mode', description: 'Track salah, Quran, and spiritual growth alongside life goals.', gradient: 'from-secondary/20 to-accent/20' },
    { icon: Shield, title: 'Shield & Rise', description: 'Digital discipline tools to block distractions and wake up better.', gradient: 'from-accent/20 to-primary/20' },
  ];

  const stats = [
    { value: '10K+', label: 'Active Users' },
    { value: '500K+', label: 'Habits Tracked' },
    { value: '98%', label: 'Success Rate' },
    { value: '4.9', label: 'User Rating', icon: Star },
  ];

  const testimonials = [
    { quote: "This app completely transformed how I approach my goals. I've never been more consistent!", author: "Sarah M.", role: "Entrepreneur" },
    { quote: "The visual tracking keeps me motivated every single day. Absolutely love it!", author: "James K.", role: "Software Engineer" },
    { quote: "Finally, an app that understands the importance of building lasting habits.", author: "Emily R.", role: "Health Coach" },
  ];

  const pricingPlans = [
    {
      name: 'Free', price: '0', period: 'forever', description: 'Get started with basic tracking',
      icon: Zap, features: ['Basic habit tracking', 'Daily check-ins', 'Simple analytics', 'Calendar view', 'Up to 5 goals'],
      cta: 'Get Started Free', popular: false,
    },
    {
      name: 'Premium', price: '4.99', period: '/mo', description: 'Everything you need to grow',
      icon: Star, trial: '3-day free trial',
      features: ['Unlimited goals & habits', 'Advanced analytics', 'AI-powered insights', 'Islamic mode', 'Shield & Rise tools', 'Weekly & Monthly reviews', 'Priority support'],
      cta: 'Start Free Trial', popular: true,
    },
    {
      name: 'Ultimate', price: '9.99', period: '/mo', description: 'For the most dedicated users',
      icon: Crown, trial: '7-day free trial',
      features: ['Everything in Premium', 'Intelligence Engine', 'Comparative analytics', 'Export & reports', 'PDF tools', 'Life calendar', 'Accountability groups', 'Early access to features'],
      cta: 'Start Free Trial', popular: false,
    },
  ];

  const appScreenshots = [
    { title: 'Dashboard', description: 'See all your progress at a glance', gradient: 'from-primary/30 to-accent/20' },
    { title: 'Analytics', description: 'Deep insights into your habits', gradient: 'from-accent/30 to-primary/20' },
    { title: 'Islamic Mode', description: 'Track spiritual growth beautifully', gradient: 'from-secondary/30 to-primary/20' },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute -bottom-40 right-1/3 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Navigation */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-11 w-11 rounded-2xl bg-card border border-primary/20 shadow-lg shadow-primary/25 flex items-center justify-center">
              <LifeOSLogo size={32} />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Life OS</span>
          </Link>
          <div className="hidden md:flex items-center gap-5 text-sm text-muted-foreground">
            <Link to="/features" className="hover:text-foreground transition-colors">Features</Link>
            <Link to="/permissions" className="hover:text-foreground transition-colors">Permissions</Link>
            <Link to="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:flex">
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild className="shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300">
              <Link to="/auth" className="gap-2">Get Started <ArrowRight className="h-4 w-4" /></Link>
            </Button>
            <button
              type="button"
              className="md:hidden h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border/50 text-foreground"
              aria-label="Menu"
              onClick={() => setMobileNavOpen((v) => !v)}
            >
              {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileNavOpen && (
          <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
            <div className="mx-auto max-w-6xl px-4 py-3 grid grid-cols-2 gap-1 text-sm">
              {[
                { to: '/features', label: 'Features' },
                { to: '/permissions', label: 'Permissions' },
                { to: '/pricing', label: 'Pricing' },
                { to: '/roadmap', label: 'Roadmap' },
                { to: '/changelog', label: 'Changelog' },
                { to: '/about', label: 'About' },
                { to: '/contact', label: 'Contact' },
                { to: '/faq', label: 'FAQ' },
                { to: '/privacy', label: 'Privacy' },
                { to: '/terms', label: 'Terms' },
                { to: '/refund', label: 'Refund' },
                { to: '/download', label: 'Download' },
              ].map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileNavOpen(false)}
                  className="px-3 py-2.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary backdrop-blur-sm animate-fade-in">
            <Sparkles className="h-4 w-4" />
            <span>Transform your year with better habits</span>
            <ChevronRight className="h-4 w-4" />
          </div>
          <h1 className="mb-8 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight animate-fade-in">
            <span className="block text-foreground">Build habits that</span>
            <span className="block mt-2 bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">stick all year</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground animate-fade-in">
            Set meaningful yearly goals, break them into daily habits, and track your progress with beautiful visualizations. Join thousands building better lives.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 mb-16 animate-fade-in">
            <Button asChild size="lg" className="h-14 px-8 text-base shadow-2xl shadow-primary/30 hover:shadow-primary/40 hover:scale-105 transition-all duration-300">
              <Link to="/auth" className="gap-2">Get Started Free <ArrowRight className="h-5 w-5" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-8 text-base border-border/50 hover:bg-muted/50 hover:scale-105 transition-all duration-300">
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-14 px-8 text-base border-primary/30 hover:bg-primary/10 hover:scale-105 transition-all duration-300">
              <Link to="/download" className="gap-2">
                <Download className="h-5 w-5" /> Download App
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto animate-fade-in">
            {stats.map((stat, index) => (
              <div key={stat.label} className="relative group" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative p-4 rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/30 transition-all duration-300">
                  <div className="flex items-center justify-center gap-1 text-2xl sm:text-3xl font-bold text-foreground mb-1">
                    {stat.value}
                    {stat.icon && <Star className="h-5 w-5 text-primary fill-primary" />}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Life OS */}
      <WhySection />

      {/* Features Section */}
      <section id="features" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-muted/50 to-muted/30" />
        <div className="mx-auto max-w-6xl relative">
          <div className="mb-16 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Zap className="h-4 w-4" /> Powerful Features
            </div>
            <h2 className="mb-4 text-3xl font-bold text-foreground">Everything you need to succeed</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Simple, yet powerful tools designed to help you build lasting habits</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => (
              <div key={feature.title} className="group relative" style={{ animationDelay: `${index * 80}ms` }}>
                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500" />
                <div className="relative h-full rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1">
                  <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} border border-primary/20`}>
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature deep-dive */}
      <FeatureDeepDive />

      {/* How It Works */}
      <HowItWorks />

      {/* App Screenshots */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Target className="h-4 w-4" /> See It In Action
            </div>
            <h2 className="mb-4 text-3xl font-bold text-foreground">Beautiful, intuitive interface</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Designed to keep you focused and motivated every day</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {appScreenshots.map((screen, i) => (
              <div key={screen.title} className="group relative">
                <div className={`rounded-2xl border border-border/50 bg-gradient-to-br ${screen.gradient} backdrop-blur-sm p-1`}>
                  <div className="rounded-xl bg-card/90 p-6 h-64 flex flex-col items-center justify-center text-center">
                    <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                      {i === 0 && <BarChart3 className="h-8 w-8 text-primary" />}
                      {i === 1 && <TrendingUp className="h-8 w-8 text-primary" />}
                      {i === 2 && <BookHeart className="h-8 w-8 text-primary" />}
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{screen.title}</h3>
                    <p className="text-sm text-muted-foreground">{screen.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-muted/50 to-muted/30" />
        <div className="mx-auto max-w-5xl relative">
          <div className="mb-16 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Crown className="h-4 w-4" /> Pricing
            </div>
            <h2 className="mb-4 text-3xl font-bold text-foreground">Simple, transparent pricing</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Start free, upgrade when you're ready. No hidden fees.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {pricingPlans.map((plan) => (
              <Card key={plan.name} className={`relative border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${plan.popular ? 'border-primary/50 ring-2 ring-primary/20 shadow-lg shadow-primary/10' : ''}`}>
                {plan.popular && <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-accent" />}
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${plan.popular ? 'bg-primary/15 border border-primary/30' : 'bg-muted/50 border border-border/50'}`}>
                      <plan.icon className={`h-5 w-5 ${plan.popular ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{plan.name}</h3>
                      {plan.popular && <Badge className="text-[10px] bg-primary/10 text-primary border-primary/20">Most Popular</Badge>}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
                  <div className="mb-4">
                    <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                  {plan.trial && (
                    <div className="flex items-center gap-1.5 text-xs text-primary mb-4">
                      <Clock className="h-3 w-3" /> {plan.trial}
                    </div>
                  )}
                  <Button asChild className="w-full mb-5" variant={plan.popular ? 'default' : 'outline'}>
                    <Link to="/premium">{plan.cta}</Link>
                  </Button>
                  <div className="space-y-2.5">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm text-muted-foreground">{f}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Star className="h-4 w-4" /> Testimonials
            </div>
            <h2 className="mb-4 text-3xl font-bold text-foreground">Loved by thousands</h2>
            <p className="text-lg text-muted-foreground">See what our users have to say</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div key={t.author} className="group relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative h-full rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-7 transition-all duration-300 hover:border-primary/30 hover:shadow-lg">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 text-primary fill-primary" />
                    ))}
                  </div>
                  <p className="text-sm text-foreground mb-5 italic">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-primary-foreground font-semibold text-sm">
                      {t.author[0]}
                    </div>
                    <div>
                      <div className="font-semibold text-foreground text-sm">{t.author}</div>
                      <div className="text-xs text-muted-foreground">{t.role}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection />

      {/* Explore everything */}
      <section className="py-20 px-4 relative">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-4">
              <Sparkles className="h-4 w-4" /> Explore the App
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">Everything you need to know</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Deep-dive pages for features, permissions, pricing, privacy and more.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { to: '/features', icon: Sparkles, title: 'Features', desc: '20+ features across 5 categories — Rise, Shield, Daily, Insights, Islamic.' },
              { to: '/permissions', icon: Lock, title: 'Permissions', desc: '13 Android permissions explained — why each one, what we can and cannot see.' },
              { to: '/privacy', icon: Shield, title: 'Privacy & Data Safety', desc: 'On-device ML, end-to-end data flow, and what we never collect.' },
              { to: '/pricing', icon: Crown, title: 'Pricing', desc: 'Free, Premium and Lifetime — full comparison table.' },
              { to: '/roadmap', icon: Map, title: 'Roadmap', desc: 'What we are building next — quarter by quarter.' },
              { to: '/changelog', icon: History, title: 'Changelog', desc: 'Every release, every fix, every new feature.' },
              { to: '/about', icon: Users, title: 'About', desc: 'Mission, story, values and the stack behind Life OS.' },
              { to: '/contact', icon: MessageCircle, title: 'Contact', desc: 'Email form and direct channels — we reply within 24h.' },
              { to: '/faq', icon: HelpCircle, title: 'FAQ', desc: '5 categories of questions answered in an accordion.' },
              { to: '/privacy-policy', icon: FileText, title: 'Privacy Policy', desc: 'The full legal privacy policy.' },
              { to: '/terms', icon: ScrollText, title: 'Terms', desc: 'Terms of service for using Life OS.' },
              { to: '/refund', icon: Receipt, title: 'Refund Policy', desc: 'How refunds work for premium plans.' },
            ].map((c) => (
              <Link
                key={c.to}
                to={c.to}
                className="group relative rounded-2xl border border-border/60 bg-card/50 backdrop-blur-sm p-5 hover:border-primary/40 hover:bg-card transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-foreground">{c.title}</h3>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 relative">
        <div className="mx-auto max-w-4xl text-center relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 rounded-3xl blur-3xl" />
          <div className="relative rounded-3xl border border-primary/20 bg-card/50 backdrop-blur-sm p-12 sm:p-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-6">
              <Sparkles className="h-4 w-4" /> Start Today
            </div>
            <h2 className="mb-4 text-3xl font-bold text-foreground">Ready to transform your year?</h2>
            <p className="mb-8 text-lg text-muted-foreground max-w-2xl mx-auto">
              Join thousands who have already changed their lives. Start your journey today — it's completely free.
            </p>
            <Button asChild size="lg" className="h-14 px-10 text-base shadow-2xl shadow-primary/30 hover:shadow-primary/40 hover:scale-105 transition-all duration-300">
              <Link to="/auth" className="gap-2">Get Started Free <ArrowRight className="h-5 w-5" /></Link>
            </Button>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}
