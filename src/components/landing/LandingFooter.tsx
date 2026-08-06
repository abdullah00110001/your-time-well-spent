import { Link } from 'react-router-dom';
import { Github, Twitter, Instagram, Heart } from 'lucide-react';
import { LifeOSLogo } from '@/components/LifeOSLogo';

export function LandingFooter() {
  const year = new Date().getFullYear();

  const cols: { title: string; links: { label: string; to: string; external?: boolean }[] }[] = [
    {
      title: 'Product',
      links: [
        { label: 'Features', to: '/features' },
        { label: 'Permissions', to: '/permissions' },
        { label: 'Pricing', to: '/pricing' },
        { label: 'Roadmap', to: '/roadmap' },
        { label: 'Changelog', to: '/changelog' },
      ],
    },
    {
      title: 'App',
      links: [
        { label: 'Download', to: '/download' },
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Shield', to: '/shield' },
        { label: 'Rise', to: '/rise' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About', to: '/about' },
        { label: 'Contact', to: '/contact' },
        { label: 'FAQ', to: '/faq' },
        { label: 'Sign In', to: '/auth' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy', to: '/privacy' },
        { label: 'Privacy Policy', to: '/privacy-policy' },
        { label: 'Terms', to: '/terms' },
        { label: 'Refund Policy', to: '/refund' },
      ],
    },
  ];

  const socials = [
    { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
    { icon: Github, href: 'https://github.com', label: 'GitHub' },
    { icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
  ];

  return (
    <footer className="relative border-t border-border/50 bg-card/40 backdrop-blur-xl">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-primary/[0.02] to-primary/[0.05]" />

      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="grid gap-10 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-4">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="h-12 w-12 rounded-2xl bg-card border border-primary/20 shadow-lg shadow-primary/20 flex items-center justify-center">
                <LifeOSLogo size={34} />
              </div>
              <span className="text-xl font-bold tracking-tight">Life OS</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              An anti-guilt operating system for your life. Track habits, guard your focus, and grow with intention — built for the modern soul.
            </p>
            <div className="flex items-center gap-2 mt-5">
              {socials.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="h-9 w-9 rounded-xl border border-border/60 bg-background/40 hover:bg-primary/10 hover:border-primary/40 hover:text-primary text-muted-foreground flex items-center justify-center transition-all"
                >
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-6">
            {cols.map((c) => (
              <div key={c.title}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-3">{c.title}</h4>
                <ul className="space-y-2">
                  {c.links.map((l) => (
                    <li key={l.label}>
                      {l.to.startsWith('/#') ? (
                        <a href={l.to.replace('/', '')} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                          {l.label}
                        </a>
                      ) : (
                        <Link to={l.to} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                          {l.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {year} Life OS. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            Made with <Heart className="h-3 w-3 text-primary fill-primary" /> for better living
          </p>
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;