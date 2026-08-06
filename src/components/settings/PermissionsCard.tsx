import { useCallback, useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Bell, Clock, MapPin, Camera, ShieldCheck, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { showPermissionDeniedToast } from '@/lib/capacitor/openAppSettings';
import {
  canScheduleExactAlarms,
  openExactAlarmSettings,
} from '@/lib/capacitor/riseAlarmBridge';

type Status = 'granted' | 'denied' | 'prompt' | 'unknown';

interface Row {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  status: Status;
  onRequest: () => Promise<void>;
}

export default function PermissionsCard() {
  const { language } = useLanguage();
  const isNative = Capacitor.isNativePlatform();

  const [notif, setNotif] = useState<Status>('unknown');
  const [alarm, setAlarm] = useState<Status>('unknown');
  const [location, setLocation] = useState<Status>('unknown');
  const [camera, setCamera] = useState<Status>('unknown');

  const normalizeStatus = (value?: string | null): Status => {
    if (value === 'granted' || value === 'limited') return 'granted';
    if (value === 'denied') return 'denied';
    if (value === 'prompt' || value === 'prompt-with-rationale') return 'prompt';
    return 'unknown';
  };

  const refreshStatuses = useCallback(async () => {
    try {
      if (isNative) {
        const [{ LocalNotifications }, { PushNotifications }] = await Promise.all([
          import('@capacitor/local-notifications'),
          import('@capacitor/push-notifications'),
        ]);
        const [localPerm, pushPerm] = await Promise.all([
          LocalNotifications.checkPermissions(),
          PushNotifications.checkPermissions(),
        ]);
        const localStatus = normalizeStatus(localPerm.display);
        const pushStatus = normalizeStatus(pushPerm.receive);
        setNotif(
          localStatus === 'granted' && pushStatus === 'granted'
            ? 'granted'
            : localStatus === 'denied' || pushStatus === 'denied'
              ? 'denied'
              : localStatus === 'prompt' || pushStatus === 'prompt'
                ? 'prompt'
                : 'unknown'
        );
      } else if (typeof Notification !== 'undefined') {
        setNotif(normalizeStatus(Notification.permission));
      }
    } catch {
      setNotif('unknown');
    }

    try {
      const granted = await canScheduleExactAlarms();
      setAlarm(granted ? 'granted' : 'denied');
    } catch {
      setAlarm('unknown');
    }

    try {
      if (isNative) {
        const { Geolocation } = await import('@capacitor/geolocation');
        const g = await Geolocation.checkPermissions();
        setLocation(normalizeStatus(g.location));
      }
    } catch {
      setLocation('unknown');
    }

    try {
      if (isNative) {
        const { Camera: Cam } = await import('@capacitor/camera');
        const c = await Cam.checkPermissions();
        setCamera(normalizeStatus(c.camera));
      }
    } catch {
      setCamera('unknown');
    }
  }, [isNative]);

  // Initial status check (no requests, just reads)
  useEffect(() => {
    void refreshStatuses();

    if (!isNative) return;

    let remove: { remove: () => Promise<void> } | undefined;
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void refreshStatuses();
    }).then((listener) => {
      remove = listener;
    });

    return () => {
      void remove?.remove();
    };
  }, [isNative, refreshStatuses]);

  const t = (en: string, bn: string) => (language === 'bn' ? bn : en);

  const requestNotifications = async () => {
    try {
      if (isNative) {
        const [{ LocalNotifications }, { PushNotifications }] = await Promise.all([
          import('@capacitor/local-notifications'),
          import('@capacitor/push-notifications'),
        ]);
        const [localRes, pushRes] = await Promise.all([
          LocalNotifications.requestPermissions(),
          PushNotifications.requestPermissions(),
        ]);
        const nextStatus =
          normalizeStatus(localRes.display) === 'granted' && normalizeStatus(pushRes.receive) === 'granted'
            ? 'granted'
            : normalizeStatus(localRes.display) === 'denied' || normalizeStatus(pushRes.receive) === 'denied'
              ? 'denied'
              : 'prompt';
        setNotif(nextStatus);
        if (nextStatus === 'granted') toast.success(t('Notifications enabled', 'নোটিফিকেশন চালু'));
        else showPermissionDeniedToast({
          feature: t('Notifications', 'নোটিফিকেশন'),
          reason: t('Needed for daily reminders, alarms and wake signals.', 'প্রতিদিনের রিমাইন্ডার ও অ্যালার্মের জন্য প্রয়োজন।'),
        });
      } else if (typeof Notification !== 'undefined') {
        const r = await Notification.requestPermission();
        setNotif(normalizeStatus(r));
      }
      await refreshStatuses();
    } catch (e) {
      console.error('[Permissions] notifications failed', e);
      toast.error(t('Could not request permission', 'অনুমতি চাওয়া যায়নি'));
    }
  };

  const requestAlarm = async () => {
    try {
      if (!isNative) { toast.info(t('Only available on the Android app', 'শুধু অ্যান্ড্রয়েড অ্যাপে')); return; }
      // Open the system Exact-Alarm settings page (Android 12+)
      await openExactAlarmSettings();
      toast.info(t('Allow "Alarms & reminders" then return to the app', '"Alarms & reminders" অনুমতি দিন'));
      // Re-check after a short delay
      setTimeout(async () => {
        await refreshStatuses();
        const granted = await canScheduleExactAlarms();
        if (!granted) {
          showPermissionDeniedToast({
            feature: t('Exact alarms', 'এক্স্যাক্ট অ্যালার্ম'),
            reason: t('Rise alarms need Alarms & reminders access to fire exactly on time.', 'রাইজ অ্যালার্ম ঠিক সময়ে চালাতে এই অনুমতি দরকার।'),
          });
        }
      }, 1500);
    } catch (e) {
      console.error('[Permissions] alarm failed', e);
      toast.error(t('Could not open alarm settings', 'অ্যালার্ম সেটিংস খোলা যায়নি'));
    }
  };

  const requestLocation = async () => {
    try {
      if (!isNative) { toast.info(t('Only available on the Android app', 'শুধু অ্যান্ড্রয়েড অ্যাপে')); return; }
      const { Geolocation } = await import('@capacitor/geolocation');
      const res = await Geolocation.requestPermissions({ permissions: ['location'] });
      const nextStatus = normalizeStatus(res.location);
      setLocation(nextStatus);
      if (nextStatus === 'granted') toast.success(t('Location enabled', 'লোকেশন চালু'));
      else showPermissionDeniedToast({
        feature: t('Location', 'লোকেশন'),
        reason: t('Used to show your city in community wake feed and Fajr-time alarms.', 'কমিউনিটি ফিড ও ফজরের অ্যালার্মের জন্য।'),
      });
      await refreshStatuses();
    } catch (e) {
      console.error('[Permissions] location failed', e);
      toast.error(t('Could not request location', 'লোকেশন চাওয়া যায়নি'));
    }
  };

  const requestCamera = async () => {
    try {
      if (!isNative) { toast.info(t('Only available on the Android app', 'শুধু অ্যান্ড্রয়েড অ্যাপে')); return; }
      const { Camera: Cam } = await import('@capacitor/camera');
      const res = await Cam.requestPermissions({ permissions: ['camera'] });
      const nextStatus = normalizeStatus(res.camera);
      setCamera(nextStatus);
      if (nextStatus === 'granted') toast.success(t('Camera enabled', 'ক্যামেরা চালু'));
      else showPermissionDeniedToast({
        feature: t('Camera', 'ক্যামেরা'),
        reason: t('Needed for wake-up photo missions and journal photos.', 'ওয়েক-আপ ফটো ও জার্নাল ছবির জন্য।'),
      });
      await refreshStatuses();
    } catch (e) {
      console.error('[Permissions] camera failed', e);
      toast.error(t('Could not request camera', 'ক্যামেরা চাওয়া যায়নি'));
    }
  };

  const rows: Row[] = [
    {
      key: 'notif',
      label: t('Notifications', 'নোটিফিকেশন'),
      description: t('Daily reminders, prayer alerts, alarms', 'প্রতিদিনের রিমাইন্ডার ও অ্যালার্ম'),
      icon: <Bell className="h-4 w-4" />,
      status: notif, onRequest: requestNotifications,
    },
    {
      key: 'alarm',
      label: t('Exact Alarms', 'এক্স্যাক্ট অ্যালার্ম'),
      description: t('Required for Rise wake-up alarms (Android 12+)', 'রাইজ অ্যালার্মের জন্য (Android 12+)'),
      icon: <Clock className="h-4 w-4" />,
      status: alarm, onRequest: requestAlarm,
    },
    {
      key: 'location',
      label: t('Location', 'লোকেশন'),
      description: t('Community feed city + Fajr-time alarm', 'কমিউনিটি ও ফজর সময়'),
      icon: <MapPin className="h-4 w-4" />,
      status: location, onRequest: requestLocation,
    },
    {
      key: 'camera',
      label: t('Camera', 'ক্যামেরা'),
      description: t('Wake-up photo missions, journal photos', 'ওয়েক-আপ ফটো ও জার্নাল'),
      icon: <Camera className="h-4 w-4" />,
      status: camera, onRequest: requestCamera,
    },
  ];

  const badge = (s: Status) => {
    if (s === 'granted') return <Badge variant="secondary" className="bg-primary/15 text-primary">{t('Granted', 'চালু')}</Badge>;
    if (s === 'denied') return <Badge variant="destructive">{t('Denied', 'অস্বীকৃত')}</Badge>;
    if (s === 'prompt') return <Badge variant="outline">{t('Not set', 'সেট নেই')}</Badge>;
    return <Badge variant="outline">{t('Unknown', '—')}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-subtitle flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          {t('Permissions', 'অনুমতি')}
        </CardTitle>
        <CardDescription className="text-caption">
          {t('Tap to grant. All requests are opt-in and only happen when you tap.', 'অনুমতি দিতে ট্যাপ করুন।')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isNative && (
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{t('Most permissions only apply inside the Android app.', 'অধিকাংশ অনুমতি অ্যান্ড্রয়েড অ্যাপে কাজ করে।')}</span>
          </div>
        )}
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5 text-muted-foreground">{r.icon}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium">{r.label}</p>
                  {badge(r.status)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
              </div>
            </div>
            <Button size="sm" variant={r.status === 'granted' ? 'outline' : 'default'} onClick={r.onRequest}>
              {r.status === 'granted' ? t('Manage', 'ব্যবস্থাপনা') : t('Grant', 'অনুমতি')}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
