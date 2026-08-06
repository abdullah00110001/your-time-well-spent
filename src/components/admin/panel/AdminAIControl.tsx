import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Brain, Zap, AlertTriangle, Pause, Play, Settings, Activity, Clock, Save } from 'lucide-react';

interface AISettings {
  id: string;
  setting_key: string;
  nudging_intensity: number;
  is_paused: boolean;
  override_rules: Record<string, any>;
}

export default function AdminAIControl() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_control_settings')
        .select('*')
        .eq('setting_key', 'global')
        .single();

      if (error) throw error;
      setSettings(data as AISettings);
    } catch (error) {
      console.error('Error fetching AI settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('ai_control_settings')
        .update({
          nudging_intensity: settings.nudging_intensity,
          is_paused: settings.is_paused,
          override_rules: settings.override_rules,
        })
        .eq('id', settings.id);

      if (error) throw error;

      await supabase.from('system_audit_logs').insert([{
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'ai_settings_updated',
        resource_type: 'ai_control_settings',
        resource_id: settings.id,
        new_value: settings as any,
      }]);

      toast.success('AI settings saved');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const togglePause = () => {
    if (!settings) return;
    setSettings({ ...settings, is_paused: !settings.is_paused });
  };

  const updateOverride = (key: string, value: any) => {
    if (!settings) return;
    setSettings({
      ...settings,
      override_rules: { ...settings.override_rules, [key]: value }
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading AI settings...</div>;
  }

  const intensityLabel = settings?.nudging_intensity 
    ? settings.nudging_intensity <= 3 ? 'Gentle' 
    : settings.nudging_intensity <= 6 ? 'Moderate' 
    : 'Assertive'
    : 'Moderate';

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      {settings?.is_paused && (
        <Card className="border-amber-500 bg-amber-500/10">
          <CardContent className="p-4 flex items-center gap-4">
            <Pause className="h-8 w-8 text-amber-500" />
            <div>
              <h3 className="font-semibold text-amber-700">AI Nudging is Paused</h3>
              <p className="text-sm text-amber-600">All AI-driven interventions are currently disabled globally</p>
            </div>
            <Button className="ml-auto" onClick={togglePause}>
              <Play className="h-4 w-4 mr-2" />
              Resume AI
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${settings?.is_paused ? 'bg-amber-500/10' : 'bg-green-500/10'}`}>
                <Brain className={`h-5 w-5 ${settings?.is_paused ? 'text-amber-500' : 'text-green-500'}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{settings?.is_paused ? 'Paused' : 'Active'}</p>
                <p className="text-xs text-muted-foreground">AI Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{intensityLabel}</p>
                <p className="text-xs text-muted-foreground">Intensity</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">1,247</p>
                <p className="text-xs text-muted-foreground">Nudges (24h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">78%</p>
                <p className="text-xs text-muted-foreground">Response Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Controls */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Nudging Intensity
            </CardTitle>
            <CardDescription>Control how assertive AI interventions should be</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Global Intensity Level</Label>
                <Badge variant="outline">{settings?.nudging_intensity || 5}/10</Badge>
              </div>
              <Slider
                value={[settings?.nudging_intensity || 5]}
                onValueChange={([value]) => setSettings(s => s ? { ...s, nudging_intensity: value } : null)}
                min={1}
                max={10}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Gentle</span>
                <span>Moderate</span>
                <span>Assertive</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-4">Intensity Breakdown</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span>Notification Frequency</span>
                  <Badge variant="outline" className="bg-green-500/10">Low</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Escalation Speed</span>
                  <Badge variant="outline" className="bg-amber-500/10">Medium</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span>Auto-Actions</span>
                  <Badge variant="outline" className="bg-blue-500/10">Conservative</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Override Controls
            </CardTitle>
            <CardDescription>Manual overrides for specific AI behaviors</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Morning Motivation</p>
                <p className="text-xs text-muted-foreground">AI-generated morning messages</p>
              </div>
              <Switch
                checked={settings?.override_rules?.morning_motivation !== false}
                onCheckedChange={(checked) => updateOverride('morning_motivation', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Focus Reminders</p>
                <p className="text-xs text-muted-foreground">Nudges during focus sessions</p>
              </div>
              <Switch
                checked={settings?.override_rules?.focus_reminders !== false}
                onCheckedChange={(checked) => updateOverride('focus_reminders', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Streak Protection</p>
                <p className="text-xs text-muted-foreground">Warn before streak breaks</p>
              </div>
              <Switch
                checked={settings?.override_rules?.streak_protection !== false}
                onCheckedChange={(checked) => updateOverride('streak_protection', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Sleep Reminders</p>
                <p className="text-xs text-muted-foreground">Bedtime nudges</p>
              </div>
              <Switch
                checked={settings?.override_rules?.sleep_reminders !== false}
                onCheckedChange={(checked) => updateOverride('sleep_reminders', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div>
                <p className="font-medium">Auto-Block Suggestions</p>
                <p className="text-xs text-muted-foreground">Suggest blocking distracting apps</p>
              </div>
              <Switch
                checked={settings?.override_rules?.auto_block_suggestions !== false}
                onCheckedChange={(checked) => updateOverride('auto_block_suggestions', checked)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emergency Controls */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Emergency Controls
          </CardTitle>
          <CardDescription>Use with caution - affects all users immediately</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div>
            <p className="font-medium">Global AI Pause</p>
            <p className="text-sm text-muted-foreground">Immediately disable all AI interventions</p>
          </div>
          <Button 
            variant={settings?.is_paused ? 'default' : 'destructive'}
            onClick={togglePause}
          >
            {settings?.is_paused ? (
              <>
                <Play className="h-4 w-4 mr-2" />
                Resume AI
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause AI Globally
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save AI Settings'}
        </Button>
      </div>
    </div>
  );
}
