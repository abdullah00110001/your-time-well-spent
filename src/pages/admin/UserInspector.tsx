import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Loader2, 
  User,
  Calendar,
  Flame,
  Moon,
  Sun,
  CheckCircle2,
  XCircle,
  Clock,
  BookOpen,
  Brain,
  Heart,
  Zap
} from 'lucide-react';
import { format, subDays, startOfYear, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';

interface UserProfile {
  user_id: string;
  full_name: string | null;
  app_mode: string | null;
  created_at: string;
}

interface DayData {
  date: string;
  score: number | null;
  hasEntry: boolean;
}

interface DayDetail {
  date: string;
  fajr_completed: boolean;
  fajr_on_time: boolean;
  dhuhr_completed: boolean;
  dhuhr_on_time: boolean;
  asr_completed: boolean;
  asr_on_time: boolean;
  maghrib_completed: boolean;
  maghrib_on_time: boolean;
  isha_completed: boolean;
  isha_on_time: boolean;
  quran_read: boolean;
  quran_minutes: number | null;
  quran_surah: string | null;
  tahajjud_performed: boolean;
  focused_study_minutes: number | null;
  device_time_minutes: number | null;
  sleep_duration_minutes: number | null;
  sleep_quality: number | null;
  energy_level: number | null;
  discipline_level: number | null;
  current_mood: string | null;
  weighted_daily_score: number | null;
}

export default function UserInspector() {
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [heatmapData, setHeatmapData] = useState<DayData[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayDetail | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingHeatmap, setLoadingHeatmap] = useState(false);
  const [userStats, setUserStats] = useState<{
    totalDays: number;
    currentStreak: number;
    longestStreak: number;
    avgScore: number;
  } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    const userId = searchParams.get('id');
    if (userId && users.length > 0) {
      const user = users.find(u => u.user_id === userId);
      if (user) {
        selectUser(user);
      }
    }
  }, [searchParams, users]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = users.filter(u => 
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.user_id.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, app_mode, created_at')
      .order('created_at', { ascending: false });
    
    setUsers(data || []);
    setFilteredUsers(data || []);
    setLoading(false);
  };

  const selectUser = async (user: UserProfile) => {
    setSelectedUser(user);
    setLoadingHeatmap(true);

    // Fetch heatmap data for the year
    const yearStart = startOfYear(new Date());
    const today = new Date();
    const days = eachDayOfInterval({ start: yearStart, end: today });

    const { data: entries } = await supabase
      .from('daily_entries')
      .select('date, weighted_daily_score')
      .eq('user_id', user.user_id)
      .gte('date', format(yearStart, 'yyyy-MM-dd'));

    const entryMap = new Map(entries?.map(e => [e.date, e.weighted_daily_score]) || []);
    
    const heatmap: DayData[] = days.map(day => ({
      date: format(day, 'yyyy-MM-dd'),
      score: entryMap.get(format(day, 'yyyy-MM-dd')) ?? null,
      hasEntry: entryMap.has(format(day, 'yyyy-MM-dd'))
    }));

    setHeatmapData(heatmap);

    // Calculate stats
    const entriesWithData = heatmap.filter(d => d.hasEntry);
    const totalDays = entriesWithData.length;
    const avgScore = totalDays > 0 
      ? entriesWithData.reduce((sum, d) => sum + (d.score || 0), 0) / totalDays 
      : 0;

    // Calculate streaks
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    for (let i = heatmap.length - 1; i >= 0; i--) {
      if (heatmap[i].hasEntry) {
        tempStreak++;
        if (i === heatmap.length - 1 || heatmap[i + 1]?.hasEntry) {
          currentStreak = tempStreak;
        }
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    setUserStats({
      totalDays,
      currentStreak,
      longestStreak,
      avgScore: Math.round(avgScore * 10) / 10
    });

    setLoadingHeatmap(false);
  };

  const viewDayDetail = async (date: string) => {
    if (!selectedUser) return;

    const { data } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', selectedUser.user_id)
      .eq('date', date)
      .single();

    if (data) {
      setSelectedDay(data as DayDetail);
      setShowDayModal(true);
    }
  };

  const getHeatmapColor = (score: number | null, hasEntry: boolean) => {
    if (!hasEntry) return 'bg-muted/30';
    if (score === null) return 'bg-muted';
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-green-400';
    if (score >= 40) return 'bg-yellow-400';
    if (score >= 20) return 'bg-orange-400';
    return 'bg-red-400';
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-headline font-bold tracking-tight">User Inspector</h1>
          <p className="text-body text-muted-foreground">
            Deep dive into any user's activity and progress
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* User Search */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-subtitle">Search Users</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredUsers.slice(0, 20).map((user) => (
                    <button
                      key={user.user_id}
                      onClick={() => selectUser(user)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors',
                        selectedUser?.user_id === user.user_id
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted/50 hover:bg-muted'
                      )}
                    >
                      <div className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center',
                        selectedUser?.user_id === user.user_id
                          ? 'bg-primary-foreground/20'
                          : 'bg-background'
                      )}>
                        <User className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{user.full_name || 'Unknown'}</p>
                        <p className={cn(
                          'text-xs truncate',
                          selectedUser?.user_id === user.user_id
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground'
                        )}>
                          {user.app_mode === 'islamic' ? '🌙 Islamic' : '☀️ Regular'}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User Details & Heatmap */}
          <div className="lg:col-span-2 space-y-6">
            {selectedUser ? (
              <>
                {/* User Profile Card */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-title font-bold">{selectedUser.full_name || 'Unknown User'}</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={selectedUser.app_mode === 'islamic' ? 'default' : 'secondary'}>
                            {selectedUser.app_mode === 'islamic' ? <Moon className="h-3 w-3 mr-1" /> : <Sun className="h-3 w-3 mr-1" />}
                            {selectedUser.app_mode === 'islamic' ? 'Islamic' : 'Regular'} Mode
                          </Badge>
                          <span className="text-caption text-muted-foreground">
                            Joined {format(new Date(selectedUser.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>

                    {loadingHeatmap ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : (
                      <>
                        {/* Stats */}
                        <div className="grid grid-cols-4 gap-4 mb-6">
                          <div className="text-center p-3 rounded-xl bg-muted/50">
                            <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
                            <p className="text-title font-bold">{userStats?.totalDays}</p>
                            <p className="text-caption text-muted-foreground">Total Days</p>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-muted/50">
                            <Flame className="h-5 w-5 mx-auto mb-1 text-orange-500" />
                            <p className="text-title font-bold">{userStats?.currentStreak}</p>
                            <p className="text-caption text-muted-foreground">Current Streak</p>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-muted/50">
                            <Zap className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                            <p className="text-title font-bold">{userStats?.longestStreak}</p>
                            <p className="text-caption text-muted-foreground">Best Streak</p>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-muted/50">
                            <Heart className="h-5 w-5 mx-auto mb-1 text-red-500" />
                            <p className="text-title font-bold">{userStats?.avgScore}</p>
                            <p className="text-caption text-muted-foreground">Avg Score</p>
                          </div>
                        </div>

                        {/* Heatmap */}
                        <div>
                          <h3 className="text-subtitle font-semibold mb-3">{new Date().getFullYear()} Activity</h3>
                          <div className="grid grid-cols-[repeat(53,1fr)] gap-0.5 overflow-x-auto">
                            {Array.from({ length: 7 }).map((_, dayOfWeek) => (
                              <div key={dayOfWeek} className="contents">
                                {heatmapData
                                  .filter((_, i) => new Date(heatmapData[i]?.date).getDay() === dayOfWeek)
                                  .map((day) => (
                                    <button
                                      key={day.date}
                                      onClick={() => day.hasEntry && viewDayDetail(day.date)}
                                      className={cn(
                                        'aspect-square rounded-sm transition-all',
                                        getHeatmapColor(day.score, day.hasEntry),
                                        day.hasEntry && 'cursor-pointer hover:ring-2 hover:ring-primary'
                                      )}
                                      title={`${day.date}: ${day.hasEntry ? `Score: ${day.score}` : 'No data'}`}
                                    />
                                  ))
                                }
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 mt-3 text-caption text-muted-foreground">
                            <span>Less</span>
                            <div className="flex gap-0.5">
                              <div className="w-3 h-3 rounded-sm bg-muted/30" />
                              <div className="w-3 h-3 rounded-sm bg-red-400" />
                              <div className="w-3 h-3 rounded-sm bg-orange-400" />
                              <div className="w-3 h-3 rounded-sm bg-yellow-400" />
                              <div className="w-3 h-3 rounded-sm bg-green-400" />
                              <div className="w-3 h-3 rounded-sm bg-green-500" />
                            </div>
                            <span>More</span>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Search className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-subtitle font-semibold mb-2">Select a User</h3>
                  <p className="text-body text-muted-foreground text-center">
                    Search and select a user from the list to view their detailed activity
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Day Detail Modal */}
        <Dialog open={showDayModal} onOpenChange={setShowDayModal}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-title">
                {selectedDay?.date && format(new Date(selectedDay.date), 'EEEE, MMMM d, yyyy')}
              </DialogTitle>
              <DialogDescription className="text-caption">
                Detailed activity for {selectedUser?.full_name}
              </DialogDescription>
            </DialogHeader>

            {selectedDay && (
              <div className="space-y-6 py-4">
                {/* Score Overview */}
                <div className="text-center p-4 rounded-xl bg-muted/50">
                  <p className="text-caption text-muted-foreground mb-1">Daily Score</p>
                  <p className="text-display font-bold text-primary">
                    {selectedDay.weighted_daily_score ?? 'N/A'}
                  </p>
                </div>

                {/* Prayers */}
                {selectedUser?.app_mode === 'islamic' && (
                  <div>
                    <h4 className="text-subtitle font-semibold mb-3 flex items-center gap-2">
                      <Moon className="h-4 w-4" /> Salah
                    </h4>
                    <div className="grid grid-cols-5 gap-2">
                      {['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((prayer) => {
                        const key = prayer.toLowerCase() as 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
                        const completed = selectedDay[`${key}_completed` as keyof DayDetail];
                        const onTime = selectedDay[`${key}_on_time` as keyof DayDetail];
                        return (
                          <div key={prayer} className={cn(
                            'text-center p-3 rounded-xl',
                            completed ? 'bg-green-500/10' : 'bg-muted/50'
                          )}>
                            {completed ? (
                              <CheckCircle2 className={cn(
                                'h-5 w-5 mx-auto mb-1',
                                onTime ? 'text-green-500' : 'text-yellow-500'
                              )} />
                            ) : (
                              <XCircle className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                            )}
                            <p className="text-caption font-medium">{prayer}</p>
                            {completed && (
                              <p className="text-[10px] text-muted-foreground">
                                {onTime ? 'On time' : 'Late'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Quran */}
                {selectedUser?.app_mode === 'islamic' && (
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                    <BookOpen className={cn(
                      'h-8 w-8',
                      selectedDay.quran_read ? 'text-primary' : 'text-muted-foreground'
                    )} />
                    <div>
                      <p className="font-medium">{selectedDay.quran_read ? 'Quran Read' : 'No Quran'}</p>
                      {selectedDay.quran_read && (
                        <p className="text-caption text-muted-foreground">
                          {selectedDay.quran_minutes} min • {selectedDay.quran_surah || 'Not specified'}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Study & Focus */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-muted/50">
                    <Brain className="h-5 w-5 text-primary mb-2" />
                    <p className="text-title font-bold">{selectedDay.focused_study_minutes || 0} min</p>
                    <p className="text-caption text-muted-foreground">Focused Study</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/50">
                    <Clock className="h-5 w-5 text-secondary mb-2" />
                    <p className="text-title font-bold">{selectedDay.device_time_minutes || 0} min</p>
                    <p className="text-caption text-muted-foreground">Device Time</p>
                  </div>
                </div>

                {/* Health */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-xl bg-muted/50">
                    <p className="text-caption text-muted-foreground mb-1">Sleep</p>
                    <p className="text-subtitle font-bold">
                      {selectedDay.sleep_duration_minutes ? Math.round(selectedDay.sleep_duration_minutes / 60 * 10) / 10 : 0}h
                    </p>
                    <p className="text-caption">Quality: {selectedDay.sleep_quality || 'N/A'}/10</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/50">
                    <p className="text-caption text-muted-foreground mb-1">Energy</p>
                    <p className="text-subtitle font-bold">{selectedDay.energy_level || 'N/A'}/10</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-muted/50">
                    <p className="text-caption text-muted-foreground mb-1">Discipline</p>
                    <p className="text-subtitle font-bold">{selectedDay.discipline_level || 'N/A'}/10</p>
                  </div>
                </div>

                {/* Mood */}
                {selectedDay.current_mood && (
                  <div className="p-4 rounded-xl bg-muted/50 text-center">
                    <p className="text-caption text-muted-foreground mb-1">Mood</p>
                    <p className="text-title font-medium capitalize">{selectedDay.current_mood}</p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
