// Focus Shield V2.0 - Unique Light Ritual Design. No Blue. No Clone.
// Settings > Blocking — the two large databases, searchable and toggleable.

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Globe, Languages, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  loadAdultSites, loadBnKeywords, searchAdultSites, searchBnKeywords,
  type AdultSiteDb, type BnKeywordDb,
} from '@/lib/shield/blockLists';
import { loadBlockingDb, saveBlockingDb, type BlockingDbSettings } from '@/lib/shield/settingsStore';

const GOLD = '#FFD166';

interface Props { onBack: () => void }

export function BlockingDatabasesPage({ onBack }: Props) {
  const [db, setDb] = useState<BlockingDbSettings>(loadBlockingDb);
  const [siteQuery, setSiteQuery] = useState('');
  const [kwQuery, setKwQuery] = useState('');
  const [siteDb, setSiteDb] = useState<AdultSiteDb | null>(null);
  const [kwDb, setKwDb] = useState<BnKeywordDb | null>(null);

  useEffect(() => {
    let alive = true;
    loadAdultSites().then((d) => { if (alive) setSiteDb(d); }).catch(() => {});
    loadBnKeywords().then((d) => { if (alive) setKwDb(d); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const patch = (p: Partial<BlockingDbSettings>) => {
    const next = { ...db, ...p };
    setDb(next);
    saveBlockingDb(next);
  };

  const sites = useMemo(
    () => (siteDb ? searchAdultSites(siteDb, siteQuery, 150) : []),
    [siteDb, siteQuery],
  );
  const keywords = useMemo(
    () => (kwDb ? searchBnKeywords(kwDb, kwQuery, 150) : []),
    [kwDb, kwQuery],
  );
  const siteCount = siteDb?.count ?? 0;
  const kwCount = kwDb?.count ?? 0;
  const loading = !siteDb || !kwDb;


  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border/50 bg-background/85 px-4 py-3 backdrop-blur pt-[max(env(safe-area-inset-top),0.75rem)]">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-base font-bold">Blocking Databases</h1>
          <p className="text-[11px] text-muted-foreground">
            {loading ? 'Loading lists…' : `${siteCount.toLocaleString()} domains · ${kwCount} Bengali keywords`}
          </p>
        </div>
      </div>

      <div className="p-4">
        <Tabs defaultValue="sites">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sites" className="text-xs">Adult Sites</TabsTrigger>
            <TabsTrigger value="keywords" className="text-xs">Bengali Keywords</TabsTrigger>
          </TabsList>

          <TabsContent value="sites" className="mt-4 space-y-3">
            <ToggleCard
              icon={Globe}
              title="Adult site list"
              hint={`${siteCount.toLocaleString()} domains, subdomains and mirrors`}
              on={db.adultSitesEnabled}
              onChange={(v) => patch({ adultSitesEnabled: v })}
            />
            <SearchBox value={siteQuery} onChange={setSiteQuery} placeholder="Search domains…" />
            <ListBox items={sites} dim={!db.adultSitesEnabled} />
          </TabsContent>

          <TabsContent value="keywords" className="mt-4 space-y-3">
            <ToggleCard
              icon={Languages}
              title="Bengali 18+ keywords"
              hint="Scans URLs and page titles"
              on={db.bnKeywordsEnabled}
              onChange={(v) => patch({ bnKeywordsEnabled: v })}
            />
            <SearchBox value={kwQuery} onChange={setKwQuery} placeholder="Search keywords…" />
            <ListBox items={keywords} dim={!db.bnKeywordsEnabled} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ToggleCard({
  icon: Icon, title, hint, on, onChange,
}: { icon: any; title: string; hint: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
      <Icon className="h-4 w-4 shrink-0" style={{ color: GOLD }} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight">{title}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
      <Switch checked={on} onCheckedChange={onChange} />
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-9 bg-muted/30 border-border/60"
      />
    </div>
  );
}

function ListBox({ items, dim }: { items: string[]; dim: boolean }) {
  if (items.length === 0) {
    return <p className="py-8 text-center text-xs text-muted-foreground">No matches</p>;
  }
  return (
    <div className={dim ? 'opacity-40' : undefined}>
      <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-border/60 divide-y divide-border/40">
        {items.map((item) => (
          <div key={item} className="px-3 py-2 text-xs font-mono break-all">{item}</div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">Showing up to 150 entries — refine your search to narrow down.</p>
    </div>
  );
}

export default BlockingDatabasesPage;
