/**
 * PHASE 2 — Blocklist section for Sleep to Rise.
 * Lets the user choose the enforcement strategy, pick distraction apps from a
 * suggested list (or add custom ones), and block distracting sites/keywords.
 */
import { useState } from 'react';
import { Ban, Plus, X, Globe, Search, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  AllowedApp,
  NightToRiseConfig,
  SUGGESTED_BLOCK_APPS,
  SUGGESTED_BLOCK_SITES,
  ALWAYS_ALLOWED_IDS,
} from './types';
import { InstalledAppPicker } from './InstalledAppPicker';

interface Props {
  config: NightToRiseConfig;
  update: (patch: Partial<NightToRiseConfig>) => void;
}

function normalizeSite(v: string) {
  return v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
}

export function NightToRiseBlocklist({ config, update }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [customSite, setCustomSite] = useState('');
  const [customKeyword, setCustomKeyword] = useState('');

  const isBlocked = (id: string) => config.blockedApps.some((a) => a.id === id);

  const toggleApp = (app: AllowedApp) => {
    if (ALWAYS_ALLOWED_IDS.includes(app.id)) return;
    update({
      blockedApps: isBlocked(app.id)
        ? config.blockedApps.filter((a) => a.id !== app.id)
        : [...config.blockedApps, app],
    });
  };

  const addSite = (raw: string) => {
    const site = normalizeSite(raw);
    if (!site || config.blockedSites.includes(site)) return;
    update({ blockedSites: [...config.blockedSites, site] });
  };

  const addKeyword = () => {
    const kw = customKeyword.trim().toLowerCase();
    if (!kw || config.blockedKeywords.includes(kw)) return;
    update({ blockedKeywords: [...config.blockedKeywords, kw] });
    setCustomKeyword('');
  };

  return (
    <div className="space-y-5">
      {/* Enforcement mode */}
      <div>
        <Label className="text-xs">Enforcement</Label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {([
            { key: 'blocklist', title: 'Blocklist', desc: 'Only these apps lock' },
            { key: 'allowlist', title: 'Allowlist', desc: 'Lock everything else' },
          ] as const).map((m) => (
            <button
              key={m.key}
              onClick={() => update({ blocklistMode: m.key })}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                config.blocklistMode === m.key
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted/50',
              )}
            >
              <p className={cn('text-xs font-semibold', config.blocklistMode === m.key && 'text-primary')}>{m.title}</p>
              <p className="text-[11px] text-muted-foreground">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Suggested distraction apps */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs">Distraction apps</Label>
          <span className="text-[11px] text-muted-foreground">{config.blockedApps.length} blocked</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_BLOCK_APPS.map((app) => (
            <button
              key={app.id}
              onClick={() => toggleApp(app)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                isBlocked(app.id)
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-border text-muted-foreground hover:bg-muted/50',
              )}
            >
              {app.name}
            </button>
          ))}
        </div>

        {/* Custom blocked apps */}
        {config.blockedApps.filter((a) => !SUGGESTED_BLOCK_APPS.some((s) => s.id === a.id)).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {config.blockedApps
              .filter((a) => !SUGGESTED_BLOCK_APPS.some((s) => s.id === a.id))
              .map((a) => (
                <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
                  {a.name}
                  <button onClick={() => toggleApp(a)} className="opacity-60 hover:opacity-100">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
          </div>
        )}

        <Button variant="outline" className="mt-3 w-full" onClick={() => setPickerOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Choose apps from phone
        </Button>
        <InstalledAppPicker
          open={pickerOpen}
          title="Apps to block"
          selected={config.blockedApps.map((a) => a.id)}
          onClose={() => setPickerOpen(false)}
          onSave={(apps) => {
            update({ blockedApps: apps.filter((a) => !ALWAYS_ALLOWED_IDS.includes(a.id)) });
            setPickerOpen(false);
          }}
        />
      </div>

      {/* Blocked sites */}
      <div>
        <Label className="flex items-center gap-1.5 text-xs">
          <Globe className="h-3.5 w-3.5" /> Blocked sites
        </Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTED_BLOCK_SITES.filter((s) => !config.blockedSites.includes(s)).map((s) => (
            <button
              key={s}
              onClick={() => addSite(s)}
              className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/50"
            >
              + {s}
            </button>
          ))}
        </div>
        {config.blockedSites.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {config.blockedSites.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
                {s}
                <button
                  onClick={() => update({ blockedSites: config.blockedSites.filter((x) => x !== s) })}
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="example.com"
            value={customSite}
            onChange={(e) => setCustomSite(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { addSite(customSite); setCustomSite(''); }
            }}
          />
          <Button size="icon" onClick={() => { addSite(customSite); setCustomSite(''); }}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Blocked keywords */}
      <div>
        <Label className="flex items-center gap-1.5 text-xs">
          <Search className="h-3.5 w-3.5" /> Blocked keywords
        </Label>
        {config.blockedKeywords.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {config.blockedKeywords.map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                {k}
                <button
                  onClick={() => update({ blockedKeywords: config.blockedKeywords.filter((x) => x !== k) })}
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-3 flex gap-2">
          <Input
            placeholder="Keyword to block in browser"
            value={customKeyword}
            onChange={(e) => setCustomKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
          />
          <Button size="icon" onClick={addKeyword}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="text-[11px] text-muted-foreground">
          Phone, Dialer and Clock can never be blocked — emergency calls and your alarm always stay reachable.
        </p>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Ban className="h-3.5 w-3.5" />
        Blocking applies only inside the Sleep and Rise windows.
      </div>
    </div>
  );
}