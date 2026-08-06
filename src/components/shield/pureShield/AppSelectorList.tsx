import { useMemo, useState } from 'react';
import { Search, Check, Sparkles, ListFilter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { InstalledAppItem } from './types';
import { RECOMMENDED_PACKAGES } from './storage';

interface AppSelectorListProps {
  apps: InstalledAppItem[];
  selectedApps: string[];
  onToggle: (pkg: string) => void;
  onSelectAll?: (pkgs: string[]) => void;
  onClearAll?: () => void;
  loading?: boolean;
  emptyHint?: string;
}

type Filter = 'all' | 'selected' | 'recommended';

export function AppSelectorList({
  apps,
  selectedApps,
  onToggle,
  onSelectAll,
  onClearAll,
  loading,
  emptyHint,
}: AppSelectorListProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // De-dupe by package name
  const dedup = useMemo(() => {
    const seen = new Set<string>();
    return apps.filter((a) => {
      if (seen.has(a.packageName)) return false;
      seen.add(a.packageName);
      return true;
    });
  }, [apps]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return dedup.filter((a) => {
      if (filter === 'selected' && !selectedApps.includes(a.packageName)) return false;
      if (filter === 'recommended' && !RECOMMENDED_PACKAGES.has(a.packageName)) return false;
      if (q && !a.appName.toLowerCase().includes(q) && !a.packageName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [dedup, query, filter, selectedApps]);

  const initials = (name: string) =>
    name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search installed apps..."
          className="pl-9 pr-9"
          aria-label="Search apps"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <ListFilter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {(['all', 'selected', 'recommended'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'px-3 py-1 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap',
              filter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border/60 text-muted-foreground hover:text-foreground',
            )}
          >
            {f === 'all' && `All (${dedup.length})`}
            {f === 'selected' && `Selected (${selectedApps.length})`}
            {f === 'recommended' && 'Recommended'}
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Showing {filtered.length} app{filtered.length === 1 ? '' : 's'}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => onSelectAll?.(filtered.map((a) => a.packageName))}
            disabled={!filtered.length}
          >
            Select all
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={onClearAll}
            disabled={!selectedApps.length}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 overflow-hidden divide-y divide-border/50">
        {loading && (
          <div className="p-6 text-center text-xs text-muted-foreground">Loading apps…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="p-8 text-center text-xs text-muted-foreground">
            {filter === 'selected' ? 'No apps selected yet — tap any app to add it.' : (emptyHint ?? 'No apps found.')}
          </div>
        )}
        {!loading &&
          filtered.map((app) => {
            const checked = selectedApps.includes(app.packageName);
            const recommended = RECOMMENDED_PACKAGES.has(app.packageName);
            return (
              <button
                key={app.packageName}
                type="button"
                onClick={() => onToggle(app.packageName)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 text-left transition-colors active:bg-muted/50',
                  checked && 'bg-primary/5',
                )}
              >
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/30 to-violet-500/30 flex items-center justify-center text-xs font-semibold shrink-0">
                  {initials(app.appName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    {app.appName}
                    {recommended && (
                      <Badge variant="outline" className="h-4 text-[9px] px-1.5 border-amber-500/40 text-amber-600 dark:text-amber-400">
                        <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                        REC
                      </Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">{app.packageName}</div>
                </div>
                <Checkbox checked={checked} aria-label={`Select ${app.appName}`} className="pointer-events-none" />
                {checked && <Check className="h-4 w-4 text-primary -ml-1" />}
              </button>
            );
          })}
      </div>
    </div>
  );
}

export default AppSelectorList;
