import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { Card, CardContent } from '@/components/ui/card';

export default function PrivacyPolicy() {
  return (
    <MarketingLayout eyebrow="Legal" title="Privacy Policy" subtitle="Last updated: June 1, 2026">
      <div className="mx-auto max-w-3xl px-4 pb-24">
        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-8 prose prose-invert max-w-none text-sm text-muted-foreground space-y-6">
            <Section title="1. Who we are">
              <p>Life OS ("we", "us") provides a habit-tracking, focus, and personal-growth app. Contact: <a href="mailto:privacy@lifeos.app" className="text-primary">privacy@lifeos.app</a>.</p>
            </Section>
            <Section title="2. What we collect">
              <ul className="list-disc pl-5 space-y-1">
                <li><strong className="text-foreground">Account data:</strong> email, display name, optional profile photo.</li>
                <li><strong className="text-foreground">App data:</strong> habits, daily inputs, journal, settings, alarms, group memberships.</li>
                <li><strong className="text-foreground">Device data:</strong> OS version, app version, anonymous crash reports.</li>
                <li><strong className="text-foreground">Not collected:</strong> microphone audio, screen-capture frames, precise GPS, other apps' notification content.</li>
              </ul>
            </Section>
            <Section title="3. How we use it">
              <p>To operate the Service, sync your data across devices, deliver notifications and alarms, generate insights, and improve the product. We do not use your data for advertising.</p>
            </Section>
            <Section title="4. On-device processing">
              <p>PureShield face/content detection runs entirely on your device using TensorFlow Lite. Frames are processed in RAM and discarded. Nothing is uploaded or stored.</p>
            </Section>
            <Section title="5. Sharing">
              <p>We never sell or rent your data. We share data only with: (a) Supabase (database + auth, EU/US regions), (b) Firebase Cloud Messaging (push notifications only), and (c) Lovable AI Gateway (for AI insights, with content minimized). Each is bound by a Data Processing Agreement.</p>
            </Section>
            <Section title="6. Security">
              <p>TLS 1.2+ in transit, AES-256 at rest, Row-Level Security on every user table, and secrets stored in a managed vault.</p>
            </Section>
            <Section title="7. Retention">
              <p>We retain your data for as long as your account is active. Upon deletion, data is wiped within 30 days, except logs required for fraud prevention (max 90 days).</p>
            </Section>
            <Section title="8. Your rights (GDPR / CCPA)">
              <p>You may access, correct, export, or delete your data at any time from Settings, or by emailing <a href="mailto:privacy@lifeos.app" className="text-primary">privacy@lifeos.app</a>.</p>
            </Section>
            <Section title="9. Children">
              <p>Life OS is not directed at children under 13. We don't knowingly collect data from them.</p>
            </Section>
            <Section title="10. Changes">
              <p>Material changes will be announced in-app at least 14 days before taking effect.</p>
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
