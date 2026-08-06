import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Edit, Crown, Star, Zap, Lock, Unlock } from 'lucide-react';

interface Plan {
  id: string;
  plan_key: string;
  name: string;
  description: string | null;
  tier: string;
  price_monthly: number | null;
  price_yearly: number | null;
  price_lifetime: number | null;
  features: string[];
  region_pricing: Record<string, any> | null;
  stripe_price_id: string | null;
  is_active: boolean;
}

const ALL_FEATURES = [
  { key: 'daily_input', label: 'Daily Life Input', category: 'Core' },
  { key: 'basic_analytics', label: 'Basic Analytics', category: 'Core' },
  { key: 'habit_tracking', label: 'Habit Tracking (up to 5)', category: 'Core' },
  { key: 'goal_setting', label: 'Goal Setting', category: 'Core' },
  { key: 'journal', label: 'Journal', category: 'Core' },
  { key: 'unlimited_habits', label: 'Unlimited Habits', category: 'Premium' },
  { key: 'advanced_analytics', label: 'Advanced Analytics & Insights', category: 'Premium' },
  { key: 'mood_correlation', label: 'Mood-Productivity Correlation', category: 'Premium' },
  { key: 'burnout_detection', label: 'Burnout Detection', category: 'Premium' },
  { key: 'life_balance_score', label: 'Life Balance Score', category: 'Premium' },
  { key: 'weekly_review', label: 'Weekly Review', category: 'Premium' },
  { key: 'monthly_review', label: 'Monthly Review', category: 'Premium' },
  { key: 'shield_basic', label: 'Shield (Basic)', category: 'Premium' },
  { key: 'rise_alarm', label: 'Rise Alarm', category: 'Premium' },
  { key: 'data_export', label: 'Data Export (CSV)', category: 'Premium' },
  { key: 'predictive_analytics', label: 'Predictive Analytics', category: 'Ultimate' },
  { key: 'ai_coaching', label: 'AI Coaching & Suggestions', category: 'Ultimate' },
  { key: 'shield_advanced', label: 'Shield Advanced (Absolute Mode)', category: 'Ultimate' },
  { key: 'community_challenges', label: 'Community Challenges', category: 'Ultimate' },
  { key: 'leaderboard', label: 'Leaderboard Access', category: 'Ultimate' },
  { key: 'accountability_groups', label: 'Accountability Groups', category: 'Ultimate' },
  { key: 'pdf_tools', label: 'PDF Tools', category: 'Ultimate' },
  { key: 'priority_support', label: 'Priority Support', category: 'Ultimate' },
  { key: 'year_end_wrapped', label: 'Year-End Wrapped', category: 'Ultimate' },
  { key: 'life_calendar', label: 'Life Calendar', category: 'Ultimate' },
];

