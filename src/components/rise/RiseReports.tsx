import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ChevronLeft,
  ChevronRight,
  Sunrise,
  TrendingUp,
  Moon,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
  subWeeks,
  subMonths,
  subDays,
  addDays,
  isSameDay,
} from 'date-fns';
import { cn } from '@/lib/utils';

type RangeMode = 'daily' | 'weekly' | 'monthly';

interface WakeReport {
  avgWakeTime: string;
  avgTimeToWake: string;
  totalWakes: number;
  onTimeWakes: number;
  dailyData: {
    day: string;
    wakeTime: string | null;
    status: 'on_time' | 'late' | 'missed';
  }[];
}

interface SleepReport {
  avgDuration: string;
  avgBedTime: string;
  totalNights: number;
  avgQuality: number;
  dailyData: { day: string; minutes: number; quality: number | null }[];
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function RiseReports() {
  const { user } = useAuth();

  const [rangeMode, setRangeMode] = useState<RangeMode>('weekly');
  // offset: 0 = current period, 1 = one period back, 2 = two periods back
  const [offset, setOffset] = useState(0);
  const [reportType, setReportType] = useState<'wake' | 'sleep'>('wake');
  const [report, setReport] = useState<WakeReport | null>(null);
  const [sleepReport, setSleepReport] = useState<SleepReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { setOffset(0); }, [rangeMode]);

  // ── Range computation — offset 0=now, 1=one back, 2=two back ──────────────
  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    const today = new Date();
    let start: Date, end: Date, label: string;

