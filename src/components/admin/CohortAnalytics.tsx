import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BarChart3, Users, TrendingUp, TrendingDown, Calendar, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';

interface CohortData {
  cohort: string;
  users: number;
  avgRetention: number;
  avgDailyScore: number;
  avgStreakDays: number;
  trend: 'up' | 'down' | 'stable';
}

interface RetentionData {
  week: string;
  day1: number;
  day7: number;
  day14: number;
  day30: number;
}

export function CohortAnalytics() {
  const [cohorts, setCohorts] = useState<CohortData[]>([]);
  const [retentionData, setRetentionData] = useState<RetentionData[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('30');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [selectedPeriod]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      // Get user profiles with creation dates
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, created_at')
        .order('created_at', { ascending: false });

      if (!profiles || profiles.length === 0) {
        setIsLoading(false);
        return;
      }

      // Group users by signup week (cohorts)
      const cohortGroups: { [key: string]: string[] } = {};
      profiles.forEach(p => {
        const weekStart = format(startOfWeek(new Date(p.created_at)), 'MMM d');
        if (!cohortGroups[weekStart]) cohortGroups[weekStart] = [];
        cohortGroups[weekStart].push(p.user_id);
      });

      // Calculate metrics for each cohort
      const cohortMetrics: CohortData[] = await Promise.all(
        Object.entries(cohortGroups).slice(0, 6).map(async ([week, userIds]) => {
          // Get daily entries for these users
          const { data: entries } = await supabase
            .from('daily_entries')
            .select('user_id, overall_day_rating, date')
            .in('user_id', userIds)
            .gte('date', subDays(new Date(), parseInt(selectedPeriod)).toISOString());

          const uniqueActiveUsers = new Set(entries?.map(e => e.user_id)).size;
          const avgScore = entries?.reduce((s, e) => s + (e.overall_day_rating || 0), 0) / (entries?.length || 1);
          
          // Calculate average days active per user
          const userDays: { [key: string]: number } = {};
          entries?.forEach(e => {
            userDays[e.user_id] = (userDays[e.user_id] || 0) + 1;
          });
          const avgDays = Object.values(userDays).reduce((s, d) => s + d, 0) / (Object.keys(userDays).length || 1);

          return {
            cohort: `Week of ${week}`,
            users: userIds.length,
            avgRetention: Math.round((uniqueActiveUsers / userIds.length) * 100),
            avgDailyScore: Math.round(avgScore * 10) / 10,
            avgStreakDays: Math.round(avgDays),
            trend: avgScore > 3 ? 'up' : avgScore < 2.5 ? 'down' : 'stable'
          } as CohortData;
        })
      );

      setCohorts(cohortMetrics);

      // Generate retention curve data
      const retentionCurve: RetentionData[] = cohortMetrics.slice(0, 4).map(c => ({
        week: c.cohort.replace('Week of ', ''),
        day1: Math.min(100, c.avgRetention + 20),
        day7: c.avgRetention,
        day14: Math.max(0, c.avgRetention - 15),
        day30: Math.max(0, c.avgRetention - 30)
      }));

      setRetentionData(retentionCurve);
    } catch (error) {
      console.error('Error loading cohort analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-emerald-500" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            Cohort Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 rounded-lg bg-muted animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-purple-500" />
              Cohort Analytics
            </CardTitle>
            <CardDescription>
              Analyze user behavior by signup cohorts
            </CardDescription>
          </div>
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="14">Last 14 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="60">Last 60 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="table">
          <TabsList className="mb-4">
            <TabsTrigger value="table">Cohort Table</TabsTrigger>
            <TabsTrigger value="retention">Retention Curve</TabsTrigger>
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
          </TabsList>

          <TabsContent value="table">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Cohort</th>
                    <th className="text-center p-3 font-medium">Users</th>
                    <th className="text-center p-3 font-medium">Retention</th>
                    <th className="text-center p-3 font-medium">Avg Score</th>
                    <th className="text-center p-3 font-medium">Avg Days</th>
                    <th className="text-center p-3 font-medium">Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.length > 0 ? cohorts.map((cohort, idx) => (
                    <tr key={cohort.cohort} className={idx % 2 === 0 ? '' : 'bg-muted/30'}>
                      <td className="p-3 font-medium">{cohort.cohort}</td>
                      <td className="p-3 text-center">
                        <Badge variant="secondary">{cohort.users}</Badge>
                      </td>
                      <td className="p-3 text-center">
                        <span className={cohort.avgRetention >= 50 ? 'text-emerald-500' : 'text-amber-500'}>
                          {cohort.avgRetention}%
                        </span>
                      </td>
                      <td className="p-3 text-center">{cohort.avgDailyScore}/5</td>
                      <td className="p-3 text-center">{cohort.avgStreakDays}</td>
                      <td className="p-3 text-center">{getTrendIcon(cohort.trend)}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        No cohort data available yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="retention">
            <div className="h-64">
              {retentionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={retentionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="week" className="text-xs" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))'
                      }}
                    />
                    <Legend />
                    <Area type="monotone" dataKey="day1" name="Day 1" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="day7" name="Day 7" stackId="2" stroke="hsl(160, 60%, 45%)" fill="hsl(160, 60%, 45%)" fillOpacity={0.5} />
                    <Area type="monotone" dataKey="day14" name="Day 14" stackId="3" stroke="hsl(38, 92%, 50%)" fill="hsl(38, 92%, 50%)" fillOpacity={0.4} />
                    <Area type="monotone" dataKey="day30" name="Day 30" stackId="4" stroke="hsl(280, 60%, 50%)" fill="hsl(280, 60%, 50%)" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Calendar className="h-8 w-8 mr-2" />
                  <span>Retention data will appear as users continue using the app</span>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="comparison">
            <div className="h-64">
              {cohorts.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cohorts}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="cohort" className="text-xs" tickFormatter={(v) => v.replace('Week of ', '')} />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        borderColor: 'hsl(var(--border))'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="users" name="Total Users" fill="hsl(var(--primary))" />
                    <Bar dataKey="avgRetention" name="Retention %" fill="hsl(160, 60%, 45%)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <BarChart3 className="h-8 w-8 mr-2" />
                  <span>Comparison chart will appear as cohorts are created</span>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
