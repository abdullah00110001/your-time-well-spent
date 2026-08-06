import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Brain, Plus, Edit, Trash2, ArrowRight, Zap, AlertTriangle, Clock, CheckCircle } from 'lucide-react';

interface BehaviorRule {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  priority: number;
  trigger_conditions: {
    type: string;
    metric: string;
    operator: string;
    value: number;
  }[];
  actions: {
    type: string;
    target: string;
    value: any;
  }[];
  time_decay: Record<string, any>;
  escalation_config: Record<string, any>;
  created_at: string;
}

const CONDITION_TYPES = [
  { value: 'metric', label: 'Metric Threshold' },
  { value: 'event', label: 'Event Count' },
  { value: 'streak', label: 'Streak Broken' },
  { value: 'time', label: 'Time-based' },
];

const METRICS = [
  { value: 'shield_breaks', label: 'Shield Breaks' },
  { value: 'alarm_misses', label: 'Alarm Misses' },
  { value: 'focus_minutes', label: 'Focus Minutes' },
  { value: 'screen_time', label: 'Screen Time' },
  { value: 'quran_minutes', label: 'Quran Minutes' },
  { value: 'salah_completion', label: 'Salah Completion' },
];

const ACTIONS = [
  { value: 'increase_strictness', label: 'Increase Strictness' },
  { value: 'send_notification', label: 'Send Notification' },
  { value: 'add_penalty', label: 'Add Penalty Time' },
  { value: 'block_apps', label: 'Block Additional Apps' },
  { value: 'enable_feature', label: 'Enable Feature' },
  { value: 'disable_feature', label: 'Disable Feature' },
];

