import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  Clock, 
  Shield,
  Flame,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

interface DisciplineScore {
  current_score: number;
  current_streak_days: number;
  total_focus_minutes: number;
  total_time_saved_minutes: number;
  can_use_absolute_mode: boolean;
}

interface ShieldAnalyticsProps {
  disciplineScore: DisciplineScore | null;
}

interface SessionLog {
  id: string;
  profile_name: string;
  status: string;
  started_at: string;
  actual_end_at: string | null;
  bypass_attempts: number;
}

export function ShieldAnalytics({ disciplineScore }: ShieldAnalyticsProps) {
  const { user } = useAuth();
  const score = disciplineScore?.current_score || 50;
  const [weeklyData, setWeeklyData] = useState<{ day: string; score: number; sessions: number }[]>([]);
  const [recentActivity, setRecentActivity] = useState<SessionLog[]>([]);
  const [totalBypassAttempts, setTotalBypassAttempts] = useState(0);
  const [yesterdayBypasses, setYesterdayBypasses] = useState(0);
  
  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user]);

  const loadAnalytics = async () => {
    if (!user) return;

    try {
      const today = new Date();
      const sevenDaysAgo = subDays(today, 6);
      const startDateStr = format(sevenDaysAgo, 'yyyy-MM-dd');

      // 🟢 Shield is now local-first — read session history from localStorage
      // (kept by ShieldPage). Fall back to Supabase for older accounts.
      let sessions: SessionLog[] = [];
      try {
        const localHistory = JSON.parse(localStorage.getItem('shield_session_history') || '[]');
        if (Array.isArray(localHistory) && localHistory.length > 0) {
          sessions = localHistory as SessionLog[];
        }
      } catch {/* ignore */}

      if (sessions.length === 0) {
        const { data: dbSessions } = await supabase
          .from('shield_sessions')
          .select('*')
          .eq('user_id', user.id)
          .gte('started_at', `${startDateStr}T00:00:00`)
          .order('started_at', { ascending: false });
        sessions = (dbSessions || []) as SessionLog[];
      }

      // Currently-active session from local storage (so today's count isn't 0)
      try {
        const active = JSON.parse(localStorage.getItem('shield_active_session') || 'null');
        if (active && active.started_at && !sessions.find(s => s.id === active.id)) {
          sessions = [active as SessionLog, ...sessions];
        }
      } catch {/* ignore */}

      const weekData = Array.from({ length: 7 }).map((_, i) => {
        const targetDate = subDays(today, 6 - i);
        const targetDateStr = format(targetDate, 'yyyy-MM-dd');
        const dayName = format(targetDate, 'EEE');

        const daySessions = sessions.filter(s => (s.started_at || '').startsWith(targetDateStr));
        const completedSessions = daySessions.filter(s => s.status === 'completed');

        const dayScore = daySessions.length > 0
          ? Math.round((completedSessions.length / daySessions.length) * 100)
          : 0;

        return { day: dayName, score: dayScore, sessions: daySessions.length };
      });

      setWeeklyData(weekData);
      setRecentActivity(sessions.slice(0, 5));

      // 🟢 Bypass attempts — local first, then DB fallback
      let todayBypass = 0;
      let yBypass = 0;
      try {
        const localBypass = JSON.parse(localStorage.getItem('shield_bypass_log') || '[]') as { created_at: string }[];
        const todayStr = format(today, 'yyyy-MM-dd');
        const yStr = format(subDays(today, 1), 'yyyy-MM-dd');
        todayBypass = localBypass.filter(b => (b.created_at || '').startsWith(todayStr)).length;
        yBypass = localBypass.filter(b => (b.created_at || '').startsWith(yStr)).length;
      } catch {/* ignore */}

      if (todayBypass === 0 && yBypass === 0) {
        const todayStartStr = format(startOfDay(today), "yyyy-MM-dd'T'HH:mm:ss");
        const { data: bypassLogs } = await supabase
          .from('shield_bypass_logs')
          .select('id')
          .eq('user_id', user.id)
          .gte('created_at', todayStartStr);
        todayBypass = bypassLogs?.length || 0;

        const yesterday = subDays(today, 1);
        const yesterdayStartStr = format(startOfDay(yesterday), "yyyy-MM-dd'T'HH:mm:ss");
        const yesterdayEndStr = format(endOfDay(yesterday), "yyyy-MM-dd'T'HH:mm:ss");
        const { data: yesterdayLogs } = await supabase
          .from('shield_bypass_logs')
          .select('id')
          .eq('user_id', user.id)
          .gte('created_at', yesterdayStartStr)
          .lt('created_at', yesterdayEndStr);
        yBypass = yesterdayLogs?.length || 0;
      }

      setTotalBypassAttempts(todayBypass);
      setYesterdayBypasses(yBypass);
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };
  
  const getScoreColor = () => {
    if (score >= 80) return 'text-emerald-500';
    if (score >= 60) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getScoreLabel = () => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Average';
    return 'Needs Work';
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  const formatSessionTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return format(date, 'MMM d');
  };

  return (
    <div className="space-y-4">
      {/* Discipline Score Card */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700 shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Discipline Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className={`text-5xl font-bold ${getScoreColor()}`}>{score}</p>
              <p className="text-sm text-white/70">{getScoreLabel()}</p>
            </div>
            <div className="h-20 w-20 rounded-full border-4 border-white/20 flex items-center justify-center">
              <div className="text-center">
                <Flame className="h-6 w-6 mx-auto text-orange-500" />
                <p className="text-xs mt-1">{disciplineScore?.current_streak_days || 0} days</p>
              </div>
            </div>
          </div>
          <Progress value={score} className="h-2" />
          <p className="text-xs text-white/50 mt-2">
            {score >= 60 ? '✓ Absolute Mode unlocked' : `${60 - score} more points to unlock Absolute Mode`}
          </p>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-4 text-center">
            <Clock className="h-8 w-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">
              {formatMinutes(disciplineScore?.total_focus_minutes || 0)}
            </p>
            <p className="text-xs text-muted-foreground">Total Focus Time</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
            <p className="text-2xl font-bold">
              {formatMinutes(disciplineScore?.total_time_saved_minutes || 0)}
            </p>
            <p className="text-xs text-muted-foreground">Time Saved</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weekly Discipline Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between h-32 gap-1">
            {weeklyData.map((day, index) => (
              <div key={`${day.day}-${index}`} className="flex-1 flex flex-col items-center gap-1">
                <div 
                  className="w-full bg-primary/20 rounded-t-lg transition-all"
                  style={{ height: `${Math.max(day.score, 5)}%` }}
                >
                  <div 
                    className="w-full bg-primary rounded-t-lg"
                    style={{ height: '100%' }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground font-medium">{day.day}</p>
              </div>
            ))}
          </div>
          {weeklyData.every(d => d.sessions === 0) && (
            <p className="text-xs text-muted-foreground text-center mt-2">No sessions this week yet</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent sessions</p>
          ) : (
            recentActivity.map((session) => (
              <div key={session.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                {session.status === 'completed' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : session.bypass_attempts > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{session.profile_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {session.status === 'completed' ? 'Completed' : session.status}
                    {session.bypass_attempts > 0 && ` • ${session.bypass_attempts} bypass attempts`}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap">{formatSessionTime(session.started_at)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Honest Insight */}
      <Card className="bg-muted/50 shadow-sm border-dashed">
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground text-center">
            {totalBypassAttempts > 0 ? (
              <>
                You tried to escape focus <span className="font-bold text-foreground">{totalBypassAttempts} times</span> today. 
                Yesterday: <span className="font-bold text-foreground">{yesterdayBypasses} times</span>. 
                {totalBypassAttempts < yesterdayBypasses ? " You're improving. 💪" : " Stay strong! 🛡️"}
              </>
            ) : (
              <>No bypass attempts today. Keep it up! 🎯</>
            )}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
