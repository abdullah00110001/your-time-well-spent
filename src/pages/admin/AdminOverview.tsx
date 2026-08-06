import { useEffect, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { 
  Users, 
  UserCheck, 
  TrendingUp, 
  AlertTriangle,
  Activity,
  Moon,
  Sun,
  Loader2,
  ArrowUpRight
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

interface DashboardStats {
  totalUsers: number;
  activeToday: number;
  activeThisWeek: number;
  avgDisciplineScore: number;
  atRiskCount: number;
  islamicModeCount: number;
  regularModeCount: number;
}

interface DailyActiveData {
  date: string;
  count: number;
}

interface AtRiskUser {
  user_id: string;
  full_name: string | null;
  email: string;
  days_inactive: number;
  last_entry_date: string | null;
  app_mode: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))'];

export default function AdminOverview() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [dailyActive, setDailyActive] = useState<DailyActiveData[]>([]);
  const [atRiskUsers, setAtRiskUsers] = useState<AtRiskUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      const threeAgo = format(subDays(new Date(), 3), 'yyyy-MM-dd');

      // Fetch total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Fetch active today (users with daily_entries today)
      const { data: todayEntries } = await supabase
        .from('daily_entries')
        .select('user_id')
        .eq('date', today);
      const activeToday = new Set(todayEntries?.map(e => e.user_id)).size;

      // Fetch active this week
      const { data: weekEntries } = await supabase
        .from('daily_entries')
        .select('user_id')
        .gte('date', weekAgo);
      const activeThisWeek = new Set(weekEntries?.map(e => e.user_id)).size;

      // Fetch average discipline score
      const { data: scoreData } = await supabase
        .from('daily_entries')
        .select('discipline_level')
        .not('discipline_level', 'is', null)
        .gte('date', weekAgo);
      const avgDiscipline = scoreData?.length 
        ? scoreData.reduce((sum, e) => sum + (e.discipline_level || 0), 0) / scoreData.length 
        : 0;

      // Fetch mode distribution
      const { data: modeData } = await supabase
        .from('profiles')
        .select('app_mode');
      const islamicCount = modeData?.filter(p => p.app_mode === 'islamic').length || 0;
      const regularCount = modeData?.filter(p => p.app_mode !== 'islamic').length || 0;

      // Fetch at-risk users (no entries for 3+ days)
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, app_mode');

      const { data: recentEntries } = await supabase
        .from('daily_entries')
        .select('user_id, date')
        .gte('date', threeAgo);

      const activeUserIds = new Set(recentEntries?.map(e => e.user_id));
      const atRisk: AtRiskUser[] = [];

      for (const profile of allProfiles || []) {
        if (!activeUserIds.has(profile.user_id)) {
          // Get last entry date
          const { data: lastEntry } = await supabase
            .from('daily_entries')
            .select('date')
            .eq('user_id', profile.user_id)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();

          const daysInactive = lastEntry?.date 
            ? Math.floor((new Date().getTime() - new Date(lastEntry.date).getTime()) / (1000 * 60 * 60 * 24))
            : 999;

          if (daysInactive >= 3) {
            atRisk.push({
              user_id: profile.user_id,
              full_name: profile.full_name,
              email: profile.user_id.slice(0, 8) + '...',
              days_inactive: daysInactive,
              last_entry_date: lastEntry?.date || null,
              app_mode: profile.app_mode || 'regular'
            });
          }
        }
      }

      // Fetch daily active data for chart (last 14 days)
      const dailyData: DailyActiveData[] = [];
      for (let i = 13; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const { data: dayEntries } = await supabase
          .from('daily_entries')
          .select('user_id')
          .eq('date', date);
        dailyData.push({
          date: format(subDays(new Date(), i), 'MMM d'),
          count: new Set(dayEntries?.map(e => e.user_id)).size
        });
      }

      setStats({
        totalUsers: totalUsers || 0,
        activeToday,
        activeThisWeek,
        avgDisciplineScore: Math.round(avgDiscipline * 10) / 10,
        atRiskCount: atRisk.length,
        islamicModeCount: islamicCount,
        regularModeCount: regularCount
      });
      setDailyActive(dailyData);
      setAtRiskUsers(atRisk.slice(0, 5));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
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

  const modeData = [
    { name: 'Islamic', value: stats?.islamicModeCount || 0 },
    { name: 'Regular', value: stats?.regularModeCount || 0 }
  ];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 border border-primary/20">
              <Activity className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight">Admin Overview</h1>
              <p className="text-xs text-muted-foreground">Monitor users and system health</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Users', value: stats?.totalUsers, sub: 'registered accounts', icon: Users, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' },
            { label: 'Active Today', value: stats?.activeToday, sub: `${stats?.totalUsers ? Math.round(((stats?.activeToday || 0) / stats.totalUsers) * 100) : 0}% of total`, icon: UserCheck, color: 'text-accent', bg: 'bg-accent/10 border-accent/20', trend: true },
            { label: 'Avg Discipline', value: `${stats?.avgDisciplineScore}/10`, sub: 'this week', icon: TrendingUp, color: 'text-secondary', bg: 'bg-secondary/10 border-secondary/20' },
            { label: 'At-Risk Users', value: stats?.atRiskCount, sub: 'inactive 3+ days', icon: AlertTriangle, color: stats?.atRiskCount ? 'text-destructive' : 'text-muted-foreground', bg: stats?.atRiskCount ? 'bg-destructive/10 border-destructive/20' : 'bg-muted/50 border-border/50' },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                  <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg border', stat.bg)}>
                    <stat.icon className={cn('h-4 w-4', stat.color)} />
                  </div>
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                  {stat.trend && <ArrowUpRight className="h-3 w-3 text-accent" />}
                  {stat.sub}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Daily Active Chart */}
          <Card className="lg:col-span-2">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-subtitle">Daily Active Users</CardTitle>
              <CardDescription className="text-caption">Last 14 days</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dailyActive}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Mode Distribution */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-subtitle">Mode Distribution</CardTitle>
              <CardDescription className="text-caption">User preferences</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {modeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-2">
                <div className="flex items-center gap-2">
                  <Moon className="h-4 w-4 text-primary" />
                  <span className="text-caption">Islamic: {stats?.islamicModeCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="h-4 w-4 text-secondary" />
                  <span className="text-caption">Regular: {stats?.regularModeCount}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* At-Risk Users */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-subtitle flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  At-Risk Users
                </CardTitle>
                <CardDescription className="text-caption">Users who haven't logged data for 3+ days</CardDescription>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/admin/at-risk">View All</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0">
            {atRiskUsers.length === 0 ? (
              <div className="text-center py-8">
                <UserCheck className="h-12 w-12 text-accent mx-auto mb-3" />
                <p className="text-body font-medium">All users are active!</p>
                <p className="text-caption text-muted-foreground">No users have been inactive for 3+ days</p>
              </div>
            ) : (
              <div className="space-y-3">
                {atRiskUsers.map((user) => (
                  <div key={user.user_id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                      </div>
                      <div>
                        <p className="font-medium text-body">{user.full_name || `User ${user.user_id.slice(0, 6)}`}</p>
                        <p className="text-caption text-muted-foreground">
                          Last active: {user.last_entry_date ? format(new Date(user.last_entry_date), 'MMM d, yyyy') : 'Never'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={user.days_inactive > 7 ? 'destructive' : 'secondary'}>
                        {user.days_inactive} days inactive
                      </Badge>
                      <Button variant="ghost" size="sm" asChild>
                        <Link to={`/admin/users?id=${user.user_id}`}>
                          View
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
