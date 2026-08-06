import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Search, Smartphone, AlertTriangle, Loader2 } from 'lucide-react';
import ShieldPlugin from '@/lib/capacitor/shieldPlugin';
import { isNative } from '@/lib/capacitor/platform';
import { toast } from 'sonner';

interface AppInfo {
  packageName: string;
  appName: string;
  usageMinutes?: number;
}

interface ShieldBlockingProps {
  blockedApps?: string[];
  onToggleApp?: (pkgName: string) => Promise<void> | void;
}

export function ShieldBlocking({ blockedApps: blockedAppsProp, onToggleApp }: ShieldBlockingProps = {}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [blockedApps, setBlockedApps] = useState<string[]>(blockedAppsProp ?? []);
  const [recentApps, setRecentApps] = useState<AppInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (blockedAppsProp) {
      setBlockedApps(blockedAppsProp);
    }
  }, [blockedAppsProp]);

  useEffect(() => {
    const loadShieldData = async () => {
      if (!isNative) {
        setIsLoading(false);
        return;
      }

      try {
        if (!blockedAppsProp) {
          const { apps } = await ShieldPlugin.getBlockedApps();
          setBlockedApps(apps || []);
        }

        const stats = await ShieldPlugin.getScreenTimeStats();
        if (stats?.apps) {
          setRecentApps(
            stats.apps.map((app) => ({
              packageName: app.packageName,
              appName: app.appName,
              usageMinutes: app.usageMinutes,
            })),
          );
        }
      } catch (error) {
        console.error('Failed to load shield data', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadShieldData();
  }, [blockedAppsProp]);

  const toggleAppBlock = async (pkgName: string) => {
    try {
      if (onToggleApp) {
        await onToggleApp(pkgName);
        return;
      }

      let updatedList: string[];
      if (blockedApps.includes(pkgName)) {
        updatedList = blockedApps.filter((id) => id !== pkgName);
        toast.info(`${pkgName} removed from block list`);
      } else {
        updatedList = [...blockedApps, pkgName];
        toast.success(`${pkgName} is now blocked`);
      }

      await ShieldPlugin.blockApps({ apps: updatedList });
      setBlockedApps(updatedList);
    } catch (error) {
      console.error('Failed to update block list', error);
      toast.error('Failed to update block list');
    }
  };

  const filteredApps = recentApps.filter((app) =>
    app.appName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.packageName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/40">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Loading app list...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <Input
          placeholder="Search apps by name or package..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white/5 border-white/10 text-white h-12 rounded-xl focus:ring-indigo-500"
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white/60 px-1">Apps Used Today</h3>
        {filteredApps.length === 0 ? (
          <Card className="bg-white/5 border-white/10 border-dashed">
            <CardContent className="p-8 text-center text-white/40">
              <p>No apps found. Make sure you have usage access.</p>
            </CardContent>
          </Card>
        ) : (
          filteredApps.map((app) => (
            <Card key={app.packageName} className={`bg-white/5 border-white/10 transition-all ${blockedApps.includes(app.packageName) ? 'border-rose-500/50 bg-rose-500/5' : ''}`}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                    <Smartphone className="h-5 w-5 text-indigo-400" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{app.appName}</p>
                    <p className="text-[10px] text-white/30 truncate">{app.packageName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  {app.usageMinutes !== undefined && (
                    <span className="text-[10px] font-mono text-white/40">{app.usageMinutes}m</span>
                  )}
                  <Switch
                    checked={blockedApps.includes(app.packageName)}
                    onCheckedChange={() => toggleAppBlock(app.packageName)}
                    className="data-[state=checked]:bg-rose-500"
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {blockedApps.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3 mt-6">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/80 leading-relaxed">
            <strong>Shield is Active:</strong> You have {blockedApps.length} apps restricted.
            Accessibility service will block these apps as soon as they are launched.
          </div>
        </div>
      )}
    </div>
  );
}
