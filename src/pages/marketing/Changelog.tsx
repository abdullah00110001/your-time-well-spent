import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Release {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  changes: { kind: 'New' | 'Improved' | 'Fixed'; text: string }[];
}

const RELEASES: Release[] = [
  {
    version: '2.4.0',
    date: 'June 2026',
    type: 'minor',
    changes: [
      { kind: 'New', text: 'Public marketing site — Features, Permissions, Privacy, About, Roadmap.' },
      { kind: 'Improved', text: 'PureShield anti-flicker with 4-frame grace + IoU temporal smoothing.' },
      { kind: 'Improved', text: 'Shield restart flow auto re-grants screen capture token.' },
      { kind: 'Fixed', text: 'Android compileSdk bumped to 36 to fix AAR metadata build failure.' },
    ],
  },
  {
    version: '2.3.0',
    date: 'May 2026',
    type: 'minor',
    changes: [
      { kind: 'New', text: 'PureShield tiered model loading (low / mid / high-end phones).' },
      { kind: 'New', text: 'Frosted + pixelate blur styles with rich gradient masks.' },
      { kind: 'Improved', text: 'Lowered detection threshold for smaller faces / thumbnails.' },
      { kind: 'Fixed', text: 'Duplicate Java method compilation error in PureShieldService.' },
    ],
  },
  {
    version: '2.2.0',
    date: 'April 2026',
    type: 'minor',
    changes: [
      { kind: 'New', text: 'Rise group wake — FCM nudges between accountability partners.' },
      { kind: 'New', text: 'Community wake feed (city-level, anonymous).' },
      { kind: 'Improved', text: 'Native exact-alarm receiver bypasses Doze on Android 13+.' },
    ],
  },
  {
    version: '2.1.0',
    date: 'March 2026',
    type: 'minor',
    changes: [
      { kind: 'New', text: 'Intelligence Engine — burnout alerts, cognitive load meter, mood-productivity correlation.' },
      { kind: 'New', text: 'Year in Review wrapped story.' },
      { kind: 'Improved', text: 'Heatmap calendar performance on long histories.' },
    ],
  },
  {
    version: '2.0.0',
    date: 'January 2026',
    type: 'major',
    changes: [
      { kind: 'New', text: 'Islamic Mode dual-system — full app re-themes around Islamic life.' },
      { kind: 'New', text: 'Shield app blocker with tiered strictness + Device Admin.' },
      { kind: 'New', text: 'Life Calendar — lifetime week grid with milestones.' },
      { kind: 'Improved', text: 'Glassmorphic dark-glacier redesign across all surfaces.' },
    ],
  },
];

const KIND_STYLE: Record<string, string> = {
  New: 'border-primary/30 text-primary bg-primary/10',
  Improved: 'border-amber-500/30 text-amber-500 bg-amber-500/10',
  Fixed: 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10',
};

export default function Changelog() {
  return (
    <MarketingLayout eyebrow="Changelog" title="What's new in Life OS" subtitle="Every shipped version, what changed, and why it matters.">
      <div className="mx-auto max-w-3xl px-4 pb-24 space-y-6">
        {RELEASES.map((r) => (
          <Card key={r.version} className="border-border/50 bg-card/80">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-baseline gap-3 mb-4 pb-3 border-b border-border/40">
                <h3 className="text-xl font-bold">v{r.version}</h3>
                <Badge variant="outline" className="text-[10px]">{r.type}</Badge>
                <span className="text-xs text-muted-foreground ml-auto">{r.date}</span>
              </div>
              <ul className="space-y-2.5">
                {r.changes.map((c, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${KIND_STYLE[c.kind]}`}>{c.kind}</Badge>
                    <span className="text-muted-foreground">{c.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </MarketingLayout>
  );
}
