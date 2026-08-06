import { useState, useEffect } from 'react';
import { format, subDays, differenceInDays, startOfYear } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EnhancedGamification } from '@/components/gamification/EnhancedGamification';
import { AccountabilityPartners } from '@/components/community/AccountabilityPartners';
import { GlobalChallenges } from '@/components/community/GlobalChallenges';
import { 
  Trophy, Flame, Star, Target, BookOpen, Clock, 
  Zap, Award, Crown, Sparkles, TrendingUp, Users, Globe
} from 'lucide-react';

interface UserScores {
  deen_score: number;
  discipline_score: number;
  focus_score: number;
  productivity_score: number;
  study_streak: number;
  salah_streak: number;
  quran_streak: number;
  level: number;
  total_points: number;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  unlocked: boolean;
  progress?: number;
  target?: number;
}

const LEVELS = [
  { level: 1, name: 'Beginner', minPoints: 0, color: 'bg-gray-500' },
  { level: 2, name: 'Seeker', minPoints: 100, color: 'bg-green-500' },
  { level: 3, name: 'Achiever', minPoints: 300, color: 'bg-blue-500' },
  { level: 4, name: 'Warrior', minPoints: 600, color: 'bg-purple-500' },
  { level: 5, name: 'Champion', minPoints: 1000, color: 'bg-yellow-500' },
  { level: 6, name: 'Master', minPoints: 1500, color: 'bg-orange-500' },
  { level: 7, name: 'Legend', minPoints: 2500, color: 'bg-red-500' },
  { level: 8, name: 'Elite', minPoints: 4000, color: 'bg-pink-500' },
  { level: 9, name: 'Grandmaster', minPoints: 6000, color: 'bg-indigo-500' },
  { level: 10, name: 'Transcendent', minPoints: 10000, color: 'bg-gradient-to-r from-yellow-500 to-orange-500' },
];

