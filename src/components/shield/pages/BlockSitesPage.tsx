import { useEffect, useState } from 'react';
import { ArrowLeft, Globe, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import ShieldPlugin from '@/lib/capacitor/shieldPlugin';

interface BlockSitesPageProps {
  onBack: () => void;
}

interface SiteEntry { url: string; active: boolean; }
const STORAGE_KEY = 'shield_blocked_sites_v2';

const SUGGESTIONS = [
  'facebook.com', 'instagram.com', 'tiktok.com', 'twitter.com', 'x.com',
  'youtube.com', 'reddit.com', 'pinterest.com',
];

export function BlockSitesPage({ onBack }: BlockSitesPageProps) {
  const [sites, setSites] = useState<SiteEntry[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSites(JSON.parse(stored));
  }, []);

  const persist = async (next: SiteEntry[]) => {
    setSites(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // isNative চেক ছাড়াই সবসময় Android কে জানাবো
    try {
      await ShieldPlugin.blockSites({
        sites: next.filter(s => s.active).map(s => s.url)
      });
    } catch (e) { console.error(e); }
  };

  const add = (raw: string) => {
    const url = raw.trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
    if (!url) return;
    if (sites.some(s => s.url === url)) {
      toast.info('Already in list');
      return;
    }
    persist([{ url, active: true }, ...sites]);
    setDraft('');
    toast.success(`Blocking ${url}`);
  };

  const toggle = (url: string) => {
    persist(sites.map(s => s.url === url ? { ...s, active: !s.active } : s));
  };

  const remove = (url: string) => {
    persist(sites.filter(s => s.url !== url));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Block Websites</h1>
            <p className="text-xs text-muted-foreground">
              {sites.filter(s => s.active).length} active
            </p>
          </div>
        </div>
        <div className="px-4 pb-3 flex gap-2">
          <Input
            placeholder="example.com"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(draft); }}
            className="h-11 rounded-xl"
          />
          <Button onClick={() => add(draft)} className="h-11 px-4 rounded-xl">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-3">
        {sites.length === 0 && (
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 px-1">
              Suggestions
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => add(s)}
                  className="px-3 py-1.5 rounded-full bg-muted text-xs hover:bg-muted/70"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {sites.map(s => (
          <Card key={s.url} className={!s.active ? 'opacity-60' : ''}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                <Globe className="h-5 w-5 text-blue-500" />
              </div>
              <p className="flex-1 font-medium text-sm truncate">{s.url}</p>
              <Switch
                checked={s.active}
                onCheckedChange={() => toggle(s.url)}
                className="data-[state=checked]:bg-rose-500"
              />
              <Button variant="ghost" size="icon" onClick={() => remove(s.url)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>
        ))}

        <p className="text-[11px] text-muted-foreground text-center pt-4 leading-relaxed">
          Site blocking works in supported browsers via Shield's accessibility service.
        </p>
      </div>
    </div>
  );
}