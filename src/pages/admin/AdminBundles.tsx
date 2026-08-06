import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Package, Upload, Loader2, Trash2, Rocket } from 'lucide-react';
import { toast } from 'sonner';

interface Bundle {
  id: string;
  version: string;
  release_notes: string | null;
  bundle_url: string;
  bundle_path: string;
  bundle_size_bytes: number | null;
  is_active: boolean;
  min_app_version_code: number | null;
  created_at: string;
}

const BUCKET = 'app-releases';

export default function AdminBundles() {
  const { user } = useAuth();
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [minCode, setMinCode] = useState<number | ''>('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ota_bundles' as any)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      // Table may not exist yet — surface a friendly message
      console.warn(error);
      toast.error('ota_bundles table missing — run the OTA migration first');
      setBundles([]);
    } else {
      setBundles((data ?? []) as unknown as Bundle[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error('Not signed in');
    if (!version.trim()) return toast.error('Version is required (e.g. 1.0.3)');
    if (!file) return toast.error('Choose a .zip bundle');
    if (!/\.zip$/i.test(file.name)) return toast.error('Bundle must be a .zip');
    if (file.size > 50 * 1024 * 1024) return toast.error('Bundle too large (max 50 MB)');

    setSubmitting(true);
    try {
      const path = `bundles/${version.trim()}-${Date.now()}.zip`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: 'application/zip' });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const { error: insErr } = await supabase.from('ota_bundles' as any).insert({
        version: version.trim(),
        release_notes: notes.trim() || null,
        bundle_url: pub.publicUrl,
        bundle_path: path,
        bundle_size_bytes: file.size,
        is_active: true,
        min_app_version_code: minCode === '' ? null : Number(minCode),
        created_by: user.id,
      });
      if (insErr) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }
      toast.success('Bundle published — clients will pick it up on next launch');
      setVersion('');
      setNotes('');
      setFile(null);
      setMinCode('');
      await load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (b: Bundle) => {
    const { error } = await supabase
      .from('ota_bundles' as any)
      .update({ is_active: !b.is_active })
      .eq('id', b.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (b: Bundle) => {
    if (!confirm(`Delete bundle ${b.version}?`)) return;
    const { error } = await supabase.from('ota_bundles' as any).delete().eq('id', b.id);
    if (error) return toast.error(error.message);
    if (b.bundle_path) {
      await supabase.storage.from(BUCKET).remove([b.bundle_path]).catch(() => {});
    }
    toast.success('Bundle deleted');
    load();
  };

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-center gap-3">
          <Package className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">OTA Bundles</h1>
            <p className="text-sm text-muted-foreground">
              Publish a new web bundle (zip) — clients update on next launch via Capawesome Live Update.
            </p>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5" /> Publish new bundle
            </CardTitle>
            <CardDescription>
              Build locally with <code>npm run build</code>, then zip the <code>dist/</code> folder and upload it here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={upload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ota-ver">Version</Label>
                <Input id="ota-ver" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0.3" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ota-min">Min native app versionCode (optional)</Label>
                <Input
                  id="ota-min"
                  type="number"
                  value={minCode}
                  onChange={(e) => setMinCode(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="1"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="ota-notes">Release notes</Label>
                <Textarea
                  id="ota-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Bug fixes and performance improvements"
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="ota-file">Bundle (.zip, max 50 MB)</Label>
                <Input
                  id="ota-file"
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file && (
                  <p className="text-xs text-muted-foreground">
                    {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={submitting} className="w-full md:w-auto">
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Publishing…</>
                  ) : (
                    <><Rocket className="h-4 w-4 mr-2" /> Publish bundle</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All bundles</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : bundles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No bundles published yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {bundles.map((b) => (
                  <li key={b.id} className="py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">v{b.version}</span>
                        <Badge variant={b.is_active ? 'default' : 'secondary'}>
                          {b.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        {b.min_app_version_code != null && (
                          <Badge variant="outline">min code: {b.min_app_version_code}</Badge>
                        )}
                        {b.bundle_size_bytes != null && (
                          <span className="text-xs text-muted-foreground">
                            {(b.bundle_size_bytes / 1024 / 1024).toFixed(2)} MB
                          </span>
                        )}
                      </div>
                      {b.release_notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.release_notes}</p>
                      )}
                      <a
                        href={b.bundle_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-muted-foreground hover:underline truncate inline-block max-w-full"
                      >
                        {b.bundle_url}
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b)} />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => remove(b)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
