import { useEffect, useState } from 'react';
import { ArrowLeft, Type, Plus, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ShieldPlugin from '@/lib/capacitor/shieldPlugin';

interface BlockKeywordsPageProps {
  onBack: () => void;
}

const STORAGE_KEY = 'shield_blocked_keywords_v2';

export function BlockKeywordsPage({ onBack }: BlockKeywordsPageProps) {
  const [keywords, setKeywords] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setKeywords(JSON.parse(stored));
  }, []);

  const persist = async (next: string[]) => {
    setKeywords(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    // isNative চেক ছাড়াই সবসময় Android কে জানাবো
    try {
      await ShieldPlugin.blockKeywords({ keywords: next });
    } catch (e) { console.error(e); }
  };

  const add = (raw: string) => {
    const kw = raw.trim().toLowerCase();
    if (!kw) return;
    if (keywords.includes(kw)) { toast.info('Already added'); return; }
    persist([kw, ...keywords]);
    setDraft('');
    toast.success(`Blocking "${kw}"`);
  };

  const remove = (kw: string) => persist(keywords.filter(k => k !== kw));

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Block Keywords</h1>
            <p className="text-xs text-muted-foreground">
              {keywords.length} keyword{keywords.length !== 1 && 's'}
            </p>
          </div>
        </div>
        <div className="px-4 pb-3 flex gap-2">
          <Input
            placeholder="Type a keyword to block…"
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

      <div className="px-4 py-3 space-y-2">
        {keywords.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-muted-foreground">
              <p className="text-sm">No keywords yet.</p>
              <p className="text-xs mt-1">
                Shield will navigate away when a blocked keyword is typed anywhere.
              </p>
            </CardContent>
          </Card>
        ) : keywords.map(kw => (
          <Card key={kw}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Type className="h-5 w-5 text-amber-500" />
              </div>
              <p className="flex-1 font-medium text-sm truncate">{kw}</p>
              <Button variant="ghost" size="icon" onClick={() => remove(kw)}>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            </CardContent>
          </Card>
        ))}

        <p className="text-[11px] text-muted-foreground text-center pt-4 leading-relaxed">
          When you type a blocked keyword in any app, Shield will automatically go back.
        </p>
      </div>
    </div>
  );
}