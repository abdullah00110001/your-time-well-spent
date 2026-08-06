import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, AlertCircle, Bell, AlarmClock, Eye, BatteryCharging, Activity, ShieldCheck } from 'lucide-react';
import { isAndroid, isNative } from '@/lib/capacitor/platform';
import {
  checkNotificationPermission,
  requestNotificationPermission,
  checkExactAlarmPermission,
  requestExactAlarmPermission,
  checkUsageStatsPermission,
  requestUsageStatsPermission,
  checkOverlayPermission,
  requestOverlayPermission,
  checkBatteryPermission,
  requestBatteryPermission,
  checkAccessibilityPermission,
  requestAccessibilityPermission,
  checkDeviceAdminPermission,
  requestDeviceAdminPermission,
  type PermissionStatus,
} from '@/lib/capacitor/permissions';

type FeatureSet = 'rise' | 'shield';

interface PermissionItem {
  key: string;
  title: string;
  description: string;
  icon: typeof Bell;
  status: PermissionStatus;
  request: () => Promise<PermissionStatus>;
}

interface Props {
  open: boolean;
  onClose: () => void;
  feature: FeatureSet;
}

export function PermissionOnboarding({ open, onClose, feature }: Props) {
  const [items, setItems] = useState<PermissionItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const buildItems = async (): Promise<PermissionItem[]> => {
    const list: PermissionItem[] = [
      {
        key: 'notifications',
        title: 'Notifications',
        description: 'Show alarm and reminder notifications',
        icon: Bell,
        status: await checkNotificationPermission(),
        request: requestNotificationPermission,
      },
    ];

    if (feature === 'rise') {
      list.push({
        key: 'exactAlarm',
        title: 'Exact Alarms',
        description: 'Required so alarms ring on time, even on locked screen',
        icon: AlarmClock,
        status: await checkExactAlarmPermission(),
        request: requestExactAlarmPermission,
      });
    }

    if (feature === 'shield') {
      list.push(
        {
          key: 'usageStats',
          title: 'Usage Access',
          description: 'Required to read screen-time and detect blocked apps',
          icon: Activity,
          status: await checkUsageStatsPermission(),
          request: requestUsageStatsPermission,
        },
        {
          key: 'overlay',
          title: 'Display Over Other Apps',
          description: 'Required to show the block screen over distracting apps',
          icon: Eye,
          status: await checkOverlayPermission(),
          request: requestOverlayPermission,
        },
        {
          key: 'accessibility',
          title: 'Accessibility',
          description: 'Required to detect when blocked apps open',
          icon: Activity,
          status: await checkAccessibilityPermission(),
          request: requestAccessibilityPermission,
        },
        // 🟢 Device Admin — DNS lock + Adult Filter + uninstall prevention
        {
          key: 'deviceAdmin',
          title: 'Device Admin',
          description: 'Locks DNS filter for adult content blocking and prevents uninstall',
          icon: ShieldCheck,
          status: await checkDeviceAdminPermission(),
          request: requestDeviceAdminPermission,
        },
      );
    }

    list.push({
      key: 'battery',
      title: 'Ignore Battery Optimization',
      description: 'Keeps Shield/Rise running in the background reliably',
      icon: BatteryCharging,
      status: await checkBatteryPermission(),
      request: requestBatteryPermission,
    });

    return list;
  };

  const refresh = async () => {
    setRefreshing(true);
    setItems(await buildItems());
    setRefreshing(false);
  };

  useEffect(() => {
    if (!open) return;
    refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, feature]);

  if (!isNative || !isAndroid) {
    return null;
  }

  const handleGrant = async (item: PermissionItem) => {
    await item.request();
    // Settings opens externally — refresh on visibility change
  };

  const allGranted = items.length > 0 && items.every((i) => i.status === 'granted');

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] p-0 rounded-t-3xl">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle>
            {feature === 'rise' ? 'Set up Rise alarms' : 'Set up Shield blocking'}
          </SheetTitle>
          <p className="text-sm text-muted-foreground text-left">
            Android needs you to enable each permission from system settings. Tap a row to open it.
          </p>
        </SheetHeader>

        <div className="p-4 space-y-3 overflow-y-auto h-[calc(90vh-160px)]">
          {items.map((item) => {
            const Icon = item.icon;
            const granted = item.status === 'granted';
            return (
              <Card key={item.key} className={granted ? 'border-emerald-500/40' : ''}>
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.title}</p>
                      {granted ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={granted ? 'outline' : 'default'}
                    onClick={() => handleGrant(item)}
                    disabled={granted}
                  >
                    {granted ? 'Done' : 'Allow'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="p-4 border-t border-border flex gap-2">
          <Button variant="outline" className="flex-1" onClick={refresh} disabled={refreshing}>
            Refresh status
          </Button>
          <Button className="flex-1" onClick={onClose}>
            {allGranted ? 'Done' : 'Continue'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
