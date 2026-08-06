import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LifeOSLogo } from '@/components/LifeOSLogo';

interface MarketingLayoutProps {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}

const NAV = [
  { to: '/features', label: 'Features' },
  { to: '/permissions', label: 'Permissions' },
  { to: '/privacy', label: 'Privacy' },
  { to: '/pricing', label: 'Pricing' },
  { to: '/about', label: 'About' },
  { to: '/faq', label: 'FAQ' },
];

export function MarketingLayout({ children, eyebrow, title, subtitle }: MarketingLayoutProps) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/80 backdrop-blur-xl fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-11 w-11 rounded-2xl bg-card border border-primary/20 shadow-lg shadow-primary/20 flex items-center justify-center">
              <LifeOSLogo size={32} />
            </div>
            <span className="text-xl font-bold tracking-tight">Life OS</span>
          </Link>
          <div className="hidden lg:flex items-center gap-5 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={
                  'transition-colors ' +
                  (pathname === n.to ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground')
                }
              >
                {n.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:flex">
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button asChild className="shadow-lg shadow-primary/25">
              <Link to="/auth" className="gap-2">
                Get Started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <button
              className="lg:hidden h-10 w-10 inline-flex items-center justify-center rounded-lg border border-border/50"
              onClick={() => setOpen(!open)}
              aria-label="Menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <div className="lg:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
            <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-muted/50"
                >
                  {n.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      {(eyebrow || title || subtitle) && (
        <section className="pt-32 pb-12 px-4">
          <div className="mx-auto max-w-4xl text-center">
            {eyebrow && (
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary">
                {eyebrow}
              </div>
            )}
            {title && (
              <h1 className="mb-5 text-4xl sm:text-5xl font-bold tracking-tight">
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                  {title}
                </span>
              </h1>
            )}
            {subtitle && (
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </section>
      )}

      <main className={eyebrow || title ? '' : 'pt-24'}>{children}</main>

      <LandingFooter />
    </div>
  );
}

export default MarketingLayout;
