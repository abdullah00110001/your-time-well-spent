import { useMemo } from 'react';
import { Trophy, Sparkles, Award, Flame, Share2, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ShieldStat } from './storage';
import { lifetimeFacesBlurred } from './storage';

interface StatsTabProps {
  stats: ShieldStat[];
  appLabels: Record<string, string>;
}

const PIE_COLORS = ['hsl(var(--primary))', '#a78bfa', '#22d3ee', '#fb7185', '#fbbf24', '#34d399'];

export function StatsTab({ stats, appLabels }: StatsTabProps) {
  const lifetime = lifetimeFacesBlurred(stats);

  const last7 = useMemo(() => {
    const arr: { date: string; faces: number; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const stat = stats.find((s) => s.date === key);
      arr.push({
        date: key,
        faces: stat?.facesBlurred ?? 0,
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      });
    }
    return arr;
  }, [stats]);

  const perApp = useMemo(() => {
    const acc: Record<string, number> = {};
    stats.forEach((s) => {
      Object.entries(s.perApp).forEach(([pkg, n]) => {
        acc[pkg] = (acc[pkg] ?? 0) + n;
      });
    });
    return Object.entries(acc)
      .map(([pkg, value]) => ({ name: appLabels[pkg] ?? pkg, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [stats, appLabels]);

  const heatmap = useMemo(() => {
    const acc = new Array(24).fill(0);
    stats.forEach((s) => s.perHour?.forEach((n, i) => (acc[i] += n)));
    const max = Math.max(1, ...acc);
    return acc.map((v) => v / max);
  }, [stats]);

  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const s = stats.find((x) => x.date === key);
      if (s && s.facesBlurred > 0) count++;
      else if (i > 0) break;
    }
    return count;
  }, [stats]);

  const achievements = [
    { id: 'first100', label: 'First 100', icon: Sparkles, unlocked: lifetime >= 100, hint: '100 faces' },
    { id: 'streak7', label: '7-day Streak', icon: Flame, unlocked: streak >= 7, hint: '7 days active' },
    { id: 'guardian', label: 'Guardian', icon: Award, unlocked: lifetime >= 1000, hint: '1,000 faces' },
    { id: 'hour', label: '1 Hour Saved', icon: Trophy, unlocked: lifetime >= 7200, hint: '2 faces/sec × 1h' },
  ];

  const noData = lifetime === 0;

  return (
    <div className="space-y-6 mt-5">
      {/* Lifetime counter */}
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-violet-500/10 p-5 text-center">
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-1">
          Total Faces Protected
        </div>
        <div className="text-4xl font-bold bg-gradient-to-br from-primary to-violet-500 bg-clip-text text-transparent">
          {lifetime.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground mt-2">
          {streak > 0 ? `🔥 ${streak}-day streak` : 'Start filtering to build your streak'}
        </div>
      </div>

      {noData ? (
        <EmptyState />
      ) : (
        <>
          {/* Bar chart */}
          <Section title="Last 7 Days">
            <div className="h-44 rounded-2xl border border-border/50 bg-card p-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                    contentStyle={{
                      background: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="faces" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          {/* Pie chart */}
          {perApp.length > 0 && (
            <Section title="Breakdown by App">
              <div className="rounded-2xl border border-border/50 bg-card p-3 flex items-center gap-3">
                <div className="h-32 w-32 shrink-0">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={perApp} dataKey="value" innerRadius={28} outerRadius={56} paddingAngle={2}>
                        {perApp.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1.5">
                  {perApp.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate flex-1">{p.name}</span>
                      <span className="font-medium tabular-nums">{p.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Section>
          )}

          {/* Heatmap */}
          <Section title="Activity by Hour">
            <div className="rounded-2xl border border-border/50 bg-card p-3">
              <div className="grid grid-cols-12 gap-1">
                {heatmap.map((v, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-sm"
                    style={{
                      background: `hsl(var(--primary) / ${0.08 + v * 0.85})`,
                    }}
                    title={`${i}:00 — intensity ${(v * 100).toFixed(0)}%`}
                  />
                ))}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
                <span>00</span>
                <span>06</span>
                <span>12</span>
                <span>18</span>
                <span>23</span>
              </div>
            </div>
          </Section>
        </>
      )}

      {/* Achievements */}
      <Section title="Achievements">
        <div className="grid grid-cols-2 gap-2.5">
          {achievements.map((a) => (
            <div
              key={a.id}
              className={cn(
                'rounded-xl border p-3',
                a.unlocked
                  ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-border/50 bg-card opacity-60',
              )}
            >
              <a.icon
                className={cn(
                  'h-5 w-5 mb-1.5',
                  a.unlocked ? 'text-amber-500' : 'text-muted-foreground',
                )}
              />
              <div className="text-xs font-semibold flex items-center gap-1.5">
                {a.label}
                {a.unlocked && <Badge className="h-4 text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 border-0 px-1.5">UNLOCKED</Badge>}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{a.hint}</div>
            </div>
          ))}
        </div>
        <Button variant="outline" className="w-full mt-3" disabled={lifetime === 0}>
          <Share2 className="h-4 w-4 mr-2" />
          Share progress
        </Button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider mb-2 px-1">
        {title}
      </h2>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <BarChart3 className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
      <p className="text-sm font-medium">No stats yet</p>
      <p className="text-xs text-muted-foreground mt-1">
        Start filtering to see daily activity, app breakdown, and achievements.
      </p>
    </div>
  );
}

export default StatsTab;
