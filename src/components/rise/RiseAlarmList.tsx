import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Bell, Users, Sunrise, Moon, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { scheduleRecurringAlarm, cancelAlarmByUuid, requestAllAlarmPermissions, checkAllAlarmPermissions } from '@/lib/capacitor/nativeAlarm';

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
  is_local?: boolean;
}

interface RiseAlarmListProps {
  alarms: RiseAlarm[];
  onToggle: (id: string, enabled: boolean) => void;
  onRefresh: () => void;
}

export function RiseAlarmList({ alarms, onToggle, onRefresh }: RiseAlarmListProps) {
  const { user } = useAuth();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [permissionsOk, setPermissionsOk] = useState(false);
  const [localAlarms, setLocalAlarms] = useState<RiseAlarm[]>([]);
  const [toDelete, setToDelete] = useState<RiseAlarm | null>(null);
  const [newAlarm, setNewAlarm] = useState({
    alarm_time: '06:00',
    days_of_week: [0, 1, 2, 3, 4, 5, 6],
    alarm_type: 'personal',
    intention: '',
    label: '',
    verification_type: 'breath_hold'
  });

  useEffect(() => {
    const init = async () => {
      const perms = await checkAllAlarmPermissions();
      setPermissionsOk(perms.notifications && perms.exactAlarm);
      loadLocalAlarms();
    };
    init();

    // FIX: localStorage চেঞ্জ হলে অটো রিলোড
    const handleStorageChange = () => loadLocalAlarms();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localAlarmsUpdated', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localAlarmsUpdated', handleStorageChange);
    };
  }, []);

  const loadLocalAlarms = () => {
    const stored = JSON.parse(localStorage.getItem('local_alarms') || '[]');
    setLocalAlarms(stored);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12? 'PM' : 'AM';
    const displayHour = h > 12? h - 12 : h === 0? 12 : h;
    return { time: `${displayHour}:${minutes}`, ampm };
  };

  const getDayLabels = (days: number[]) => {
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return labels.map((l, i) => ({ label: l, active: days.includes(i) }));
  };

  const toggleDay = (day: number) => {
    setNewAlarm(prev => ({
     ...prev,
      days_of_week: prev.days_of_week.includes(day)
       ? prev.days_of_week.filter(d => d!== day)
        : [...prev.days_of_week, day].sort()
    }));
  };

  const createAlarm = async () => {
    if (!user) return;
    

    const alarmId = crypto.randomUUID();
    const isLocal = newAlarm.alarm_type === 'personal' || newAlarm.alarm_type === 'recovery';

    await scheduleRecurringAlarm(
      alarmId,
      newAlarm.alarm_time,
      newAlarm.days_of_week,
      {
        title: newAlarm.label || 'Rise Alarm',
        body: newAlarm.intention || 'Time to wake up!',
        missionType: newAlarm.verification_type as any,
        snoozeMinutes: 5,
        alarmDbId: isLocal? undefined : alarmId
      }
    );

    if (isLocal) {
      const localAlarmData: RiseAlarm = {
        id: alarmId,
       ...newAlarm,
        is_enabled: true,
        snooze_limit: 3,
        snooze_interval_minutes: 5,
        is_local: true
      };
      const updated = [...localAlarms, localAlarmData];
      localStorage.setItem('local_alarms', JSON.stringify(updated));
      setLocalAlarms(updated);
      // FIX: অন্য কম্পোনেন্টকে জানাও
      window.dispatchEvent(new Event('localAlarmsUpdated'));
      toast.success('Personal alarm set! ✅');
    } else {
      const { error } = await supabase
       .from('rise_alarms')
       .insert({
          id: alarmId,
          user_id: user.id,
         ...newAlarm,
          is_enabled: true,
          snooze_limit: 3,
          snooze_interval_minutes: 5
        });
      if (error) {
        toast.error('Failed to create alarm');
        await cancelAlarmByUuid(alarmId);
        return;
      }
      toast.success('Group alarm created & scheduled!');
      onRefresh();
    }

    setShowCreateDialog(false);
    setNewAlarm({
      alarm_time: '06:00',
      days_of_week: [0, 1, 2, 3, 4, 5, 6],
      alarm_type: 'personal',
      intention: '',
      label: '',
      verification_type: 'breath_hold'
    });
  };

  const handleToggle = async (alarm: RiseAlarm, enabled: boolean) => {
    if (alarm.is_local) {
      const updated = localAlarms.map(a => a.id === alarm.id? {...a, is_enabled: enabled } : a);
      localStorage.setItem('local_alarms', JSON.stringify(updated));
      setLocalAlarms(updated);
      window.dispatchEvent(new Event('localAlarmsUpdated'));
    } else {
      await onToggle(alarm.id, enabled);
    }

    if (enabled) {
      await scheduleRecurringAlarm(
        alarm.id,
        alarm.alarm_time,
        alarm.days_of_week,
        {
          title: alarm.label || 'Rise Alarm',
          body: alarm.intention || 'Time to wake up!',
          missionType: alarm.verification_type as any,
          snoozeMinutes: alarm.snooze_interval_minutes || 5,
          alarmDbId: alarm.is_local? undefined : alarm.id
        }
      );
      toast.success('Alarm enabled');
    } else {
      await cancelAlarmByUuid(alarm.id);
      toast.success('Alarm disabled');
    }
  };

  const deleteAlarm = async (alarm: RiseAlarm) => {
    await cancelAlarmByUuid(alarm.id);
    if (alarm.is_local) {
      const updated = localAlarms.filter(a => a.id !== alarm.id);
      localStorage.setItem('local_alarms', JSON.stringify(updated));
      setLocalAlarms(updated);
      window.dispatchEvent(new Event('localAlarmsUpdated'));
    } else {
      const { error } = await supabase
       .from('rise_alarms')
       .delete()
       .eq('id', alarm.id);
      if (error) {
        toast.error('Failed to delete alarm');
        return;
      }
      onRefresh();
    }
    toast.success('Alarm deleted');
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    await deleteAlarm(target);
  };

  const getAlarmTypeIcon = (type: string) => {
    switch (type) {
      case 'group': return <Users className="h-4 w-4" />;
      case 'fajr': return <Moon className="h-4 w-4" />;
      case 'recovery': return <Sunrise className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const allAlarms = [...alarms,...localAlarms].sort((a, b) => a.alarm_time.localeCompare(b.alarm_time));

  return (
    <div className="space-y-4">
      

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogTrigger asChild>
          <Button className="w-full h-14 rounded-2xl" size="lg">
            <Plus className="h-5 w-5 mr-2" /> Add New Alarm
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Alarm</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="text-center">
              <Input
                type="time"
                value={newAlarm.alarm_time}
                onChange={(e) => setNewAlarm(prev => ({...prev, alarm_time: e.target.value }))}
                className="text-4xl h-20 text-center font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label>Repeat</Label>
              <div className="flex justify-between">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <Button
                    key={i}
                    variant={newAlarm.days_of_week.includes(i)? 'default' : 'outline'}
                    size="icon"
                    className="h-10 w-10 rounded-full"
                    onClick={() => toggleDay(i)}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Alarm Type</Label>
              <Select
                value={newAlarm.alarm_type}
                onValueChange={(value) => setNewAlarm(prev => ({...prev, alarm_type: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal">🔔 Personal Alarm</SelectItem>
                  <SelectItem value="group">👥 Group Alarm</SelectItem>
                  <SelectItem value="fajr">🌙 Fajr Alarm</SelectItem>
                  <SelectItem value="recovery">🌅 Recovery Alarm</SelectItem>
                </SelectContent>
              </Select>
              {newAlarm.alarm_type === 'personal' && (
                <p className="text-xs text-muted-foreground">Saved only on your device</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Wake Verification</Label>
              <Select
                value={newAlarm.verification_type}
                onValueChange={(value) => setNewAlarm(prev => ({...prev, verification_type: value }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="breath_hold">🌬️ Breath Hold (5 seconds)</SelectItem>
                  <SelectItem value="morning_intention">✍️ Type "I am awake"</SelectItem>
                  <SelectItem value="stand_detection">🧍 Stand Up Detection</SelectItem>
                  <SelectItem value="photo">📸 Take Morning Photo</SelectItem>
                  <SelectItem value="none">❌ No Verification</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Why are you waking up? (Optional)</Label>
              <Textarea
                placeholder="e.g., Fajr prayer and morning study"
                value={newAlarm.intention}
                onChange={(e) => setNewAlarm(prev => ({...prev, intention: e.target.value }))}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">This will appear when your alarm rings</p>
            </div>

            <div className="space-y-2">
              <Label>Label (Optional)</Label>
              <Input
                placeholder="e.g., Wake up early"
                value={newAlarm.label}
                onChange={(e) => setNewAlarm(prev => ({...prev, label: e.target.value }))}
              />
            </div>

            <Button className="w-full" onClick={createAlarm}>Create Alarm</Button>
          </div>
        </DialogContent>
      </Dialog>

      {allAlarms.length === 0? (
        <Card>
          <CardContent className="py-8 text-center">
            <Sunrise className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <h3 className="font-semibold mb-1">No Alarms Set</h3>
            <p className="text-sm text-muted-foreground">Create an alarm to start your disciplined mornings</p>
          </CardContent>
        </Card>
      ) : (
        allAlarms.map((alarm) => {
          const { time, ampm } = formatTime(alarm.alarm_time);
          const days = getDayLabels(alarm.days_of_week);
          return (
            <Card key={alarm.id} className={cn('transition-all',!alarm.is_enabled && 'opacity-50')}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex gap-1 mb-2">
                      {days.map((d, i) => (
                        <span
                          key={i}
                          className={cn(
                            'text-xs font-medium w-5 h-5 flex items-center justify-center rounded',
                            d.active? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                          )}
                        >
                          {d.label}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{time}</span>
                      <span className="text-lg text-muted-foreground">{ampm}</span>
                      {getAlarmTypeIcon(alarm.alarm_type)}
                      {alarm.is_local && <span className="text-xs bg-muted px-2 py-0.5 rounded">Local</span>}
                    </div>
                    {(alarm.label || alarm.intention) && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xl">💡</span>
                        <span className="text-sm text-muted-foreground">
                          {alarm.label || alarm.intention}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={alarm.is_enabled}
                      onCheckedChange={(checked) => handleToggle(alarm, checked)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setToDelete(alarm)}
                      aria-label="Delete alarm"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this alarm?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.label || toDelete?.intention || `Alarm at ${toDelete?.alarm_time}`} will be cancelled
              and removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}