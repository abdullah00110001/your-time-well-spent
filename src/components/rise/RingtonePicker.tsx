import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Search, Play, Pause, Loader2, Check, Music2, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { isNative } from '@/lib/capacitor/platform';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { pickDeviceRingtone } from '@/lib/capacitor/nativeRingtonePicker';
import { useOfflineGuard } from '@/components/OfflineGuard';

interface Ringtone {
  id: string;
  name: string;
  description: string | null;
  category: string;
  file_url: string;
  duration_seconds: number | null;
}

interface RingtonePickerProps {
  /** Called with the final URI (local file:// when cached on native, remote URL on web). */
  onSelect: (uri: string, ringtone: Ringtone) => void;
  /** Currently selected ringtone id, for visual checkmark. */
  selectedId?: string;
}

const CATEGORIES = ['All', 'Gentle', 'Loud', 'Nature', 'Classic', 'Other'] as const;

/** Hard-coded default ringtone — always visible at top of list regardless of DB. */
const DEFAULT_RINGTONE: Ringtone = {
  id: 'default:rise-and-shine',
  name: 'Rise & Shine (Default)',
  description: 'Built-in default — works offline',
  category: 'Classic',
  // Use a small built-in beep tone. On native we fall through to the system default.
  file_url: 'data:audio/wav;base64,UklGRkIDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YR4DAAB/f39/f4B/f4F/gIB/gH9/gIB/f3+Af3+Af3+Af4B/gH9/gH9/gIB/f4B/f4B/f4F/gIB/gH9/gIB/',
  duration_seconds: 30,
};

/** Bouncing audio-bars equalizer shown while a ringtone is previewing. */
function AudioBars() {
  return (
    <div className="flex items-end gap-[2px] h-4">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-[3px] bg-primary rounded-sm animate-[eqbar_900ms_ease-in-out_infinite]"
          style={{
            animationDelay: `${i * 120}ms`,
            height: '100%',
          }}
        />
      ))}
      <style>{`
        @keyframes eqbar {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

const RINGTONE_CACHE_DIR = 'ringtones';

async function getCachedRingtoneUri(ringtoneId: string, remoteUrl: string): Promise<string> {
  if (!isNative) return remoteUrl;
  // ✅ Bypass caching for built-in default and device-picker URIs — they're already local/inline.
  if (
    ringtoneId.startsWith('default:') ||
    ringtoneId.startsWith('device:') ||
    remoteUrl.startsWith('data:') ||
    remoteUrl.startsWith('content://') ||
    remoteUrl.startsWith('file://') ||
    remoteUrl.startsWith('android.resource://')
  ) {
    return remoteUrl;
  }
  const ext = (remoteUrl.split('.').pop() || 'mp3').split('?')[0].slice(0, 4);
  const fileName = `${RINGTONE_CACHE_DIR}/${ringtoneId}.${ext}`;

  // Check if cached
  try {
    const stat = await Filesystem.stat({ path: fileName, directory: Directory.Data });
    if (stat?.uri) return stat.uri;
  } catch {
    // not cached — fall through to download
  }

  // Ensure dir exists
  try {
    await Filesystem.mkdir({ path: RINGTONE_CACHE_DIR, directory: Directory.Data, recursive: true });
  } catch {
    /* dir may already exist */
  }

  // Download as base64 and write
  const resp = await fetch(remoteUrl);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status}`);
  const blob = await resp.blob();
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const written = await Filesystem.writeFile({
    path: fileName,
    data: base64,
    directory: Directory.Data,
  });
  return written.uri;
}

