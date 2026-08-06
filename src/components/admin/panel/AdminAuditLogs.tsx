import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Search, Download, Eye, User, Settings, Shield, CreditCard, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLog {
  id: string;
  actor_id: string | null;
  actor_type: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  created_at: string;
}

const ACTION_ICONS: Record<string, any> = {
  user: User,
  system: Settings,
  shield: Shield,
  payment: CreditCard,
  alarm: AlertTriangle,
};

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-500',
  updated: 'bg-blue-500',
  deleted: 'bg-destructive',
  suspended: 'bg-amber-500',
  enabled: 'bg-green-500',
  disabled: 'bg-gray-500',
};

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    for (const [key, color] of Object.entries(ACTION_COLORS)) {
      if (action.toLowerCase().includes(key)) return color;
    }
    return 'bg-gray-500';
  };

  const getActionIcon = (resourceType: string | null) => {
    return ACTION_ICONS[resourceType || 'system'] || Settings;
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = !searchQuery || 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.resource_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actor_id?.includes(searchQuery);
    const matchesFilter = filterAction === 'all' || log.action.includes(filterAction);
    return matchesSearch && matchesFilter;
  });

  const exportLogs = () => {
    const csv = [
      ['Timestamp', 'Actor', 'Action', 'Resource', 'IP'].join(','),
      ...filteredLogs.map(log => [
        log.created_at,
        log.actor_id || 'system',
        log.action,
        log.resource_type || '',
        log.ip_address || '',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{logs.length}</p>
                <p className="text-xs text-muted-foreground">Total Logs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <User className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{logs.filter(l => l.action.includes('user')).length}</p>
                <p className="text-xs text-muted-foreground">User Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Settings className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{logs.filter(l => l.action.includes('config') || l.action.includes('setting')).length}</p>
                <p className="text-xs text-muted-foreground">Config Changes</p>
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
                <p className="text-2xl font-bold">{logs.filter(l => l.action.includes('delete') || l.action.includes('suspend')).length}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Audit Trail
            </CardTitle>
            <CardDescription>Complete action history for security review</CardDescription>
          </div>
          <Button variant="outline" onClick={exportLogs}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="created">Created</SelectItem>
                <SelectItem value="updated">Updated</SelectItem>
                <SelectItem value="deleted">Deleted</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Resource</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">Loading logs...</TableCell>
                  </TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">No audit logs found</TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.slice(0, 50).map((log) => {
                    const Icon = getActionIcon(log.resource_type);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">
                          {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
                              <User className="h-3 w-3" />
                            </div>
                            <span className="font-mono text-xs">
                              {log.actor_id?.slice(0, 8) || 'system'}...
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${getActionColor(log.action)}`} />
                            <span className="text-sm">{log.action}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <Badge variant="outline">{log.resource_type || 'N/A'}</Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => setSelectedLog(log)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Audit Log Details</DialogTitle>
                              </DialogHeader>
                              <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground">Timestamp</p>
                                    <p className="font-mono">{format(new Date(log.created_at), 'PPpp')}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Actor ID</p>
                                    <p className="font-mono">{log.actor_id || 'System'}</p>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Action</p>
                                    <Badge>{log.action}</Badge>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground">Resource</p>
                                    <p>{log.resource_type} / {log.resource_id?.slice(0, 8)}...</p>
                                  </div>
                                  {log.ip_address && (
                                    <div>
                                      <p className="text-sm text-muted-foreground">IP Address</p>
                                      <p className="font-mono">{log.ip_address}</p>
                                    </div>
                                  )}
                                </div>
                                
                                {(log.old_value || log.new_value) && (
                                  <div className="pt-4 border-t">
                                    <p className="text-sm font-medium mb-2">Changes</p>
                                    <div className="grid grid-cols-2 gap-4">
                                      {log.old_value && (
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">Before</p>
                                          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                                            {JSON.stringify(log.old_value, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                      {log.new_value && (
                                        <div>
                                          <p className="text-xs text-muted-foreground mb-1">After</p>
                                          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40">
                                            {JSON.stringify(log.new_value, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
