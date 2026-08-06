import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { 
  Smartphone, Check, X, Eye, Save, Phone, 
  Clock, CheckCircle2, XCircle, AlertCircle, Send
} from 'lucide-react';

interface ManualPayment {
  id: string;
  user_id: string;
  plan_id: string | null;
  payment_method: string;
  phone_number: string;
  trx_id: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  status: string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

interface PaymentInfo {
  bkash_number: string;
  nagad_number: string;
  rocket_number: string;
  instructions_bn: string;
  instructions_en: string;
}

const DEFAULT_PAYMENT_INFO: PaymentInfo = {
  bkash_number: '',
  nagad_number: '',
  rocket_number: '',
  instructions_bn: 'নিচের নম্বরে Send Money করুন, তারপর TrxID দিন।',
  instructions_en: 'Send money to the number below, then submit your TrxID.',
};

export default function AdminManualPayments() {
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo>(DEFAULT_PAYMENT_INFO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<ManualPayment | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [paymentsRes, settingsRes, profilesRes] = await Promise.all([
        supabase.from('manual_payments').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('app_settings').select('*').eq('key', 'manual_payment_info').maybeSingle(),
        supabase.from('profiles').select('user_id, full_name'),
      ]);

      setPayments((paymentsRes.data || []) as ManualPayment[]);
      
      if (settingsRes.data?.value) {
        setPaymentInfo({ ...DEFAULT_PAYMENT_INFO, ...(settingsRes.data.value as any) });
      }

      const profileMap: Record<string, string> = {};
      (profilesRes.data || []).forEach((p: any) => {
        profileMap[p.user_id] = p.full_name || 'Unknown';
      });
      setProfiles(profileMap);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePaymentInfo = async () => {
    setSaving(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'manual_payment_info')
        .maybeSingle();

      if (existing) {
        await supabase
          .from('app_settings')
          .update({ value: paymentInfo as any, updated_by: userId })
          .eq('key', 'manual_payment_info');
      } else {
        await supabase
          .from('app_settings')
          .insert({ key: 'manual_payment_info', value: paymentInfo as any, updated_by: userId });
      }
      toast.success('পেমেন্ট তথ্য সেভ হয়েছে!');
    } catch (error) {
      toast.error('সেভ করতে ব্যর্থ');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (payment: ManualPayment) => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      
      // Update payment status
      await supabase
        .from('manual_payments')
        .update({ 
          status: 'approved', 
          reviewed_by: userId, 
          reviewed_at: new Date().toISOString(),
          admin_note: adminNote || null 
        })
        .eq('id', payment.id);

      // If plan_id exists, activate subscription
      if (payment.plan_id) {
        const now = new Date();
        let expiresAt: Date;
        if (payment.billing_cycle === 'weekly') {
          expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        } else if (payment.billing_cycle === 'yearly') {
          expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
        } else {
          expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }

        await supabase.from('user_subscriptions').insert({
          user_id: payment.user_id,
          plan_id: payment.plan_id,
          status: 'active',
          platform: 'manual',
          starts_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
        });
      }

      // Send notification to user
      await supabase.from('notifications').insert({
        user_id: payment.user_id,
        title: '✅ পেমেন্ট অনুমোদিত!',
        message: `আপনার ${payment.payment_method} পেমেন্ট (TrxID: ${payment.trx_id}) অনুমোদিত হয়েছে। প্রিমিয়াম ফিচার এখন সক্রিয়!`,
        type: 'payment',
        metadata: { payment_id: payment.id, status: 'approved' },
      });

      toast.success('পেমেন্ট অনুমোদিত হয়েছে ও ইউজারকে নোটিফাই করা হয়েছে!');
      setSelectedPayment(null);
      setAdminNote('');
      fetchData();
    } catch (error) {
      console.error('Error approving:', error);
      toast.error('অনুমোদন করতে ব্যর্থ');
    }
  };

  const handleReject = async (payment: ManualPayment) => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      
      await supabase
        .from('manual_payments')
        .update({ 
          status: 'rejected', 
          reviewed_by: userId, 
          reviewed_at: new Date().toISOString(),
          admin_note: adminNote || 'পেমেন্ট যাচাই ব্যর্থ' 
        })
        .eq('id', payment.id);

      // Notify user
      await supabase.from('notifications').insert({
        user_id: payment.user_id,
        title: '❌ পেমেন্ট প্রত্যাখ্যান',
        message: `আপনার ${payment.payment_method} পেমেন্ট (TrxID: ${payment.trx_id}) প্রত্যাখ্যান হয়েছে। ${adminNote || 'অনুগ্রহ করে সঠিক TrxID দিন।'}`,
        type: 'payment',
        metadata: { payment_id: payment.id, status: 'rejected' },
      });

      toast.success('পেমেন্ট প্রত্যাখ্যান হয়েছে ও ইউজারকে নোটিফাই করা হয়েছে');
      setSelectedPayment(null);
      setAdminNote('');
      fetchData();
    } catch (error) {
      toast.error('প্রত্যাখ্যান করতে ব্যর্থ');
    }
  };

  const pendingCount = payments.filter(p => p.status === 'pending').length;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />অনুমোদিত</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />প্রত্যাখ্যাত</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20"><Clock className="h-3 w-3" />অপেক্ষমান</Badge>;
    }
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'bkash': return '🟣 bKash';
      case 'nagad': return '🟠 Nagad';
      case 'rocket': return '🔵 Rocket';
      default: return method;
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests" className="gap-1">
            পেমেন্ট রিকুয়েস্ট
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="settings">পেমেন্ট সেটিংস</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                ম্যানুয়াল পেমেন্ট রিকুয়েস্ট
              </CardTitle>
              <CardDescription>ইউজারদের bKash/Nagad/Rocket পেমেন্ট যাচাই ও অনুমোদন করুন</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ইউজার</TableHead>
                    <TableHead>পদ্ধতি</TableHead>
                    <TableHead>ফোন</TableHead>
                    <TableHead>TrxID</TableHead>
                    <TableHead>টাকা</TableHead>
                    <TableHead>স্ট্যাটাস</TableHead>
                    <TableHead>তারিখ</TableHead>
                    <TableHead className="text-right">অ্যাকশন</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        কোনো পেমেন্ট রিকুয়েস্ট নেই
                      </TableCell>
                    </TableRow>
                  ) : (
                    payments.map((payment) => (
                      <TableRow key={payment.id} className={payment.status === 'pending' ? 'bg-amber-500/5' : ''}>
                        <TableCell className="font-medium">{profiles[payment.user_id] || payment.user_id.slice(0, 8)}</TableCell>
                        <TableCell>{getMethodLabel(payment.payment_method)}</TableCell>
                        <TableCell className="font-mono text-sm">{payment.phone_number}</TableCell>
                        <TableCell className="font-mono text-sm font-medium">{payment.trx_id}</TableCell>
                        <TableCell>৳{payment.amount}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(payment.created_at), 'dd MMM, HH:mm')}
                        </TableCell>
                        <TableCell className="text-right">
                          {payment.status === 'pending' ? (
                            <Button variant="outline" size="sm" onClick={() => { setSelectedPayment(payment); setAdminNote(''); }}>
                              <Eye className="h-3 w-3 mr-1" />
                              রিভিউ
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {payment.admin_note || '—'}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                পেমেন্ট তথ্য সেটআপ
              </CardTitle>
              <CardDescription>ইউজাররা এই নম্বরগুলোতে টাকা পাঠাবে। সেটআপ করলে প্রিমিয়াম পেজে দেখাবে।</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">🟣 bKash নম্বর</Label>
                  <Input
                    placeholder="01XXXXXXXXX"
                    value={paymentInfo.bkash_number}
                    onChange={(e) => setPaymentInfo(prev => ({ ...prev, bkash_number: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">🟠 Nagad নম্বর</Label>
                  <Input
                    placeholder="01XXXXXXXXX"
                    value={paymentInfo.nagad_number}
                    onChange={(e) => setPaymentInfo(prev => ({ ...prev, nagad_number: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">🔵 Rocket নম্বর</Label>
                  <Input
                    placeholder="01XXXXXXXXX"
                    value={paymentInfo.rocket_number}
                    onChange={(e) => setPaymentInfo(prev => ({ ...prev, rocket_number: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>নির্দেশনা (বাংলা)</Label>
                <Textarea
                  value={paymentInfo.instructions_bn}
                  onChange={(e) => setPaymentInfo(prev => ({ ...prev, instructions_bn: e.target.value }))}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>Instructions (English)</Label>
                <Textarea
                  value={paymentInfo.instructions_en}
                  onChange={(e) => setPaymentInfo(prev => ({ ...prev, instructions_en: e.target.value }))}
                  rows={2}
                />
              </div>
              <Button onClick={savePaymentInfo} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'সেভ হচ্ছে...' : 'সেভ করুন'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={() => setSelectedPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>পেমেন্ট রিভিউ</DialogTitle>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground text-xs">ইউজার</p>
                  <p className="font-medium">{profiles[selectedPayment.user_id] || selectedPayment.user_id.slice(0, 8)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground text-xs">পদ্ধতি</p>
                  <p className="font-medium">{getMethodLabel(selectedPayment.payment_method)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground text-xs">ফোন নম্বর</p>
                  <p className="font-mono font-medium">{selectedPayment.phone_number}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground text-xs">TrxID</p>
                  <p className="font-mono font-bold text-primary">{selectedPayment.trx_id}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground text-xs">পরিমাণ</p>
                  <p className="font-bold text-lg">৳{selectedPayment.amount}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted">
                  <p className="text-muted-foreground text-xs">বিলিং সাইকেল</p>
                  <p className="font-medium">{selectedPayment.billing_cycle}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                  <p className="text-sm text-amber-700">
                    bKash/Nagad অ্যাপ থেকে TrxID যাচাই করুন। ভুয়া TrxID হলে প্রত্যাখ্যান করুন।
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>অ্যাডমিন নোট (ঐচ্ছিক)</Label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="যেকোনো মন্তব্য..."
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => selectedPayment && handleReject(selectedPayment)}
            >
              <X className="h-4 w-4 mr-1" />
              প্রত্যাখ্যান
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => selectedPayment && handleApprove(selectedPayment)}
            >
              <Check className="h-4 w-4 mr-1" />
              অনুমোদন করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
