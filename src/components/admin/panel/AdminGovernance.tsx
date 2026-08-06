import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Scale, Shield, AlertTriangle, FileText, Plus, Edit, Eye, Power, Save } from 'lucide-react';

interface GovernancePolicy {
  id: string;
  policy_key: string;
  name: string;
  description: string | null;
  rules: Record<string, any>;
  is_active: boolean;
  emergency_override: boolean;
  created_at: string;
}

export default function AdminGovernance() {
  const [policies, setPolicies] = useState<GovernancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    policy_key: '',
    name: '',
    description: '',
    rules: '{}',
    is_active: true,
    emergency_override: false,
  });

  useEffect(() => {
    fetchPolicies();
  }, []);

  const fetchPolicies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('governance_policies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPolicies((data || []).map(p => ({ ...p, rules: p.rules as Record<string, any> || {} })));
    } catch (error) {
      console.error('Error fetching policies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSavePolicy = async () => {
    try {
      let rules;
      try {
        rules = JSON.parse(formData.rules);
      } catch {
        toast.error('Invalid JSON in rules');
        return;
      }

      const { error } = await supabase
        .from('governance_policies')
        .insert({
          policy_key: formData.policy_key.toLowerCase().replace(/\s+/g, '_'),
          name: formData.name,
          description: formData.description,
          rules,
          is_active: formData.is_active,
          emergency_override: formData.emergency_override,
        });

      if (error) throw error;

      toast.success('Policy created');
      setIsAddDialogOpen(false);
      setFormData({
        policy_key: '',
        name: '',
        description: '',
        rules: '{}',
        is_active: true,
        emergency_override: false,
      });
      fetchPolicies();
    } catch (error) {
      console.error('Error saving policy:', error);
      toast.error('Failed to save policy');
    }
  };

  const togglePolicy = async (policy: GovernancePolicy) => {
    try {
      const { error } = await supabase
        .from('governance_policies')
        .update({ is_active: !policy.is_active })
        .eq('id', policy.id);

      if (error) throw error;

      await supabase.from('system_audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: policy.is_active ? 'policy_disabled' : 'policy_enabled',
        resource_type: 'governance_policy',
        resource_id: policy.id,
      });

      toast.success(policy.is_active ? 'Policy disabled' : 'Policy enabled');
      fetchPolicies();
    } catch (error) {
      toast.error('Failed to toggle policy');
    }
  };

  const DEFAULT_POLICIES = [
    {
      key: 'data_retention',
      name: 'Data Retention Policy',
      description: 'Rules for how long user data is stored',
      icon: FileText,
    },
    {
      key: 'consent_management',
      name: 'Consent Management',
      description: 'User consent tracking and compliance',
      icon: Shield,
    },
    {
      key: 'emergency_protocol',
      name: 'Emergency Protocol',
      description: 'Kill switch and emergency procedures',
      icon: Power,
    },
    {
      key: 'ethical_guidelines',
      name: 'Ethical AI Guidelines',
      description: 'Limits on AI nudging intensity',
      icon: Scale,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Policy Overview */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {DEFAULT_POLICIES.map((policy) => {
          const existing = policies.find(p => p.policy_key === policy.key);
          return (
            <Card key={policy.key} className={existing?.is_active ? 'border-green-500/50' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${existing?.is_active ? 'bg-green-500/10' : 'bg-muted'}`}>
                    <policy.icon className={`h-5 w-5 ${existing?.is_active ? 'text-green-500' : 'text-muted-foreground'}`} />
                  </div>
                  <Badge variant={existing?.is_active ? 'default' : 'secondary'}>
                    {existing?.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <h4 className="font-medium">{policy.name}</h4>
                <p className="text-xs text-muted-foreground mt-1">{policy.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Policies List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              Governance Policies
            </CardTitle>
            <CardDescription>System-wide rules and ethical guidelines</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Policy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Governance Policy</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Policy Key</Label>
                    <Input
                      placeholder="data_retention"
                      value={formData.policy_key}
                      onChange={(e) => setFormData(prev => ({ ...prev, policy_key: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      placeholder="Data Retention Policy"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe what this policy governs..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Rules (JSON)</Label>
                  <Textarea
                    placeholder='{"max_retention_days": 365, "require_consent": true}'
                    value={formData.rules}
                    onChange={(e) => setFormData(prev => ({ ...prev, rules: e.target.value }))}
                    className="font-mono text-sm"
                    rows={5}
                  />
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                    />
                    <Label>Active</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.emergency_override}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, emergency_override: checked }))}
                    />
                    <Label>Allow Emergency Override</Label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSavePolicy}>Create Policy</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading policies...</p>
            ) : policies.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No policies configured</p>
            ) : (
              policies.map((policy) => (
                <div
                  key={policy.id}
                  className={`p-4 rounded-lg border ${policy.is_active ? 'bg-card' : 'bg-muted/50'}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{policy.name}</h4>
                        <Badge variant="outline">{policy.policy_key}</Badge>
                        {policy.emergency_override && (
                          <Badge variant="outline" className="border-amber-500 text-amber-500">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Override Enabled
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{policy.description}</p>
                      <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-20">
                        {JSON.stringify(policy.rules, null, 2)}
                      </pre>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={policy.is_active}
                        onCheckedChange={() => togglePolicy(policy)}
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transparency & Compliance */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Transparency Logs</CardTitle>
            <CardDescription>Public-facing policy changes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { date: 'Feb 9, 2026', action: 'Privacy policy updated', type: 'policy' },
                { date: 'Feb 5, 2026', action: 'Terms of service v2.1', type: 'legal' },
                { date: 'Jan 28, 2026', action: 'Data retention reduced to 1 year', type: 'compliance' },
              ].map((log, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{log.action}</p>
                    <p className="text-xs text-muted-foreground">{log.date}</p>
                  </div>
                  <Badge variant="outline">{log.type}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ethical Risk Indicators</CardTitle>
            <CardDescription>Monitoring AI and system ethics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { label: 'AI Nudging Intensity', value: 'Normal', status: 'green' },
                { label: 'User Consent Coverage', value: '98%', status: 'green' },
                { label: 'Data Minimization', value: 'Compliant', status: 'green' },
                { label: 'Over-Notification Risk', value: 'Low', status: 'green' },
              ].map((indicator, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm">{indicator.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{indicator.value}</span>
                    <div className={`h-2 w-2 rounded-full ${indicator.status === 'green' ? 'bg-green-500' : 'bg-amber-500'}`} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
