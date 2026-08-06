import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const FAQ = [
  {
    group: 'General',
    items: [
      { q: 'What is Life OS?', a: 'A complete operating system for habits, focus, faith, and growth — combining habit tracking, app blocking, intention alarms, and AI insights in one place.' },
      { q: 'Is it free?', a: 'Yes. Free tier covers basic habit tracking, daily check-ins, and simple analytics for up to 5 goals. Premium ($4.99/mo) unlocks unlimited tracking, Shield, AI insights, and Islamic mode features. Ultimate ($9.99/mo) adds Intelligence Engine, comparative analytics, and PDF exports.' },
      { q: 'Which platforms is it on?', a: 'Currently Android (native Capacitor app + installable web app on any phone). iOS is on the roadmap.' },
      { q: 'Does it work offline?', a: 'Yes. Your daily inputs, habits, and journal are cached locally and sync the moment you reconnect.' },
    ],
  },
  {
    group: 'Privacy & Permissions',
    items: [
      { q: 'Do you sell my data?', a: 'No. We never sell, rent, or share personal data with third parties for marketing. The app makes money only from subscriptions.' },
      { q: 'Does PureShield upload my screen?', a: 'No. PureShield uses on-device TensorFlow Lite models. Frames are processed in RAM and discarded immediately. Nothing leaves your phone.' },
      { q: 'Why does Shield need Accessibility?', a: 'It\'s the most reliable way on Android 13+ to detect when a blocked app comes to the foreground. We only read the package name — never keystrokes, never screen content. Full breakdown on the Permissions page.' },
      { q: 'Can I export and delete my data?', a: 'Yes. Settings → Export gives you PDF/CSV. Settings → Delete account wipes everything from our servers within 30 days.' },
    ],
  },
  {
    group: 'Islamic Mode',
    items: [
      { q: 'What is Islamic Mode?', a: 'A toggle that re-themes the whole app around Islamic life — salah tracking, Quran heatmap, niyyah, night Muhasaba, Tahajjud analytics, Tawbah protocol, and metrics like Akhirah Ratio and Barakah Index.' },
      { q: 'Do I have to be Muslim to use the app?', a: 'No. Islamic mode is optional. With it off, the app is a clean, secular habit-tracker + discipline OS.' },
    ],
  },
  {
    group: 'Shield & Rise',
    items: [
      { q: 'Can Shield block adult sites?', a: 'Yes. Shield uses a DNS-level adult filter (requires Device Admin to lock it). It also blocks adult apps and provides PureShield visual blur.' },
      { q: 'Will Rise alarms ring if I force-close the app?', a: 'Yes. Rise uses Android\'s exact-alarm scheduler with a wake-lock receiver — it rings even on hard-killed apps, on locked screens, and during Doze. (You\'ll still want to disable battery optimization for max reliability — guided in setup.)' },
      { q: 'Can someone in my group wake me up?', a: 'Yes. Group members can send a wake nudge (FCM push). You can mute, block, or set quiet hours per-person.' },
    ],
  },
  {
    group: 'Billing',
    items: [
      { q: 'Is there a free trial?', a: 'Yes — 3 days for Premium, 7 days for Ultimate. No card required to start.' },
      { q: 'Can I cancel anytime?', a: 'Yes. One tap from Settings → Premium. Access continues until the end of your billing period.' },
      { q: 'Do you offer refunds?', a: 'Yes. Within 14 days of purchase, no questions asked. See the Refund Policy page.' },
      { q: 'Are there regional prices?', a: 'Yes. We offer adjusted pricing for several regions including South Asia. Contact us if pricing is a barrier.' },
    ],
  },
];

export default function Faq() {
  return (
    <MarketingLayout eyebrow="Frequently asked" title="Questions, answered" subtitle="If you can't find what you're looking for, just email us.">
      <div className="mx-auto max-w-3xl px-4 pb-24 space-y-8">
        {FAQ.map((g) => (
          <Card key={g.group} className="border-border/50 bg-card/80">
            <CardContent className="p-6">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-primary mb-3">{g.group}</h2>
              <Accordion type="single" collapsible className="w-full">
                {g.items.map((item, i) => (
                  <AccordionItem key={i} value={`${g.group}-${i}`} className="border-border/40">
                    <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">{item.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground leading-relaxed">{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        ))}

        <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/50 to-accent/10 p-8 text-center">
          <h3 className="text-lg font-bold mb-2">Still have a question?</h3>
          <p className="text-sm text-muted-foreground mb-5">We respond within 24 hours.</p>
          <Button asChild><Link to="/contact">Contact Us</Link></Button>
        </div>
      </div>
    </MarketingLayout>
  );
}
