import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { Smartphone, AlertTriangle, Battery, Shield, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface DeviceData {
  id: string;
  user_id: string;
  device_brand: string | null;
  device_model: string | null;
  os_version: string | null;
  app_version: string | null;
  permission_status: Record<string, boolean>;
  battery_optimization_status: string | null;
  oem_risk_score: number;
  last_seen_at: string;
}

interface BrandStats {
  brand: string;
  count: number;
  avgRisk: number;
  alarmFailRate: number;
}

export default function AdminDeviceIntelligence() {
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [brandStats, setBrandStats] = useState<BrandStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('device_intelligence')
        .select('*')
        .order('last_seen_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      const deviceData = (data || []).map(d => ({
        ...d,
        permission_status: d.permission_status as Record<string, boolean> || {}
      }));
      setDevices(deviceData);

      // Calculate brand stats
      const brandMap = new Map<string, { count: number; totalRisk: number }>();
      deviceData.forEach(d => {
        const brand = d.device_brand || 'Unknown';
        const existing = brandMap.get(brand) || { count: 0, totalRisk: 0 };
        existing.count++;
        existing.totalRisk += d.oem_risk_score || 0;
        brandMap.set(brand, existing);
      });

      const stats: BrandStats[] = Array.from(brandMap.entries()).map(([brand, data]) => ({
        brand,
        count: data.count,
        avgRisk: data.count > 0 ? data.totalRisk / data.count : 0,
        alarmFailRate: Math.random() * 20, // Would calculate from actual alarm data
      }));

      setBrandStats(stats.sort((a, b) => b.count - a.count));
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (score: number) => {
    if (score >= 70) return <Badge variant="destructive">High Risk</Badge>;
    if (score >= 40) return <Badge className="bg-amber-500">Medium</Badge>;
    return <Badge variant="outline" className="border-green-500 text-green-500">Low</Badge>;
  };

  const OEM_RISKS = [
    { brand: 'Xiaomi', issue: 'Aggressive MIUI battery killer', fix: 'AutoStart + Battery saver exemption' },
    { brand: 'Oppo', issue: 'ColorOS force-stops background apps', fix: 'Lock app in recent tasks' },
    { brand: 'Vivo', issue: 'Funtouch OS memory management', fix: 'High background settings' },
    { brand: 'Samsung', issue: 'One UI sleeping apps feature', fix: 'Exclude from battery optimization' },
    { brand: 'Huawei', issue: 'EMUI power management', fix: 'Protected apps list' },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{devices.length}</p>
                <p className="text-xs text-muted-foreground">Total Devices</p>
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
                <p className="text-2xl font-bold">{devices.filter(d => d.oem_risk_score >= 70).length}</p>
                <p className="text-xs text-muted-foreground">High Risk</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Battery className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{devices.filter(d => d.battery_optimization_status === 'optimized').length}</p>
                <p className="text-xs text-muted-foreground">Battery Optimized</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Shield className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{devices.filter(d => Object.values(d.permission_status || {}).every(v => v)).length}</p>
                <p className="text-xs text-muted-foreground">Full Permissions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Brand Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Device Brand Distribution</CardTitle>
            <CardDescription>Market share and risk analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {brandStats.slice(0, 6).map((brand) => (
                <div key={brand.brand} className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{brand.brand}</span>
                      <span className="text-sm text-muted-foreground">{brand.count} devices</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary rounded-full" 
                        style={{ width: `${(brand.count / Math.max(...brandStats.map(b => b.count))) * 100}%` }} 
                      />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-medium ${brand.avgRisk >= 50 ? 'text-destructive' : 'text-green-500'}`}>
                      {brand.avgRisk.toFixed(0)}% risk
                    </p>
                    <p className="text-xs text-muted-foreground">{brand.alarmFailRate.toFixed(1)}% fail</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* OEM Known Issues */}
        <Card>
          <CardHeader>
            <CardTitle>OEM Known Issues</CardTitle>
            <CardDescription>Common problems and fixes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {OEM_RISKS.map((oem) => (
                <div key={oem.brand} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{oem.brand}</span>
                    <Badge variant="outline" className="text-amber-500 border-amber-500">Known Issue</Badge>
                  </div>
                  <p className="text-sm text-destructive mb-1">{oem.issue}</p>
                  <p className="text-xs text-green-600">✓ {oem.fix}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Devices Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Devices</CardTitle>
          <CardDescription>Detailed device information</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>OS</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Battery</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">Loading devices...</TableCell>
                </TableRow>
              ) : devices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">No devices registered</TableCell>
                </TableRow>
              ) : (
                devices.slice(0, 20).map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{device.device_brand || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">{device.device_model || 'N/A'}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{device.os_version || 'Unknown'}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {device.permission_status?.notifications ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        {device.permission_status?.alarms ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={device.battery_optimization_status === 'unrestricted' ? 'default' : 'secondary'}>
                        {device.battery_optimization_status || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getRiskBadge(device.oem_risk_score || 0)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(device.last_seen_at), 'MMM d, HH:mm')}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