    if (rangeMode === 'daily') {
      // subDays(today, offset): offset=0 → today, offset=1 → yesterday
      const d = subDays(today, offset);
      start = startOfDay(d);
      end   = endOfDay(d);
      label = offset === 0 ? `Today  ${format(d, 'MMM d')}`
            : offset === 1 ? `Yesterday  ${format(d, 'MMM d')}`
            : format(d, 'EEE, MMM d');
    } else if (rangeMode === 'monthly') {
      const m = subMonths(today, offset);
      start = startOfMonth(m);
      end   = endOfMonth(m);
      label = offset === 0 ? `This month  ${format(m, 'MMM yyyy')}`
            : offset === 1 ? `Last month  ${format(m, 'MMM yyyy')}`
            : format(m, 'MMM yyyy');
    } else {
      // weekly
      const w = subWeeks(today, offset);
      start = startOfWeek(w, { weekStartsOn: 0 });
      end   = endOfWeek(start, { weekStartsOn: 0 });
      label = offset === 0
        ? `This week  ${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
        : offset === 1
        ? `Last week  ${format(start, 'MMM d')} – ${format(end, 'MMM d')}`
        : `${format(start, 'MMM d')} – ${format(end, 'MMM d')}`;
    }

    return { rangeStart: start, rangeEnd: end, rangeLabel: label };
  }, [rangeMode, offset]);

  useEffect(() => {
    if (user) {
      loadWakeData(rangeStart, rangeEnd);
      loadSleepData(rangeStart, rangeEnd);
    }
  }, [user, rangeStart, rangeEnd]);

  // ── Wake data ──────────────────────────────────────────────────────────────
  const loadWakeData = async (start: Date, end: Date) => {
    if (!user) return;
    setIsLoading(true);
    try {
      const startIso = start.toISOString();
      const endIso   = end.toISOString();

      // Modern table
      const { data: eventsRaw } = await (supabase as any)
        .from('rise_wake_events')
        .select('woke_at')
        .eq('user_id', user.id)
        .gte('woke_at', startIso)
        .lte('woke_at', endIso)
        .order('woke_at', { ascending: true });

      // Legacy table
      const { data: legacyRaw } = await supabase
        .from('rise_alarm_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startIso)
        .lte('created_at', endIso)
        .order('created_at', { ascending: true });

      type WakeRow = { wokeAt: Date; minutesLate: number | null };

      const eventRows: WakeRow[] = ((eventsRaw || []) as { woke_at: string }[]).map(e => ({
        wokeAt: new Date(e.woke_at),
        minutesLate: null,
      }));

      const legacyRows: WakeRow[] = (legacyRaw || [])
        .filter((l: any) => l.actual_wake_time)
        .map((l: any) => ({
          wokeAt: new Date(l.actual_wake_time),
          minutesLate: l.minutes_late ?? null,
        }));

      // De-duplicate by minute bucket
      const seen = new Set<string>();
      const rows: WakeRow[] = [];
      [...eventRows, ...legacyRows].forEach(r => {
        const k = `${r.wokeAt.getFullYear()}-${r.wokeAt.getMonth()}-${r.wokeAt.getDate()}-${r.wokeAt.getHours()}-${r.wokeAt.getMinutes()}`;
        if (!seen.has(k)) { seen.add(k); rows.push(r); }
      });
      rows.sort((a, b) => a.wokeAt.getTime() - b.wokeAt.getTime());

      const wakeTimes = rows.map(r => r.wokeAt.getHours() * 60 + r.wokeAt.getMinutes());
      const avgMinutes = wakeTimes.length > 0
        ? Math.round(wakeTimes.reduce((a, b) => a + b, 0) / wakeTimes.length)
        : null;

      const lateValues = rows.filter(r => r.minutesLate !== null).map(r => r.minutesLate as number);
      const avgLate = lateValues.length > 0
        ? lateValues.reduce((a, b) => a + b, 0) / lateValues.length
        : null;

      // Build chart buckets
      const buildBuckets = () => {
        if (rangeMode === 'daily') {
          const r = rows[0];
          return [{
            day: format(start, 'EEE'),
            wakeTime: r ? format(r.wokeAt, 'h:mm a') : null,
            status: (r ? ((r.minutesLate ?? 0) <= 5 ? 'on_time' : 'late') : 'missed') as 'on_time' | 'late' | 'missed',
          }];
        }
        if (rangeMode === 'monthly') {
          const daysInMonth = endOfMonth(start).getDate();
          return Array.from({ length: daysInMonth }, (_, idx) => {
            const date = new Date(start.getFullYear(), start.getMonth(), idx + 1);
            const r = rows.find(x => isSameDay(x.wokeAt, date));
            return {
              day: String(idx + 1),
              wakeTime: r ? format(r.wokeAt, 'h:mm a') : null,
              status: (r ? ((r.minutesLate ?? 0) <= 5 ? 'on_time' : 'late') : 'missed') as 'on_time' | 'late' | 'missed',
            };
          });
        }
        // weekly — 7 days
        return DAY_NAMES.map((day, i) => {
          const target = addDays(start, i);
          const r = rows.find(x => isSameDay(x.wokeAt, target));
          return {
            day,
            wakeTime: r ? format(r.wokeAt, 'h:mm a') : null,
            status: (r ? ((r.minutesLate ?? 0) <= 5 ? 'on_time' : 'late') : 'missed') as 'on_time' | 'late' | 'missed',
          };
        });
      };

      setReport({
        avgWakeTime: avgMinutes !== null
          ? (() => {
              const h = Math.floor(avgMinutes / 60);
              const m = avgMinutes % 60;
              const ampm = h >= 12 ? 'PM' : 'AM';
              const displayH = h % 12 || 12;
              return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
            })()
          : '--:--',
        avgTimeToWake: avgLate !== null
          ? avgLate < 60
            ? `${Math.round(avgLate)}m`
            : `${Math.floor(avgLate / 60)}h ${Math.round(avgLate % 60)}m`
          : '--',
        totalWakes: rows.length,
        onTimeWakes: rows.filter(r => (r.minutesLate ?? 0) <= 5).length,
        dailyData: buildBuckets(),
      });
    } catch (e) {
      console.error('Wake report error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Sleep data ─────────────────────────────────────────────────────────────
  const loadSleepData = async (start: Date, end: Date) => {
    if (!user) return;
    try {
      const startIso = start.toISOString();
      const endIso   = end.toISOString();

      const { data: logs, error } = await (supabase as any)
        .from('sleep_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('bed_time', startIso)
        .lte('bed_time', endIso)
        .order('bed_time', { ascending: true });

      if (error) throw error;

      type SleepRow = {
        bed_time: string;
        duration_minutes: number | null;
        quality_rating: number | null;
      };
      const arr: SleepRow[] = logs || [];

      const durations = arr.map(l => l.duration_minutes || 0).filter(Boolean);
      const avgMin = durations.length
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

      const bedMinutes = arr.filter(l => l.bed_time).map(l => {
        const d = new Date(l.bed_time);
        return d.getHours() * 60 + d.getMinutes();
      });
      const avgBed = bedMinutes.length
        ? Math.round(bedMinutes.reduce((a, b) => a + b, 0) / bedMinutes.length)
        : null;

      const qualities = arr.map(l => l.quality_rating || 0).filter(Boolean);
      const avgQ = qualities.length ? qualities.reduce((a, b) => a + b, 0) / qualities.length : 0;

      const buildSleepBuckets = () => {
        if (rangeMode === 'daily') {
          const r = arr[0];
          return [{ day: format(start, 'EEE'), minutes: r?.duration_minutes || 0, quality: r?.quality_rating || null }];
        }
        if (rangeMode === 'monthly') {
          const daysInMonth = endOfMonth(start).getDate();
          return Array.from({ length: daysInMonth }, (_, idx) => {
            const date = new Date(start.getFullYear(), start.getMonth(), idx + 1);
            const r = arr.find(l => isSameDay(new Date(l.bed_time), date));
            return { day: String(idx + 1), minutes: r?.duration_minutes || 0, quality: r?.quality_rating || null };
          });
        }
        return DAY_NAMES.map((day, i) => {
          const target = addDays(start, i);
          const r = arr.find(l => isSameDay(new Date(l.bed_time), target));
          return { day, minutes: r?.duration_minutes || 0, quality: r?.quality_rating || null };
        });
      };

      setSleepReport({
        avgDuration: avgMin !== null ? `${Math.floor(avgMin / 60)}h ${avgMin % 60}m` : '--',
        avgBedTime: avgBed !== null
          ? (() => {
              const h = Math.floor(avgBed / 60) % 24;
              const m = avgBed % 60;
              const ampm = h >= 12 ? 'PM' : 'AM';
              const displayH = h % 12 || 12;
              return `${displayH}:${m.toString().padStart(2, '0')} ${ampm}`;
            })()
          : '--:--',
        totalNights: arr.length,
        avgQuality: Math.round(avgQ * 10) / 10,
        dailyData: buildSleepBuckets(),
      });
    } catch (e) {
      console.error('Sleep report error:', e);
    }
  };

  const getBarHeight = (status: string) => {
    switch (status) {
      case 'on_time': return '100%';
      case 'late':    return '60%';
      default:        return '8%';
    }
  };

  const getBarColor = (status: string) => {
    switch (status) {
      case 'on_time': return 'bg-amber-500';
      case 'late':    return 'bg-amber-500/50';
      default:        return 'bg-muted';
    }
  };

  return (
    <div className="space-y-4">

      {/* Daily / Weekly / Monthly */}
      <Tabs value={rangeMode} onValueChange={(v) => setRangeMode(v as RangeMode)}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Navigator */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setOffset(p => p + 1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="font-medium text-sm text-center flex items-center gap-1.5">
          <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
          {rangeLabel}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setOffset(p => p - 1)}
          disabled={offset <= 0}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Wake / Sleep toggle */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant={reportType === 'wake' ? 'default' : 'ghost'}
          size="sm"
          className={cn(reportType === 'wake' && 'bg-amber-500 hover:bg-amber-600')}
          onClick={() => setReportType('wake')}
        >
          <Sunrise className="h-4 w-4 mr-2" />
          Wake up report
        </Button>
        <Button
          variant={reportType === 'sleep' ? 'default' : 'ghost'}
          size="sm"
          className={cn(reportType === 'sleep' && 'bg-indigo-500 hover:bg-indigo-600')}
          onClick={() => setReportType('sleep')}
        >
          <Moon className="h-4 w-4 mr-2" />
          Sleep report
        </Button>
      </div>

      {isLoading && (
        <div className="text-center text-muted-foreground text-sm py-4">Loading…</div>
      )}

      {/* ── SLEEP ── */}
      {reportType === 'sleep' && !isLoading && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-gradient-to-br from-indigo-900/30 to-violet-800/20 border-indigo-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold">{sleepReport?.avgDuration || '--'}</p>
                <p className="text-xs text-muted-foreground mt-1">Avg. sleep</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-indigo-900/30 to-violet-800/20 border-indigo-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold">{sleepReport?.avgBedTime || '--:--'}</p>
                <p className="text-xs text-muted-foreground mt-1">Avg. bedtime</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="h-40 flex items-end justify-between gap-1">
                {sleepReport?.dailyData.map((day, i) => {
                  const pct = day.minutes ? Math.min(100, (day.minutes / 540) * 100) : 5;
                  const isToday = rangeMode === 'weekly' && i === new Date().getDay();
                  return (
                    <div key={`${day.day}-${i}`} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full h-32 bg-muted/30 rounded-t-lg flex items-end">
                        <div
                          className={cn('w-full rounded-t-lg transition-all', day.minutes ? 'bg-indigo-500' : 'bg-muted')}
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      {rangeMode !== 'monthly' && (
                        <span className={cn('text-xs', isToday ? 'font-bold text-indigo-400' : 'text-muted-foreground')}>
                          {day.day[0]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Moon className="h-4 w-4" /> Sleep Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <span className="text-sm">Nights tracked</span>
                <span className="font-bold">{sleepReport?.totalNights || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <span className="text-sm">Avg. quality</span>
                <span className="font-bold text-indigo-400">
                  {sleepReport?.avgQuality ? `${sleepReport.avgQuality}/5` : '--'}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── WAKE ── */}
      {reportType === 'wake' && !isLoading && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-gradient-to-br from-amber-900/30 to-orange-800/20 border-amber-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold">{report?.avgWakeTime || '--:--'}</p>
                <p className="text-xs text-muted-foreground mt-1">Avg. wake-up time</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-amber-900/30 to-orange-800/20 border-amber-500/20">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold">{report?.avgTimeToWake || '--'}</p>
                <p className="text-xs text-muted-foreground mt-1">Avg. time to wake up</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="h-40 flex items-end justify-between gap-1">
                {report?.dailyData.map((day, i) => {
                  const isToday = rangeMode === 'weekly' && i === new Date().getDay();
                  return (
                    <div key={`${day.day}-${i}`} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full h-32 bg-muted/30 rounded-t-lg flex items-end">
                        <div
                          className={cn('w-full rounded-t-lg transition-all', getBarColor(day.status))}
                          style={{ height: getBarHeight(day.status) }}
                        />
                      </div>
                      {rangeMode !== 'monthly' && (
                        <span className={cn('text-xs', isToday ? 'font-bold text-amber-500' : 'text-muted-foreground')}>
                          {day.day[0]}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-end gap-2 mt-2">
                <div className="h-0.5 w-4 bg-amber-500 rounded" />
                <span className="text-xs text-amber-500">
                  Average {report?.avgWakeTime || '--:--'}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                {rangeMode === 'daily' ? 'Daily' : rangeMode === 'monthly' ? 'Monthly' : 'Weekly'} Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <span className="text-sm">Total wake-ups</span>
                <span className="font-bold">{report?.totalWakes || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <span className="text-sm">On-time wake-ups</span>
                <span className="font-bold text-primary">{report?.onTimeWakes || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                <span className="text-sm">Success rate</span>
                <span className="font-bold text-amber-500">
                  {report?.totalWakes
                    ? `${Math.round((report.onTimeWakes / report.totalWakes) * 100)}%`
                    : '0%'}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
