import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Trophy, Flame, Star, Zap, Crown, Medal, Award, Target, Gift, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  progress: number;
  target: number;
  unlocked: boolean;
  unlockedAt?: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  xpReward: number;
}

interface UserLevel {
  level: number;
  xp: number;
  xpToNext: number;
  title: string;
}

export function EnhancedGamification() {
  const { user } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userLevel, setUserLevel] = useState<UserLevel>({ level: 1, xp: 0, xpToNext: 100, title: 'Beginner' });
  const [isLoading, setIsLoading] = useState(true);
  const [weeklyBonusActive, setWeeklyBonusActive] = useState(false);

  useEffect(() => {
    if (user) {
      loadGamificationData();
    }
  }, [user]);

  const loadGamificationData = async () => {
    if (!user) return;
    setIsLoading(true);

    try {
      // Get user scores
      const { data: scores } = await supabase
        .from('user_scores')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1);

      // Get daily entries for achievements
      const { data: entries } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(365);

      // Get earned badges
      const { data: badges } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', user.id);

      // Calculate level and XP
      const totalPoints = scores?.[0]?.total_points || 0;
      const level = Math.floor(totalPoints / 500) + 1;
      const xpInLevel = totalPoints % 500;
      const titles = ['Beginner', 'Apprentice', 'Journeyman', 'Expert', 'Master', 'Grandmaster', 'Legend'];
      
      setUserLevel({
        level,
        xp: xpInLevel,
        xpToNext: 500,
        title: titles[Math.min(level - 1, titles.length - 1)]
      });

      // Check for weekly bonus (Sunday)
      const today = new Date().getDay();
      setWeeklyBonusActive(today === 0);

      // Calculate achievements
      const entriesCount = entries?.length || 0;
      const consecutiveDays = scores?.[0]?.study_streak || 0;
      const quranDays = entries?.filter(e => e.quran_read).length || 0;
      const salahPerfectDays = entries?.filter(e => 
        e.fajr_completed && e.dhuhr_completed && e.asr_completed && 
        e.maghrib_completed && e.isha_completed
      ).length || 0;
      const exerciseDays = entries?.filter(e => e.exercise_done).length || 0;
      const tahajjudDays = entries?.filter(e => e.tahajjud_performed).length || 0;

      const achievementsList: Achievement[] = [
        {
          id: 'first-entry',
          name: 'First Step',
          description: 'Complete your first daily entry',
          icon: <Star className="h-5 w-5 text-amber-500" />,
          progress: Math.min(entriesCount, 1),
          target: 1,
          unlocked: entriesCount >= 1,
          rarity: 'common',
          xpReward: 10
        },
        {
          id: 'week-warrior',
          name: 'Week Warrior',
          description: 'Complete 7 consecutive days',
          icon: <Flame className="h-5 w-5 text-orange-500" />,
          progress: Math.min(consecutiveDays, 7),
          target: 7,
          unlocked: consecutiveDays >= 7,
          rarity: 'common',
          xpReward: 50
        },
        {
          id: 'month-master',
          name: 'Month Master',
          description: 'Complete 30 consecutive days',
          icon: <Trophy className="h-5 w-5 text-yellow-500" />,
          progress: Math.min(consecutiveDays, 30),
          target: 30,
          unlocked: consecutiveDays >= 30,
          rarity: 'rare',
          xpReward: 200
        },
        {
          id: 'quran-devotee',
          name: 'Quran Devotee',
          description: 'Read Quran for 50 days',
          icon: <Sparkles className="h-5 w-5 text-emerald-500" />,
          progress: Math.min(quranDays, 50),
          target: 50,
          unlocked: quranDays >= 50,
          rarity: 'rare',
          xpReward: 150
        },
        {
          id: 'salah-perfectionist',
          name: 'Salah Perfectionist',
          description: 'Complete all 5 prayers for 21 days',
          icon: <Crown className="h-5 w-5 text-purple-500" />,
          progress: Math.min(salahPerfectDays, 21),
          target: 21,
          unlocked: salahPerfectDays >= 21,
          rarity: 'epic',
          xpReward: 300
        },
        {
          id: 'fitness-champion',
          name: 'Fitness Champion',
          description: 'Exercise for 30 days',
          icon: <Zap className="h-5 w-5 text-blue-500" />,
          progress: Math.min(exerciseDays, 30),
          target: 30,
          unlocked: exerciseDays >= 30,
          rarity: 'rare',
          xpReward: 150
        },
        {
          id: 'tahajjud-warrior',
          name: 'Tahajjud Warrior',
          description: 'Pray Tahajjud for 10 nights',
          icon: <Medal className="h-5 w-5 text-indigo-500" />,
          progress: Math.min(tahajjudDays, 10),
          target: 10,
          unlocked: tahajjudDays >= 10,
          rarity: 'epic',
          xpReward: 250
        },
        {
          id: 'century-legend',
          name: 'Century Legend',
          description: 'Complete 100 consecutive days',
          icon: <Award className="h-5 w-5 text-rose-500" />,
          progress: Math.min(consecutiveDays, 100),
          target: 100,
          unlocked: consecutiveDays >= 100,
          rarity: 'legendary',
          xpReward: 1000
        }
      ];

      setAchievements(achievementsList);
    } catch (error) {
      console.error('Error loading gamification data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'common': return 'border-muted-foreground/50 bg-muted/30';
      case 'rare': return 'border-blue-500/50 bg-blue-500/10';
      case 'epic': return 'border-purple-500/50 bg-purple-500/10';
      case 'legendary': return 'border-amber-500/50 bg-gradient-to-br from-amber-500/20 to-orange-500/20';
      default: return 'border-muted';
    }
  };

  const getRarityBadge = (rarity: string) => {
    switch (rarity) {
      case 'common': return <Badge variant="secondary">Common</Badge>;
      case 'rare': return <Badge className="bg-blue-500">Rare</Badge>;
      case 'epic': return <Badge className="bg-purple-500">Epic</Badge>;
      case 'legendary': return <Badge className="bg-gradient-to-r from-amber-500 to-orange-500">Legendary</Badge>;
      default: return null;
    }
  };

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Achievements & Rewards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-amber-500" />
          Achievements & Rewards
        </CardTitle>
        <CardDescription>
          {unlockedCount}/{achievements.length} achievements unlocked
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Level Progress */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">{userLevel.level}</span>
              </div>
              <div>
                <h3 className="font-semibold">{userLevel.title}</h3>
                <p className="text-sm text-muted-foreground">Level {userLevel.level}</p>
              </div>
            </div>
            {weeklyBonusActive && (
              <Badge className="bg-gradient-to-r from-amber-500 to-orange-500">
                <Gift className="h-3 w-3 mr-1" />
                2x XP Sunday!
              </Badge>
            )}
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{userLevel.xp} XP</span>
              <span>{userLevel.xpToNext} XP</span>
            </div>
            <Progress value={(userLevel.xp / userLevel.xpToNext) * 100} className="h-2" />
          </div>
        </div>

        {/* Achievement Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {achievements.map(achievement => (
            <div
              key={achievement.id}
              className={`p-3 rounded-lg border ${getRarityColor(achievement.rarity)} ${
                achievement.unlocked ? 'opacity-100' : 'opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${achievement.unlocked ? 'bg-card' : 'bg-muted'}`}>
                  {achievement.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm truncate">{achievement.name}</h4>
                    {achievement.unlocked && (
                      <Badge variant="outline" className="text-xs border-emerald-500 text-emerald-500">
                        ✓
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{achievement.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <Progress 
                      value={(achievement.progress / achievement.target) * 100} 
                      className="h-1.5 flex-1 mr-2" 
                    />
                    <span className="text-xs text-muted-foreground">
                      {achievement.progress}/{achievement.target}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    {getRarityBadge(achievement.rarity)}
                    <span className="text-xs text-amber-500">+{achievement.xpReward} XP</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
