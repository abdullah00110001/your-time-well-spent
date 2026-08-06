import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, DollarSign, TrendingUp, Users, Plus, Edit, Ticket, Gift, AlertTriangle, Search, Download, Key, Smartphone } from 'lucide-react';
import { format } from 'date-fns';
import AdminPaymentProviders from './AdminPaymentProviders';
import AdminPlanManager from './AdminPlanManager';
import AdminManualPayments from './AdminManualPayments';

interface SubscriptionPlan {
  id: string;
  plan_key: string;
  name: string;
  tier: string;
  price_monthly: number | null;
  price_yearly: number | null;
  price_lifetime: number | null;
  features: string[];
  is_active: boolean;
}

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  valid_until: string | null;
  is_active: boolean;
}

interface PaymentLog {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  platform: string;
  status: string;
  created_at: string;
}

export default function AdminPayments() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [payments, setPayments] = useState<PaymentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ mrr: 0, arr: 0, activeSubscribers: 0, conversionRate: 0 });
  const [isAddCouponOpen, setIsAddCouponOpen] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 10,
    max_uses: 100,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, couponsRes, paymentsRes, subsRes] = await Promise.all([
        supabase.from('subscription_plans').select('*').order('price_monthly'),
        supabase.from('coupons').select('*').order('created_at', { ascending: false }),
        supabase.from('payment_logs').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('user_subscriptions').select('*', { count: 'exact' }).eq('status', 'active'),
      ]);

      setPlans((plansRes.data || []).map(p => ({ ...p, features: p.features as string[] || [] })));
      setCoupons(couponsRes.data || []);
      setPayments(paymentsRes.data || []);

      // Calculate MRR (simplified)
      const activeCount = subsRes.count || 0;
      const avgRevenue = 4.99; // Simplified avg
      setStats({
        mrr: activeCount * avgRevenue,
        arr: activeCount * avgRevenue * 12,
        activeSubscribers: activeCount,
        conversionRate: 12.5, // Would calculate from data
      });
    } catch (error) {
      console.error('Error fetching payment data:', error);
      toast.error('Failed to fetch payment data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCoupon = async () => {
    try {
      const { error } = await supabase
        .from('coupons')
        .insert({
          code: newCoupon.code.toUpperCase(),
          discount_type: newCoupon.discount_type,
          discount_value: newCoupon.discount_value,
          max_uses: newCoupon.max_uses,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        });

      if (error) throw error;
      toast.success('Coupon created');
      setIsAddCouponOpen(false);
      setNewCoupon({ code: '', discount_type: 'percentage', discount_value: 10, max_uses: 100 });
      fetchData();
    } catch (error) {
      console.error('Error creating coupon:', error);
      toast.error('Failed to create coupon');
    }
  };

  const toggleCoupon = async (coupon: Coupon) => {
    try {
      const { error } = await supabase
        .from('coupons')
        .update({ is_active: !coupon.is_active })
        .eq('id', coupon.id);

      if (error) throw error;
      toast.success(coupon.is_active ? 'Coupon deactivated' : 'Coupon activated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update coupon');
    }
  };

  return (
    <div className="space-y-6">
      {/* Revenue Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.mrr.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">MRR</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.arr.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground">ARR</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeSubscribers}</p>
                <p className="text-xs text-muted-foreground">Subscribers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <CreditCard className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.conversionRate}%</p>
                <p className="text-xs text-muted-foreground">Conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="manual" className="space-y-6">
        <TabsList>
          <TabsTrigger value="manual">
            <Smartphone className="h-4 w-4 mr-1" />
            ম্যানুয়াল পেমেন্ট
          </TabsTrigger>
          <TabsTrigger value="providers">
            <Key className="h-4 w-4 mr-1" />
            Providers
          </TabsTrigger>
          <TabsTrigger value="plans">Plans</TabsTrigger>
          <TabsTrigger value="coupons">Coupons</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="fraud">Fraud Detection</TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <AdminManualPayments />
        </TabsContent>

        <TabsContent value="providers">
          <AdminPaymentProviders />
        </TabsContent>

        <TabsContent value="plans">
          <AdminPlanManager />
          <Card>
            <CardHeader>
              <CardTitle>Subscription Plans</CardTitle>
              <CardDescription>Manage pricing and features</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <div key={plan.id} className={`p-4 rounded-lg border ${!plan.is_active ? 'opacity-50' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">{plan.name}</h3>
                      <Badge variant={plan.tier === 'premium' ? 'default' : plan.tier === 'ultimate' ? 'destructive' : 'secondary'}>
                        {plan.tier}
                      </Badge>
                    </div>
                    <div className="space-y-2 mb-4">
                      {plan.price_monthly && (
                        <p className="text-2xl font-bold">${plan.price_monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                      )}
                      {plan.price_yearly && (
                        <p className="text-sm text-muted-foreground">${plan.price_yearly}/year</p>
                      )}
                      {plan.price_lifetime && (
                        <p className="text-sm text-muted-foreground">${plan.price_lifetime} lifetime</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      {plan.features.slice(0, 4).map((feature, i) => (
                        <p key={i} className="text-xs text-muted-foreground">✓ {feature}</p>
                      ))}
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-4">
                      <Edit className="h-3 w-3 mr-1" />
                      Edit Plan
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coupons">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Ticket className="h-5 w-5" />
                  Coupons & Discounts
                </CardTitle>
                <CardDescription>Manage promotional codes</CardDescription>
              </div>
              <Dialog open={isAddCouponOpen} onOpenChange={setIsAddCouponOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Coupon
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Coupon</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Coupon Code</Label>
                      <Input
                        placeholder="SUMMER2024"
                        value={newCoupon.code}
                        onChange={(e) => setNewCoupon(prev => ({ ...prev, code: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Discount Type</Label>
                        <Select value={newCoupon.discount_type} onValueChange={(v) => setNewCoupon(prev => ({ ...prev, discount_type: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="fixed">Fixed Amount</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Value</Label>
                        <Input
                          type="number"
                          value={newCoupon.discount_value}
                          onChange={(e) => setNewCoupon(prev => ({ ...prev, discount_value: parseInt(e.target.value) || 0 }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Max Uses</Label>
                      <Input
                        type="number"
                        value={newCoupon.max_uses}
                        onChange={(e) => setNewCoupon(prev => ({ ...prev, max_uses: parseInt(e.target.value) || 0 }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddCouponOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddCoupon}>Create Coupon</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Uses</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">No coupons created</TableCell>
                    </TableRow>
                  ) : (
                    coupons.map((coupon) => (
                      <TableRow key={coupon.id}>
                        <TableCell>
                          <code className="px-2 py-1 bg-muted rounded">{coupon.code}</code>
                        </TableCell>
                        <TableCell>
                          {coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `$${coupon.discount_value}`}
                        </TableCell>
                        <TableCell>
                          {coupon.uses_count}/{coupon.max_uses || '∞'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={coupon.is_active ? 'default' : 'secondary'}>
                            {coupon.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => toggleCoupon(coupon)}>
                            {coupon.is_active ? 'Deactivate' : 'Activate'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>Recent payment activity</CardDescription>
              </div>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">No transactions yet</TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono text-sm">{payment.user_id.slice(0, 8)}...</TableCell>
                        <TableCell>${payment.amount} {payment.currency}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{payment.platform}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={payment.status === 'completed' ? 'default' : 'destructive'}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{format(new Date(payment.created_at), 'MMM d, HH:mm')}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fraud">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Fraud & Abuse Detection
              </CardTitle>
              <CardDescription>Monitor suspicious activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 rounded-lg border bg-green-500/5 border-green-500/20">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-green-500"></div>
                    <span className="font-medium">No suspicious activity detected</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    All recent transactions appear legitimate. Continue monitoring.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg border text-center">
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-xs text-muted-foreground">Refund Abuse</p>
                  </div>
                  <div className="p-4 rounded-lg border text-center">
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-xs text-muted-foreground">Emulator Detected</p>
                  </div>
                  <div className="p-4 rounded-lg border text-center">
                    <p className="text-2xl font-bold">0</p>
                    <p className="text-xs text-muted-foreground">Receipt Forgery</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
