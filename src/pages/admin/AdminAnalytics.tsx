import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, Users, Calendar, Target, BarChart3, Mail } from 'lucide-react';
import { format, subDays, subMonths } from 'date-fns';
import { CohortAnalytics } from '@/components/admin/CohortAnalytics';
import { EmailCampaignManager } from '@/components/admin/EmailCampaignManager';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area
} from 'recharts';

interface TrendData {
  date: string;
  value: number;
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [userGrowth, setUserGrowth] = useState<TrendData[]>([]);
  const [dailyActive, setDailyActive] = useState<TrendData[]>([]);
  const [disciplineTrend, setDisciplineTrend] = useState<TrendData[]>([]);
  const [prayerCompletion, setPrayerCompletion] = useState<TrendData[]>([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      // User Growth (last 30 days)
      const growthData: TrendData[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .lte('created_at', `${date}T23:59:59`);
        growthData.push({
          date: format(subDays(new Date(), i), 'MMM d'),
          value: count || 0
        });
      }
      setUserGrowth(growthData);

      // Daily Active Users (last 30 days)
      const activeData: TrendData[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const { data } = await supabase
          .from('daily_entries')
          .select('user_id')
          .eq('date', date);
        activeData.push({
          date: format(subDays(new Date(), i), 'MMM d'),
          value: new Set(data?.map(e => e.user_id)).size
        });
      }
      setDailyActive(activeData);

      // Discipline Trend (last 14 days)
      const disciplineData: TrendData[] = [];
      for (let i = 13; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const { data } = await supabase
          .from('daily_entries')
          .select('discipline_level')
          .eq('date', date)
          .not('discipline_level', 'is', null);
        const avg = data?.length 
          ? data.reduce((s, e) => s + (e.discipline_level || 0), 0) / data.length 
          : 0;
        disciplineData.push({
          date: format(subDays(new Date(), i), 'MMM d'),
          value: Math.round(avg * 10) / 10
        });
      }
      setDisciplineTrend(disciplineData);

      // Prayer Completion Rate (last 7 days)
      const prayerData: TrendData[] = [];
      const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const { data } = await supabase
          .from('daily_entries')
          .select('fajr_completed, dhuhr_completed, asr_completed, maghrib_completed, isha_completed')
          .eq('date', date);
        
        let completed = 0;
        let total = 0;
        data?.forEach(entry => {
          prayers.forEach(p => {
            const key = `${p}_completed` as keyof typeof entry;
            if (entry[key] !== null) {
              total++;
              if (entry[key]) completed++;
            }
          });
        });
        prayerData.push({
          date: format(subDays(new Date(), i), 'EEE'),
          value: total > 0 ? Math.round((completed / total) * 100) : 0
        });
      }
      setPrayerCompletion(prayerData);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-headline font-bold tracking-tight">Analytics</h1>
          <p className="text-body text-muted-foreground">
            System-wide trends, cohort analysis, and email campaigns
          </p>
        </div>

        <Tabs defaultValue="trends" className="space-y-6">
          <TabsList className="grid grid-cols-3 w-full max-w-md">
            <TabsTrigger value="trends">
              <TrendingUp className="h-4 w-4 mr-2" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="cohorts">
              <BarChart3 className="h-4 w-4 mr-2" />
              Cohorts
            </TabsTrigger>
            <TabsTrigger value="campaigns">
              <Mail className="h-4 w-4 mr-2" />
              Campaigns
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trends">
            {/* Charts Grid */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* User Growth */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-subtitle flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    User Growth
                  </CardTitle>
                  <CardDescription className="text-caption">
                    Total registered users over time
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={userGrowth}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="hsl(var(--primary))" 
                          fill="hsl(var(--primary))"
                          fillOpacity={0.2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Daily Active */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-subtitle flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-secondary" />
                    Daily Active Users
                  </CardTitle>
                  <CardDescription className="text-caption">
                    Users who logged data each day
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyActive}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar 
                          dataKey="value" 
                          fill="hsl(var(--secondary))" 
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Discipline Trend */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-subtitle flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Average Discipline Level
                  </CardTitle>
                  <CardDescription className="text-caption">
                    Community-wide discipline score
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={disciplineTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="hsl(142, 76%, 36%)"
                          strokeWidth={2}
                          dot={{ fill: 'hsl(142, 76%, 36%)' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Prayer Completion */}
              <Card>
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-subtitle flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Prayer Completion Rate
                  </CardTitle>
                  <CardDescription className="text-caption">
                    Percentage of prayers completed (Islamic users)
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={prayerCompletion}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <Tooltip 
                          formatter={(value) => [`${value}%`, 'Completion']}
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar 
                          dataKey="value" 
                          fill="hsl(var(--primary))" 
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cohorts">
            <CohortAnalytics />
          </TabsContent>

          <TabsContent value="campaigns">
            <EmailCampaignManager />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
