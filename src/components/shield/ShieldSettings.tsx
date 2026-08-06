import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Ban, Clock, Columns, Power, AppWindow, AlertTriangle, 
  KeyRound, Timer, Lock, Vibrate, Volume2, Eye,
  Trash2, Database, RefreshCw, Zap, BellRing, 
  ShieldCheck, CheckCircle2, XCircle, Bell, ChevronRight,
  ShieldAlert, Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { openAccessibilitySettings, openDeviceAdminSettings, openUsageAccessSettings } from '@/utils/permissions';
import { Capacitor } from '@capacitor/core';
import ShieldPlugin from '@/lib/capacitor/shieldPlugin';
import { PureShieldCard } from '@/components/shield/pureShield/PureShieldCard';
import { usePureShield } from '@/hooks/usePureShield';
import { toast } from 'sonner';

interface SettingItem {
  icon: any;
  title: string;
  description: string;
  hasArrow?: boolean;
  hasToggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (value: boolean) => void;
  onClick?: () => void;
  isPremium?: boolean;
  iconColor?: string;
  iconBg?: string;
  status?: 'granted' | 'denied';
  showGreenDot?: boolean; 
}

interface ShieldSettingsProps {
  settings: {
    pauseDurationEnabled: boolean;
    blockSplitScreen: boolean;
    blockPowerOff: boolean;
    blockRecentApps: boolean;
    preventUninstall: boolean;
    lowTimeAlert: boolean;
    pomodoroBreak: boolean;
    floatingTimer: boolean;
  };
  onSettingChange: (key: string, value: boolean) => void;
  onNavigate: (page: string) => void;
}