export default function AdminBehaviorRules() {
  const [rules, setRules] = useState<BehaviorRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<BehaviorRule | null>(null);
  const [formData, setFormData] = useState<{
    name: string; description: string; is_active: boolean; priority: number;
    trigger_conditions: any[]; actions: any[];
  }>({
    name: '',
    description: '',
    is_active: true,
    priority: 0,
    trigger_conditions: [{ type: 'metric', metric: 'shield_breaks', operator: '>=', value: 3 }],
    actions: [{ type: 'increase_strictness', target: 'shield', value: 1 }],
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('behavior_rules')
        .select('*')
        .order('priority', { ascending: false });

      if (error) throw error;
      setRules((data || []) as unknown as BehaviorRule[]);
    } catch (error) {
      console.error('Error fetching rules:', error);
      toast.error('Failed to fetch behavior rules');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRule = async () => {
    try {
      if (editingRule) {
        const { error } = await supabase
          .from('behavior_rules')
          .update({
            name: formData.name,
            description: formData.description,
            is_active: formData.is_active,
            priority: formData.priority,
            trigger_conditions: formData.trigger_conditions,
            actions: formData.actions,
          })
          .eq('id', editingRule.id);

        if (error) throw error;
        toast.success('Rule updated');
      } else {
        const { error } = await supabase
          .from('behavior_rules')
          .insert({
            name: formData.name,
            description: formData.description,
            is_active: formData.is_active,
            priority: formData.priority,
            trigger_conditions: formData.trigger_conditions,
            actions: formData.actions,
            created_by: (await supabase.auth.getUser()).data.user?.id,
          });

        if (error) throw error;
        toast.success('Rule created');
      }

      setIsDialogOpen(false);
      setEditingRule(null);
      resetForm();
      fetchRules();
    } catch (error) {
      console.error('Error saving rule:', error);
      toast.error('Failed to save rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      const { error } = await supabase
        .from('behavior_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      toast.success('Rule deleted');
      fetchRules();
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const toggleRule = async (rule: BehaviorRule) => {
    try {
      const { error } = await supabase
        .from('behavior_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;
      toast.success(rule.is_active ? 'Rule disabled' : 'Rule enabled');
      fetchRules();
    } catch (error) {
      toast.error('Failed to toggle rule');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true,
      priority: 0,
      trigger_conditions: [{ type: 'metric', metric: 'shield_breaks', operator: '>=', value: 3 }],
      actions: [{ type: 'increase_strictness', target: 'shield', value: 1 }],
    });
  };

  const openEditDialog = (rule: BehaviorRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      is_active: rule.is_active,
      priority: rule.priority,
      trigger_conditions: rule.trigger_conditions as any || [],
      actions: rule.actions as any || [],
    });
    setIsDialogOpen(true);
  };

  const addCondition = () => {
    setFormData(prev => ({
      ...prev,
      trigger_conditions: [...prev.trigger_conditions, { type: 'metric', metric: 'shield_breaks', operator: '>=', value: 1 }]
    }));
  };

  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, { type: 'send_notification', target: 'user', value: 'Warning message' }]
    }));
  };

  const updateCondition = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      trigger_conditions: prev.trigger_conditions.map((c, i) => i === index ? { ...c, [field]: value } : c)
    }));
  };

  const updateAction = (index: number, field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((a, i) => i === index ? { ...a, [field]: value } : a)
    }));
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rules.length}</p>
                <p className="text-xs text-muted-foreground">Total Rules</p>
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
                <p className="text-2xl font-bold">{rules.filter(r => r.is_active).length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rules.filter(r => r.priority > 5).length}</p>
                <p className="text-xs text-muted-foreground">High Priority</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rules.filter(r => r.time_decay && Object.keys(r.time_decay).length > 0).length}</p>
                <p className="text-xs text-muted-foreground">With Decay</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              Behavior Rule Engine
            </CardTitle>
            <CardDescription>No-code IF-THEN rules for automated interventions</CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setEditingRule(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRule ? 'Edit Rule' : 'Create Behavior Rule'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Rule Name</Label>
                    <Input
                      placeholder="Shield Break Escalation"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Priority (0-10)</Label>
                    <Input
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                      min={0}
                      max={10}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="When user breaks shield 3+ times, increase strictness..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                {/* Conditions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">IF (Conditions)</Label>
                    <Button variant="outline" size="sm" onClick={addCondition}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Condition
                    </Button>
                  </div>
                  {formData.trigger_conditions.map((condition, index) => (
                    <div key={index} className="grid grid-cols-4 gap-2 p-3 rounded-lg border bg-muted/50">
                      <Select value={condition.metric} onValueChange={(v) => updateCondition(index, 'metric', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {METRICS.map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={condition.operator} onValueChange={(v) => updateCondition(index, 'operator', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value=">=">≥</SelectItem>
                          <SelectItem value="<=">≤</SelectItem>
                          <SelectItem value="==">==</SelectItem>
                          <SelectItem value=">">{">"}</SelectItem>
                          <SelectItem value="<">{"<"}</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        value={condition.value}
                        onChange={(e) => updateCondition(index, 'value', parseInt(e.target.value) || 0)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => setFormData(prev => ({ ...prev, trigger_conditions: prev.trigger_conditions.filter((_, i) => i !== index) }))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">THEN (Actions)</Label>
                    <Button variant="outline" size="sm" onClick={addAction}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Action
                    </Button>
                  </div>
                  {formData.actions.map((action, index) => (
                    <div key={index} className="grid grid-cols-3 gap-2 p-3 rounded-lg border bg-muted/50">
                      <Select value={action.type} onValueChange={(v) => updateAction(index, 'type', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ACTIONS.map(a => (
                            <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Value"
                        value={action.value}
                        onChange={(e) => updateAction(index, 'value', e.target.value)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => setFormData(prev => ({ ...prev, actions: prev.actions.filter((_, i) => i !== index) }))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                  <Label>Rule Active</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveRule}>Save Rule</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading rules...</p>
            ) : rules.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No behavior rules configured</p>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-4 rounded-lg border ${rule.is_active ? 'bg-card' : 'bg-muted/50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{rule.name}</h4>
                        <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                          {rule.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline">Priority: {rule.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{rule.description || 'No description'}</p>
                      
                      {/* Rule Preview */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-amber-600">IF</span>
                        {(rule.trigger_conditions as any[] || []).map((c: any, i: number) => (
                          <Badge key={i} variant="outline" className="bg-amber-500/10">
                            {c.metric} {c.operator} {c.value}
                          </Badge>
                        ))}
                        <ArrowRight className="h-4 w-4 mx-2" />
                        <span className="font-medium text-green-600">THEN</span>
                        {(rule.actions as any[] || []).map((a: any, i: number) => (
                          <Badge key={i} variant="outline" className="bg-green-500/10">
                            {a.type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.is_active}
                        onCheckedChange={() => toggleRule(rule)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(rule)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteRule(rule.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
