import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Smartphone, Send, Copy, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface ManualPaymentFormProps {
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  billingCycle: string;
  onClose: () => void;
  onSuccess: () => void;
}

interface PaymentInfo {
  bkash_number: string;
  nagad_number: string;
  rocket_number: string;
  instructions_bn: string;
  instructions_en: string;
}

export default function ManualPaymentForm({
  planId, planName, amount, currency, billingCycle, onClose, onSuccess
}: ManualPaymentFormProps) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [method, setMethod] = useState('bkash');
  const [phone, setPhone] = useState('');
  const [trxId, setTrxId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentInfo();
  }, []);

  const fetchPaymentInfo = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'manual_payment_info')
        .maybeSingle();

      if (data?.value) {
        setPaymentInfo(data.value as any);
      }
    } catch (error) {
      console.error('Failed to load payment info:', error);
    } finally {
      setLoading(false);
    }
  };

  const getReceiverNumber = () => {
    if (!paymentInfo) return '';
    switch (method) {
      case 'bkash': return paymentInfo.bkash_number;
      case 'nagad': return paymentInfo.nagad_number;
      case 'rocket': return paymentInfo.rocket_number;
      default: return '';
    }
  };

  const copyNumber = () => {
    const number = getReceiverNumber();
    if (number) {
      navigator.clipboard.writeText(number);
      toast.success(language === 'bn' ? 'নম্বর কপি হয়েছে!' : 'Number copied!');
    }
  };

  const handleSubmit = async () => {
    if (!user || !trxId.trim() || !phone.trim()) {
      toast.error(language === 'bn' ? 'সব তথ্য পূরণ করুন' : 'Please fill all fields');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('manual_payments').insert({
        user_id: user.id,
        plan_id: planId,
        payment_method: method,
        phone_number: phone,
        trx_id: trxId.trim(),
        amount,
        currency,
        billing_cycle: billingCycle,
      });

      if (error) throw error;

      setSubmitted(true);
      toast.success(language === 'bn' ? 'পেমেন্ট সাবমিট হয়েছে! অ্যাডমিন যাচাই করবেন।' : 'Payment submitted! Admin will verify.');
      onSuccess();
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(language === 'bn' ? 'সাবমিট ব্যর্থ হয়েছে' : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const receiverNumber = getReceiverNumber();

  if (loading) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!paymentInfo || (!paymentInfo.bkash_number && !paymentInfo.nagad_number && !paymentInfo.rocket_number)) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === 'bn' ? 'পেমেন্ট' : 'Payment'}</DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <XCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {language === 'bn' 
                ? 'পেমেন্ট সিস্টেম এখনও সেটআপ হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।' 
                : 'Payment system not configured yet. Contact admin.'}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (submitted) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <div className="py-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-lg font-semibold">
              {language === 'bn' ? 'পেমেন্ট সাবমিট হয়েছে!' : 'Payment Submitted!'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {language === 'bn' 
                ? 'অ্যাডমিন আপনার TrxID যাচাই করবেন। যাচাই সম্পন্ন হলে নোটিফিকেশন পাবেন।' 
                : 'Admin will verify your TrxID. You will receive a notification once verified.'}
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {language === 'bn' ? 'সাধারণত ১-২৪ ঘণ্টার মধ্যে' : 'Usually within 1-24 hours'}
            </div>
            <Button onClick={onClose} className="w-full mt-4">
              {language === 'bn' ? 'ঠিক আছে' : 'Done'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            {language === 'bn' ? 'মোবাইল পেমেন্ট' : 'Mobile Payment'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Plan Info */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex justify-between items-center">
              <span className="font-medium">{planName}</span>
              <Badge variant="secondary">৳{amount}/{billingCycle === 'monthly' ? 'মাস' : billingCycle === 'yearly' ? 'বছর' : 'সপ্তাহ'}</Badge>
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>{language === 'bn' ? 'পেমেন্ট পদ্ধতি' : 'Payment Method'}</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentInfo.bkash_number && <SelectItem value="bkash">🟣 bKash</SelectItem>}
                {paymentInfo.nagad_number && <SelectItem value="nagad">🟠 Nagad</SelectItem>}
                {paymentInfo.rocket_number && <SelectItem value="rocket">🔵 Rocket</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Instructions */}
          {receiverNumber && (
            <div className="p-3 rounded-lg bg-muted space-y-2">
              <p className="text-sm font-medium">
                {language === 'bn' ? paymentInfo.instructions_bn : paymentInfo.instructions_en}
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-background rounded border font-mono font-bold text-lg">
                  {receiverNumber}
                </code>
                <Button variant="outline" size="icon" onClick={copyNumber}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {language === 'bn' ? `পরিমাণ: ৳${amount}` : `Amount: ৳${amount}`}
              </p>
            </div>
          )}

          {/* User Phone */}
          <div className="space-y-2">
            <Label>{language === 'bn' ? 'আপনার ফোন নম্বর' : 'Your Phone Number'}</Label>
            <Input
              placeholder="01XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
            />
          </div>

          {/* TrxID */}
          <div className="space-y-2">
            <Label>{language === 'bn' ? 'Transaction ID (TrxID)' : 'Transaction ID (TrxID)'}</Label>
            <Input
              placeholder="e.g. ABC123XYZ"
              value={trxId}
              onChange={(e) => setTrxId(e.target.value)}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              {language === 'bn' 
                ? 'Send Money করার পর যে TrxID পাবেন সেটা দিন' 
                : 'Enter the TrxID you received after sending money'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {language === 'bn' ? 'বাতিল' : 'Cancel'}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !trxId.trim() || !phone.trim()}>
            {submitting ? (
              <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send className="h-4 w-4 mr-1" />
                {language === 'bn' ? 'সাবমিট করুন' : 'Submit'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
