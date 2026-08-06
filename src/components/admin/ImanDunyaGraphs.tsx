import { useState, useEffect } from 'react';
import { format, subDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Heart, Briefcase, AlertTriangle, TrendingDown } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, AreaChart, Area
} from 'recharts';

interface ImanDunyaData {
  date: string;
  iman: number;
  dunya: number;
  userId?: string;
}

interface AtRiskUser {
  userId: string;
  userName: string;
  daysDecreasing: number;
  currentIman: number;
}

interface ImanDunyaGraphsProps {
  selectedUserId?: string | null;
  onUserAlert?: (userId: string, date: string) => void;
}

export default function ImanDunyaGraphs({ selectedUserId, onUserAlert }: ImanDunyaGraphsProps) {
  const [graphData, setGraphData] = useState<ImanDunyaData[]>([]);
  const [atRiskUsers, setAtRiskUsers] = useState<AtRiskUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedUserId]);

  const fetchData = async () => {
    setLoading(true);
    const last30Days = format(subDays(new Date(), 29), 'yyyy-MM-dd');

    let query = supabase
      .from('daily_entries')
      .select(`
        date, user_id,
        fajr_completed, dhuhr_completed, asr_completed, maghrib_completed, isha_completed,
        quran_read, quran_minutes, tahajjud_performed, khushu_level,
        focused_study_minutes, revision_minutes, skill_learning_minutes, exercise_done,
        niyyah_type, akhirah_score, dunya_score
      `)
      .gte('date', last30Days)
      .order('date', { ascending: true });

    if (selectedUserId) {
      query = query.eq('user_id', selectedUserId);
    }

    const { data: entries } = await query;
    if (!entries || entries.length === 0) {
      setGraphData([]);
      setLoading(false);
      return;
    }

    // Calculate Iman (Worship) Score per entry
    // Components: Salah (40%), Quran (25%), Tahajjud (15%), Khushu (10%), Niyyah for Allah (10%)
    const calculateImanScore = (entry: any) => {
      const salahCount = [
        entry.fajr_completed, entry.dhuhr_completed, entry.asr_completed,
        entry.maghrib_completed, entry.isha_completed
      ].filter(Boolean).length;
      const salahScore = (salahCount / 5) * 40;
      
      const quranScore = entry.quran_read ? 
        Math.min(25, (entry.quran_minutes || 0) / 30 * 25) : 0;
      
      const tahajjudScore = entry.tahajjud_performed ? 15 : 0;
      const khushuScore = ((entry.khushu_level || 0) / 10) * 10;
      const niyyahScore = entry.niyyah_type === 'allah' ? 10 : 
                         entry.niyyah_type === 'career' ? 5 : 0;

      return Math.round(salahScore + quranScore + tahajjudScore + khushuScore + niyyahScore);
    };

    // Calculate Dunya (Work/Study) Score per entry
    // Components: Study (40%), Skills (30%), Exercise (20%), Niyyah productivity (10%)
    const calculateDunyaScore = (entry: any) => {
      const studyMinutes = (entry.focused_study_minutes || 0) + (entry.revision_minutes || 0);
      const studyScore = Math.min(40, studyMinutes / 180 * 40); // 3 hours = max
      
      const skillScore = Math.min(30, (entry.skill_learning_minutes || 0) / 60 * 30);
      const exerciseScore = entry.exercise_done ? 20 : 0;
      const niyyahProductivity = entry.niyyah_type ? 10 : 0;

      return Math.round(studyScore + skillScore + exerciseScore + niyyahProductivity);
    };

    // Aggregate by date
    const dateMap = new Map<string, { iman: number; dunya: number; count: number }>();
    const userImanTrend = new Map<string, number[]>();

    entries.forEach(entry => {
      const imanScore = entry.akhirah_score || calculateImanScore(entry);
      const dunyaScore = entry.dunya_score || calculateDunyaScore(entry);

      // Aggregate for graph
      const existing = dateMap.get(entry.date) || { iman: 0, dunya: 0, count: 0 };
      dateMap.set(entry.date, {
        iman: existing.iman + imanScore,
        dunya: existing.dunya + dunyaScore,
        count: existing.count + 1,
      });

      // Track per-user trends for at-risk detection
      if (!selectedUserId) {
        const userScores = userImanTrend.get(entry.user_id) || [];
        userScores.push(imanScore);
        userImanTrend.set(entry.user_id, userScores);
      }
    });

    const chartData = Array.from(dateMap.entries()).map(([date, values]) => ({
      date: format(new Date(date), 'MMM d'),
      iman: Math.round(values.iman / values.count),
      dunya: Math.round(values.dunya / values.count),
    }));

    setGraphData(chartData);

    // Find at-risk users (Iman decreasing for 3+ days)
    if (!selectedUserId) {
      const atRisk: AtRiskUser[] = [];
      
      // Get user names
      const userIds = Array.from(userImanTrend.keys());
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      
      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name || 'Unknown']) || []);

      userImanTrend.forEach((scores, userId) => {
        if (scores.length >= 3) {
          const lastThree = scores.slice(-3);
          const isDecreasing = lastThree.every((score, i) => 
            i === 0 || score < lastThree[i - 1]
          );
          
          if (isDecreasing) {
            atRisk.push({
              userId,
              userName: nameMap.get(userId) || 'Unknown',
              daysDecreasing: 3,
              currentIman: lastThree[lastThree.length - 1],
            });
          }
        }
      });

      setAtRiskUsers(atRisk);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] bg-muted rounded" />
          </CardContent>
        </Card>
        <Card className="animate-pulse">
          <CardHeader>
            <div className="h-6 bg-muted rounded w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* At-Risk Users Alert */}
      {atRiskUsers.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
              Intervention Needed
            </CardTitle>
            <CardDescription>
              Users with declining Iman scores for 3+ consecutive days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {atRiskUsers.map(user => (
                <Badge 
                  key={user.userId}
                  variant="outline"
                  className="cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/50 border-amber-500"
                  onClick={() => onUserAlert?.(user.userId, format(new Date(), 'yyyy-MM-dd'))}
                >
                  <TrendingDown className="h-3 w-3 mr-1 text-amber-600" />
                  {user.userName} (Iman: {user.currentIman})
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Iman Graph */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-emerald-500" />
              Iman Graph (Worship)
            </CardTitle>
            <CardDescription>
              Prayer + Quran + Tahajjud + Khushu + Niyyah
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {graphData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={graphData}>
                    <defs>
                      <linearGradient id="imanGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142 76% 36%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(142 76% 36%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="iman" 
                      stroke="hsl(142 76% 36%)" 
                      fill="url(#imanGradient)"
                      strokeWidth={2}
                      name="Iman Score"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Dunya Graph */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-blue-500" />
              Dunya Graph (Productivity)
            </CardTitle>
            <CardDescription>
              Study + Skills + Exercise + Focus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              {graphData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={graphData}>
                    <defs>
                      <linearGradient id="dunyaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis domain={[0, 100]} className="text-xs" />
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="dunya" 
                      stroke="hsl(217 91% 60%)" 
                      fill="url(#dunyaGradient)"
                      strokeWidth={2}
                      name="Dunya Score"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Combined View */}
      <Card>
        <CardHeader>
          <CardTitle>Iman vs Dunya Balance</CardTitle>
          <CardDescription>
            Ideal balance: Strong Iman foundation with productive Dunya efforts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {graphData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis domain={[0, 100]} className="text-xs" />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="iman" 
                    stroke="hsl(142 76% 36%)" 
                    strokeWidth={2}
                    name="Iman (Worship)"
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="dunya" 
                    stroke="hsl(217 91% 60%)" 
                    strokeWidth={2}
                    name="Dunya (Productivity)"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