export default function AdminPlanManager() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [form, setForm] = useState({
    plan_key: '', name: '', description: '', tier: 'free',
    price_monthly: 0, price_yearly: 0, price_lifetime: 0,
    features: '', is_active: true, stripe_price_id: '',
    price_bdt_monthly: 0,
  });

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('subscription_plans')
      .select('*')
      .order('price_monthly');
    if (!error) setPlans((data || []).map(p => ({ ...p, features: (p.features as string[]) || [] })) as Plan[]);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingPlan(null);
    setSelectedFeatures([]);
    setForm({ plan_key: '', name: '', description: '', tier: 'free', price_monthly: 0, price_yearly: 0, price_lifetime: 0, features: '', is_active: true, stripe_price_id: '', price_bdt_monthly: 0 });
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    // Try to match existing features to our feature keys
    const matched = ALL_FEATURES
      .filter(f => plan.features.some(pf => pf.toLowerCase().includes(f.label.toLowerCase()) || pf.toLowerCase().includes(f.key.replace(/_/g, ' '))))
      .map(f => f.key);
    setSelectedFeatures(matched.length > 0 ? matched : []);
    setForm({
      plan_key: plan.plan_key, name: plan.name, description: plan.description || '',
      tier: plan.tier, price_monthly: plan.price_monthly || 0, price_yearly: plan.price_yearly || 0,
      price_lifetime: plan.price_lifetime || 0, features: plan.features.join('\n'),
      is_active: plan.is_active, stripe_price_id: plan.stripe_price_id || '',
      price_bdt_monthly: (plan.region_pricing as any)?.bdt_monthly || 0,
    });
    setDialogOpen(true);
  };

  const toggleFeature = (key: string) => {
    setSelectedFeatures(prev => 
      prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
    );
  };

  const selectTierDefaults = (tier: string) => {
    const coreKeys = ALL_FEATURES.filter(f => f.category === 'Core').map(f => f.key);
    const premiumKeys = ALL_FEATURES.filter(f => f.category === 'Premium').map(f => f.key);
    const ultimateKeys = ALL_FEATURES.filter(f => f.category === 'Ultimate').map(f => f.key);

    if (tier === 'free') setSelectedFeatures(coreKeys);
    else if (tier === 'premium') setSelectedFeatures([...coreKeys, ...premiumKeys]);
    else setSelectedFeatures([...coreKeys, ...premiumKeys, ...ultimateKeys]);
    setForm(p => ({ ...p, tier }));
  };

  const handleSave = async () => {
    // Combine selected feature labels with any custom features from textarea
    const featureLabels = ALL_FEATURES
      .filter(f => selectedFeatures.includes(f.key))
      .map(f => f.label);
    const customFeatures = form.features.split('\n').filter(f => f.trim() && !featureLabels.some(fl => fl.toLowerCase() === f.trim().toLowerCase()));
    const allFeatures = [...featureLabels, ...customFeatures];

    const payload = {
      plan_key: form.plan_key.toLowerCase().replace(/\s+/g, '_'),
      name: form.name, description: form.description || null, tier: form.tier,
      price_monthly: form.price_monthly, price_yearly: form.price_yearly,
      price_lifetime: form.price_lifetime, features: allFeatures as any,
      is_active: form.is_active, stripe_price_id: form.stripe_price_id || null,
      region_pricing: { bdt_monthly: form.price_bdt_monthly, feature_keys: selectedFeatures } as any,
    };

    try {
      if (editingPlan) {
        const { error } = await supabase.from('subscription_plans').update(payload).eq('id', editingPlan.id);
        if (error) throw error;
        toast.success('Plan updated');
      } else {
        const { error } = await supabase.from('subscription_plans').insert(payload);
        if (error) throw error;
        toast.success('Plan created');
      }
      setDialogOpen(false);
      fetchPlans();
    } catch (error) {
      toast.error('Failed to save plan');
    }
  };

  const getPlanIcon = (tier: string) => {
    if (tier === 'free') return <Zap className="h-5 w-5 text-muted-foreground" />;
    if (tier === 'premium') return <Star className="h-5 w-5 text-primary" />;
    return <Crown className="h-5 w-5 text-amber-500" />;
  };

  const categories = ['Core', 'Premium', 'Ultimate'];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Subscription Plans</CardTitle>
          <CardDescription>Manage pricing tiers, features access (free vs paid)</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Plan</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create Plan'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plan Key</Label>
                  <Input value={form.plan_key} onChange={e => setForm(p => ({ ...p, plan_key: e.target.value }))} placeholder="premium" disabled={!!editingPlan} />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Premium" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Best for serious users" />
              </div>
              <div className="space-y-2">
                <Label>Tier (click to auto-select features)</Label>
                <div className="flex gap-2">
                  {['free', 'premium', 'ultimate'].map(t => (
                    <Button key={t} size="sm" variant={form.tier === t ? 'default' : 'outline'} onClick={() => selectTierDefaults(t)} className="capitalize">{t}</Button>
                  ))}
                </div>
              </div>

              {/* Feature Selection */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Feature Access (select what this plan includes)
                </Label>
                <div className="border rounded-lg p-3 space-y-4 max-h-60 overflow-y-auto">
                  {categories.map(category => (
                    <div key={category}>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={category === 'Core' ? 'secondary' : category === 'Premium' ? 'default' : 'destructive'} className="text-xs">
                          {category}
                        </Badge>
                        {category === 'Core' && <span className="text-xs text-muted-foreground">(Free tier)</span>}
                        {category === 'Premium' && <span className="text-xs text-muted-foreground">(Paid)</span>}
                        {category === 'Ultimate' && <span className="text-xs text-muted-foreground">(Top tier)</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {ALL_FEATURES.filter(f => f.category === category).map(feature => (
                          <label key={feature.key} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1.5 rounded">
                            <Checkbox
                              checked={selectedFeatures.includes(feature.key)}
                              onCheckedChange={() => toggleFeature(feature.key)}
                            />
                            <span className="flex items-center gap-1">
                              {selectedFeatures.includes(feature.key) ? (
                                <Unlock className="h-3 w-3 text-green-500" />
                              ) : (
                                <Lock className="h-3 w-3 text-muted-foreground" />
                              )}
                              {feature.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedFeatures.length}/{ALL_FEATURES.length} features
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monthly (USD)</Label>
                  <Input type="number" value={form.price_monthly} onChange={e => setForm(p => ({ ...p, price_monthly: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Monthly (BDT)</Label>
                  <Input type="number" value={form.price_bdt_monthly} onChange={e => setForm(p => ({ ...p, price_bdt_monthly: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Yearly (USD)</Label>
                  <Input type="number" value={form.price_yearly} onChange={e => setForm(p => ({ ...p, price_yearly: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div className="space-y-2">
                  <Label>Lifetime (USD)</Label>
                  <Input type="number" value={form.price_lifetime} onChange={e => setForm(p => ({ ...p, price_lifetime: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Stripe Price ID</Label>
                <Input value={form.stripe_price_id} onChange={e => setForm(p => ({ ...p, stripe_price_id: e.target.value }))} placeholder="price_..." />
              </div>
              <div className="space-y-2">
                <Label>Additional Custom Features (one per line)</Label>
                <Textarea rows={3} value={form.features} onChange={e => setForm(p => ({ ...p, features: e.target.value }))} placeholder="Custom feature 1&#10;Custom feature 2" />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(p => ({ ...p, is_active: v }))} />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>Save Plan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center py-8 text-muted-foreground">Loading plans...</p>
        ) : plans.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No plans created yet</p>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Create First Plan</Button>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {plans.map((plan) => (
              <div key={plan.id} className={`p-4 rounded-lg border ${!plan.is_active ? 'opacity-50' : ''} ${plan.tier === 'premium' ? 'border-primary ring-1 ring-primary/20' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getPlanIcon(plan.tier)}
                    <h3 className="font-semibold">{plan.name}</h3>
                  </div>
                  <Badge variant={plan.tier === 'premium' ? 'default' : plan.tier === 'ultimate' ? 'destructive' : 'secondary'} className="capitalize">
                    {plan.tier}
                  </Badge>
                </div>
                {plan.description && <p className="text-sm text-muted-foreground mb-3">{plan.description}</p>}
                <div className="mb-3">
                  {plan.price_monthly ? (
                    <p className="text-2xl font-bold">${plan.price_monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                  ) : (
                    <p className="text-2xl font-bold">Free</p>
                  )}
                  {(plan.region_pricing as any)?.bdt_monthly > 0 && (
                    <p className="text-sm text-muted-foreground">৳{(plan.region_pricing as any).bdt_monthly}/mo</p>
                  )}
                </div>
                <div className="space-y-1 mb-2">
                  {plan.features.slice(0, 5).map((f, j) => (
                    <p key={j} className="text-xs text-muted-foreground flex items-center gap-1">
                      <Unlock className="h-3 w-3 text-green-500" /> {f}
                    </p>
                  ))}
                  {plan.features.length > 5 && (
                    <p className="text-xs text-muted-foreground">+{plan.features.length - 5} more</p>
                  )}
                </div>
                {(plan.region_pricing as any)?.feature_keys && (
                  <p className="text-xs text-muted-foreground mb-3">
                    {(plan.region_pricing as any).feature_keys.length} gated features
                  </p>
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={() => openEdit(plan)}>
                  <Edit className="h-3 w-3 mr-1" /> Edit
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
