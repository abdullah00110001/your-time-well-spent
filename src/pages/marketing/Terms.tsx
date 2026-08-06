import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { Card, CardContent } from '@/components/ui/card';

export default function Terms() {
  return (
    <MarketingLayout eyebrow="Legal" title="Terms of Service" subtitle="Last updated: June 1, 2026">
      <div className="mx-auto max-w-3xl px-4 pb-24">
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-8 prose prose-invert max-w-none text-sm text-muted-foreground space-y-6">
            <Section title="1. Acceptance">
              <p>By creating an account or using Life OS ("the Service"), you agree to these Terms. If you don't agree, please don't use the Service.</p>
            </Section>
            <Section title="2. Your account">
              <p>You're responsible for keeping your login credentials secure. Notify us immediately if you suspect unauthorized access. You must be 13 or older to use Life OS.</p>
            </Section>
            <Section title="3. Acceptable use">
              <p>You agree not to: (a) reverse-engineer the Service, (b) use it to harass other users, (c) circumvent paid features, or (d) use it for any illegal purpose.</p>
            </Section>
            <Section title="4. Subscriptions & billing">
              <p>Premium and Ultimate are billed monthly or annually. Free trials convert to paid plans automatically unless cancelled. You can cancel anytime from Settings → Premium.</p>
            </Section>
            <Section title="5. Refunds">
              <p>We offer a 14-day no-questions-asked refund on first-time subscriptions. See the Refund Policy for full details.</p>
            </Section>
            <Section title="6. Your data">
              <p>You own your data. We process it per our Privacy Policy. You can export or delete it at any time from Settings.</p>
            </Section>
            <Section title="7. Service availability">
              <p>We aim for 99.5% uptime but make no guarantee. Scheduled maintenance is announced in advance when possible.</p>
            </Section>
            <Section title="8. Disclaimer">
              <p>Life OS is provided "as is." It's a tool to help you build habits and discipline — it's not a substitute for medical, psychological, or religious advice.</p>
            </Section>
            <Section title="9. Limitation of liability">
              <p>To the maximum extent permitted by law, our liability is limited to the amount you paid us in the 12 months preceding the claim.</p>
            </Section>
            <Section title="10. Changes">
              <p>We may update these Terms. Material changes will be announced in-app at least 14 days before they take effect.</p>
            </Section>
            <Section title="11. Contact">
              <p>Questions? Email <a href="mailto:legal@lifeos.app" className="text-primary">legal@lifeos.app</a>.</p>
            </Section>
          </CardContent>
        </Card>
      </div>
    </MarketingLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-foreground font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}
