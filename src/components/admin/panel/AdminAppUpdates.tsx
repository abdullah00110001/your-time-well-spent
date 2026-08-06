import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Rocket, Send, Clock, CheckCircle2, Loader2, Upload } from 'lucide-react';
import { format } from 'date-fns';

interface AppUpdate {
  id: string;
  version: string;
  title: string;
  description: string;
  update_type: string;
  is_mandatory: boolean;
  download_url: string | null;
  is_active: boolean;
  created_at: string;
}

export default function AdminAppUpdates() {
  const { user } = useAuth();
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingApk, setUploadingApk] = useState(false);
  const [currentApkName, setCurrentApkName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newUpdate, setNewUpdate] = useState({
    version: '',
    version_code: '',
    title: '',
    description: '',
    update_type: 'feature',
    is_mandatory: false,
    download_url: '',
  });

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('*')
      .eq('key', 'app_updates')
      .maybeSingle();

    if (data?.value) {
      setUpdates((data.value as any).updates || []);
    }

    // Check current APK in storage
    try {
      const { data: files } = await supabase.storage.from('app-releases').list('', {
        limit: 1,
        sortBy: { column: 'created_at', order: 'desc' },
      });
      if (files && files.length > 0) {
        setCurrentApkName(files[0].name);
      }
    } catch {}

    setLoading(false);
  };

  const pushUpdate = async () => {
    if (!newUpdate.version || !newUpdate.title || !newUpdate.description || !newUpdate.version_code) {
      toast.error('Please fill version, version code, title, and description');
      return;
    }
    setSaving(true);

    const versionCode = parseInt(newUpdate.version_code, 10);
    if (isNaN(versionCode) || versionCode < 1) {
      toast.error('Version code must be a positive integer');
      setSaving(false);
      return;
    }

    const update: AppUpdate = {
      id: crypto.randomUUID(),
      ...newUpdate,
      download_url: newUpdate.download_url || null,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    const updatedList = [update, ...updates];

    // 1. Save to app_settings (update history)
    const { error } = await supabase
      .from('app_settings')
      .upsert({
        key: 'app_updates',
        value: { updates: updatedList, latest_version: newUpdate.version } as any,
        updated_by: user?.id,
      }, { onConflict: 'key' });

    if (error) {
      toast.error('Failed to push update');
      setSaving(false);
      return;
    }

    // 2. Sync app_metadata table (used by useAppUpdate hook for version checking)
    // Get the latest APK URL from storage as fallback
    let apkDownloadUrl = newUpdate.download_url || '';
    if (!apkDownloadUrl) {
      try {
        const { data: files } = await supabase.storage.from('app-releases').list('', {
          limit: 10,
          sortBy: { column: 'created_at', order: 'desc' },
        });
        const apkFile = files?.find(f => f.name.endsWith('.apk'));
        if (apkFile) {
          const { data: urlData } = supabase.storage.from('app-releases').getPublicUrl(apkFile.name);
          apkDownloadUrl = urlData.publicUrl;
        }
      } catch {}
    }

    await supabase
      .from('app_metadata')
      .upsert({
        id: 'singleton',
        latest_version_code: versionCode,
        download_url: apkDownloadUrl || '/download',
        is_force_update: newUpdate.is_mandatory,
        release_notes: `${newUpdate.title}: ${newUpdate.description}`,
        updated_by: user?.id,
      }, { onConflict: 'id' });

    // 3. Send notification to all users
    const { data: allUsers } = await supabase
      .from('profiles')
      .select('user_id');

    if (allUsers) {
      const notifications = allUsers.map(u => ({
        user_id: u.user_id,
        title: `🚀 App Update v${newUpdate.version}`,
        message: `${newUpdate.title}: ${newUpdate.description.slice(0, 100)}`,
        type: 'app_update',
        metadata: { version: newUpdate.version, version_code: versionCode, mandatory: newUpdate.is_mandatory },
      }));

      for (let i = 0; i < notifications.length; i += 50) {
        await supabase.from('notifications').insert(notifications.slice(i, i + 50));
      }
    }

    toast.success(`Update v${newUpdate.version} (code: ${versionCode}) pushed!`);
    setUpdates(updatedList);
    setNewUpdate({ version: '', version_code: '', title: '', description: '', update_type: 'feature', is_mandatory: false, download_url: '' });
    setSaving(false);
  };

  const toggleUpdate = async (id: string) => {
    const updatedList = updates.map(u => 
      u.id === id ? { ...u, is_active: !u.is_active } : u
    );
    
    await supabase
      .from('app_settings')
      .upsert({
        key: 'app_updates',
        value: { updates: updatedList, latest_version: updatedList.find(u => u.is_active)?.version || '' } as any,
        updated_by: user?.id,
      }, { onConflict: 'key' });

    setUpdates(updatedList);
    toast.success('Update status changed');
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Upload APK */}
      <Card>
        <CardHeader>
          <CardTitle className="text-subtitle flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload APK File
          </CardTitle>
          <CardDescription className="text-caption">
            Upload the latest APK for users to download
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {currentApkName && (
            <div className="flex items-center gap-2 p-3 rounded-xl border bg-card">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Current: {currentApkName}</span>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".apk"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (!file.name.endsWith('.apk')) {
                toast.error('Please select an APK file');
                return;
              }
              setUploadingApk(true);
              const fileName = `yearly-track-v${newUpdate.version || 'latest'}.apk`;
              const { error } = await supabase.storage.from('app-releases').upload(fileName, file, { upsert: true });
              if (error) {
                toast.error('Upload failed: ' + error.message);
              } else {
                setCurrentApkName(fileName);
                toast.success('APK uploaded successfully!');
              }
              setUploadingApk(false);
            }}
          />
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingApk}
          >
            {uploadingApk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploadingApk ? 'Uploading...' : 'Select & Upload APK'}
          </Button>
        </CardContent>
      </Card>

      {/* Push New Update */}
      <Card>
        <CardHeader>
          <CardTitle className="text-subtitle flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Push App Update
          </CardTitle>
          <CardDescription className="text-caption">
            Create and push a new update notification to all users
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Version Name</Label>
              <Input placeholder="e.g. 2.1.0" value={newUpdate.version} onChange={e => setNewUpdate(p => ({ ...p, version: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Version Code (integer)</Label>
              <Input placeholder="e.g. 2 (increment each release)" type="number" value={newUpdate.version_code} onChange={e => setNewUpdate(p => ({ ...p, version_code: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Update Type</Label>
              <Select value={newUpdate.update_type} onValueChange={v => setNewUpdate(p => ({ ...p, update_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="feature">✨ Feature</SelectItem>
                  <SelectItem value="bugfix">🐛 Bug Fix</SelectItem>
                  <SelectItem value="security">🔒 Security</SelectItem>
                  <SelectItem value="performance">⚡ Performance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Title</Label>
            <Input placeholder="What's new in this update?" value={newUpdate.title} onChange={e => setNewUpdate(p => ({ ...p, title: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea placeholder="Describe the changes..." rows={3} value={newUpdate.description} onChange={e => setNewUpdate(p => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="space-y-2">
            <Label>Download URL (optional)</Label>
            <Input placeholder="https://play.google.com/..." value={newUpdate.download_url} onChange={e => setNewUpdate(p => ({ ...p, download_url: e.target.value }))} />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={newUpdate.is_mandatory} onCheckedChange={v => setNewUpdate(p => ({ ...p, is_mandatory: v }))} />
            <Label>Mandatory Update</Label>
          </div>

          <Button onClick={pushUpdate} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Push Update to All Users
          </Button>
        </CardContent>
      </Card>

      {/* Update History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-subtitle">Update History</CardTitle>
          <CardDescription className="text-caption">{updates.length} updates pushed</CardDescription>
        </CardHeader>
        <CardContent>
          {updates.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No updates pushed yet</p>
          ) : (
            <div className="space-y-3">
              {updates.map(update => (
                <div key={update.id} className="p-4 rounded-xl border bg-card flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="outline">v{update.version}</Badge>
                      <Badge variant="secondary" className="capitalize">{update.update_type}</Badge>
                      {update.is_mandatory && <Badge variant="destructive">Mandatory</Badge>}
                      {update.is_active ? (
                        <Badge className="bg-green-500/10 text-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>
                      ) : (
                        <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Inactive</Badge>
                      )}
                    </div>
                    <p className="font-medium text-sm">{update.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{update.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {format(new Date(update.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <Switch checked={update.is_active} onCheckedChange={() => toggleUpdate(update.id)} />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