export function RingtonePicker({ onSelect, selectedId }: RingtonePickerProps) {
  const [ringtones, setRingtones] = useState<Ringtone[]>([]);
  const { requireOnline } = useOfflineGuard();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]>('All');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch ringtones on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('ringtones')
        .select('id, name, description, category, file_url, duration_seconds')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error('Failed to load ringtones');
        console.error(error);
        setRingtones([DEFAULT_RINGTONE]);
      } else {
        // Prepend the default so it's always visible & selectable, even offline.
        setRingtones([DEFAULT_RINGTONE, ...((data ?? []) as Ringtone[])]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ringtones.filter((r) => {
      if (category !== 'All' && r.category !== category) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [ringtones, search, category]);

  const handlePreview = (rt: Ringtone) => {
    if (playingId === rt.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(rt.file_url);
    audio.preload = 'auto';
    audio.onended = () => setPlayingId((id) => (id === rt.id ? null : id));
    audio.onerror = () => {
      toast.error(`Could not stream "${rt.name}"`);
      setPlayingId(null);
    };
    audioRef.current = audio;
    audio.play().then(() => setPlayingId(rt.id)).catch((e) => {
      console.error('preview play failed', e);
      toast.error('Playback blocked');
    });
  };

  const handleSelect = async (rt: Ringtone) => {
    // Default + device-picker ringtones work offline.
    const isLocal =
      rt.id.startsWith('default:') ||
      rt.id.startsWith('device:') ||
      rt.file_url.startsWith('data:') ||
      rt.file_url.startsWith('content://') ||
      rt.file_url.startsWith('file://');

    const run = async () => {
    setDownloadingId(rt.id);
    try {
      const uri = await getCachedRingtoneUri(rt.id, rt.file_url);
      onSelect(uri, rt);
      toast.success(`Selected: ${rt.name}`);
    } catch (e: any) {
      console.error(e);
      const msg = String(e?.message ?? e);
      if (/quota|storage/i.test(msg)) {
        toast.error('Device storage full. Free up space and retry.');
      } else {
        toast.error('Download failed. Check your connection.');
      }
    } finally {
      setDownloadingId(null);
    }
    };

    if (isLocal) {
      await run();
    } else {
      requireOnline(() => { void run(); }, 'Downloading this ringtone');
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Sticky search + categories */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ringtones"
              className="pl-9 h-10 bg-muted/40 border-border"
            />
          </div>
        </div>
        <ScrollArea className="w-full">
          <div className="flex gap-2 px-3 pb-3">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all',
                  category === c
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:bg-muted/70'
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="opacity-0" />
        </ScrollArea>
      </div>

      {/* Native device-picker button (Android only) */}
      {isNative && (
        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={async () => {
              try {
                const picked = await pickDeviceRingtone({ title: 'Pick a device sound' });
                if (!picked || !picked.uri) {
                  return;
                }
                // Sanitize bogus titles (some Android devices return a numeric ID as the title)
                const rawTitle = (picked.title ?? '').trim();
                const niceTitle =
                  !rawTitle || /^\d+$/.test(rawTitle) ? 'Device ringtone' : rawTitle;
                const ringtoneId = `device:${picked.uri}`;
                onSelect(picked.uri, {
                  id: ringtoneId,
                  name: niceTitle,
                  description: 'Picked from device',
                  category: 'Device',
                  file_url: picked.uri,
                  duration_seconds: null,
                });
                toast.success(`Selected: ${niceTitle}`);
              } catch (e: any) {
                console.error('Device picker failed', e);
                toast.error('Could not open device picker');
              }
            }}
            className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border border-dashed border-border bg-muted/30 hover:bg-muted/60 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Smartphone className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">Choose from device</p>
                <p className="text-xs text-muted-foreground">Use any installed Android ringtone</p>
              </div>
            </div>
            <Check className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Music2 className="h-10 w-10 mb-2 opacity-40" />
            <p className="text-sm">No ringtones found</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((rt) => {
              const isPlaying = playingId === rt.id;
              const isDownloading = downloadingId === rt.id;
              const isSelected = selectedId === rt.id || selectedId === rt.file_url;
              return (
                <li
                  key={rt.id}
                  className={cn(
                    'group flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition-colors',
                    isPlaying ? 'border-primary/60 shadow-sm' : 'border-border hover:border-border/80'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handlePreview(rt)}
                    aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
                    className={cn(
                      'h-10 w-10 shrink-0 rounded-full flex items-center justify-center transition-colors',
                      isPlaying
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground hover:bg-primary/10 hover:text-primary'
                    )}
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate text-foreground">{rt.name}</p>
                      {isPlaying && <AudioBars />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {rt.description || rt.category}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant={isSelected ? 'secondary' : 'default'}
                    disabled={isDownloading}
                    onClick={() => handleSelect(rt)}
                    className="shrink-0 h-8 min-w-[72px]"
                  >
                    {isDownloading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isSelected ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1" /> Selected
                      </>
                    ) : (
                      'Select'
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default RingtonePicker;
