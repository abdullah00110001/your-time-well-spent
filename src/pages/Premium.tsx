import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Crown, Check, Zap, Star, Ticket, ArrowLeft, Clock, Receipt, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import ManualPaymentForm from '@/components/payment/ManualPaymentForm';

interface Plan {
  id: string;
  plan_key: string;
  name: string;
  description: string | null;
  tier: string;
  price_monthly: number | null;
  price_weekly: number | null;
  price_yearly: number | null;
  price_lifetime: number | null;
  trial_days: number;
  features: string[];
  region_pricing: Record<string, any> | null;
  stripe_price_id: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  total_amount: number;
  status: string;
  plan_name: string | null;
  created_at: string;
}

type BillingCycle = 'weekly' | 'monthly' | 'yearly';

export default function Premium() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<{ discount_type: string; discount_value: number } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [currentSub, setCurrentSub] = useState<any>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [subscribing, setSubscribing] = useState(false);
  const [manualPaymentPlan, setManualPaymentPlan] = useState<{ plan: Plan; price: number } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPlans();
    if (user) {
      fetchCurrentSubscription();
      fetchInvoices();
    }
  }, [user]);

  const fetchPlans = async () => {
    try {
      const { data } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly');
      setPlans((data || []).map(p => ({ ...p, features: (p.features as string[]) || [], trial_days: (p as any).trial_days || 0 })) as Plan[]);
    } catch (err) {
      console.warn('Failed to fetch plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentSubscription = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('*, subscription_plans(*)')
        .eq('user_id', user.id)
        .in('status', ['active', 'trialing'])
        .maybeSingle();
      if (data) {
        setCurrentSub(data);
        setCurrentPlan((data.subscription_plans as any)?.tier || 'free');
      }
    } catch (err) {
      console.warn('Failed to fetch subscription:', err);
    }
  };

  const fetchInvoices = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);
      setInvoices((data || []) as Invoice[]);
    } catch (err) {
      console.warn('Failed to fetch invoices:', err);
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        toast.error('Invalid or expired coupon');
        return;
      }
      if (data.max_uses && (data.uses_count || 0) >= data.max_uses) {
        toast.error('Coupon usage limit reached');
        return;
      }
      setCouponApplied({ discount_type: data.discount_type || 'percentage', discount_value: data.discount_value });
      toast.success(`Coupon applied! ${data.discount_type === 'percentage' ? `${data.discount_value}% off` : `$${data.discount_value} off`}`);
    } catch {
      toast.error('Failed to apply coupon');
    }
  };

  const getPrice = (plan: Plan): number => {
    switch (billingCycle) {
      case 'weekly': return plan.price_weekly || 0;
      case 'yearly': return plan.price_yearly || 0;
      default: return plan.price_monthly || 0;
    }
  };

  const getDiscountedPrice = (price: number) => {
    if (!couponApplied) return price;
    if (couponApplied.discount_type === 'percentage') {
      return price * (1 - couponApplied.discount_value / 100);
    }
    return Math.max(0, price - couponApplied.discount_value);
  };

  const handleSubscribe = async (plan: Plan) => {
    if (!user) {
      toast.error(language === 'bn' ? 'প্রথমে লগইন করুন' : 'Please login first');
      navigate('/auth');
      return;
    }

    // Check if manual payment is available
    const { data: paymentInfoData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'manual_payment_info')
      .maybeSingle();

    const paymentInfo = paymentInfoData?.value as any;
    const hasManualPayment = paymentInfo?.bkash_number || paymentInfo?.nagad_number || paymentInfo?.rocket_number;

    if (hasManualPayment) {
      const price = getPrice(plan);
      const finalPrice = getDiscountedPrice(price);
      // Get BDT price if available
      const bdtPrice = (plan.region_pricing as any)?.bdt_monthly || finalPrice;
      setManualPaymentPlan({ plan, price: bdtPrice });
      return;
    }

    // Fallback to existing flow
    setSubscribing(true);
    try {
      const price = getPrice(plan);
      const finalPrice = getDiscountedPrice(price);
      const isTrial = plan.trial_days > 0;
      const now = new Date();
      const trialEnd = isTrial ? new Date(now.getTime() + plan.trial_days * 24 * 60 * 60 * 1000) : null;

      let expiresAt: Date;
      if (billingCycle === 'weekly') {
        expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      } else if (billingCycle === 'yearly') {
        expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
      } else {
        expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      const { data: sub, error: subError } = await supabase
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          status: isTrial ? 'trialing' : 'active',
          platform: 'web',
          starts_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          is_trial: isTrial,
          trial_ends_at: trialEnd?.toISOString() || null,
        })
        .select()
        .single();

      if (subError) throw subError;

      const { data: txn, error: txnError } = await supabase
        .from('payment_transactions')
        .insert({
          user_id: user.id,
          subscription_id: sub.id,
          amount: isTrial ? 0 : finalPrice,
          currency: 'USD',
          payment_provider: 'manual',
          status: isTrial ? 'completed' : 'pending',
          metadata: { plan_key: plan.plan_key, billing_cycle: billingCycle, coupon: couponApplied } as any,
        })
        .select()
        .single();

      if (txnError) throw txnError;

      const { data: invNum } = await supabase.rpc('generate_invoice_number');
      const invoiceNumber = invNum || `INV-${new Date().getFullYear()}-${Date.now()}`;

      await supabase.from('invoices').insert({
        user_id: user.id,
        transaction_id: txn.id,
        subscription_id: sub.id,
        invoice_number: invoiceNumber,
        amount: isTrial ? 0 : finalPrice,
        currency: 'USD',
        tax_amount: 0,
        total_amount: isTrial ? 0 : finalPrice,
        status: isTrial ? 'trial' : 'paid',
        billing_period_start: now.toISOString(),
        billing_period_end: expiresAt.toISOString(),
        plan_name: plan.name,
        user_email: user.email,
        payment_method: 'manual',
      });

      if (isTrial) {
        toast.success(`${plan.trial_days}-day free trial started!`);
      } else {
        toast.success('Subscription activated!');
      }

      fetchCurrentSubscription();
      fetchInvoices();
    } catch (err) {
      console.error('Subscription error:', err);
      toast.error(language === 'bn' ? 'সাবস্ক্রিপশন ব্যর্থ' : 'Failed to process subscription');
    } finally {
      setSubscribing(false);
    }
  };

  const getPlanIcon = (tier: string) => {
    if (tier === 'free') return <Zap className="h-8 w-8 text-muted-foreground" />;
    if (tier === 'premium') return <Star className="h-8 w-8 text-primary" />;
    return <Crown className="h-8 w-8 text-amber-500" />;
  };

  const getCycleLabel = () => {
    switch (billingCycle) {
      case 'weekly': return '/wk';
      case 'yearly': return '/yr';
      default: return '/mo';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading plans...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Crown className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Upgrade Your Life OS</h1>
          </div>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Unlock powerful features to supercharge your productivity and spiritual growth
          </p>
        </div>

        {/* Current Subscription Status */}
        {currentSub && (
          <Card className="mb-6 border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Current Plan: {(currentSub.subscription_plans as any)?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {currentSub.is_trial ? (
                      <>Trial ends {new Date(currentSub.trial_ends_at).toLocaleDateString()}</>
                    ) : (
                      <>Expires {new Date(currentSub.expires_at).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
              </div>
              {currentSub.is_trial && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Trial
                </Badge>
              )}
            </CardContent>
          </Card>
        )}

        {/* Billing Cycle Toggle */}
        <div className="flex justify-center mb-8">
          <Tabs value={billingCycle} onValueChange={(v) => setBillingCycle(v as BillingCycle)}>
            <TabsList>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">
                Yearly
                <Badge variant="secondary" className="ml-2 text-xs">Save 33%</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {plans.map((plan) => {
            const isCurrentPlan = currentPlan === plan.tier;
            const price = getPrice(plan);
            const finalPrice = getDiscountedPrice(price);
            const hasDiscount = couponApplied && price > 0;

            return (
              <Card key={plan.id} className={`relative ${plan.tier === 'premium' ? 'border-primary ring-2 ring-primary/20' : ''} ${isCurrentPlan ? 'bg-primary/5' : ''}`}>
                {plan.tier === 'premium' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="flex justify-center mb-3">{getPlanIcon(plan.tier)}</div>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  {plan.trial_days > 0 && (
                    <Badge variant="outline" className="mx-auto mt-1 text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {plan.trial_days}-day free trial
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    {price > 0 ? (
                      <>
                        {hasDiscount && (
                          <p className="text-sm line-through text-muted-foreground">${price}{getCycleLabel()}</p>
                        )}
                        <p className="text-3xl font-bold">
                          ${finalPrice.toFixed(2)}
                          <span className="text-sm font-normal text-muted-foreground">{getCycleLabel()}</span>
                        </p>
                      </>
                    ) : (
                      <p className="text-3xl font-bold">Free</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    className="w-full"
                    variant={plan.tier === 'premium' ? 'default' : 'outline'}
                    disabled={isCurrentPlan || plan.tier === 'free' || subscribing}
                    onClick={() => handleSubscribe(plan)}
                  >
                    <Smartphone className="h-4 w-4 mr-1" />
                    {isCurrentPlan ? (language === 'bn' ? 'বর্তমান প্ল্যান' : 'Current Plan') : plan.tier === 'free' ? (language === 'bn' ? 'চিরকাল বিনামূল্যে' : 'Free Forever') : 
                     plan.trial_days > 0 ? `Start ${plan.trial_days}-Day Trial` : (language === 'bn' ? 'পেমেন্ট করুন' : 'Pay Now')}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Coupon */}
        <Card className="max-w-md mx-auto mb-8">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Ticket className="h-5 w-5 text-muted-foreground" />
              <Input
                placeholder={language === 'bn' ? 'কুপন কোড লিখুন' : 'Enter coupon code'}
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="flex-1"
              />
              <Button onClick={applyCoupon} variant="outline" size="sm">
                {language === 'bn' ? 'প্রয়োগ' : 'Apply'}
              </Button>
            </div>
            {couponApplied && (
              <p className="text-sm text-primary mt-2 flex items-center gap-1">
                <Check className="h-3 w-3" />
                {couponApplied.discount_type === 'percentage' ? `${couponApplied.discount_value}% discount applied` : `$${couponApplied.discount_value} discount applied`}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Invoice History */}
        {invoices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                {language === 'bn' ? 'ইনভয়েস ইতিহাস' : 'Invoice History'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium text-sm">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.plan_name} • {new Date(inv.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${inv.total_amount}</p>
                      <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                        {inv.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Manual Payment Dialog */}
        {manualPaymentPlan && (
          <ManualPaymentForm
            planId={manualPaymentPlan.plan.id}
            planName={manualPaymentPlan.plan.name}
            amount={manualPaymentPlan.price}
            currency="BDT"
            billingCycle={billingCycle}
            onClose={() => setManualPaymentPlan(null)}
            onSuccess={() => {
              setManualPaymentPlan(null);
              fetchCurrentSubscription();
            }}
          />
        )}
      </div>
    </div>
  );
}
