import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Key, Search, Crown, Gift, Lock, Unlock, Clock, Users, CreditCard, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface Subscription {
  id: string;
  user_id: string;
  status: string | null;
  starts_at: string | null;
  expires_at: string | null;
  cancelled_at: string | null;
  is_trial: boolean | null;
  plan_name?: string;
}

export default function AdminEntitlements() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isGrantOpen, setIsGrantOpen] = useState(false);
  const [grantData, setGrantData] = useState({ userId: '', plan: 'premium', days: 30 });
  const [stats, setStats] = useState({ active: 0, expired: 0, trial: 0, lifetime: 0 });

  useEffect(() => { fetchSubscriptions(); }, []);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*, subscription_plans(name)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const enriched = (data || []).map(s => ({
        ...s,
        plan_name: (s as any).subscription_plans?.name || 'Unknown',
      }));

      setSubscriptions(enriched);
      setStats({
        active: enriched.filter(s => s.status === 'active').length,
        expired: enriched.filter(s => s.status === 'expired' || s.status === 'cancelled').length,
        trial: enriched.filter(s => s.status === 'trial').length,
        lifetime: enriched.filter(s => s.status === 'lifetime').length,
      });
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async () => {
    if (!grantData.userId) { toast.error('Enter user ID'); return; }
    try {
      const planRes = await supabase.from('subscription_plans').select('id').eq('tier', grantData.plan).single();
      if (!planRes.data) { toast.error('Plan not found'); return; }

      const endDate = new Date();
      endDate.setDate(endDate.getDate() + grantData.days);

      const { error } = await supabase.from('user_subscriptions').upsert({
        user_id: grantData.userId,
        plan_id: planRes.data.id,
        status: 'active',
        platform: 'admin_grant',
        starts_at: new Date().toISOString(),
        expires_at: endDate.toISOString(),
      }, { onConflict: 'user_id' });

      if (error) throw error;

      await supabase.from('system_audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'access_granted',
        resource_type: 'subscription',
        resource_id: grantData.userId,
        new_value: grantData,
      });

      toast.success('Access granted');
      setIsGrantOpen(false);
      fetchSubscriptions();
    } catch (error) {
      toast.error('Failed to grant access');
    }
  };

  const revokeAccess = async (sub: Subscription) => {
    try {
      await supabase.from('user_subscriptions').update({ status: 'revoked' }).eq('id', sub.id);
      
      await supabase.from('system_audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'access_revoked',
        resource_type: 'subscription',
        resource_id: sub.user_id,
      });

      toast.success('Access revoked');
      fetchSubscriptions();
    } catch (error) {
      toast.error('Failed to revoke access');
    }
  };

  const extendSubscription = async (sub: Subscription, days: number) => {
    try {
      const currentEnd = sub.expires_at ? new Date(sub.expires_at) : new Date();
      currentEnd.setDate(currentEnd.getDate() + days);

      await supabase.from('user_subscriptions')
        .update({ expires_at: currentEnd.toISOString(), status: 'active' })
        .eq('id', sub.id);

      toast.success(`Extended by ${days} days`);
      fetchSubscriptions();
    } catch (error) {
      toast.error('Failed to extend');
    }
  };

  const filtered = subscriptions.filter(s => {
    const matchSearch = !searchQuery || s.user_id.includes(searchQuery) || s.plan_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active', value: stats.active, icon: Crown, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Expired/Cancelled', value: stats.expired, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Trial', value: stats.trial, icon: Gift, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Lifetime', value: stats.lifetime, icon: Key, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bg}`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Entitlement Engine</CardTitle>
            <CardDescription>Manage user access and subscriptions</CardDescription>
          </div>
          <Dialog open={isGrantOpen} onOpenChange={setIsGrantOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Grant Access</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Grant Premium Access</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>User ID</Label>
                  <Input placeholder="uuid..." value={grantData.userId} onChange={e => setGrantData(p => ({ ...p, userId: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Plan</Label>
                    <Select value={grantData.plan} onValueChange={v => setGrantData(p => ({ ...p, plan: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="premium">Premium</SelectItem>
                        <SelectItem value="ultimate">Ultimate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (days)</Label>
                    <Input type="number" value={grantData.days} onChange={e => setGrantData(p => ({ ...p, days: parseInt(e.target.value) || 30 }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsGrantOpen(false)}>Cancel</Button>
                <Button onClick={handleGrantAccess}>Grant Access</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by user ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">No subscriptions found</TableCell></TableRow>
              ) : (
                filtered.map(sub => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-mono text-sm">{sub.user_id.slice(0, 8)}...</TableCell>
                    <TableCell><Badge>{sub.plan_name}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={sub.status === 'active' ? 'default' : sub.status === 'revoked' ? 'destructive' : 'secondary'}>
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {sub.expires_at ? format(new Date(sub.expires_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => extendSubscription(sub, 30)}>
                          <Clock className="h-3 w-3 mr-1" /> +30d
                        </Button>
                        {sub.status === 'active' ? (
                          <Button variant="ghost" size="icon" onClick={() => revokeAccess(sub)}>
                            <Lock className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" onClick={() => extendSubscription(sub, 30)}>
                            <Unlock className="h-4 w-4 text-green-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
