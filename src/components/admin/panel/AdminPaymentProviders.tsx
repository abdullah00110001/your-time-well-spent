import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CreditCard, Smartphone, Eye, EyeOff, Save, CheckCircle2, XCircle } from 'lucide-react';

interface ProviderConfig {
  enabled: boolean;
  api_key: string;
  secret_key: string;
  webhook_secret?: string;
  mode: 'test' | 'live';
}

interface ProvidersState {
  stripe: ProviderConfig;
  bkash: ProviderConfig;
  nagad: ProviderConfig;
}

const DEFAULT_STATE: ProvidersState = {
  stripe: { enabled: false, api_key: '', secret_key: '', webhook_secret: '', mode: 'test' },
  bkash: { enabled: false, api_key: '', secret_key: '', mode: 'test' },
  nagad: { enabled: false, api_key: '', secret_key: '', mode: 'test' },
};

export default function AdminPaymentProviders() {
  const [providers, setProviders] = useState<ProvidersState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchProviderSettings();
  }, []);

  const fetchProviderSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'payment_providers')
        .maybeSingle();

      if (error) throw error;
      if (data?.value) {
        const val = data.value as Record<string, any>;
        setProviders({
          stripe: { ...DEFAULT_STATE.stripe, ...val.stripe },
          bkash: { ...DEFAULT_STATE.bkash, ...val.bkash },
          nagad: { ...DEFAULT_STATE.nagad, ...val.nagad },
        });
      }
    } catch (error) {
      console.error('Error fetching provider settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;

      // Check if setting exists
      const { data: existing } = await supabase
        .from('app_settings')
        .select('id')
        .eq('key', 'payment_providers')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('app_settings')
          .update({ value: providers as any, updated_by: userId })
          .eq('key', 'payment_providers');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('app_settings')
          .insert({ key: 'payment_providers', value: providers as any, updated_by: userId });
        if (error) throw error;
      }

      // Log audit
      await supabase.from('system_audit_logs').insert({
        actor_id: userId,
        action: 'payment_providers_updated',
        resource_type: 'app_settings',
        new_value: { providers_enabled: { stripe: providers.stripe.enabled, bkash: providers.bkash.enabled, nagad: providers.nagad.enabled } },
      });

      toast.success('Payment provider settings saved');
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const updateProvider = (provider: keyof ProvidersState, field: string, value: any) => {
    setProviders(prev => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value },
    }));
  };

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const maskValue = (value: string) => {
    if (!value) return '';
    if (value.length <= 8) return '••••••••';
    return value.slice(0, 4) + '••••••••' + value.slice(-4);
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading provider settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stripe */}
      <Card className={providers.stripe.enabled ? 'border-primary/30' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[hsl(var(--primary))]/10">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Stripe</CardTitle>
                <CardDescription>International cards, Google Pay, Apple Pay</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={providers.stripe.mode === 'live' ? 'default' : 'secondary'}>
                {providers.stripe.mode}
              </Badge>
              <Switch
                checked={providers.stripe.enabled}
                onCheckedChange={(v) => updateProvider('stripe', 'enabled', v)}
              />
            </div>
          </div>
        </CardHeader>
        {providers.stripe.enabled && (
          <CardContent className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button
                variant={providers.stripe.mode === 'test' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateProvider('stripe', 'mode', 'test')}
              >
                Test Mode
              </Button>
              <Button
                variant={providers.stripe.mode === 'live' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateProvider('stripe', 'mode', 'live')}
              >
                Live Mode
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Publishable Key</Label>
              <Input
                placeholder="pk_test_..."
                value={providers.stripe.api_key}
                onChange={(e) => updateProvider('stripe', 'api_key', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Secret Key</Label>
              <div className="flex gap-2">
                <Input
                  type={showSecrets['stripe_secret'] ? 'text' : 'password'}
                  placeholder="sk_test_..."
                  value={providers.stripe.secret_key}
                  onChange={(e) => updateProvider('stripe', 'secret_key', e.target.value)}
                />
                <Button variant="ghost" size="icon" onClick={() => toggleSecret('stripe_secret')}>
                  {showSecrets['stripe_secret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <div className="flex gap-2">
                <Input
                  type={showSecrets['stripe_webhook'] ? 'text' : 'password'}
                  placeholder="whsec_..."
                  value={providers.stripe.webhook_secret || ''}
                  onChange={(e) => updateProvider('stripe', 'webhook_secret', e.target.value)}
                />
                <Button variant="ghost" size="icon" onClick={() => toggleSecret('stripe_webhook')}>
                  {showSecrets['stripe_webhook'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {providers.stripe.secret_key ? (
                <><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-green-600">Keys configured</span></>
              ) : (
                <><XCircle className="h-4 w-4 text-destructive" /><span className="text-destructive">Keys not set</span></>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* bKash */}
      <Card className={providers.bkash.enabled ? 'border-[hsl(220,80%,50%)]/30' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <Smartphone className="h-5 w-5 text-pink-500" />
              </div>
              <div>
                <CardTitle className="text-lg">bKash</CardTitle>
                <CardDescription>Bangladesh mobile payment (বিকাশ)</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={providers.bkash.mode === 'live' ? 'default' : 'secondary'}>
                {providers.bkash.mode}
              </Badge>
              <Switch
                checked={providers.bkash.enabled}
                onCheckedChange={(v) => updateProvider('bkash', 'enabled', v)}
              />
            </div>
          </div>
        </CardHeader>
        {providers.bkash.enabled && (
          <CardContent className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button
                variant={providers.bkash.mode === 'test' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateProvider('bkash', 'mode', 'test')}
              >
                Sandbox
              </Button>
              <Button
                variant={providers.bkash.mode === 'live' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateProvider('bkash', 'mode', 'live')}
              >
                Production
              </Button>
            </div>
            <div className="space-y-2">
              <Label>App Key</Label>
              <Input
                placeholder="bKash App Key"
                value={providers.bkash.api_key}
                onChange={(e) => updateProvider('bkash', 'api_key', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>App Secret</Label>
              <div className="flex gap-2">
                <Input
                  type={showSecrets['bkash_secret'] ? 'text' : 'password'}
                  placeholder="bKash App Secret"
                  value={providers.bkash.secret_key}
                  onChange={(e) => updateProvider('bkash', 'secret_key', e.target.value)}
                />
                <Button variant="ghost" size="icon" onClick={() => toggleSecret('bkash_secret')}>
                  {showSecrets['bkash_secret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {providers.bkash.secret_key ? (
                <><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-green-600">Keys configured</span></>
              ) : (
                <><XCircle className="h-4 w-4 text-destructive" /><span className="text-destructive">Keys not set</span></>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Nagad */}
      <Card className={providers.nagad.enabled ? 'border-orange-500/30' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Smartphone className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Nagad</CardTitle>
                <CardDescription>Bangladesh mobile payment (নগদ)</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={providers.nagad.mode === 'live' ? 'default' : 'secondary'}>
                {providers.nagad.mode}
              </Badge>
              <Switch
                checked={providers.nagad.enabled}
                onCheckedChange={(v) => updateProvider('nagad', 'enabled', v)}
              />
            </div>
          </div>
        </CardHeader>
        {providers.nagad.enabled && (
          <CardContent className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button
                variant={providers.nagad.mode === 'test' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateProvider('nagad', 'mode', 'test')}
              >
                Sandbox
              </Button>
              <Button
                variant={providers.nagad.mode === 'live' ? 'default' : 'outline'}
                size="sm"
                onClick={() => updateProvider('nagad', 'mode', 'live')}
              >
                Production
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Merchant ID</Label>
              <Input
                placeholder="Nagad Merchant ID"
                value={providers.nagad.api_key}
                onChange={(e) => updateProvider('nagad', 'api_key', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Merchant Secret</Label>
              <div className="flex gap-2">
                <Input
                  type={showSecrets['nagad_secret'] ? 'text' : 'password'}
                  placeholder="Nagad Secret Key"
                  value={providers.nagad.secret_key}
                  onChange={(e) => updateProvider('nagad', 'secret_key', e.target.value)}
                />
                <Button variant="ghost" size="icon" onClick={() => toggleSecret('nagad_secret')}>
                  {showSecrets['nagad_secret'] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {providers.nagad.secret_key ? (
                <><CheckCircle2 className="h-4 w-4 text-green-500" /><span className="text-green-600">Keys configured</span></>
              ) : (
                <><XCircle className="h-4 w-4 text-destructive" /><span className="text-destructive">Keys not set</span></>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Provider Settings'}
        </Button>
      </div>
    </div>
  );
}
