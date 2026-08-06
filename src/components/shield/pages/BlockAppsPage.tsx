import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Loader2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ShieldPlugin, { type InstalledApp } from '@/lib/capacitor/shieldPlugin';

interface BlockAppsPageProps {
  onBack: () => void;
}

const STORAGE_KEY = 'shield_blocked_apps_v2';

function AppIcon({ packageName, appName }: { packageName: string; appName: string }) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <span className="text-sm font-bold text-primary">
          {appName.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={`https://play-lh.googleusercontent.com/icon?id=${packageName}`}
      alt={appName}
      className="h-10 w-10 rounded-xl object-cover shrink-0"
      onError={() => setError(true)}
    />
  );
}

export function BlockAppsPage({ onBack }: BlockAppsPageProps) {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const initialBlocked: string[] = stored ? JSON.parse(stored) : [];
        setBlocked(new Set(initialBlocked));

        try {
          const native = await ShieldPlugin.getBlockedApps();
          if (native.apps?.length) {
            setBlocked(new Set(native.apps));
          }
        } catch {/* fall through */}

        try {
          const installed = await ShieldPlugin.getInstalledApps();
          setApps(installed.apps || []);
        } catch (e) {
          console.error('getInstalledApps failed', e);
          const stats = await ShieldPlugin.getScreenTimeStats();
          setApps((stats.apps || []).map(a => ({
            packageName: a.packageName,
            appName: a.appName,
            isSystem: false,
          })));
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const sortedFiltered = useMemo(() => {
    const lower = search.toLowerCase();
    return apps
      .filter(a =>
        a.appName.toLowerCase().includes(lower) ||
        a.packageName.toLowerCase().includes(lower)
      )
      .sort((a, b) => {
        const aB = blocked.has(a.packageName) ? 0 : 1;
        const bB = blocked.has(b.packageName) ? 0 : 1;
        if (aB !== bB) return aB - bB;
        return a.appName.localeCompare(b.appName);
      });
  }, [apps, search, blocked]);

  const persist = async (next: Set<string>) => {
    setBlocked(new Set(next));
    const list = Array.from(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    try {
      await ShieldPlugin.blockApps({ apps: list });
    } catch (e) {
      console.error('blockApps failed', e);
      toast.error('Could not save to Shield service');
    }
  };

  const toggle = (pkg: string) => {
    const next = new Set(blocked);
    if (next.has(pkg)) {
      next.delete(pkg);
      toast.info('Unblocked');
    } else {
      next.add(pkg);
      toast.success('Blocked');
    }
    persist(next);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Block Apps</h1>
            <p className="text-xs text-muted-foreground">
              {blocked.size} app{blocked.size !== 1 && 's'} blocked
            </p>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search apps…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11 rounded-xl"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin mb-3" />
          <p>Loading apps…</p>
        </div>
      ) : (
        <div className="px-4 py-3 space-y-2">
          {sortedFiltered.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground">
                No apps match your search.
              </CardContent>
            </Card>
          ) : (
            sortedFiltered.map(app => {
              const isBlocked = blocked.has(app.packageName);
              return (
                <Card
                  key={app.packageName}
                  className={isBlocked ? 'border-rose-500/50 bg-rose-500/5' : ''}
                >
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <AppIcon
                          packageName={app.packageName}
                          appName={app.appName}
                        />
                        {isBlocked && (
                          <div className="absolute -top-1 -right-1 bg-rose-500 rounded-full p-0.5">
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{app.appName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {app.packageName}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={isBlocked}
                      onCheckedChange={() => toggle(app.packageName)}
                      className="data-[state=checked]:bg-rose-500"
                    />
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}