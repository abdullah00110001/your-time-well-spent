import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Clock, AlertTriangle, TrendingUp, Lock, Unlock, Timer, Save, Zap } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface ShieldConfig {
  id: string;
  config_key: string;
  blocking_rules: Record<string, any>;
  time_locks: Record<string, any>;
  emergency_bypass_limits: number;
  cooldown_penalty_minutes: number;
  relapse_escalation: {
    threshold: number;
    penalty_multiplier: number;
  };
  strength_by_plan: Record<string, number>;
}

interface ShieldStats {
  active_sessions: number;
  break_rate: number;
  avg_focus_time: number;
  relapse_count: number;
  blocked_attempts: number;
}

export default function AdminShieldControl() {
  const [config, setConfig] = useState<ShieldConfig | null>(null);
  const [stats, setStats] = useState<ShieldStats>({ active_sessions: 0, break_rate: 0, avg_focus_time: 0, relapse_count: 0, blocked_attempts: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchStats();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('shield_configurations')
        .select('*')
        .eq('config_key', 'default')
        .single();

      if (error) throw error;
      setConfig(data as unknown as ShieldConfig);
    } catch (error) {
      console.error('Error fetching shield config:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

      const [sessionsRes, bypassRes] = await Promise.all([
        supabase.from('shield_sessions').select('*').gte('created_at', weekAgo),
        supabase.from('shield_bypass_logs').select('*', { count: 'exact' }).gte('created_at', weekAgo),
      ]);

      const sessions = sessionsRes.data || [];
      const completed = sessions.filter(s => s.completed_successfully);
      const totalMinutes = sessions.reduce((acc, s) => {
        if (s.actual_end_at && s.created_at) {
          const duration = (new Date(s.actual_end_at).getTime() - new Date(s.created_at).getTime()) / 60000;
          return acc + duration;
        }
        return acc;
      }, 0);

      setStats({
        active_sessions: sessions.filter(s => !s.actual_end_at).length,
        break_rate: sessions.length > 0 ? ((sessions.length - completed.length) / sessions.length) * 100 : 0,
        avg_focus_time: sessions.length > 0 ? totalMinutes / sessions.length : 0,
        relapse_count: sessions.filter(s => s.early_exit_reason).length,
        blocked_attempts: bypassRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('shield_configurations')
        .update({
          blocking_rules: config.blocking_rules,
          time_locks: config.time_locks,
          emergency_bypass_limits: config.emergency_bypass_limits,
          cooldown_penalty_minutes: config.cooldown_penalty_minutes,
          relapse_escalation: config.relapse_escalation,
          strength_by_plan: config.strength_by_plan,
        })
        .eq('id', config.id);

      if (error) throw error;

      await supabase.from('system_audit_logs').insert([{
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'shield_config_updated',
        resource_type: 'shield_configuration',
        resource_id: config.id,
        new_value: config as any,
      }]);

      toast.success('Shield configuration saved');
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (path: string, value: any) => {
    if (!config) return;
    
    const keys = path.split('.');
    const newConfig = { ...config };
    let current: any = newConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current[keys[i]] = { ...current[keys[i]] };
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
    
    setConfig(newConfig);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading shield configuration...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.active_sessions}</p>
                <p className="text-xs text-muted-foreground">Active Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Unlock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.break_rate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Break Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Timer className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avg_focus_time.toFixed(0)}m</p>
                <p className="text-xs text-muted-foreground">Avg Focus</p>
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
                <p className="text-2xl font-bold">{stats.relapse_count}</p>
                <p className="text-xs text-muted-foreground">Relapses (7d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Lock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.blocked_attempts}</p>
                <p className="text-xs text-muted-foreground">Blocked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Tabs */}
      <Tabs defaultValue="limits" className="space-y-6">
        <TabsList>
          <TabsTrigger value="limits">Limits</TabsTrigger>
          <TabsTrigger value="penalties">Penalties</TabsTrigger>
          <TabsTrigger value="plans">Plan Strength</TabsTrigger>
          <TabsTrigger value="rules">Blocking Rules</TabsTrigger>
        </TabsList>

        <TabsContent value="limits">
          <Card>
            <CardHeader>
              <CardTitle>Emergency Bypass Limits</CardTitle>
              <CardDescription>Configure emergency exit options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Emergency Bypasses per Day</Label>
                    <Badge variant="outline">{config?.emergency_bypass_limits || 3}</Badge>
                  </div>
                  <Slider
                    value={[config?.emergency_bypass_limits || 3]}
                    onValueChange={([value]) => updateConfig('emergency_bypass_limits', value)}
                    min={0}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of times user can bypass shield per day (0 = strict mode)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="penalties">
          <Card>
            <CardHeader>
              <CardTitle>Penalty Configuration</CardTitle>
              <CardDescription>Configure cooldowns and escalation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Cooldown Penalty (minutes)</Label>
                  <Input
                    type="number"
                    value={config?.cooldown_penalty_minutes || 30}
                    onChange={(e) => updateConfig('cooldown_penalty_minutes', parseInt(e.target.value))}
                    min={5}
                    max={120}
                  />
                  <p className="text-xs text-muted-foreground">
                    Wait time before shield can be restarted
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Relapse Threshold</Label>
                  <Input
                    type="number"
                    value={config?.relapse_escalation?.threshold || 3}
                    onChange={(e) => updateConfig('relapse_escalation.threshold', parseInt(e.target.value))}
                    min={1}
                    max={10}
                  />
                  <p className="text-xs text-muted-foreground">
                    Breaks before penalties escalate
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Penalty Multiplier</Label>
                  <Badge variant="outline">{config?.relapse_escalation?.penalty_multiplier || 1.5}x</Badge>
                </div>
                <Slider
                  value={[config?.relapse_escalation?.penalty_multiplier || 1.5]}
                  onValueChange={([value]) => updateConfig('relapse_escalation.penalty_multiplier', value)}
                  min={1}
                  max={5}
                  step={0.1}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Cooldown multiplier after threshold is exceeded
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader>
              <CardTitle>Shield Strength by Plan</CardTitle>
              <CardDescription>Configure feature access per subscription tier</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {['free', 'premium', 'ultimate'].map(plan => (
                <div key={plan} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="capitalize">{plan} Plan Strength</Label>
                    <Badge variant="outline">{config?.strength_by_plan?.[plan] || 1}/5</Badge>
                  </div>
                  <Slider
                    value={[config?.strength_by_plan?.[plan] || 1]}
                    onValueChange={([value]) => updateConfig(`strength_by_plan.${plan}`, value)}
                    min={1}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Higher strength = more blocking options, stricter enforcement
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Global Blocking Rules</CardTitle>
              <CardDescription>Configure default app/site blocking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Block Adult Content</p>
                    <p className="text-xs text-muted-foreground">Always block adult websites and apps</p>
                  </div>
                  <Switch
                    checked={config?.blocking_rules?.block_adult || true}
                    onCheckedChange={(checked) => updateConfig('blocking_rules.block_adult', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Block Infinite Scroll</p>
                    <p className="text-xs text-muted-foreground">Block TikTok, Reels, Shorts by default</p>
                  </div>
                  <Switch
                    checked={config?.blocking_rules?.block_infinite_scroll || true}
                    onCheckedChange={(checked) => updateConfig('blocking_rules.block_infinite_scroll', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Block Social Media</p>
                    <p className="text-xs text-muted-foreground">Include social apps in default blocks</p>
                  </div>
                  <Switch
                    checked={config?.blocking_rules?.block_social || false}
                    onCheckedChange={(checked) => updateConfig('blocking_rules.block_social', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Block Gaming</p>
                    <p className="text-xs text-muted-foreground">Include games in default blocks</p>
                  </div>
                  <Switch
                    checked={config?.blocking_rules?.block_gaming || false}
                    onCheckedChange={(checked) => updateConfig('blocking_rules.block_gaming', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
