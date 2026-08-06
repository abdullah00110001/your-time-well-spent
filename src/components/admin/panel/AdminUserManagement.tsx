import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Filter, Eye, Ban, Unlock, AlertTriangle, Shield, Bell, Smartphone, Crown, User } from 'lucide-react';
import { format } from 'date-fns';

interface UserData {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  app_mode: string | null;
  created_at: string;
  subscription?: {
    status: string;
    plan: string;
  };
  risk_score?: number;
  device_count?: number;
  last_active?: string;
}

export default function AdminUserManagement() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterRisk, setFilterRisk] = useState('all');
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [stats, setStats] = useState({ total: 0, active: 0, atRisk: 0, premium: 0 });

  useEffect(() => {
    fetchUsers();
    fetchStats();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Enrich with subscription and risk data
      const enrichedUsers = await Promise.all(
        (profiles || []).map(async (profile) => {
          const [subRes, riskRes, deviceRes] = await Promise.all([
            supabase.from('user_subscriptions').select('status, subscription_plans(name)').eq('user_id', profile.user_id).maybeSingle(),
            supabase.from('user_risk_scores').select('abuse_risk_score').eq('user_id', profile.user_id).maybeSingle(),
            supabase.from('device_intelligence').select('id').eq('user_id', profile.user_id),
          ]);

          return {
            ...profile,
            subscription: subRes.data ? {
              status: subRes.data.status,
              plan: (subRes.data as any).subscription_plans?.name || 'Free'
            } : { status: 'none', plan: 'Free' },
            risk_score: riskRes.data?.abuse_risk_score || 0,
            device_count: deviceRes.data?.length || 0,
          };
        })
      );

      setUsers(enrichedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    const [totalRes, activeRes, riskRes, premiumRes] = await Promise.all([
      supabase.from('profiles').select('user_id', { count: 'exact', head: true }),
      supabase.from('daily_entries').select('user_id', { count: 'exact', head: true }).gte('date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
      supabase.from('user_risk_scores').select('user_id', { count: 'exact', head: true }).gte('abuse_risk_score', 70),
      supabase.from('user_subscriptions').select('user_id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);

    setStats({
      total: totalRes.count || 0,
      active: new Set((activeRes as any).data?.map((e: any) => e.user_id)).size || 0,
      atRisk: riskRes.count || 0,
      premium: premiumRes.count || 0,
    });
  };

  const handleSuspendUser = async (userId: string) => {
    // Log the action
    await supabase.from('system_audit_logs').insert({
      actor_id: (await supabase.auth.getUser()).data.user?.id,
      action: 'user_suspended',
      resource_type: 'user',
      resource_id: userId,
    });
    
    toast.success('User suspended');
    fetchUsers();
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery || 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.user_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPlan = filterPlan === 'all' || user.subscription?.plan.toLowerCase() === filterPlan;
    const matchesRisk = filterRisk === 'all' || 
      (filterRisk === 'high' && (user.risk_score || 0) >= 70) ||
      (filterRisk === 'medium' && (user.risk_score || 0) >= 40 && (user.risk_score || 0) < 70) ||
      (filterRisk === 'low' && (user.risk_score || 0) < 40);
    return matchesSearch && matchesPlan && matchesRisk;
  });

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Bell className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active}</p>
                <p className="text-xs text-muted-foreground">Active (7d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.atRisk}</p>
                <p className="text-xs text-muted-foreground">At Risk</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Crown className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.premium}</p>
                <p className="text-xs text-muted-foreground">Premium</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>View, filter, and manage all platform users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="premium">Premium</SelectItem>
                <SelectItem value="ultimate">Ultimate</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterRisk} onValueChange={setFilterRisk}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="low">Low Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Users Table */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Risk</TableHead>
                  <TableHead>Devices</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="h-10 w-10 rounded-full" />
                            ) : (
                              <User className="h-5 w-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{user.full_name || 'Anonymous'}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{user.user_id.slice(0, 8)}...</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.subscription?.plan === 'Free' ? 'secondary' : 'default'}>
                          {user.subscription?.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline"
                          className={
                            (user.risk_score || 0) >= 70 ? 'border-destructive text-destructive' :
                            (user.risk_score || 0) >= 40 ? 'border-amber-500 text-amber-500' :
                            'border-green-500 text-green-500'
                          }
                        >
                          {user.risk_score || 0}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Smartphone className="h-4 w-4 text-muted-foreground" />
                          {user.device_count}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setSelectedUser(user)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>User Details</DialogTitle>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">User ID</p>
                                    <p className="font-mono text-sm">{user.user_id}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Full Name</p>
                                    <p>{user.full_name || 'Not set'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">App Mode</p>
                                    <Badge>{user.app_mode || 'islamic'}</Badge>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Subscription</p>
                                    <Badge>{user.subscription?.plan} ({user.subscription?.status})</Badge>
                                  </div>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="icon" onClick={() => handleSuspendUser(user.user_id)}>
                            <Ban className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