export function ShieldSettings({ settings, onSettingChange, onNavigate }: ShieldSettingsProps) {
  const { running: pureShieldRunning } = usePureShield();
  const [permissionStatus, setPermissionStatus] = useState({
    accessibility: false,
    usageStats: false,
    deviceAdmin: false,
    batteryOptimization: false,
  });

  useEffect(() => {
    checkPermissionStatus();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkPermissionStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  const checkPermissionStatus = async () => {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
      const perms = await ShieldPlugin.checkPermissions();
      setPermissionStatus({
        accessibility: !!perms.accessibility,
        usageStats: !!perms.usageStats,
        deviceAdmin: !!perms.deviceAdmin,
        batteryOptimization: !!perms.battery,
      });
    } catch (e) {
      console.warn('[ShieldSettings] checkPermissions failed:', e);
    }
  };

  const handleOpenBatterySettings = async () => {
    if (Capacitor.getPlatform() !== 'android') return;
    try {
      await ShieldPlugin.requestBattery();
    } catch (e) {
      console.error('[ShieldSettings] requestBattery failed:', e);
    }
  };

  const handleToggleHardcore = async (key: string, value: boolean) => {
    try {
      onSettingChange(key, value);
      if (Capacitor.getPlatform() === 'android') {
        await ShieldPlugin.updateHardcoreSettings({ key, value });
        if (value) toast.success(`${key.replace('block', 'Block ')} Enabled 🔒`);
      }
    } catch (e) {
      onSettingChange(key, !value);
      toast.error('Failed to update setting. Please check permissions.');
    }
  };

  const handleToggleUninstall = async (value: boolean) => {
    if (value && !permissionStatus.deviceAdmin) {
      toast.info('Please enable Device Admin permission first.');
      openDeviceAdminSettings();
      return;
    }
    try {
      onSettingChange('preventUninstall', value);
      if (Capacitor.getPlatform() === 'android') {
        await ShieldPlugin.updateHardcoreSettings({ key: 'preventUninstall', value });
        if (value) toast.success('Uninstall Prevention Enabled 🛡️');
      }
    } catch (e) {
      onSettingChange('preventUninstall', !value);
      toast.error('Failed to enable Uninstall Protection.');
    }
  };

  // ─── Blocking Settings ───────────────────────────────────────────────────
  const blockingSettings: SettingItem[] = [
    {
      icon: Ban,
      title: 'Block Screen Style',
      description: 'Choose what appears when apps are blocked',
      hasArrow: true,
      onClick: () => onNavigate('block-screen'),
      iconColor: 'text-rose-500',
      iconBg: 'bg-rose-500/10',
    },
    {
      icon: ShieldCheck,
      title: 'Adult Filter',
      description: permissionStatus.accessibility
        ? 'Active — All 18+ sites are blocked'
        : 'Tap to configure Adult Filter settings', // 👈 ডেসক্রিপশন ফিক্স করা হয়েছে
      hasArrow: true,
      hasToggle: false,
      onClick: () => onNavigate('adult-filter'), // 👈 সরাসরি নেভিগেশন কল
      iconColor: permissionStatus.accessibility ? 'text-green-500' : 'text-rose-500',
      iconBg: permissionStatus.accessibility ? 'bg-green-500/10' : 'bg-rose-500/10',
      showGreenDot: permissionStatus.accessibility,
    },
    {
      icon: Activity,
      title: 'Floating Timer',
      description: settings.floatingTimer
        ? 'On — tap to configure style, size, opacity'
        : 'Always-on session overlay (off)',
      hasToggle: true,
      toggleValue: settings.floatingTimer,
      onToggle: (v) => onSettingChange('floatingTimer', v),
      onClick: () => onNavigate('floating-timer'),
      iconColor: 'text-teal-500',
      iconBg: 'bg-teal-500/10',
    },
    {
      icon: Columns,
      title: 'Block Split Screen',
      description: 'Prevent multitasking to stay focused',
      hasToggle: true,
      toggleValue: settings.blockSplitScreen,
      onToggle: (v) => handleToggleHardcore('blockSplitScreen', v),
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
    },
    {
      icon: Power,
      title: 'Block Power Off',
      description: 'Best-effort prevent shutdown during focus',
      hasToggle: true,
      toggleValue: settings.blockPowerOff,
      onToggle: (v) => handleToggleHardcore('blockPowerOff', v),
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-500/10',
    },
    {
      icon: AppWindow,
      title: 'Block Recent Apps',
      description: 'Auto-close recents while focused',
      hasToggle: true,
      toggleValue: settings.blockRecentApps,
      onToggle: (v) => handleToggleHardcore('blockRecentApps', v),
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-500/10',
    },
    {
      icon: Lock,
      title: 'Prevent Uninstall',
      description: 'Requires Device Admin permission',
      hasToggle: true,
      toggleValue: settings.preventUninstall,
      onToggle: (v) => handleToggleUninstall(v),
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10',
    },
  ];

  const timerSettings: SettingItem[] = [
    {
      icon: Clock,
      title: 'Start of Day',
      description: 'Set when your day resets (default: midnight)',
      hasArrow: true,
      iconColor: 'text-sky-500',
      iconBg: 'bg-sky-500/10',
    },
    {
      icon: Timer,
      title: 'Pause Duration',
      description: 'Skip duration selection when pausing',
      hasToggle: true,
      toggleValue: settings.pauseDurationEnabled,
      onToggle: (value) => onSettingChange('pauseDurationEnabled', value),
      iconColor: 'text-teal-500',
      iconBg: 'bg-teal-500/10',
    },
    {
      icon: AlertTriangle,
      title: 'Low Time Alert',
      description: 'Get alerts when time limit is running out',
      hasToggle: true,
      toggleValue: settings.lowTimeAlert,
      onToggle: (value) => onSettingChange('lowTimeAlert', value),
      iconColor: 'text-amber-500',
      iconBg: 'bg-amber-500/10',
    },
    {
      icon: BellRing,
      title: 'Pomodoro Breaks',
      description: "Notify when it's time to take a break",
      hasToggle: true,
      toggleValue: settings.pomodoroBreak,
      onToggle: (value) => onSettingChange('pomodoroBreak', value),
      iconColor: 'text-green-500',
      iconBg: 'bg-green-500/10',
    },
    {
      icon: RefreshCw,
      title: 'Auto-Reset Daily',
      description: 'Automatically reset limits each day',
      hasToggle: true,
      toggleValue: true,
      iconColor: 'text-indigo-500',
      iconBg: 'bg-indigo-500/10',
    },
  ];

  const notificationSettings: SettingItem[] = [
    {
      icon: Bell,
      title: 'Push Notifications',
      description: 'Receive focus reminders and alerts',
      hasToggle: true,
      toggleValue: true,
      iconColor: 'text-pink-500',
      iconBg: 'bg-pink-500/10',
    },
    {
      icon: Vibrate,
      title: 'Vibration Alerts',
      description: 'Vibrate when blocking apps',
      hasToggle: true,
      toggleValue: true,
      iconColor: 'text-violet-500',
      iconBg: 'bg-violet-500/10',
    },
    {
      icon: Volume2,
      title: 'Sound Effects',
      description: 'Play sound when sessions start/end',
      hasToggle: true,
      toggleValue: false,
      iconColor: 'text-cyan-500',
      iconBg: 'bg-cyan-500/10',
    },
  ];

  const advancedSettings: SettingItem[] = [
    {
      icon: ShieldCheck,
      title: 'Device Admin',
      description: permissionStatus.deviceAdmin ? 'Enabled - Protection Active' : 'Tap to enable advanced protection',
      hasArrow: true,
      onClick: openDeviceAdminSettings,
      iconColor: 'text-green-600',
      iconBg: 'bg-green-600/10',
      status: permissionStatus.deviceAdmin ? 'granted' : 'denied',
    },
    {
      icon: KeyRound,
      title: 'Emergency Bypass',
      description: 'Configure emergency access options',
      hasArrow: true,
      onClick: async () => {
        const pin = window.prompt("Enter your 4-digit Emergency PIN:");
        if (!pin) return;
        try {
          const res = await ShieldPlugin.triggerEmergencyBypass({ pin });
          if (res.success) {
            toast.success("Bypass Activated! All restrictions lifted. 🔓");
          }
        } catch (e: any) {
          toast.error(e.message || "Incorrect PIN!");
        }
      },
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10',
    },
    {
      icon: Eye,
      title: 'Accessibility Service',
      description: permissionStatus.accessibility ? 'Enabled - Blocking apps works' : 'Tap to enable - Required for app blocking',
      hasArrow: true,
      onClick: openAccessibilitySettings,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/10',
      status: permissionStatus.accessibility ? 'granted' : 'denied',
    },
    {
      icon: Zap,
      title: 'Battery Optimization',
      description: permissionStatus.batteryOptimization ? 'Disabled - App runs in background' : 'Tap to disable for reliable blocking',
      hasArrow: true,
      onClick: handleOpenBatterySettings,
      iconColor: 'text-yellow-500',
      iconBg: 'bg-yellow-500/10',
      status: permissionStatus.batteryOptimization ? 'granted' : 'denied',
    },
  ];

  const dataSettings: SettingItem[] = [
    {
      icon: Database,
      title: 'Usage Statistics',
      description: permissionStatus.usageStats ? 'Enabled - Tracking Active' : 'Tap to enable app usage tracking',
      hasArrow: true,
      onClick: openUsageAccessSettings,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-500/10',
      status: permissionStatus.usageStats ? 'granted' : 'denied',
    },
    {
      icon: Trash2,
      title: 'Clear History',
      description: 'Delete all usage data',
      hasArrow: true,
      onClick: async () => {
        const confirm = window.confirm("Are you sure you want to clear all usage statistics? This cannot be undone.");
        if (confirm) {
          try {
            await ShieldPlugin.clearHistory();
            toast.success("History cleared successfully! 🗑️");
          } catch (e) {
            toast.error("Failed to clear history.");
          }
        }
      },
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/10',
    },
  ];

  const dangerZoneSettings: SettingItem[] = [
    {
      icon: ShieldAlert,
      title: 'Safe Uninstall',
      description: 'Deactivate protection and uninstall Focus Shield',
      hasArrow: true,
      onClick: async () => {
        const isStrict = settings.preventUninstall && permissionStatus.deviceAdmin;
        const message = isStrict
          ? "Warning: Protection is active. You must deactivate settings before uninstalling. Proceed anyway?"
          : "Are you sure you want to uninstall Focus Shield? All your settings will be lost.";
        const confirm = window.confirm(message);
        if (confirm) {
          try {
            toast.loading("Deactivating and preparing for uninstall...");
            await ShieldPlugin.requestUninstall();
          } catch (e: any) {
            toast.error(e.message || "Uninstall failed. Check if a focus session is active.");
          }
        }
      },
      iconColor: 'text-red-600',
      iconBg: 'bg-red-600/10',
    },
  ];

  // ─── Render Item ─────────────────────────────────────────────────────────
  const renderSettingItem = (item: SettingItem, index: number, isLast: boolean) => (
    <div
      key={index}
      className={cn(
        'flex items-center gap-4 p-4 cursor-pointer active:bg-muted/50 transition-colors select-none',
        !isLast && 'border-b border-border/50'
      )}
      onClick={(e) => {
        // যদি আইটেমে onClick থাকে, তবে সেটা ফায়ার করবে
        if (item.onClick) {
          item.onClick();
        }
      }}
    >
      <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", item.iconBg || 'bg-muted')}>
        <item.icon className={cn("h-5 w-5", item.iconColor || 'text-muted-foreground')} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm">{item.title}</h3>
          {item.isPremium && (
            <Badge variant="secondary" className="text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0">
              PRO
            </Badge>
          )}
          {item.showGreenDot && (
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
          )}
          {!item.showGreenDot && item.status === 'granted' && (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
          {!item.showGreenDot && item.status === 'denied' && (
            <XCircle className="h-4 w-4 text-red-500" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
          {item.description}
        </p>
      </div>
      {item.hasArrow && (
        <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
      )}
      {item.hasToggle && (
        <Switch
          checked={item.toggleValue}
          onCheckedChange={item.onToggle}
          onClick={(e) => e.stopPropagation()} // টগল ক্লিকের সময় যাতে মেইন ডিভের onClick রান না হয়
          className="shrink-0 data-[state=checked]:bg-primary"
        />
      )}
    </div>
  );

  const renderSection = (title: string, items: SettingItem[]) => (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <h2 className="font-semibold text-xs text-muted-foreground mb-2 px-1 uppercase tracking-wider">{title}</h2>
      <Card className="overflow-hidden border-border/50 shadow-sm">
        <CardContent className="p-0">
          {items.map((item, index) => renderSettingItem(item, index, index === items.length - 1))}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6 pb-4">
      <PureShieldCard isActive={pureShieldRunning} onClick={() => onNavigate('pure-shield')} />
      {renderSection('Blocking', blockingSettings)}
      {renderSection('Timer & Alerts', timerSettings)}
      {renderSection('Notifications', notificationSettings)}
      {renderSection('Advanced Protection', advancedSettings)}
      {renderSection('Data & Privacy', dataSettings)}
      {renderSection('Danger Zone', dangerZoneSettings)}
    </div>
  );
}
