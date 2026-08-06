import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Globe, Users, Trophy, Target, Clock, TrendingUp, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GlobalChallenge {
  id: string;
  title: string;
  description: string;
  participants: number;
  target: number;
  progress: number;
  daysLeft: number;
  category: string;
  icon: string;
  joined: boolean;
}

export function GlobalChallenges() {
  const { user } = useAuth();
  const [challenges, setChallenges] = useState<GlobalChallenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [joiningChallenge, setJoiningChallenge] = useState<string | null>(null);

  useEffect(() => {
    loadChallenges();
  }, [user]);

  const loadChallenges = async () => {
    setIsLoading(true);
    try {
      // Load challenges from database
      const { data: dbChallenges } = await supabase
        .from('challenges')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Check which ones user has joined
      let userChallengeIds: string[] = [];
      if (user) {
        const { data: userChallenges } = await supabase
          .from('user_challenges')
          .select('challenge_id')
          .eq('user_id', user.id);
        userChallengeIds = userChallenges?.map(uc => uc.challenge_id) || [];
      }

      // Map to GlobalChallenge format with participant counts
      const mappedChallenges: GlobalChallenge[] = await Promise.all(
        (dbChallenges || []).map(async (c) => {
          // Get participant count
          const { count } = await supabase
            .from('user_challenges')
            .select('*', { count: 'exact', head: true })
            .eq('challenge_id', c.id);

          // Calculate days left
          const endDate = c.end_date ? new Date(c.end_date) : new Date();
          const now = new Date();
          const daysLeft = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

          return {
            id: c.id,
            title: c.title,
            description: c.description,
            participants: count || 0,
            target: c.target_value,
            progress: 0, // Would need to aggregate from user_challenges
            daysLeft,
            category: c.challenge_type,
            icon: c.badge_icon || '🎯',
            joined: userChallengeIds.includes(c.id)
          };
        })
      );

      // Add some evergreen challenges if none exist
      if (mappedChallenges.length === 0) {
        setChallenges([
          {
            id: 'quran-100',
            title: '100 Days of Quran',
            description: 'Read Quran daily for 100 consecutive days',
            participants: 847,
            target: 100,
            progress: 23,
            daysLeft: 77,
            category: 'spiritual',
            icon: '📖',
            joined: false
          },
          {
            id: 'fajr-warriors',
            title: 'Fajr Warriors',
            description: 'Wake up and pray Fajr on time for 30 days',
            participants: 1234,
            target: 30,
            progress: 0,
            daysLeft: 30,
            category: 'spiritual',
            icon: '🌅',
            joined: false
          },
          {
            id: 'fitness-month',
            title: 'Fitness Month',
            description: 'Exercise at least 20 days this month',
            participants: 562,
            target: 20,
            progress: 0,
            daysLeft: 15,
            category: 'health',
            icon: '💪',
            joined: false
          },
          {
            id: 'digital-detox',
            title: 'Digital Detox Challenge',
            description: 'Keep screen time under 2 hours for 21 days',
            participants: 389,
            target: 21,
            progress: 0,
            daysLeft: 21,
            category: 'productivity',
            icon: '📵',
            joined: false
          }
        ]);
      } else {
        setChallenges(mappedChallenges);
      }
    } catch (error) {
      console.error('Error loading challenges:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const joinChallenge = async (challengeId: string) => {
    if (!user) {
      toast.error('Please sign in to join challenges');
      return;
    }

    setJoiningChallenge(challengeId);
    try {
      // Check if it's a real challenge in DB
      const { data: existingChallenge } = await supabase
        .from('challenges')
        .select('id')
        .eq('id', challengeId)
        .single();

      if (existingChallenge) {
        const { error } = await supabase
          .from('user_challenges')
          .insert({
            user_id: user.id,
            challenge_id: challengeId,
            progress: 0
          });

        if (error) throw error;
      }

      // Update local state
      setChallenges(prev => 
        prev.map(c => 
          c.id === challengeId 
            ? { ...c, joined: true, participants: c.participants + 1 }
            : c
        )
      );

      toast.success('Challenge joined! Good luck! 🎯');
    } catch (error) {
      console.error('Error joining challenge:', error);
      toast.error('Failed to join challenge');
    } finally {
      setJoiningChallenge(null);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'spiritual': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'health': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'productivity': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            Global Challenges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
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
          <Globe className="h-5 w-5 text-blue-500" />
          Global Challenges
        </CardTitle>
        <CardDescription>
          Join community-wide challenges and grow together
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {challenges.map(challenge => (
          <div
            key={challenge.id}
            className="p-4 rounded-lg border bg-card hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1">
                <span className="text-3xl">{challenge.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold">{challenge.title}</h4>
                    <Badge variant="outline" className={getCategoryColor(challenge.category)}>
                      {challenge.category}
                    </Badge>
                    {challenge.joined && (
                      <Badge className="bg-emerald-500 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Joined
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{challenge.description}</p>
                  
                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {challenge.participants.toLocaleString()} participants
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {challenge.daysLeft} days left
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      {challenge.target} days target
                    </span>
                  </div>

                  {/* Progress (if joined) */}
                  {challenge.joined && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Your Progress</span>
                        <span>{challenge.progress}/{challenge.target}</span>
                      </div>
                      <Progress value={(challenge.progress / challenge.target) * 100} className="h-2" />
                    </div>
                  )}
                </div>
              </div>
              
              {!challenge.joined && (
                <Button
                  size="sm"
                  onClick={() => joinChallenge(challenge.id)}
                  disabled={joiningChallenge === challenge.id}
                >
                  Join
                </Button>
              )}
            </div>
          </div>
        ))}

        {/* Leaderboard Preview */}
        <div className="mt-6 p-4 rounded-lg bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <div>
                <h4 className="font-semibold">Community Leaderboard</h4>
                <p className="text-xs text-muted-foreground">See top performers</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