export default function Gamification() {
  const { user } = useAuth();
  const [scores, setScores] = useState<UserScores | null>(null);
  const [totalEntries, setTotalEntries] = useState(0);
  const [totalStudyHours, setTotalStudyHours] = useState(0);
  const [quranDays, setQuranDays] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Fetch latest scores
      const { data: scoresData } = await supabase
        .from('user_scores')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (scoresData) {
        setScores(scoresData as UserScores);
      }

      // Fetch statistics
      const yearStart = format(startOfYear(new Date()), 'yyyy-MM-dd');
      
      const { data: entries } = await supabase
        .from('daily_entries')
        .select('focused_study_minutes, quran_read')
        .eq('user_id', user.id)
        .gte('date', yearStart);

      if (entries) {
        setTotalEntries(entries.length);
        setTotalStudyHours(Math.round(entries.reduce((sum, e) => sum + (e.focused_study_minutes || 0), 0) / 60));
        setQuranDays(entries.filter(e => e.quran_read).length);
      }

      // Calculate streaks
      await calculateStreaks();
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStreaks = async () => {
    if (!user) return;

    const { data: entries } = await supabase
      .from('daily_entries')
      .select('date, focused_study_minutes, fajr_completed, dhuhr_completed, asr_completed, maghrib_completed, isha_completed, quran_read')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(365);

    if (!entries || entries.length === 0) return;

    let studyStreak = 0;
    let salahStreak = 0;
    let quranStreak = 0;

    // Calculate study streak
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const expectedDate = format(subDays(new Date(), i), 'yyyy-MM-dd');
      if (entry.date !== expectedDate) break;
      if ((entry.focused_study_minutes || 0) >= 30) {
        studyStreak++;
      } else {
        break;
      }
    }

    // Calculate salah streak (all 5 prayers)
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const expectedDate = format(subDays(new Date(), i), 'yyyy-MM-dd');
      if (entry.date !== expectedDate) break;
      if (entry.fajr_completed && entry.dhuhr_completed && entry.asr_completed && 
          entry.maghrib_completed && entry.isha_completed) {
        salahStreak++;
      } else {
        break;
      }
    }

    // Calculate Quran streak
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const expectedDate = format(subDays(new Date(), i), 'yyyy-MM-dd');
      if (entry.date !== expectedDate) break;
      if (entry.quran_read) {
        quranStreak++;
      } else {
        break;
      }
    }

    // Calculate total points
    const totalPoints = (scores?.total_points || 0) + studyStreak * 5 + salahStreak * 10 + quranStreak * 7;
    
    // Update scores
    await supabase
      .from('user_scores')
      .upsert({
        user_id: user.id,
        date: format(new Date(), 'yyyy-MM-dd'),
        study_streak: studyStreak,
        salah_streak: salahStreak,
        quran_streak: quranStreak,
        total_points: totalPoints,
        level: LEVELS.filter(l => l.minPoints <= totalPoints).pop()?.level || 1,
      }, { onConflict: 'user_id,date' });

    setScores(prev => prev ? {
      ...prev,
      study_streak: studyStreak,
      salah_streak: salahStreak,
      quran_streak: quranStreak,
      total_points: totalPoints,
    } : null);
  };

  const getCurrentLevel = () => {
    const points = scores?.total_points || 0;
    return LEVELS.filter(l => l.minPoints <= points).pop() || LEVELS[0];
  };

  const getNextLevel = () => {
    const currentLevel = getCurrentLevel();
    return LEVELS.find(l => l.level === currentLevel.level + 1) || null;
  };

  const getProgressToNextLevel = () => {
    const points = scores?.total_points || 0;
    const currentLevel = getCurrentLevel();
    const nextLevel = getNextLevel();
    if (!nextLevel) return 100;
    const progressPoints = points - currentLevel.minPoints;
    const neededPoints = nextLevel.minPoints - currentLevel.minPoints;
    return Math.round((progressPoints / neededPoints) * 100);
  };

  const achievements: Achievement[] = [
    {
      id: 'first_entry',
      name: 'First Steps',
      description: 'Log your first daily entry',
      icon: <Star className="h-6 w-6 text-yellow-500" />,
      unlocked: totalEntries >= 1,
    },
    {
      id: 'week_warrior',
      name: 'Week Warrior',
      description: 'Log entries for 7 consecutive days',
      icon: <Flame className="h-6 w-6 text-orange-500" />,
      unlocked: (scores?.study_streak || 0) >= 7,
      progress: Math.min(scores?.study_streak || 0, 7),
      target: 7,
    },
    {
      id: 'month_master',
      name: 'Month Master',
      description: 'Complete 30 days of tracking',
      icon: <Crown className="h-6 w-6 text-purple-500" />,
      unlocked: totalEntries >= 30,
      progress: Math.min(totalEntries, 30),
      target: 30,
    },
    {
      id: 'salah_guardian',
      name: 'Salah Guardian',
      description: 'Complete all 5 prayers for 7 days',
      icon: <Sparkles className="h-6 w-6 text-green-500" />,
      unlocked: (scores?.salah_streak || 0) >= 7,
      progress: Math.min(scores?.salah_streak || 0, 7),
      target: 7,
    },
    {
      id: 'quran_companion',
      name: 'Qur\'an Companion',
      description: 'Read Qur\'an for 14 days',
      icon: <BookOpen className="h-6 w-6 text-emerald-500" />,
      unlocked: quranDays >= 14,
      progress: Math.min(quranDays, 14),
      target: 14,
    },
    {
      id: 'study_champion',
      name: 'Study Champion',
      description: 'Accumulate 100 hours of study',
      icon: <Clock className="h-6 w-6 text-blue-500" />,
      unlocked: totalStudyHours >= 100,
      progress: Math.min(totalStudyHours, 100),
      target: 100,
    },
    {
      id: 'discipline_master',
      name: 'Discipline Master',
      description: 'Reach discipline score of 80+',
      icon: <Target className="h-6 w-6 text-red-500" />,
      unlocked: (scores?.discipline_score || 0) >= 80,
      progress: Math.min(scores?.discipline_score || 0, 80),
      target: 80,
    },
    {
      id: 'year_legend',
      name: 'Year Legend',
      description: 'Complete 365 days of tracking',
      icon: <Trophy className="h-6 w-6 text-yellow-600" />,
      unlocked: totalEntries >= 365,
      progress: Math.min(totalEntries, 365),
      target: 365,
    },
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  const currentLevel = getCurrentLevel();
  const nextLevel = getNextLevel();

  return (
    <AppLayout>
      <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Your Journey</h1>
          <p className="text-muted-foreground">Track your progress, earn achievements, and compete with the community</p>
        </div>

        <Tabs defaultValue="progress" className="space-y-4">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="progress">
              <Trophy className="h-4 w-4 mr-2" />
              Progress
            </TabsTrigger>
            <TabsTrigger value="community">
              <Users className="h-4 w-4 mr-2" />
              Community
            </TabsTrigger>
            <TabsTrigger value="challenges">
              <Globe className="h-4 w-4 mr-2" />
              Challenges
            </TabsTrigger>
          </TabsList>

          <TabsContent value="progress" className="space-y-6">
            {/* Level Card */}
            <Card className="overflow-hidden">
              <div className={`h-2 ${currentLevel.color}`} />
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-full ${currentLevel.color} flex items-center justify-center text-white`}>
                      <span className="text-2xl font-bold">{currentLevel.level}</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold">{currentLevel.name}</h2>
                      <p className="text-muted-foreground">{scores?.total_points || 0} total points</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <TrendingUp className="h-8 w-8 text-primary" />
                  </div>
                </div>
                
                {nextLevel && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress to {nextLevel.name}</span>
                      <span>{getProgressToNextLevel()}%</span>
                    </div>
                    <Progress value={getProgressToNextLevel()} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">
                      {nextLevel.minPoints - (scores?.total_points || 0)} points to next level
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Streaks */}
            <div className="grid gap-4 grid-cols-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center">
                      <Flame className="h-6 w-6 text-orange-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{scores?.study_streak || 0}</p>
                  <p className="text-xs text-muted-foreground">Study Streak</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-green-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{scores?.salah_streak || 0}</p>
                  <p className="text-xs text-muted-foreground">Salah Streak</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-emerald-500" />
                    </div>
                  </div>
                  <p className="text-2xl font-bold">{scores?.quran_streak || 0}</p>
                  <p className="text-xs text-muted-foreground">Qur'an Streak</p>
                </CardContent>
              </Card>
            </div>

            {/* Enhanced Achievements */}
            <EnhancedGamification />
          </TabsContent>

          <TabsContent value="community" className="space-y-6">
            <AccountabilityPartners />
          </TabsContent>

          <TabsContent value="challenges" className="space-y-6">
            <GlobalChallenges />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}