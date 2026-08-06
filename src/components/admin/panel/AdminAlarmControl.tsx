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
import { Bell, Clock, Users, AlertTriangle, TrendingUp, CheckCircle, XCircle, Smartphone, Save } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface AlarmConfig {
  id: string;
  config_key: string;
  strictness_level: number;
  dismiss_protection: {
    require_action: boolean;
    min_awake_time_seconds: number;
  };
  snooze_limits: {
    max_snoozes: number;
    snooze_interval_minutes: number;
  };
  group_enforcement: {
    peer_wake_enabled: boolean;
    escalation_delay_minutes: number;
  };
  oem_overrides: Record<string, any>;
}

interface AlarmStats {
  total_alarms: number;
  success_rate: number;
  avg_snoozes: number;
  group_effectiveness: number;
  missed_today: number;
}

export default function AdminAlarmControl() {
  const [config, setConfig] = useState<AlarmConfig | null>(null);
  const [stats, setStats] = useState<AlarmStats>({ total_alarms: 0, success_rate: 0, avg_snoozes: 0, group_effectiveness: 0, missed_today: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchStats();
  }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('alarm_configurations')
        .select('*')
        .eq('config_key', 'default')
        .single();

      if (error) throw error;
      setConfig(data as unknown as AlarmConfig);
    } catch (error) {
      console.error('Error fetching alarm config:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

      const [logsRes, missedRes] = await Promise.all([
        supabase.from('rise_alarm_logs').select('*').gte('created_at', weekAgo),
        supabase.from('rise_alarm_logs').select('*', { count: 'exact' }).eq('status', 'missed').gte('created_at', today),
      ]);

      const logs = logsRes.data || [];
      const successful = logs.filter(l => l.status === 'completed' || l.status === 'on_time');
      const totalSnoozes = logs.reduce((acc, l) => acc + (l.snooze_count || 0), 0);

      setStats({
        total_alarms: logs.length,
        success_rate: logs.length > 0 ? (successful.length / logs.length) * 100 : 0,
        avg_snoozes: logs.length > 0 ? totalSnoozes / logs.length : 0,
        group_effectiveness: 78, // Would calculate from group data
        missed_today: missedRes.count || 0,
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
        .from('alarm_configurations')
        .update({
          strictness_level: config.strictness_level,
          dismiss_protection: config.dismiss_protection,
          snooze_limits: config.snooze_limits,
          group_enforcement: config.group_enforcement,
          oem_overrides: config.oem_overrides,
        })
        .eq('id', config.id);

      if (error) throw error;

      // Log the action
      await supabase.from('system_audit_logs').insert([{
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'alarm_config_updated',
        resource_type: 'alarm_configuration',
        resource_id: config.id,
        new_value: config as any,
      }]);

      toast.success('Alarm configuration saved');
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
    return <div className="flex items-center justify-center py-12">Loading alarm configuration...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total_alarms}</p>
                <p className="text-xs text-muted-foreground">Total (7d)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.success_rate.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avg_snoozes.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Avg Snoozes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.group_effectiveness}%</p>
                <p className="text-xs text-muted-foreground">Group Effect</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.missed_today}</p>
                <p className="text-xs text-muted-foreground">Missed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="dismissal">Dismissal</TabsTrigger>
          <TabsTrigger value="snooze">Snooze</TabsTrigger>
          <TabsTrigger value="group">Group</TabsTrigger>
          <TabsTrigger value="oem">OEM Overrides</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Alarm Settings</CardTitle>
              <CardDescription>Configure global alarm behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Strictness Level</Label>
                    <Badge variant="outline">{config?.strictness_level || 5}/10</Badge>
                  </div>
                  <Slider
                    value={[config?.strictness_level || 5]}
                    onValueChange={([value]) => updateConfig('strictness_level', value)}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher = harder to dismiss, more protection against accidental stops
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dismissal">
          <Card>
            <CardHeader>
              <CardTitle>Dismiss Protection</CardTitle>
              <CardDescription>Configure how alarms can be dismissed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Action to Dismiss</Label>
                  <p className="text-xs text-muted-foreground">User must complete a task to stop alarm</p>
                </div>
                <Switch
                  checked={config?.dismiss_protection?.require_action || false}
                  onCheckedChange={(checked) => updateConfig('dismiss_protection.require_action', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label>Minimum Awake Time (seconds)</Label>
                <Input
                  type="number"
                  value={config?.dismiss_protection?.min_awake_time_seconds || 30}
                  onChange={(e) => updateConfig('dismiss_protection.min_awake_time_seconds', parseInt(e.target.value))}
                  min={10}
                  max={300}
                />
                <p className="text-xs text-muted-foreground">
                  Time user must stay awake before alarm is considered successful
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="snooze">
          <Card>
            <CardHeader>
              <CardTitle>Snooze Settings</CardTitle>
              <CardDescription>Configure snooze behavior and limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Maximum Snoozes</Label>
                  <Input
                    type="number"
                    value={config?.snooze_limits?.max_snoozes || 3}
                    onChange={(e) => updateConfig('snooze_limits.max_snoozes', parseInt(e.target.value))}
                    min={0}
                    max={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Snooze Interval (minutes)</Label>
                  <Input
                    type="number"
                    value={config?.snooze_limits?.snooze_interval_minutes || 5}
                    onChange={(e) => updateConfig('snooze_limits.snooze_interval_minutes', parseInt(e.target.value))}
                    min={1}
                    max={30}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="group">
          <Card>
            <CardHeader>
              <CardTitle>Group Enforcement</CardTitle>
              <CardDescription>Configure group alarm behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Peer Wake Enabled</Label>
                  <p className="text-xs text-muted-foreground">Allow group members to escalate wake calls</p>
                </div>
                <Switch
                  checked={config?.group_enforcement?.peer_wake_enabled || false}
                  onCheckedChange={(checked) => updateConfig('group_enforcement.peer_wake_enabled', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label>Escalation Delay (minutes)</Label>
                <Input
                  type="number"
                  value={config?.group_enforcement?.escalation_delay_minutes || 5}
                  onChange={(e) => updateConfig('group_enforcement.escalation_delay_minutes', parseInt(e.target.value))}
                  min={1}
                  max={30}
                />
                <p className="text-xs text-muted-foreground">
                  Time before group is notified about missed alarm
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="oem">
          <Card>
            <CardHeader>
              <CardTitle>OEM-Specific Overrides</CardTitle>
              <CardDescription>Configure behavior for specific device manufacturers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {['xiaomi', 'oppo', 'vivo', 'samsung', 'huawei'].map(brand => (
                  <div key={brand} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium capitalize">{brand}</p>
                        <p className="text-xs text-muted-foreground">Battery optimization bypass</p>
                      </div>
                    </div>
                    <Switch
                      checked={config?.oem_overrides?.[brand]?.aggressive_wake || false}
                      onCheckedChange={(checked) => updateConfig(`oem_overrides.${brand}.aggressive_wake`, checked)}
                    />
                  </div>
                ))}
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
