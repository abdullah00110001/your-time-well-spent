import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Clock, Plus, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  activity: string | null;
  notes: string | null;
}

const RANGE_DAYS = 7;

export default function TimeTracking() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    activity: '',
    hours: '1',
    notes: '',
  });

  const since = useMemo(() => format(subDays(new Date(), RANGE_DAYS - 1), 'yyyy-MM-dd'), []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('time_entries')
      .select('id, date, hours, activity, notes')
      .eq('user_id', user.id)
      .gte('date', since)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      toast.error('Could not load time entries');
      return;
    }
    setEntries((data ?? []).map((d) => ({ ...d, hours: Number(d.hours) })));
  }, [user, since]);

  useEffect(() => { void load(); }, [load]);

  const addEntry = async () => {
    if (!user) return;
    const hours = Number(form.hours);
    if (!form.activity.trim()) {
      toast.error('Add an activity name');
      return;
    }
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
      toast.error('Hours must be between 0 and 24');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('time_entries').insert({
      user_id: user.id,
      date: form.date,
      hours,
      activity: form.activity.trim(),
      notes: form.notes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error('Could not save entry');
      return;
    }
    toast.success('Time logged');
    setForm((p) => ({ ...p, activity: '', hours: '1', notes: '' }));
    void load();
  };

  const removeEntry = async (id: string) => {
    const { error } = await supabase.from('time_entries').delete().eq('id', id);
    if (error) {
      toast.error('Could not delete entry');
      return;
    }
    setEntries((p) => p.filter((e) => e.id !== id));
  };

  const totals = useMemo(() => {
    const byActivity = new Map<string, number>();
    let total = 0;
    for (const e of entries) {
      total += e.hours;
      const key = e.activity || 'Unlabelled';
      byActivity.set(key, (byActivity.get(key) ?? 0) + e.hours);
    }
    return {
      total,
      today: entries.filter((e) => e.date === format(new Date(), 'yyyy-MM-dd')).reduce((s, e) => s + e.hours, 0),
      byActivity: [...byActivity.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [entries]);

  return (
    <AppLayout>
      <div className="p-4 space-y-6 max-w-3xl mx-auto">
        <header className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Time Tracking</h1>
            <p className="text-sm text-muted-foreground">Last {RANGE_DAYS} days of logged hours</p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{totals.today.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">Logged today</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{totals.total.toFixed(1)}h</p>
              <p className="text-xs text-muted-foreground">Logged this week</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Log time</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="tt-date">Date</Label>
                <Input
                  id="tt-date"
                  type="date"
                  value={form.date}
                  max={format(new Date(), 'yyyy-MM-dd')}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tt-hours">Hours</Label>
                <Input
                  id="tt-hours"
                  type="number"
                  step="0.25"
                  min="0"
                  max="24"
                  value={form.hours}
                  onChange={(e) => setForm((p) => ({ ...p, hours: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tt-activity">Activity</Label>
              <Input
                id="tt-activity"
                placeholder="e.g., Deep work, Quran, Exercise"
                value={form.activity}
                onChange={(e) => setForm((p) => ({ ...p, activity: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tt-notes">Notes (optional)</Label>
              <Input
                id="tt-notes"
                placeholder="What did you get done?"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
            <Button className="w-full" onClick={addEntry} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Log time
            </Button>
          </CardContent>
        </Card>

        {totals.byActivity.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {totals.byActivity.map(([activity, hours]) => (
                <div key={activity} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{activity}</span>
                    <span className="text-muted-foreground">{hours.toFixed(1)}h</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${totals.total ? (hours / totals.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Entries</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No time logged yet.</p>
            ) : (
              entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.activity || 'Unlabelled'}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {format(new Date(`${e.date}T00:00:00`), 'EEE d MMM')}
                      {e.notes ? ` · ${e.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary">{e.hours.toFixed(2)}h</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeEntry(e.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
