import { useState, useEffect, useRef } from 'react';
import { readLocalAlarms, writeLocalAlarms } from '@/lib/rise/localAlarms';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sunrise } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RiseBottomNav } from '@/components/rise/RiseBottomNav';
import { RiseHeader } from '@/components/rise/RiseHeader';
import { RiseAlarmCard } from '@/components/rise/RiseAlarmCard';
import { NextAlarmRing } from '@/components/rise/NextAlarmRing';
import { AscentRail, AscentNode } from '@/components/rise/ascent/AscentRail';
import { ThermalDrift } from '@/components/rise/ascent/ThermalDrift';
import { missionLabel } from '@/lib/rise/missionLabel';
import { RiseAlarmEditor } from '@/components/rise/RiseAlarmEditor';
import { RiseReports } from '@/components/rise/RiseReports';
import { RiseSettings } from '@/components/rise/RiseSettings';
import CommunityWakeFeed from '@/components/rise/CommunityWakeFeed';
import { LifeosGroupsHome } from '@/components/groups/LifeosGroupsHome';
import { Card, CardContent } from '@/components/ui/card';
import { scheduleRecurringAlarm, cancelAlarmByUuid, initializeAlarmChannel } from '@/lib/capacitor/nativeAlarm';
import { cancelNativeAlarmShots, canScheduleExactAlarms } from '@/lib/capacitor/riseAlarmBridge';
import { isNative } from '@/lib/capacitor/platform';
import { App } from '@capacitor/app';
// import { LocalNotifications } from '@capacitor/local-notifications';

// � New Imports for Sequential Permissions
import {
  getAllPermissions,
  requestNotificationPermission,
  requestExactAlarmPermission,
  requestOverlayPermission,
  requestBatteryPermission
} from '@/lib/capacitor/permissions';

interface RiseAlarm {
  id: string;
  alarm_time: string;
  days_of_week: number[];
  alarm_type: string;
  is_enabled: boolean;
  intention: string | null;
  label: string | null;
  verification_type: string;
  snooze_limit: number;
  snooze_interval_minutes?: number;
  sound_type?: string;
  vibration_enabled?: boolean;
  ringtone_url?: string | null;
  ringtone_name?: string | null;
}

interface RiseStreak {
  current_streak: number;
  longest_streak: number;
  total_on_time_wakes: number;
  total_alarms: number;
  is_recovery_mode: boolean;
}

// � Permission Interface
interface RisePermissionStatus {
  notifications: boolean;
  exactAlarm: boolean;
  overlay: boolean;
  battery: boolean;
}

