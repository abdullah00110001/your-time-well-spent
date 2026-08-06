import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus, Sunrise } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RiseBottomNav } from '@/components/rise/RiseBottomNav';
import { RiseHeader } from '@/components/rise/RiseHeader';
import { RiseAlarmCard } from '@/components/rise/RiseAlarmCard';
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
  const [nextAlarm, setNextAlarm] = useState<{ time: string; countdown: string } | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAlarm, setEditingAlarm] = useState<RiseAlarm | null>(null);
  const [backFlash, setBackFlash] = useState(false);

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
    if (user) {
      loadRiseData();

      if (isNative) {
        initializeAlarmChannel(); // Initialize channel silently
        verifyPermissions();

        // � Auto-verify when returning from settings
        const listener = App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            verifyPermissions();
          }
        });

        return () => {
          listener.then(l => l.remove());
        };
      }
    }
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

  useEffect(() => {
    updateNextAlarm();
    const interval = setInterval(updateNextAlarm, 60000);
    return () => clearInterval(interval);
  }, [alarms]);

  // Route to full-screen Ring when an alarm notification is received or tapped.
/*   useEffect(() => {
    if (!isNative) return;
    let receivedSub: any, actionSub: any;
    (async () => {
      receivedSub = await LocalNotifications.addListener('localNotificationReceived', (n) => {
        const id = (n.extra as any)?.alarmDbId || (n.extra as any)?.uuid;
        if (id) navigate(`/rise/ring/${id}`);
      });
      actionSub = await LocalNotifications.addListener('localNotificationActionPerformed', (r) => {
        const id = (r.notification.extra as any)?.alarmDbId || (r.notification.extra as any)?.uuid;
        if (id) navigate(`/rise/ring/${id}`);
      });
    })();
    return () => {
      receivedSub?.remove?.();
      actionSub?.remove?.();
    };
  }, [navigate]);
 */
  const loadLocalAlarms = (): RiseAlarm[] => {
    try {
      const raw = localStorage.getItem('local_alarms');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return (parsed as any[]).map((a) => ({
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
      }));
    } catch (e) {
      console.warn('Failed to read local alarms', e);
      return [];
    }
  };

  const saveLocalAlarms = (list: RiseAlarm[]) => {
    try {
      localStorage.setItem('local_alarms', JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to persist local alarms', e);
    }
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
      setNextAlarm({ time: closestAlarm.alarm.alarm_time, countdown: `Ring in ${hours} hr. ${minutes} min` });
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
            <div className="space-y-4">
              {/* Hero: Next Alarm — minimal LifeOS card */}
              <div className="relative overflow-hidden rounded-2xl bg-card border border-border shadow-sm p-5">
                <div className="flex items-center gap-2 mb-3 text-muted-foreground">
                  <Sunrise className="h-4 w-4 text-primary" />
                  <span className="text-[11px] uppercase tracking-widest font-semibold">Next Alarm</span>
                </div>
                {nextAlarm ? (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl md:text-5xl font-black tabular-nums tracking-tight text-foreground">
                        {(() => {
                          const [h, m] = nextAlarm.time.split(':');
                          const hh = parseInt(h);
                          const disp = hh > 12 ? hh - 12 : hh === 0 ? 12 : hh;
                          return `${disp}:${m}`;
                        })()}
                      </span>
                      <span className="text-base font-semibold text-muted-foreground">
                        {parseInt(nextAlarm.time.split(':')[0]) >= 12 ? 'PM' : 'AM'}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{nextAlarm.countdown}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xl font-bold text-foreground">No alarms set</p>
                    <p className="text-xs text-muted-foreground mt-1">Tap + to create your first wake-up</p>
                  </>
                )}
              </div>

              {/* Alarm list */}
              {alarms.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-10 text-center">
                    <Sunrise className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                    <h3 className="font-semibold mb-1">No alarms yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Tap the + button to create your first alarm
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {alarms.map((alarm) => (
                    <RiseAlarmCard
                      key={alarm.id}
                      alarm={alarm}
                      onToggle={toggleAlarm}
                      onEdit={handleEditAlarm}
                      onDelete={handleDeleteAlarm}
                      onDuplicate={handleDuplicateAlarm}
                    />
                  ))}
                </div>
              )}

              {/* Floating Add button */}
              <Button
                onClick={handleCreateAlarm}
                className="fixed bottom-24 right-4 h-16 w-16 rounded-full shadow-xl shadow-amber-500/40 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 z-40"
                size="icon"
                aria-label="Create alarm"
              >
                <Plus className="h-7 w-7" />
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