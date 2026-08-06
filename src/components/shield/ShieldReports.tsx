import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Clock, ShieldOff, Flame, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { isNative } from '@/lib/capacitor/platform';
import ShieldPlugin from '@/lib/capacitor/shieldPlugin';

type Range = 'daily' | 'weekly' | 'monthly';

interface AppStat { name: string; minutes: number; }

export function ShieldReports() {
  const [range, setRange] = useState<Range>('daily');
  const [topApps, setTopApps] = useState<AppStat[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [blockedAttempts, setBlockedAttempts] = useState(0);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        if (isNative) {
          const stats = await ShieldPlugin.getScreenTimeStats();
          const apps = (stats.apps || [])
            .map(a => ({ name: a.appName, minutes: a.usageMinutes }))
            .sort((a, b) => b.minutes - a.minutes)
            .slice(0, 8);
          setTopApps(apps);
          setTotalMinutes(stats.totalMinutes || 0);
          try {
            const b = await ShieldPlugin.getBlockStats();
            setBlockedAttempts(b.blockedAttemptsToday || 0);
          } catch {/* */}
        } else {
          // Web mock
          setTopApps([
            { name: 'Instagram', minutes: 84 },
            { name: 'YouTube', minutes: 62 },
            { name: 'Chrome', minutes: 41 },
            { name: 'WhatsApp', minutes: 28 },
          ]);
          setTotalMinutes(215);
          setBlockedAttempts(7);
        }
        const cleanStreak = parseInt(localStorage.getItem('shield_clean_streak') || '0', 10);
        setStreak(cleanStreak);
      } catch (e) { console.error(e); }
    };
    load();
  }, [range]);

  const productivityScore = useMemo(() => {
    const baseline = 240; // 4hr baseline
    const score = Math.max(0, Math.min(100, Math.round(100 - (totalMinutes / baseline) * 60 + streak * 2)));
    return score;
  }, [totalMinutes, streak]);

  const formatMins = (m: number) => {
    const h = Math.floor(m / 60); const min = m % 60;
    return h > 0 ? `${h}h ${min}m` : `${min}m`;
  };

  return (
    <div className="space-y-4">
      <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        <TabsContent value={range} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Clock className="h-3.5 w-3.5" /> Screen time
                </div>
                <p className="text-2xl font-extrabold">{formatMins(totalMinutes)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <ShieldOff className="h-3.5 w-3.5" /> Blocked
                </div>
                <p className="text-2xl font-extrabold">{blockedAttempts}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <Flame className="h-3.5 w-3.5" /> Clean streak
                </div>
                <p className="text-2xl font-extrabold">{streak}d</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                  <TrendingUp className="h-3.5 w-3.5" /> Score
                </div>
                <p className="text-2xl font-extrabold">{productivityScore}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm">Top apps by usage</h3>
              </div>
              {topApps.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">No usage data yet.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topApps} layout="vertical" margin={{ left: 8, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
                        formatter={(v: number) => [`${v} min`, 'Usage']}
                      />
                      <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}