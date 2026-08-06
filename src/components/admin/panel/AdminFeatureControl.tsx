import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Settings, Plus, Edit, Trash2, Zap, Shield, Bell, Users, Brain, BarChart3, Globe, Smartphone, Crown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface FeatureFlag {
  id: string;
  feature_key: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  enabled_for_plans: string[];
  enabled_for_regions: string[];
  enabled_for_device_brands: string[];
  config: Record<string, any>;
  created_at: string;
  min_plan: string;
}

const FEATURE_ICONS: Record<string, any> = {
  rise_alarms: Bell,
  shield_blocker: Shield,
  group_accountability: Users,
  ai_nudging: Brain,
  advanced_analytics: BarChart3,
};

const PLANS = ['free', 'premium', 'ultimate'];
const REGIONS = ['global', 'us', 'eu', 'asia', 'mena'];
const DEVICE_BRANDS = ['all', 'samsung', 'xiaomi', 'oppo', 'vivo', 'oneplus', 'pixel'];

export default function AdminFeatureControl() {
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<FeatureFlag | null>(null);
  const [formData, setFormData] = useState({
    feature_key: '',
    name: '',
    description: '',
    is_enabled: true,
    enabled_for_plans: [] as string[],
    enabled_for_regions: [] as string[],
    enabled_for_device_brands: [] as string[],
  });

  useEffect(() => {
    fetchFeatures();
  }, []);

  const fetchFeatures = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .select('*')
        .order('name');

      if (error) throw error;
      setFeatures((data || []) as unknown as FeatureFlag[]);
    } catch (error) {
      console.error('Error fetching features:', error);
      toast.error('Failed to fetch features');
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (feature: FeatureFlag) => {
    try {
      const { error } = await supabase
        .from('feature_flags')
        .update({ is_enabled: !feature.is_enabled })
        .eq('id', feature.id);

      if (error) throw error;
      
      // Log the action
      await supabase.from('system_audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: feature.is_enabled ? 'feature_disabled' : 'feature_enabled',
        resource_type: 'feature_flag',
        resource_id: feature.id,
        new_value: { is_enabled: !feature.is_enabled },
      });

      toast.success(`Feature ${feature.is_enabled ? 'disabled' : 'enabled'}`);
      fetchFeatures();
    } catch (error) {
      toast.error('Failed to toggle feature');
    }
  };

  const handleSaveFeature = async () => {
    try {
      if (editingFeature) {
        const { error } = await supabase
          .from('feature_flags')
          .update({
            name: formData.name,
            description: formData.description,
            is_enabled: formData.is_enabled,
            enabled_for_plans: formData.enabled_for_plans,
            enabled_for_regions: formData.enabled_for_regions,
            enabled_for_device_brands: formData.enabled_for_device_brands,
            min_plan: (formData as any).min_plan || 'free',
          })
          .eq('id', editingFeature.id);

        if (error) throw error;
        toast.success('Feature updated');
      } else {
        const { error } = await supabase
          .from('feature_flags')
          .insert({
            feature_key: formData.feature_key.toLowerCase().replace(/\s+/g, '_'),
            name: formData.name,
            description: formData.description,
            is_enabled: formData.is_enabled,
            enabled_for_plans: formData.enabled_for_plans,
            enabled_for_regions: formData.enabled_for_regions,
            enabled_for_device_brands: formData.enabled_for_device_brands,
            min_plan: (formData as any).min_plan || 'free',
          });

        if (error) throw error;
        toast.success('Feature created');
      }

      setIsAddDialogOpen(false);
      setEditingFeature(null);
      resetForm();
      fetchFeatures();
    } catch (error) {
      console.error('Error saving feature:', error);
      toast.error('Failed to save feature');
    }
  };

  const resetForm = () => {
    setFormData({
      feature_key: '',
      name: '',
      description: '',
      is_enabled: true,
      enabled_for_plans: [],
      enabled_for_regions: [],
      enabled_for_device_brands: [],
    });
  };

  const openEditDialog = (feature: FeatureFlag) => {
    setEditingFeature(feature);
    setFormData({
      feature_key: feature.feature_key,
      name: feature.name,
      description: feature.description || '',
      is_enabled: feature.is_enabled,
      enabled_for_plans: feature.enabled_for_plans || [],
      enabled_for_regions: feature.enabled_for_regions || [],
      enabled_for_device_brands: feature.enabled_for_device_brands || [],
      min_plan: feature.min_plan || 'free',
    } as any);
    setIsAddDialogOpen(true);
  };

  const toggleArrayItem = (array: string[], item: string, key: keyof typeof formData) => {
    const newArray = array.includes(item) 
      ? array.filter(i => i !== item)
      : [...array, item];
    setFormData(prev => ({ ...prev, [key]: newArray }));
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{features.length}</p>
                <p className="text-xs text-muted-foreground">Total Features</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Zap className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{features.filter(f => f.is_enabled).length}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Globe className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{features.filter(f => f.enabled_for_regions?.length > 0).length}</p>
                <p className="text-xs text-muted-foreground">Region-Limited</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Smartphone className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{features.filter(f => f.enabled_for_device_brands?.length > 0).length}</p>
                <p className="text-xs text-muted-foreground">Device-Specific</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Feature Flags</CardTitle>
            <CardDescription>Control feature availability across the platform</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => { setIsAddDialogOpen(open); if (!open) { setEditingFeature(null); resetForm(); } }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Feature
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingFeature ? 'Edit Feature' : 'Add Feature'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Feature Key</Label>
                    <Input
                      placeholder="new_feature"
                      value={formData.feature_key}
                      onChange={(e) => setFormData(prev => ({ ...prev, feature_key: e.target.value }))}
                      disabled={!!editingFeature}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Display Name</Label>
                    <Input
                      placeholder="New Feature"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    placeholder="Describe what this feature does..."
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Switch
                    checked={formData.is_enabled}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_enabled: checked }))}
                  />
                  <Label>Feature Enabled</Label>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    Minimum Plan Required
                  </Label>
                  <Select value={(formData as any).min_plan || 'free'} onValueChange={(v) => setFormData(prev => ({ ...prev, min_plan: v }))}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free (Everyone)</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="ultimate">Ultimate</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Users need at least this plan to access this feature</p>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">Enabled for Plans</Label>
                  <div className="flex flex-wrap gap-2">
                    {PLANS.map(plan => (
                      <div key={plan} className="flex items-center gap-2">
                        <Checkbox
                          checked={formData.enabled_for_plans.includes(plan)}
                          onCheckedChange={() => toggleArrayItem(formData.enabled_for_plans, plan, 'enabled_for_plans')}
                        />
                        <Label className="capitalize">{plan}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">Enabled for Regions</Label>
                  <div className="flex flex-wrap gap-2">
                    {REGIONS.map(region => (
                      <div key={region} className="flex items-center gap-2">
                        <Checkbox
                          checked={formData.enabled_for_regions.includes(region)}
                          onCheckedChange={() => toggleArrayItem(formData.enabled_for_regions, region, 'enabled_for_regions')}
                        />
                        <Label className="uppercase">{region}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">Enabled for Device Brands</Label>
                  <div className="flex flex-wrap gap-2">
                    {DEVICE_BRANDS.map(brand => (
                      <div key={brand} className="flex items-center gap-2">
                        <Checkbox
                          checked={formData.enabled_for_device_brands.includes(brand)}
                          onCheckedChange={() => toggleArrayItem(formData.enabled_for_device_brands, brand, 'enabled_for_device_brands')}
                        />
                        <Label className="capitalize">{brand}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveFeature}>Save Feature</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Loading features...</p>
            ) : features.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No features configured</p>
            ) : (
              features.map((feature) => {
                const Icon = FEATURE_ICONS[feature.feature_key] || Settings;
                return (
                  <div
                    key={feature.id}
                    className={`flex items-center justify-between p-4 rounded-lg border ${feature.is_enabled ? 'bg-card' : 'bg-muted/50'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${feature.is_enabled ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Icon className={`h-5 w-5 ${feature.is_enabled ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{feature.name}</h4>
                          <Badge variant="outline" className="text-xs">{feature.feature_key}</Badge>
                          {feature.min_plan && feature.min_plan !== 'free' && (
                            <Badge variant="default" className="text-xs capitalize flex items-center gap-1">
                              <Crown className="h-3 w-3" />{feature.min_plan}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{feature.description || 'No description'}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {feature.enabled_for_plans?.map(plan => (
                            <Badge key={plan} variant="secondary" className="text-xs capitalize">{plan}</Badge>
                          ))}
                          {feature.enabled_for_regions?.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Globe className="h-3 w-3 mr-1" />
                              {feature.enabled_for_regions.length} regions
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={feature.is_enabled}
                        onCheckedChange={() => toggleFeature(feature)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(feature)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
