import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useChallenges } from '@/hooks/useChallenges';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAppMode } from '@/contexts/AppModeContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Target, Clock, Star, Zap, Award, Calendar, CheckCircle2, Loader2 } from 'lucide-react';

export default function Challenges() {
  const { language } = useLanguage();
  const { mode } = useAppMode();
  const { 
    challenges, 
    userChallenges, 
    userBadges, 
    loading, 
    joinChallenge,
    getActiveChallenges,
    getJoinedChallenges 
  } = useChallenges();
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const handleJoin = async (challengeId: string) => {
    setJoiningId(challengeId);
    await joinChallenge(challengeId);
    setJoiningId(null);
  };

  const getChallengeTypeIcon = (type: string) => {
    switch (type) {
      case 'daily': return <Zap className="h-4 w-4" />;
      case 'weekly': return <Calendar className="h-4 w-4" />;
      case 'monthly': return <Star className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getChallengeTypeColor = (type: string) => {
    switch (type) {
      case 'daily': return 'bg-amber-500/20 text-amber-500 border-amber-500/30';
      case 'weekly': return 'bg-blue-500/20 text-blue-500 border-blue-500/30';
      case 'monthly': return 'bg-purple-500/20 text-purple-500 border-purple-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const availableChallenges = getActiveChallenges();
  const joinedChallenges = getJoinedChallenges();
  const completedChallenges = joinedChallenges.filter(uc => uc.is_completed);
  const activeChallenges = joinedChallenges.filter(uc => !uc.is_completed);

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-headline font-bold flex items-center gap-2">
            <Trophy className={`h-7 w-7 ${mode === 'islamic' ? 'text-emerald-500' : 'text-primary'}`} />
            Challenges
          </h1>
          <p className="text-muted-foreground mt-1">
            Complete challenges to earn badges and boost your progress
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-primary">{activeChallenges.length}</div>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-emerald-500">{completedChallenges.length}</div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-amber-500">{userBadges.length}</div>
              <p className="text-xs text-muted-foreground">Badges</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-500">{availableChallenges.length}</div>
              <p className="text-xs text-muted-foreground">Available</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="active" className="space-y-4">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="available">Discover</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
          </TabsList>

          {/* Active Challenges */}
          <TabsContent value="active" className="space-y-4">
            {activeChallenges.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No active challenges</p>
                  <p className="text-sm text-muted-foreground">Join a challenge to get started!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {activeChallenges.map((uc) => {
                  const challenge = uc.challenge;
                  if (!challenge) return null;
                  const progressPercent = Math.min((uc.progress / challenge.target_value) * 100, 100);

                  return (
                    <Card key={uc.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{challenge.badge_icon || '🎯'}</span>
                            <div>
                              <CardTitle className="text-base">
                                {language === 'bn' && challenge.title_bn ? challenge.title_bn : challenge.title}
                              </CardTitle>
                              <Badge variant="outline" className={`mt-1 ${getChallengeTypeColor(challenge.challenge_type)}`}>
                                {getChallengeTypeIcon(challenge.challenge_type)}
                                <span className="ml-1 capitalize">{challenge.challenge_type}</span>
                              </Badge>
                            </div>
                          </div>
                          <Badge variant="secondary" className="shrink-0">
                            +{challenge.reward_points} pts
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-3">
                          {language === 'bn' && challenge.description_bn ? challenge.description_bn : challenge.description}
                        </p>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span className="font-medium">{uc.progress} / {challenge.target_value}</span>
                          </div>
                          <Progress value={progressPercent} className="h-2" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Available Challenges */}
          <TabsContent value="available" className="space-y-4">
            {availableChallenges.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
                  <p className="text-muted-foreground">You've joined all available challenges!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {availableChallenges.map((challenge) => (
                  <Card key={challenge.id} className="overflow-hidden border-dashed">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{challenge.badge_icon || '🎯'}</span>
                          <div>
                            <CardTitle className="text-base">
                              {language === 'bn' && challenge.title_bn ? challenge.title_bn : challenge.title}
                            </CardTitle>
                            <Badge variant="outline" className={`mt-1 ${getChallengeTypeColor(challenge.challenge_type)}`}>
                              {getChallengeTypeIcon(challenge.challenge_type)}
                              <span className="ml-1 capitalize">{challenge.challenge_type}</span>
                            </Badge>
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          +{challenge.reward_points} pts
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {language === 'bn' && challenge.description_bn ? challenge.description_bn : challenge.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Target: {challenge.target_value} {challenge.target_metric.replace('_', ' ')}
                        </span>
                        <Button 
                          size="sm" 
                          onClick={() => handleJoin(challenge.id)}
                          disabled={joiningId === challenge.id}
                        >
                          {joiningId === challenge.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1" />
                          ) : (
                            <Target className="h-4 w-4 mr-1" />
                          )}
                          Join
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Completed Challenges */}
          <TabsContent value="completed" className="space-y-4">
            {completedChallenges.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No completed challenges yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {completedChallenges.map((uc) => {
                  const challenge = uc.challenge;
                  if (!challenge) return null;

                  return (
                    <Card key={uc.id} className="bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800">
                      <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{challenge.badge_icon || '🏆'}</span>
                          <div>
                            <CardTitle className="text-base flex items-center gap-2">
                              {language === 'bn' && challenge.title_bn ? challenge.title_bn : challenge.title}
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                              Completed {uc.completed_at ? new Date(uc.completed_at).toLocaleDateString() : ''}
                            </p>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Badge className="bg-emerald-500">+{challenge.reward_points} pts earned</Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Badges */}
          <TabsContent value="badges" className="space-y-4">
            {userBadges.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No badges earned yet</p>
                  <p className="text-sm text-muted-foreground">Complete challenges to earn badges!</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
                {userBadges.map((badge) => (
                  <Card key={badge.id} className="text-center">
                    <CardContent className="pt-6">
                      <div className="text-4xl mb-2">{badge.badge_icon || '🏅'}</div>
                      <h3 className="font-semibold text-sm">{badge.badge_name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{badge.badge_description}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {new Date(badge.earned_at).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