export default function RisePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('alarms');
  const [alarms, setAlarms] = useState<RiseAlarm[]>([]);
  const [streak, setStreak] = useState<RiseStreak | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nextAlarm, setNextAlarm] = useState<
    { time: string; countdown: string; progress: number; alarm: RiseAlarm } | null
  >(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<RiseAlarm | null>(null);
  const [backFlash, setBackFlash] = useState(false);
  const [railSweep, setRailSweep] = useState(false);


  // � Permission State
  const [permissions, setPermissions] = useState<RisePermissionStatus>({
    notifications: true,
    exactAlarm: true,
    overlay: true,
    battery: true,
  });

  // Intercept Android hardware back button: do NOT navigate; flash header back button red.
  useEffect(() => {
    if (!isNative) return;
    let cleanup: (() => void) | undefined;
    let flashTimer: ReturnType<typeof setTimeout> | undefined;

    const handlerPromise = App.addListener('backButton', () => {
      setBackFlash(true);
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => setBackFlash(false), 600);
      // Intentionally do not call App.exitApp() or history.back() — back is suppressed.
    });

    handlerPromise.then((h) => {
      cleanup = () => h.remove();
    });

    return () => {
      if (flashTimer) clearTimeout(flashTimer);
      cleanup?.();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    loadRiseData();
    if (!isNative) return;

    initializeAlarmChannel(); // Initialize channel silently
    verifyPermissions();

    // Auto-verify when returning from settings.
    // `cancelled` guard: without it a fast unmount/remount (StrictMode double
    // invoke) could remove a newer listener or leak the old one.
    let cancelled = false;
    let handle: { remove: () => void } | null = null;
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) verifyPermissions();
    }).then((l) => {
      if (cancelled) { l.remove(); return; }
      handle = l;
    });

    return () => {
      cancelled = true;
      handle?.remove();
    };
  }, [user]);


  // � Function to verify all permissions
  const verifyPermissions = async () => {
    try {
      const status = await getAllPermissions();
      setPermissions({
        notifications: status.notifications === 'granted',
        exactAlarm: status.exactAlarm === 'granted',
        overlay: status.overlay === 'granted',
        battery: status.battery === 'granted'
      });
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  // Keep the "next alarm" label fresh without tearing the interval down on
  // every alarm mutation: the interval is created once and reads the latest
  // callback through a ref.
  const updateNextAlarmRef = useRef<() => void>(() => {});
  useEffect(() => {
    updateNextAlarmRef.current = updateNextAlarm;
    updateNextAlarm();
  });
  useEffect(() => {
    const interval = setInterval(() => updateNextAlarmRef.current(), 60000);
    return () => clearInterval(interval);
  }, []);

  const loadLocalAlarms = (): RiseAlarm[] => {
    return readLocalAlarms().map((a: any) => ({
      // Spread first so alarm-specific extras (mission_config, extra_loud,
      // wallpaper_url, groupId…) survive a round-trip through this screen.
      ...a,
      id: a.id,
      alarm_time: a.alarm_time,
      days_of_week: a.days_of_week || [],
      alarm_type: a.alarm_type || 'personal',
      is_enabled: a.is_enabled !== false,
      intention: a.intention || null,
      label: a.label || null,
      verification_type: a.verification_type || 'math',
      snooze_limit: a.snooze_limit ?? 3,
      snooze_interval_minutes: a.snooze_interval_minutes ?? 5,
      sound_type: a.sound_type || 'default',
      vibration_enabled: a.vibration_enabled ?? true,
      // ✅ Persist user-selected ringtone across sessions
      ringtone_url: a.ringtone_url ?? null,
      ringtone_name: a.ringtone_name ?? null,
    })) as RiseAlarm[];
  };

  const saveLocalAlarms = (list: RiseAlarm[]) => {
    // Merge over the stored records so fields this screen doesn't model are
    // never dropped.
    const stored = readLocalAlarms();
    const byId = new Map<string, any>(stored.map((a: any) => [String(a?.id), a] as [string, any]));
    writeLocalAlarms(list.map((a: any) => ({ ...(byId.get(String(a.id)) || {}), ...a })));
  };


  const loadRiseData = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      let { data: streakData } = await supabase
       .from('rise_streaks')
       .select('*')
       .eq('user_id', user.id)
       .single();
      if (!streakData) {
        const { data: newStreak } = await supabase
         .from('rise_streaks')
         .insert({ user_id: user.id })
         .select()
         .single();
        streakData = newStreak;
      }
      const local = loadLocalAlarms();
      setAlarms(local.sort((a, b) => a.alarm_time.localeCompare(b.alarm_time)));
      setStreak(streakData);
    } catch (error) {
      console.error('Error loading rise data:', error);
      setAlarms(loadLocalAlarms());
    } finally {
      setIsLoading(false);
    }
  };

  const updateNextAlarm = () => {
    const enabledAlarms = alarms.filter(a => a.is_enabled);
    if (enabledAlarms.length === 0) {
      setNextAlarm(null);
      return;
    }
    const now = new Date();
    const today = now.getDay();
    let closestAlarm: { alarm: RiseAlarm; date: Date } | null = null;
    enabledAlarms.forEach(alarm => {
      const [hours, minutes] = alarm.alarm_time.split(':').map(Number);
      for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
        const checkDay = (today + dayOffset) % 7;
        if (alarm.days_of_week.includes(checkDay)) {
          const alarmDate = new Date(now);
          alarmDate.setDate(alarmDate.getDate() + dayOffset);
          alarmDate.setHours(hours, minutes, 0, 0);
          if (alarmDate > now) {
            if (!closestAlarm || alarmDate < closestAlarm.date) {
              closestAlarm = { alarm, date: alarmDate };
            }
            break;
          }
        }
      }
    });
    if (closestAlarm) {
      const diff = closestAlarm.date.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      // Fill the arc over the last 12 hours before the alarm.
      const WINDOW_MS = 12 * 60 * 60 * 1000;
      const progress = Math.max(0, Math.min(1, 1 - diff / WINDOW_MS));
      setNextAlarm({
        time: closestAlarm.alarm.alarm_time,
        countdown: `Ring in ${hours} hr. ${minutes} min`,
        progress,
        alarm: closestAlarm.alarm,
      });
    } else {
      setNextAlarm(null);
    }
  };

  const toggleAlarm = async (alarmId: string, enabled: boolean) => {
    // Safety check - force permissions before turning on an alarm
    if (enabled && (!permissions.notifications || !permissions.exactAlarm || !permissions.overlay)) {
      toast.error('Please complete the Rise setup first!');
      return;
    }

    const alarm = alarms.find(a => a.id === alarmId);
    if (!alarm) return;
    const updated = alarms.map(a => a.id === alarmId ? { ...a, is_enabled: enabled } : a);
    setAlarms(updated);
    saveLocalAlarms(updated);
    if (isNative) {
      if (enabled) {
        await scheduleRecurringAlarm(
          alarmId,
          alarm.alarm_time,
          alarm.days_of_week,
          {
            title: alarm.label || 'Rise Alarm',
            body: alarm.intention || 'Time to wake up!',
            missionType: alarm.verification_type as any,
            intention: alarm.intention || undefined,
            snoozeMinutes: alarm.snooze_interval_minutes || 5
          }
        );
      } else {
        await cancelAlarmByUuid(alarmId);
        await cancelNativeAlarmShots(alarmId);
      }
    }
  };

  const handleEditAlarm = (alarm: RiseAlarm) => {
    setEditingAlarm(alarm);
    setEditorOpen(true);
  };

  const handleCreateAlarm = () => {
    setEditingAlarm(null);
    setEditorOpen(true);
  };

  // Commit press: send a light up the meridian, then open the editor.
  const handleCommit = () => {
    setRailSweep(true);
    window.setTimeout(() => setRailSweep(false), 620);
    window.setTimeout(() => handleCreateAlarm(), 220);
  };


  const handleSaveAlarm = async (data: any) => {
    loadRiseData();
  };

  const handleDeleteAlarm = async (alarmId: string) => {
    const target = alarms.find(a => a.id === alarmId);
    const remaining = alarms.filter(a => a.id !== alarmId);
    setAlarms(remaining);
    saveLocalAlarms(remaining);
    if (isNative) {
      await cancelAlarmByUuid(alarmId);
      if (target) {
        await cancelNativeAlarmShots(alarmId);
      }
    }
    toast.success('Alarm deleted');
  };

  const handleDuplicateAlarm = async (alarm: RiseAlarm) => {
    const copy: RiseAlarm = {
     ...alarm,
      id: crypto.randomUUID(),
      label: alarm.label ? `${alarm.label} (copy)` : null,
      is_enabled: false,
    };
    const next = [...alarms, copy];
    setAlarms(next);
    saveLocalAlarms(next);
    toast.success('Alarm duplicated');
  };

  // � LOGIC FOR SEQUENTIAL POPUP (Specific to Rise)
  const getActivePermissionRequest = () => {
    if (!permissions.notifications) {
      return {
        step: "Step 1 of 4",
        title: "Notifications",
        icon: "🔔",
        description: "Rise needs notification access to wake you up properly and show snooze options.",
        action: async () => {
          try {
            await requestNotificationPermission();
            verifyPermissions(); // Prompt is immediate, verify right away
          } catch (e) {
            toast.error("Failed to request permission.");
          }
        }
      };
    }
    if (!permissions.exactAlarm) {
      return {
        step: "Step 2 of 4",
        title: "Exact Alarms",
        icon: "⏰",
        description: "Crucial for waking you up at the exact minute without any Android delays.",
        action: async () => {
          try {
            await requestExactAlarmPermission();
          } catch (e) {
            toast.error("Failed to open Settings.");
          }
        }
      };
    }
    if (!permissions.overlay) {
      return {
        step: "Step 3 of 4",
        title: "Full Screen Alarm",
        icon: "📱",
        description: "Allows the alarm screen to wake up your device and appear even when your phone is locked.",
        action: async () => {
          try {
            await requestOverlayPermission();
          } catch (e) {
            toast.error("Failed to open Settings.");
          }
        }
      };
    }
    if (!permissions.battery) {
      return {
        step: "Step 4 of 4",
        title: "Run in Background",
        icon: "🔋",
        description: "Ensures your phone's battery saver doesn't accidentally kill your morning alarm.",
        action: async () => {
          try {
            await requestBatteryPermission();
          } catch (e) {
            toast.error("Failed to open Settings.");
          }
        }
      };
    }
    return null; // All permissions granted!
  };

  const activePermission = getActivePermissionRequest();
  const isBlockingUI = activePermission !== null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-2xl" />
          <div className="h-48 bg-muted rounded-2xl" />
          <div className="h-64 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 relative">

      {/* � THE SEQUENTIAL POPUP UI */}
      {isBlockingUI && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-background w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-8 text-center animate-in zoom-in-95 duration-200">
            <span className="text-xs font-bold uppercase tracking-wider text-primary mb-4 block">
              {activePermission.step}
            </span>
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-5xl">{activePermission.icon}</span>
            </div>
            <h2 className="text-2xl font-extrabold mb-3">{activePermission.title}</h2>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
              {activePermission.description}
            </p>
            <button
              onClick={activePermission.action}
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all"
            >
              Grant Permission
            </button>
          </div>
        </div>
      )}

      {/* Main UI - Blurred/Disabled until setup is complete */}
      <div className={`transition-opacity duration-300 ${isBlockingUI ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
        <RiseHeader streak={streak?.current_streak || 0} backFlash={backFlash} />

        <div className="px-4 mt-4">
          {activeTab === 'alarms' && (
            <div className="rise-os relative">
              <ThermalDrift className="h-[280px]" />

              <AscentRail sweep={railSweep} className="relative">
                {/* Hero node: the next alarm */}
                <AscentNode index={0} active={!!nextAlarm}>
                  <NextAlarmRing
                    time={nextAlarm?.time ?? null}
                    countdown={nextAlarm?.countdown ?? null}
                    progress={nextAlarm?.progress ?? 0}
                    intention={nextAlarm?.alarm?.intention ?? null}
                    missionLabel={nextAlarm ? missionLabel(nextAlarm.alarm) : null}
                  />
                </AscentNode>

                {alarms.length === 0 ? (
                  <AscentNode index={1}>
                    <Card className="border-dashed">
                      <CardContent className="py-10 text-center">
                        <Sunrise className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                        <h3 className="font-semibold mb-3">What will tomorrow's you thank you for?</h3>
                        <Button onClick={handleCreateAlarm}>Set tonight's intention</Button>
                      </CardContent>
                    </Card>
                  </AscentNode>
                ) : (
                  alarms.map((alarm, i) => (
                    <AscentNode
                      key={alarm.id}
                      index={i + 1}
                      active={alarm.id === nextAlarm?.alarm?.id}
                      onSwipeUp={!alarm.is_enabled ? () => toggleAlarm(alarm.id, true) : undefined}
                      onSwipeDown={alarm.is_enabled ? () => toggleAlarm(alarm.id, false) : undefined}
                    >
                      <RiseAlarmCard
                        alarm={alarm}
                        onToggle={toggleAlarm}
                        onEdit={handleEditAlarm}
                        onDelete={handleDeleteAlarm}
                        onDuplicate={handleDuplicateAlarm}
                      />
                    </AscentNode>
                  ))
                )}
              </AscentRail>

              {/* horizon: everything above is committed, below is still night */}
              <div className="rise-horizon mt-5" />

              <Button
                onClick={handleCommit}
                className="mt-4 w-full h-12 rounded-full text-base font-semibold"
              >
                Commit to tomorrow
              </Button>
            </div>
          )}

          {activeTab === 'group' && <LifeosGroupsHome defaultType="rise" />}
          {activeTab === 'community' && <CommunityWakeFeed />}
          {activeTab === 'reports' && <RiseReports />}
          {activeTab === 'settings' && <RiseSettings />}
        </div>

        <RiseAlarmEditor
          open={editorOpen}
          onClose={() => {
            setEditorOpen(false);
            setEditingAlarm(null);
          }}
          onSave={handleSaveAlarm}
          initialData={
            editingAlarm
             ? {
                  id: editingAlarm.id,
                  alarm_time: editingAlarm.alarm_time,
                  days_of_week: editingAlarm.days_of_week,
                  alarm_type: editingAlarm.alarm_type,
                  intention: editingAlarm.intention || '',
                  label: editingAlarm.label || '',
                  verification_type: editingAlarm.verification_type,
                  snooze_limit: editingAlarm.snooze_limit,
                  snooze_interval_minutes: editingAlarm.snooze_interval_minutes || 5,
                  sound_type: editingAlarm.sound_type || 'default',
                  vibration_enabled: editingAlarm.vibration_enabled ?? true,
                  volume: 80,
                  gentle_wakeup_seconds: 30
                }
              : undefined
          }
          isEditing={!!editingAlarm}
        />
        <RiseBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
}