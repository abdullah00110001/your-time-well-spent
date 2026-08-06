import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Music2, Play, Pause, Trash2, Upload, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Ringtone {
  id: string;
  name: string;
  description: string | null;
  category: string;
  file_url: string;
  file_path: string | null;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = ['Gentle', 'Loud', 'Nature', 'Classic', 'Other'];
const BUCKET = 'ringtones';

export default function AdminRingtones() {
  const { user } = useAuth();
  const [ringtones, setRingtones] = useState<Ringtone[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>('Gentle');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // preview state
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // delete confirm
  const [toDelete, setToDelete] = useState<Ringtone | null>(null);

  const loadRingtones = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ringtones')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Failed to load ringtones');
      console.error(error);
    } else {
      setRingtones((data ?? []) as Ringtone[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRingtones();
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('Gentle');
    setFile(null);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast.error('Not signed in');
    if (!name.trim()) return toast.error('Name is required');
    if (!file) return toast.error('Please choose an .mp3 file');
    if (!/audio\/(mpeg|mp3|wav|x-m4a|aac|ogg)/.test(file.type) && !/\.(mp3|wav|m4a|aac|ogg)$/i.test(file.name)) {
      return toast.error('Only audio files are allowed');
    }
    if (file.size > 10 * 1024 * 1024) {
      return toast.error('File too large (max 10 MB)');
    }

    setSubmitting(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'mp3';
      const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;

      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const file_url = publicData.publicUrl;

      const { error: insErr } = await supabase.from('ringtones').insert({
        name: name.trim(),
        description: description.trim() || null,
        category,
        file_url,
        file_path: path,
        file_size_bytes: file.size,
        created_by: user.id,
      });
      if (insErr) {
        // cleanup uploaded file if DB insert failed
        await supabase.storage.from(BUCKET).remove([path]);
        throw insErr;
      }

      toast.success('Ringtone added');
      resetForm();
      await loadRingtones();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreview = (rt: Ringtone) => {
    if (playingId === rt.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(rt.file_url);
    audio.onended = () => setPlayingId((id) => (id === rt.id ? null : id));
    audio.onerror = () => {
      toast.error('Playback failed');
      setPlayingId(null);
    };
    audioRef.current = audio;
    audio.play().then(() => setPlayingId(rt.id)).catch(() => toast.error('Playback blocked'));
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    const rt = toDelete;
    setToDelete(null);
    try {
      // delete DB record (RLS-protected)
      const { error: dbErr } = await supabase.from('ringtones').delete().eq('id', rt.id);
      if (dbErr) throw dbErr;

      // best-effort storage cleanup
      if (rt.file_path) {
        const { error: stErr } = await supabase.storage.from(BUCKET).remove([rt.file_path]);
        if (stErr) console.warn('Storage cleanup failed:', stErr.message);
      }

      toast.success('Ringtone deleted');
      setRingtones((prev) => prev.filter((r) => r.id !== rt.id));
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Delete failed');
    }
  };

  const stats = useMemo(() => ({
    total: ringtones.length,
    active: ringtones.filter((r) => r.is_active).length,
  }), [ringtones]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Music2 className="h-6 w-6 text-primary" /> Ringtone Manager
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage ringtones available in the alarm app. Changes go live instantly.
            </p>
          </div>
          <div className="hidden sm:flex gap-2">
            <Badge variant="secondary">{stats.total} total</Badge>
            <Badge>{stats.active} active</Badge>
          </div>
        </header>

        {/* Add form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5" /> Add New Ringtone
            </CardTitle>
            <CardDescription>Upload an .mp3 and fill in metadata.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="rt-name">Name</Label>
                <Input id="rt-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Morning Birds" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rt-cat">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="rt-cat"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="rt-desc">Description</Label>
                <Textarea
                  id="rt-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Soft chirping birds — perfect for a gentle wake-up."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="rt-file">Audio file (.mp3, max 10 MB)</Label>
                <Input
                  id="rt-file"
                  type="file"
                  accept="audio/mpeg,audio/mp3,audio/wav,audio/aac,audio/ogg,.mp3,.wav,.m4a,.aac,.ogg"
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
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading…</>
                  ) : (
                    <><Upload className="h-4 w-4 mr-2" /> Upload & Save</>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All Ringtones</CardTitle>
            <CardDescription>Click play to preview. Deleting also removes the file from storage.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 flex justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : ringtones.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Music2 className="h-10 w-10 mx-auto mb-2 opacity-40" />
                No ringtones yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12" />
                      <TableHead>Name</TableHead>
                      <TableHead className="hidden md:table-cell">Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="hidden lg:table-cell">Stream URL</TableHead>
                      <TableHead className="w-12 text-right">—</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ringtones.map((rt) => {
                      const isPlaying = playingId === rt.id;
                      return (
                        <TableRow key={rt.id}>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              onClick={() => handlePreview(rt)}
                              aria-label="Preview"
                            >
                              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">{rt.name}</TableCell>
                          <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-xs truncate">
                            {rt.description || '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{rt.category}</Badge>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[280px] truncate">
                            <a href={rt.file_url} target="_blank" rel="noreferrer" className="hover:underline">
                              {rt.file_url}
                            </a>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setToDelete(rt)}
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{toDelete?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the database record and the file from storage. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
