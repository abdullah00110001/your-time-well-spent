import { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, Users, MessageSquare, BarChart3, 
  Search, Send, Zap, TrendingUp, Clock, Activity
} from 'lucide-react';
import { format, subDays } from 'date-fns';

export default function AdminCommandCenter() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeToday: 0,
    atRisk: 0,
    pendingFeedback: 0
  });

  useEffect(() => {
    fetchQuickStats();
  }, []);

  const fetchQuickStats = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const threeAgo = format(subDays(new Date(), 3), 'yyyy-MM-dd');

    const [profiles, todayEntries, recentEntries] = await Promise.all([
      supabase.from('profiles').select('user_id', { count: 'exact' }),
      supabase.from('daily_entries').select('user_id').eq('date', today),
      supabase.from('daily_entries').select('user_id').gte('date', threeAgo)
    ]);

    const activeUserIds = new Set(recentEntries.data?.map(e => e.user_id));
    const atRiskCount = (profiles.count || 0) - activeUserIds.size;

    setStats({
      totalUsers: profiles.count || 0,
      activeToday: new Set(todayEntries.data?.map(e => e.user_id)).size,
      atRisk: Math.max(0, atRiskCount),
      pendingFeedback: 0
    });
  };

  const quickActions = [
    { title: 'View At-Risk Users', icon: AlertTriangle, href: '/admin/at-risk', color: 'text-destructive', badge: stats.atRisk },
    { title: 'User Inspector', icon: Search, href: '/admin/users', color: 'text-blue-500' },
    { title: 'Send Feedback', icon: MessageSquare, href: '/admin/feedback', color: 'text-green-500' },
    { title: 'View Analytics', icon: BarChart3, href: '/admin/analytics', color: 'text-purple-500' },
  ];

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-headline font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-7 w-7 text-primary" />
            Command Center
          </h1>
          <p className="text-body text-muted-foreground">Quick actions and system overview</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <Card><CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-title font-bold">{stats.totalUsers}</p>
            <p className="text-caption text-muted-foreground">Total Users</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Activity className="h-5 w-5 mx-auto mb-1 text-green-500" />
            <p className="text-title font-bold">{stats.activeToday}</p>
            <p className="text-caption text-muted-foreground">Active Today</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-destructive" />
            <p className="text-title font-bold">{stats.atRisk}</p>
            <p className="text-caption text-muted-foreground">At-Risk</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <Clock className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <p className="text-title font-bold">{format(new Date(), 'HH:mm')}</p>
            <p className="text-caption text-muted-foreground">Server Time</p>
          </CardContent></Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader><CardTitle className="text-subtitle">Quick Actions</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Button key={action.href} variant="outline" className="h-auto p-4 justify-start" asChild>
                <Link to={action.href}>
                  <action.icon className={`h-5 w-5 mr-3 ${action.color}`} />
                  <span className="flex-1 text-left">{action.title}</span>
                  {action.badge !== undefined && action.badge > 0 && (
                    <Badge variant="destructive">{action.badge}</Badge>
                  )}
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
