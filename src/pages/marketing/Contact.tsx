import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Mail, MessageSquare, Bug, Send, Twitter, Github, Instagram } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function Contact() {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const data = new FormData(e.currentTarget);
    const subject = encodeURIComponent(`[Life OS] ${data.get('subject') || 'Message'}`);
    const body = encodeURIComponent(
      `Name: ${data.get('name')}\nEmail: ${data.get('email')}\n\n${data.get('message')}`
    );
    window.location.href = `mailto:hello@lifeos.app?subject=${subject}&body=${body}`;
    setTimeout(() => {
      toast.success('Opening your email app...');
      setSubmitting(false);
    }, 400);
  };

  return (
    <MarketingLayout eyebrow="Get in touch" title="We'd love to hear from you" subtitle="Bugs, ideas, partnerships, press — pick a channel and we'll respond.">
      <div className="mx-auto max-w-5xl px-4 pb-24 grid lg:grid-cols-5 gap-8">
        {/* Channels */}
        <div className="lg:col-span-2 space-y-3">
          <ChannelCard icon={Mail} title="Email" value="hello@lifeos.app" href="mailto:hello@lifeos.app" />
          <ChannelCard icon={Bug} title="Bug reports" value="bugs@lifeos.app" href="mailto:bugs@lifeos.app" />
          <ChannelCard icon={MessageSquare} title="Press & partnerships" value="press@lifeos.app" href="mailto:press@lifeos.app" />

          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3">Social</p>
              <div className="flex gap-2">
                {[
                  { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
                  { icon: Github, href: 'https://github.com', label: 'GitHub' },
                  { icon: Instagram, href: 'https://instagram.com', label: 'Instagram' },
                ].map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="h-10 w-10 rounded-xl border border-border/50 bg-background/40 hover:bg-primary/10 hover:border-primary/40 text-muted-foreground hover:text-primary flex items-center justify-center transition-all"
                  >
                    <s.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        <Card className="lg:col-span-3 border-border/50 bg-card/80">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required placeholder="Your name" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" required placeholder="you@email.com" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" name="subject" required placeholder="What's this about?" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" name="message" required rows={6} placeholder="Tell us more..." />
              </div>
              <Button type="submit" className="w-full gap-2" disabled={submitting}>
                <Send className="h-4 w-4" />
                {submitting ? 'Opening...' : 'Send Message'}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                This form opens your email client. For now we don't store messages on our servers — direct email only.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
}

function ChannelCard({ icon: Icon, title, value, href }: any) {
  return (
    <a href={href} className="block">
      <Card className="border-border/50 bg-card/80 hover:border-primary/30 transition-colors">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-xs text-muted-foreground truncate">{value}</p>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
