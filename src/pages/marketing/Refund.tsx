import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock, Mail } from 'lucide-react';

export default function Refund() {
  return (
    <MarketingLayout eyebrow="Legal" title="Refund Policy" subtitle="Fair, simple, and on your side.">
      <div className="mx-auto max-w-3xl px-4 pb-24 space-y-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <Pill icon={Clock} title="14 days" desc="Full refund on first-time subscription." />
          <Pill icon={CheckCircle2} title="No questions" desc="We don't make you justify it." />
          <Pill icon={Mail} title="One email" desc="Reply and we process it." />
        </div>

        <Card className="border-border/50 bg-card/80">
          <CardContent className="p-8 prose prose-invert max-w-none text-sm text-muted-foreground space-y-5">
            <Block title="Eligibility">
              <p>You're eligible for a full refund within 14 days of your first Premium or Ultimate purchase. Renewal payments are eligible within 7 days of the renewal charge.</p>
            </Block>
            <Block title="How to request">
              <p>Email <a href="mailto:billing@lifeos.app" className="text-primary">billing@lifeos.app</a> from the email on your account with the subject "Refund." Include your order ID if you have it.</p>
            </Block>
            <Block title="Processing time">
              <p>We process refunds within 3 business days. Your bank may take an additional 5–10 days to reflect it.</p>
            </Block>
            <Block title="What happens to your account">
              <p>Your account stays active on the Free tier. Your data is not deleted unless you ask us to delete it.</p>
            </Block>
            <Block title="Exceptions">
              <p>Refunds are not available for: (a) accounts terminated for Terms of Service violations, (b) third-party app store purchases (Google Play / App Store) — please request via the store, (c) fraudulent chargebacks.</p>
            </Block>
          </CardContent>
        </Card>

        <div className="text-center">
          <Button asChild><Link to="/contact">Need help? Contact us</Link></Button>
        </div>
      </div>
    </MarketingLayout>
  );
}

function Pill({ icon: Icon, title, desc }: any) {
  return (
    <Card className="border-border/50 bg-card/80 text-center">
      <CardContent className="p-5">
        <div className="h-10 w-10 mx-auto rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <p className="font-semibold mb-1">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </CardContent>
    </Card>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-foreground font-semibold mb-2">{title}</h3>
      {children}
    </div>
  );
}
