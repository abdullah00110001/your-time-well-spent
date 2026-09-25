import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Search, Loader2, CheckCircle2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import ShieldPlugin, { type InstalledApp } from '@/lib/capacitor/shieldPlugin';
import { AppIconImage } from '@/components/shield/AppIconImage';

interface BlockAppsPageProps {
  onBack: () => void;
}

const STORAGE_KEY = 'shield_allowed_apps_v2';
const LEGACY_STORAGE_KEY = 'shield_blocked_apps_v2';

const isProtectedSystemPackage = (pkg: string) => {
  const normalized = pkg?.trim().toLowerCase();
  if (!normalized) return true;

  return normalized === 'android' || [
    'com.android.',
    'com.google.android.',
    'com.sec.android.',
    'com.miui.',
    'com.oneplus.',
    'com.samsung.',
    'com.huawei.',
  ].some(prefix => normalized.startsWith(prefix));
};

const sanitizePackages = (packages: string[]) =>
  Array.from(new Set((packages || []).filter(pkg => pkg && !isProtectedSystemPackage(pkg))));

export function BlockAppsPage({ onBack }: BlockAppsPageProps) {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        const initialAllowed = sanitizePackages(stored ? JSON.parse(stored) : []);
        setAllowed(new Set(initialAllowed));

        try {
          const native = await ShieldPlugin.getAllowedApps();
          const nextAllowed = sanitizePackages(native.apps || []);
          setAllowed(new Set(nextAllowed));
          localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAllowed));
        } catch {
          try {
            const legacy = await ShieldPlugin.getBlockedApps();
            const legacyAllowed = sanitizePackages(legacy.apps || []);
            if (legacyAllowed.length > 0) {
              setAllowed(new Set(legacyAllowed));
              localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyAllowed));
            }
          } catch {
            // old block-list state is ignored; allowlist is the source of truth
          }
        }

        try {
          const installed = await ShieldPlugin.getInstalledApps();
          setApps((installed.apps || []).filter(app => !isProtectedSystemPackage(app.packageName)));
        } catch (e) {
          console.error('getInstalledApps failed', e);
          const stats = await ShieldPlugin.getScreenTimeStats();
          setApps((stats.apps || [])
            .map(app => ({ packageName: app.packageName, appName: app.appName, isSystem: false }))
            .filter(app => !isProtectedSystemPackage(app.packageName)));
        }

        // Migration: allowlist wins, but stale blocked list is not reused to block apps.
        const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacy) {
          try {
            const parsed = JSON.parse(legacy);
            if (Array.isArray(parsed) && parsed.length > 0 && initialAllowed.length === 0) {
              localStorage.removeItem(LEGACY_STORAGE_KEY);
            }
          } catch {}
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
      .filter(app =>
        app.appName.toLowerCase().includes(lower) ||
        app.packageName.toLowerCase().includes(lower)
      )
      .sort((a, b) => {
        const aState = allowed.has(a.packageName) ? 0 : 1;
        const bState = allowed.has(b.packageName) ? 0 : 1;
        if (aState !== bState) return aState - bState;
        return a.appName.localeCompare(b.appName);
      });
  }, [apps, search, allowed]);

  const persist = async (next: Set<string>) => {
    const safeList = sanitizePackages(Array.from(next));
    const safeSet = new Set(safeList);
    setAllowed(safeSet);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeList));
    localStorage.removeItem(LEGACY_STORAGE_KEY);

    try {
      await ShieldPlugin.setAllowedApps({ apps: safeList });
    } catch (e) {
      console.error('setAllowedApps failed', e);
      try {
        await ShieldPlugin.blockApps({ apps: safeList });
      } catch (nativeError) {
        console.error('blockApps fallback failed', nativeError);
      }
      toast.error('Could not save allowlist to Shield service');
    }
  };

  const toggle = (packageName: string) => {
    if (isProtectedSystemPackage(packageName)) {
      toast.info('System apps stay allowed and cannot be removed from the allowlist.');
      return;
    }

    const next = new Set(allowed);
    if (next.has(packageName)) {
      next.delete(packageName);
      toast.info('Removed from allowed apps');
    } else {
      next.add(packageName);
      toast.success('Added to allowed apps');
    }
    void persist(next);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Allowed Apps</h1>
            <p className="text-xs text-muted-foreground">
              {allowed.size} app{allowed.size !== 1 && 's'} allowed
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
              const isAllowed = allowed.has(app.packageName);
              return (
                <Card
                  key={app.packageName}
                  className={isAllowed ? 'border-emerald-500/50 bg-emerald-500/5' : ''}
                >
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <AppIconImage icon={app.icon} appName={app.appName} />
                        {isAllowed && (
                          <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5">
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{app.appName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{app.packageName}</p>
                      </div>
                    </div>
                    <Switch
                      checked={isAllowed}
                      onCheckedChange={() => toggle(app.packageName)}
                      className="data-[state=checked]:bg-emerald-500"
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
