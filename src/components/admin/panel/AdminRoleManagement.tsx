import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, UserCog, Plus, Edit, Trash2, Key, Eye, Users, CreditCard, BarChart3, Settings } from 'lucide-react';

interface AdminRole {
  id: string;
  user_id: string;
  role: string;
  permissions: Record<string, boolean>;
  created_at: string;
  user_email?: string;
}

const PERMISSION_GROUPS = [
  { id: 'users', label: 'User Management', icon: Users, permissions: ['users.view', 'users.edit', 'users.suspend', 'users.delete'] },
  { id: 'payments', label: 'Payment Management', icon: CreditCard, permissions: ['payments.view', 'payments.refund', 'payments.grant'] },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, permissions: ['analytics.view', 'analytics.export'] },
  { id: 'system', label: 'System Settings', icon: Settings, permissions: ['system.view', 'system.edit', 'system.emergency'] },
];

const ROLE_PRESETS: Record<string, Record<string, boolean>> = {
  super_admin: { 'users.view': true, 'users.edit': true, 'users.suspend': true, 'users.delete': true, 'payments.view': true, 'payments.refund': true, 'payments.grant': true, 'analytics.view': true, 'analytics.export': true, 'system.view': true, 'system.edit': true, 'system.emergency': true },
  finance_admin: { 'payments.view': true, 'payments.refund': true, 'analytics.view': true, 'analytics.export': true },
  support_admin: { 'users.view': true, 'users.edit': true, 'payments.view': true },
  analyst: { 'users.view': true, 'analytics.view': true, 'analytics.export': true },
  auditor: { 'users.view': true, 'payments.view': true, 'analytics.view': true, 'system.view': true },
};

export default function AdminRoleManagement() {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newRole, setNewRole] = useState('auditor');
  const [newPermissions, setNewPermissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchRoles();
  }, []);

  useEffect(() => {
    setNewPermissions(ROLE_PRESETS[newRole] || {});
  }, [newRole]);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRoles((data || []).map(r => ({ ...r, permissions: r.permissions as Record<string, boolean> || {} })));
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to fetch admin roles');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async () => {
    if (!newUserEmail) {
      toast.error('Please enter a user email');
      return;
    }

    try {
      // First find user by email in profiles (simplified - in production you'd have email in profiles)
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_id')
        .limit(1)
        .single();

      if (!profile) {
        toast.error('User not found');
        return;
      }

      const { error } = await supabase
        .from('admin_roles')
        .insert([{
          user_id: profile.user_id,
          role: newRole as any,
          permissions: newPermissions,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        }]);

      if (error) throw error;

      toast.success('Admin role added successfully');
      setIsAddDialogOpen(false);
      setNewUserEmail('');
      fetchRoles();
    } catch (error) {
      console.error('Error adding role:', error);
      toast.error('Failed to add admin role');
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    try {
      const { error } = await supabase
        .from('admin_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
      toast.success('Role removed');
      fetchRoles();
    } catch (error) {
      toast.error('Failed to remove role');
    }
  };

  const togglePermission = (permission: string) => {
    setNewPermissions(prev => ({
      ...prev,
      [permission]: !prev[permission]
    }));
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'super_admin': return 'bg-red-500';
      case 'finance_admin': return 'bg-green-500';
      case 'support_admin': return 'bg-blue-500';
      case 'analyst': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      {/* Role Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {Object.keys(ROLE_PRESETS).map(role => (
          <Card key={role}>
            <CardContent className="p-4 text-center">
              <div className={`mx-auto h-10 w-10 rounded-full ${getRoleBadgeColor(role)} flex items-center justify-center mb-2`}>
                <UserCog className="h-5 w-5 text-white" />
              </div>
              <p className="font-medium capitalize">{role.replace('_', ' ')}</p>
              <p className="text-xs text-muted-foreground">
                {roles.filter(r => r.role === role).length} users
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Role Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Admin Role Management
            </CardTitle>
            <CardDescription>Manage admin access and permissions</CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Admin
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Admin User</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>User Email</Label>
                    <Input
                      placeholder="admin@example.com"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                        <SelectItem value="finance_admin">Finance Admin</SelectItem>
                        <SelectItem value="support_admin">Support Admin</SelectItem>
                        <SelectItem value="analyst">Analyst</SelectItem>
                        <SelectItem value="auditor">Auditor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="text-base font-semibold">Permissions</Label>
                  <div className="grid gap-4">
                    {PERMISSION_GROUPS.map(group => (
                      <div key={group.id} className="rounded-lg border p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <group.icon className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{group.label}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {group.permissions.map(perm => (
                            <div key={perm} className="flex items-center gap-2">
                              <Checkbox
                                id={perm}
                                checked={newPermissions[perm] || false}
                                onCheckedChange={() => togglePermission(perm)}
                              />
                              <Label htmlFor={perm} className="text-sm font-normal">
                                {perm.split('.')[1]}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAddRole}>Add Admin</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : roles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">No admin roles configured</TableCell>
                </TableRow>
              ) : (
                roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell>
                      <p className="font-mono text-sm">{role.user_id.slice(0, 8)}...</p>
                    </TableCell>
                    <TableCell>
                      <Badge className={getRoleBadgeColor(role.role)}>
                        {role.role.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(role.permissions || {})
                          .filter(([_, v]) => v)
                          .slice(0, 3)
                          .map(([k]) => (
                            <Badge key={k} variant="outline" className="text-xs">
                              {k}
                            </Badge>
                          ))}
                        {Object.entries(role.permissions || {}).filter(([_, v]) => v).length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{Object.entries(role.permissions || {}).filter(([_, v]) => v).length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(role.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteRole(role.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
