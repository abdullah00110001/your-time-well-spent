import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Crown, Check, Zap, Star, Ticket, Smartphone } from 'lucide-react';
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

type BillingCycle = 'weekly' | 'monthly' | 'yearly';

export default function PremiumTab() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [couponCode, setCouponCode] = useState('');
  const [couponApplied, setCouponApplied] = useState<{ discount_type: string; discount_value: number } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [billingCycle] = useState<BillingCycle>('monthly');
  const [manualPaymentPlan, setManualPaymentPlan] = useState<{ plan: Plan; price: number } | null>(null);

  useEffect(() => {
    fetchPlans();
    fetchCurrentSubscription();
  }, []);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly');
    setPlans((data || []).map(p => ({ ...p, features: (p.features as string[]) || [], trial_days: (p as any).trial_days || 0 })) as Plan[]);
    setLoading(false);
  };

  const fetchCurrentSubscription = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (data) {
      setCurrentPlan((data.subscription_plans as any)?.tier || 'free');
    }
  };

  const applyCoupon = async () => {
    if (!couponCode.trim()) return;
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', couponCode.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      toast.error(language === 'bn' ? 'অবৈধ বা মেয়াদোত্তীর্ণ কুপন' : 'Invalid or expired coupon');
      return;
    }
    if (data.max_uses && data.uses_count >= data.max_uses) {
      toast.error(language === 'bn' ? 'কুপন ব্যবহার সীমা শেষ' : 'Coupon usage limit reached');
      return;
    }
    setCouponApplied({ discount_type: data.discount_type || 'percentage', discount_value: data.discount_value });
    toast.success(`${language === 'bn' ? 'কুপন প্রয়োগ হয়েছে!' : 'Coupon applied!'} ${data.discount_type === 'percentage' ? `${data.discount_value}% off` : `$${data.discount_value} off`}`);
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
      return;
    }

    // Check manual payment info first
    const { data: paymentInfoData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'manual_payment_info')
      .maybeSingle();

    const paymentInfo = paymentInfoData?.value as any;
    const hasManualPayment = paymentInfo?.bkash_number || paymentInfo?.nagad_number || paymentInfo?.rocket_number;

    if (hasManualPayment) {
      const price = plan.price_monthly || 0;
      const finalPrice = getDiscountedPrice(price);
      const bdtPrice = (plan.region_pricing as any)?.bdt_monthly || finalPrice;
      setManualPaymentPlan({ plan, price: bdtPrice });
      return;
    }

    // Check payment providers as fallback
    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'payment_providers')
      .maybeSingle();

    const providers = settings?.value as Record<string, any> | null;
    const stripeEnabled = providers?.stripe?.enabled && providers?.stripe?.secret_key;

    if (!stripeEnabled) {
      toast.error(language === 'bn' ? 'পেমেন্ট সিস্টেম এখনও কনফিগার করা হয়নি' : 'Payment system is not configured yet. Please contact admin.');
      return;
    }

    const price = plan.price_monthly || 0;
    const finalPrice = getDiscountedPrice(price);

    const { error } = await supabase.from('payment_transactions').insert({
      user_id: user.id,
      amount: finalPrice,
      currency: 'USD',
      payment_provider: 'stripe',
      status: 'pending',
      metadata: { plan_id: plan.id, coupon_applied: couponApplied } as any,
    });

    if (error) {
      toast.error(language === 'bn' ? 'পেমেন্ট শুরু করতে ব্যর্থ' : 'Failed to initiate payment');
      return;
    }

    toast.success(language === 'bn' ? 'পেমেন্ট শুরু হয়েছে! প্রক্রিয়াকরণ চলছে...' : 'Payment initiated! Processing...');
  };

  const getPlanIcon = (tier: string) => {
    if (tier === 'free') return <Zap className="h-8 w-8 text-muted-foreground" />;
    if (tier === 'premium') return <Star className="h-8 w-8 text-primary" />;
    return <Crown className="h-8 w-8 text-accent" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{language === 'bn' ? 'প্ল্যান লোড হচ্ছে...' : 'Loading plans...'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Crown className="h-7 w-7 text-primary" />
          <h2 className="text-xl font-bold">{language === 'bn' ? 'আপনার Life OS আপগ্রেড করুন' : 'Upgrade Your Life OS'}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {language === 'bn' ? 'শক্তিশালী ফিচার আনলক করুন' : 'Unlock powerful features to supercharge your productivity'}
        </p>
      </div>

      {/* Plans */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const isCurrentPlan = currentPlan === plan.tier;
          const price = plan.price_monthly || 0;
          const finalPrice = getDiscountedPrice(price);
          const hasDiscount = couponApplied && price > 0;

          return (
            <Card key={plan.id} className={`relative ${plan.tier === 'premium' ? 'border-primary ring-2 ring-primary/20' : ''} ${isCurrentPlan ? 'bg-primary/5' : ''}`}>
              {plan.tier === 'premium' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">{language === 'bn' ? 'সবচেয়ে জনপ্রিয়' : 'Most Popular'}</Badge>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-2">{getPlanIcon(plan.tier)}</div>
                <CardTitle className="text-lg">{plan.name}</CardTitle>
                {plan.description && <p className="text-xs text-muted-foreground">{plan.description}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-center">
                  {price > 0 ? (
                    <>
                      {hasDiscount && <p className="text-sm line-through text-muted-foreground">${price}/mo</p>}
                      <p className="text-2xl font-bold">
                        ${finalPrice.toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </p>
                      {(plan.region_pricing as any)?.bdt_monthly > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ৳{hasDiscount ? getDiscountedPrice((plan.region_pricing as any).bdt_monthly).toFixed(0) : (plan.region_pricing as any).bdt_monthly}/mo
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-2xl font-bold">{language === 'bn' ? 'বিনামূল্যে' : 'Free'}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  {plan.features.map((feature, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <span className="text-xs">{feature}</span>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full"
                  variant={plan.tier === 'premium' ? 'default' : 'outline'}
                  disabled={isCurrentPlan || plan.tier === 'free'}
                  onClick={() => handleSubscribe(plan)}
                  size="sm"
                >
                  {isCurrentPlan ? (language === 'bn' ? 'বর্তমান প্ল্যান' : 'Current Plan') : plan.tier === 'free' ? (language === 'bn' ? 'চিরকাল বিনামূল্যে' : 'Free Forever') : (language === 'bn' ? 'সাবস্ক্রাইব করুন' : 'Subscribe')}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Coupon */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-muted-foreground shrink-0" />
            <Input
              placeholder={language === 'bn' ? 'কুপন কোড লিখুন' : 'Enter coupon code'}
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              className="flex-1"
            />
            <Button onClick={applyCoupon} variant="outline" size="sm">{language === 'bn' ? 'প্রয়োগ' : 'Apply'}</Button>
          </div>
          {couponApplied && (
            <p className="text-sm text-primary mt-2 flex items-center gap-1">
              <Check className="h-3 w-3" />
              {couponApplied.discount_type === 'percentage' ? `${couponApplied.discount_value}% discount applied` : `$${couponApplied.discount_value} discount applied`}
            </p>
          )}
        </CardContent>
      </Card>

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
  );
}
