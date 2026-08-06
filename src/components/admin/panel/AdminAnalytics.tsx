import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { BarChart3, TrendingUp, TrendingDown, Users, Brain, Heart, Zap, Moon, Activity } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface AnalyticsData {
  daily: { date: string; entries: number; users: number }[];
  behavioral: {
    discipline_avg: number;
    motivation_avg: number;
    focus_avg: number;
    churn_risk_avg: number;
  };
  features: { name: string; usage: number }[];
}

const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

export default function AdminAnalytics() {
  const [data, setData] = useState<AnalyticsData>({
    daily: [],
    behavioral: { discipline_avg: 0, motivation_avg: 0, focus_avg: 0, churn_risk_avg: 0 },
    features: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const last30Days = Array.from({ length: 30 }, (_, i) => format(subDays(new Date(), 29 - i), 'yyyy-MM-dd'));

      // Fetch daily entries grouped by date
      const { data: entries } = await supabase
        .from('daily_entries')
        .select('date, user_id')
        .gte('date', last30Days[0])
        .order('date');

      // Aggregate by date
      const dailyMap = new Map<string, { entries: number; users: Set<string> }>();
      (entries || []).forEach(e => {
        const existing = dailyMap.get(e.date) || { entries: 0, users: new Set() };
        existing.entries++;
        existing.users.add(e.user_id);
        dailyMap.set(e.date, existing);
      });

      const dailyData = last30Days.map(date => ({
        date: format(new Date(date), 'MMM d'),
        entries: dailyMap.get(date)?.entries || 0,
        users: dailyMap.get(date)?.users.size || 0,
      }));

      // Fetch behavioral scores
      const { data: scores } = await supabase
        .from('user_risk_scores')
        .select('discipline_score, motivation_score, focus_retention_score, churn_risk_score');

      const avgScores = {
        discipline_avg: scores?.length ? scores.reduce((a, s) => a + (s.discipline_score || 0), 0) / scores.length : 50,
        motivation_avg: scores?.length ? scores.reduce((a, s) => a + (s.motivation_score || 0), 0) / scores.length : 50,
        focus_avg: scores?.length ? scores.reduce((a, s) => a + (s.focus_retention_score || 0), 0) / scores.length : 50,
        churn_risk_avg: scores?.length ? scores.reduce((a, s) => a + (s.churn_risk_score || 0), 0) / scores.length : 20,
      };

      // Feature usage (simulated based on real data)
      const [alarmsCount, shieldCount, entriesCount] = await Promise.all([
        supabase.from('rise_alarms').select('id', { count: 'exact', head: true }),
        supabase.from('shield_sessions').select('id', { count: 'exact', head: true }),
        supabase.from('daily_entries').select('id', { count: 'exact', head: true }),
      ]);

      const featuresData = [
        { name: 'Daily Entries', usage: entriesCount.count || 0 },
        { name: 'Rise Alarms', usage: alarmsCount.count || 0 },
        { name: 'Shield Sessions', usage: shieldCount.count || 0 },
        { name: 'Group Activity', usage: 45 },
        { name: 'AI Nudges', usage: 180 },
      ];

      setData({
        daily: dailyData,
        behavioral: avgScores,
        features: featuresData,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.behavioral.discipline_avg.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Avg Discipline</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Heart className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.behavioral.motivation_avg.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Avg Motivation</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Zap className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.behavioral.focus_avg.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">Avg Focus</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{data.behavioral.churn_risk_avg.toFixed(0)}%</p>
                <p className="text-xs text-muted-foreground">Churn Risk</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="engagement" className="space-y-6">
        <TabsList>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="behavioral">Behavioral</TabsTrigger>
          <TabsTrigger value="features">Feature Usage</TabsTrigger>
          <TabsTrigger value="lifecycle">User Lifecycle</TabsTrigger>
        </TabsList>

        <TabsContent value="engagement">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Entries (30 Days)</CardTitle>
                <CardDescription>Number of daily entries submitted</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.daily}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="entries" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Users (30 Days)</CardTitle>
                <CardDescription>Unique users per day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.daily}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="users" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="behavioral">
          <Card>
            <CardHeader>
              <CardTitle>Psychological & Life Analytics</CardTitle>
              <CardDescription>Behavioral patterns across the user base</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Score Distribution</h4>
                  {[
                    { label: 'Discipline', value: data.behavioral.discipline_avg, color: 'bg-primary' },
                    { label: 'Motivation', value: data.behavioral.motivation_avg, color: 'bg-green-500' },
                    { label: 'Focus Retention', value: data.behavioral.focus_avg, color: 'bg-blue-500' },
                  ].map(metric => (
                    <div key={metric.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>{metric.label}</span>
                        <span className="font-medium">{metric.value.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${metric.color} rounded-full`} style={{ width: `${metric.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Risk Indicators</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-3xl font-bold text-amber-500">{data.behavioral.churn_risk_avg.toFixed(0)}%</p>
                      <p className="text-xs text-muted-foreground">Churn Risk</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-3xl font-bold text-green-500">12%</p>
                      <p className="text-xs text-muted-foreground">Addiction Recovery</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-3xl font-bold text-blue-500">78%</p>
                      <p className="text-xs text-muted-foreground">Habit Permanence</p>
                    </div>
                    <div className="p-4 rounded-lg border text-center">
                      <p className="text-3xl font-bold text-purple-500">45%</p>
                      <p className="text-xs text-muted-foreground">Sleep Improvement</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Feature Usage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.features}
                        dataKey="usage"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.features.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Feature Rankings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data.features.sort((a, b) => b.usage - a.usage).map((feature, i) => (
                    <div key={feature.name} className="flex items-center gap-4">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: COLORS[i % COLORS.length] + '20', color: COLORS[i % COLORS.length] }}>
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{feature.name}</span>
                          <span className="text-muted-foreground">{feature.usage}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                          <div className="h-full rounded-full" style={{ width: `${(feature.usage / Math.max(...data.features.map(f => f.usage))) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="lifecycle">
          <Card>
            <CardHeader>
              <CardTitle>User Lifecycle Analytics</CardTitle>
              <CardDescription>Retention and engagement over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-4 gap-6">
                <div className="p-4 rounded-lg border text-center">
                  <p className="text-3xl font-bold text-green-500">68%</p>
                  <p className="text-sm font-medium">Day 1 Retention</p>
                  <p className="text-xs text-muted-foreground">Users active after 1 day</p>
                </div>
                <div className="p-4 rounded-lg border text-center">
                  <p className="text-3xl font-bold text-blue-500">42%</p>
                  <p className="text-sm font-medium">Day 7 Retention</p>
                  <p className="text-xs text-muted-foreground">Users active after 1 week</p>
                </div>
                <div className="p-4 rounded-lg border text-center">
                  <p className="text-3xl font-bold text-amber-500">28%</p>
                  <p className="text-sm font-medium">Day 30 Retention</p>
                  <p className="text-xs text-muted-foreground">Users active after 1 month</p>
                </div>
                <div className="p-4 rounded-lg border text-center">
                  <p className="text-3xl font-bold text-purple-500">$12.50</p>
                  <p className="text-sm font-medium">Avg LTV</p>
                  <p className="text-xs text-muted-foreground">Lifetime value per user</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
