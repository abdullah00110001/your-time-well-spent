// Focus Shield V2.0 - Unique Light Ritual Design. No Blue. No Clone.
// Daily app limits — per-app minute budgets enforced natively
// (ShieldTimerManager reads real UsageStats and blocks once the budget is spent).

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { ArrowLeft, Search, Timer } from 'lucide-react';
import { toast } from 'sonner';
import ShieldPlugin, { type InstalledApp } from '@/lib/capacitor/shieldPlugin';
import { openUsageAccessSettings } from '@/utils/permissions';

const PRESETS = [0, 10, 15, 30, 45, 60, 90, 120];

export function DailyLimitsPage({ onBack }: { onBack: () => void }) {
  const [apps, setApps] = useState<InstalledApp[]>([]);
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [used, setUsed] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    ShieldPlugin.getInstalledApps()
      .then((r) => setApps(r.apps.filter((a) => !a.isSystem)))
      .catch(() => setApps([]));
    ShieldPlugin.getAppLimits()
      .then((r) => {
        setLimits(r.limits || {});
        setUsed(r.usedMinutes || {});
      })
      .catch(() => null);
  }, []);

  const setLimit = async (pkg: string, minutes: number) => {
    const previous = limits[pkg] ?? 0;
    setLimits((l) => ({ ...l, [pkg]: minutes }));
    try {
      await ShieldPlugin.setAppLimit({ packageName: pkg, minutes });
      toast.success(minutes > 0 ? `Limit set: ${minutes} min/day` : 'Limit removed');
    } catch (e: any) {
      setLimits((l) => ({ ...l, [pkg]: previous }));
      if (String(e?.message).includes('USAGE_STATS')) {
        toast.error('Usage Access permission is required');
        openUsageAccessSettings();
      } else {
        toast.error('Could not save limit');
      }
    }
  };

  const visible = apps.filter((a) =>
    a.appName.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0F0C0A] text-foreground pb-24">
      <header className="flex items-center gap-3 p-4 border-b border-[#FFD166]/10">
        <button onClick={onBack} aria-label="Back" className="p-2 -ml-2">
          <ArrowLeft className="h-5 w-5 text-[#FFD166]" />
        </button>
        <h1 className="text-base font-semibold">Daily Limits</h1>
      </header>

      <div className="p-4">
        <div className="flex items-center gap-2 px-3 h-11 rounded-xl bg-[#FFD166]/5 border border-[#FFD166]/10">
          <Search className="h-4 w-4 text-[#FFD166]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </div>
      </div>

      <div className="px-4 space-y-2">
        {visible.map((app) => {
          const limit = limits[app.packageName] ?? 0;
          const spent = used[app.packageName] ?? 0;
          return (
            <div
              key={app.packageName}
              className="p-4 rounded-2xl bg-[#FFD166]/5 border border-[#FFD166]/10"
            >
              <div className="flex items-center gap-3">
                <Timer className="h-4 w-4 text-[#FF8C42]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{app.appName}</p>
                  <p className="text-xs text-muted-foreground">
                    {limit > 0 ? `${spent}/${limit} min used today` : 'No limit'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setLimit(app.packageName, p)}
                    className={
                      'px-3 h-8 rounded-lg text-xs border transition-colors ' +
                      (limit === p
                        ? 'bg-[#FFD166] text-[#1A1410] border-[#FFD166]'
                        : 'border-[#FFD166]/20 text-[#FFD166]')
                    }
                  >
                    {p === 0 ? 'Off' : `${p}m`}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-10">No apps found.</p>
        )}
      </div>
    </div>
  );
}

export default DailyLimitsPage;
