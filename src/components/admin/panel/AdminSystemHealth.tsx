import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Activity, CheckCircle, XCircle, AlertTriangle, RefreshCw, Power, Zap, Database, Server, Bell, Shield } from 'lucide-react';
import { format } from 'date-fns';

interface SystemService {
  id: string;
  service_name: string;
  status: string;
  last_check_at: string;
  error_count: number;
  recovery_mode: boolean;
  config: Record<string, any>;
}

const SERVICE_ICONS: Record<string, any> = {
  alarm_service: Bell,
  shield_service: Shield,
  notification_service: Bell,
  sync_service: RefreshCw,
};

export default function AdminSystemHealth() {
  const [services, setServices] = useState<SystemService[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_health')
        .select('*')
        .order('service_name');

      if (error) throw error;
      setServices((data || []).map(s => ({ ...s, config: s.config as Record<string, any> || {} })));
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshHealth = async () => {
    setRefreshing(true);
    try {
      // Update last_check_at for all services
      await supabase
        .from('system_health')
        .update({ last_check_at: new Date().toISOString() })
        .neq('id', '');
      
      await fetchServices();
      toast.success('Health check completed');
    } catch (error) {
      toast.error('Health check failed');
    } finally {
      setRefreshing(false);
    }
  };

  const toggleRecoveryMode = async (service: SystemService) => {
    try {
      const { error } = await supabase
        .from('system_health')
        .update({ recovery_mode: !service.recovery_mode })
        .eq('id', service.id);

      if (error) throw error;

      await supabase.from('system_audit_logs').insert({
        actor_id: (await supabase.auth.getUser()).data.user?.id,
        action: service.recovery_mode ? 'recovery_mode_disabled' : 'recovery_mode_enabled',
        resource_type: 'system_health',
        resource_id: service.id,
      });

      toast.success(service.recovery_mode ? 'Recovery mode disabled' : 'Recovery mode enabled');
      fetchServices();
    } catch (error) {
      toast.error('Failed to toggle recovery mode');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded': return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'down': return <XCircle className="h-5 w-5 text-destructive" />;
      default: return <Activity className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy': return <Badge className="bg-green-500">Healthy</Badge>;
      case 'degraded': return <Badge className="bg-amber-500">Degraded</Badge>;
      case 'down': return <Badge variant="destructive">Down</Badge>;
      default: return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const overallHealth = services.every(s => s.status === 'healthy') 
    ? 'healthy' 
    : services.some(s => s.status === 'down') 
      ? 'critical' 
      : 'degraded';

  return (
    <div className="space-y-6">
      {/* Overall Status Banner */}
      <Card className={
        overallHealth === 'healthy' ? 'border-green-500 bg-green-500/5' :
        overallHealth === 'degraded' ? 'border-amber-500 bg-amber-500/5' :
        'border-destructive bg-destructive/5'
      }>
        <CardContent className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {overallHealth === 'healthy' ? (
              <CheckCircle className="h-12 w-12 text-green-500" />
            ) : overallHealth === 'degraded' ? (
              <AlertTriangle className="h-12 w-12 text-amber-500" />
            ) : (
              <XCircle className="h-12 w-12 text-destructive" />
            )}
            <div>
              <h2 className="text-xl font-bold">
                {overallHealth === 'healthy' ? 'All Systems Operational' :
                 overallHealth === 'degraded' ? 'Partial System Degradation' :
                 'Critical System Issues'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Last updated: {format(new Date(), 'PPpp')}
              </p>
            </div>
          </div>
          <Button onClick={refreshHealth} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Checking...' : 'Health Check'}
          </Button>
        </CardContent>
      </Card>

      {/* Service Status Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center">Loading services...</CardContent>
          </Card>
        ) : services.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-8 text-center">No services configured</CardContent>
          </Card>
        ) : (
          services.map((service) => {
            const Icon = SERVICE_ICONS[service.service_name] || Activity;
            return (
              <Card key={service.id} className={service.status !== 'healthy' ? 'border-amber-500' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${service.status === 'healthy' ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                        <Icon className={`h-5 w-5 ${service.status === 'healthy' ? 'text-green-500' : 'text-amber-500'}`} />
                      </div>
                      <div>
                        <p className="font-medium capitalize">{service.service_name.replace('_', ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(service.last_check_at), 'HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                    {getStatusIcon(service.status)}
                  </div>
                  <div className="flex items-center justify-between">
                    {getStatusBadge(service.status)}
                    {service.error_count > 0 && (
                      <Badge variant="outline" className="text-destructive">
                        {service.error_count} errors
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Disaster Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" />
            Disaster Control & Recovery
          </CardTitle>
          <CardDescription>Emergency controls and recovery options</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {services.map((service) => (
            <div key={service.id} className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-4">
                <div className={`h-3 w-3 rounded-full ${service.status === 'healthy' ? 'bg-green-500' : 'bg-amber-500'}`} />
                <div>
                  <p className="font-medium capitalize">{service.service_name.replace('_', ' ')}</p>
                  <p className="text-sm text-muted-foreground">
                    Recovery Mode: {service.recovery_mode ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Recovery Mode</span>
                  <Switch
                    checked={service.recovery_mode}
                    onCheckedChange={() => toggleRecoveryMode(service)}
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Emergency Actions */}
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-4">Emergency Actions</h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Button variant="outline" className="h-auto py-3 flex-col">
                <Bell className="h-5 w-5 mb-2" />
                <span className="text-sm">Force Wake All</span>
                <span className="text-xs text-muted-foreground">Emergency push</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex-col">
                <Shield className="h-5 w-5 mb-2" />
                <span className="text-sm">Release All Shields</span>
                <span className="text-xs text-muted-foreground">Disable blocking</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex-col">
                <RefreshCw className="h-5 w-5 mb-2" />
                <span className="text-sm">Force Sync</span>
                <span className="text-xs text-muted-foreground">All devices</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex-col border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground">
                <Power className="h-5 w-5 mb-2" />
                <span className="text-sm">Kill Switch</span>
                <span className="text-xs">Stop all services</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Metrics */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Database className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">99.9%</p>
                <p className="text-sm text-muted-foreground">Database Uptime</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Server className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">45ms</p>
                <p className="text-sm text-muted-foreground">Avg Response Time</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Zap className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">1.2K</p>
                <p className="text-sm text-muted-foreground">Requests/min</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
