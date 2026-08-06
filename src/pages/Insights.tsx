import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { useAdvancedInsights } from '@/hooks/useAdvancedInsights';
import HabitFrictionSystem from '@/components/insights/HabitFrictionSystem';
import MoodProductivityCorrelation from '@/components/insights/MoodProductivityCorrelation';
import CognitiveLoadMeter from '@/components/insights/CognitiveLoadMeter';
import SalahQualityCard from '@/components/insights/SalahQualityCard';
import QuranHeatmap from '@/components/insights/QuranHeatmap';
import LifeBalanceScore from '@/components/insights/LifeBalanceScore';
import BurnoutAlert from '@/components/insights/BurnoutAlert';
import RecoveryMode from '@/components/insights/RecoveryMode';
import GoalAdjustmentCard from '@/components/insights/GoalAdjustmentCard';
import MirrorMode from '@/components/insights/MirrorMode';
import { SmartGoalSuggestions } from '@/components/insights/SmartGoalSuggestions';
import { PatternInsights } from '@/components/insights/PatternInsights';
import { PredictiveAnalytics } from '@/components/insights/PredictiveAnalytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Brain, Heart, Activity, BookOpen, Target, Sparkles, Loader2, TrendingUp, AlertTriangle, Zap, Moon, Lightbulb, BarChart } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function Insights() {
  const { user } = useAuth();
  const { 
    loading, 
    cognitiveLoad, 
    salahQuality, 
    lifeBalance, 
    burnoutPrediction,
    recoveryMode,
    goalAdjustments,
    mirrorMode,
    moodCorrelation
  } = useAdvancedInsights();

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Analyzing your data...</p>
        </div>
      </AppLayout>
    );
  }

  // Calculate overall health score
  const overallScore = Math.round(
    (lifeBalance.score * 0.3) + 
    (salahQuality.qualityScore * 0.3) + 
    ((100 - cognitiveLoad.score) * 0.2) +
    ((burnoutPrediction.riskLevel === 'none' ? 100 : burnoutPrediction.riskLevel === 'mild' ? 70 : burnoutPrediction.riskLevel === 'moderate' ? 40 : 20) * 0.2)
  );

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-500';
  };

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'from-emerald-500/20 to-emerald-500/5';
    if (score >= 50) return 'from-amber-500/20 to-amber-500/5';
    return 'from-red-500/20 to-red-500/5';
  };

  return (
    <AppLayout>
      <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Advanced Insights
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Deep analysis of your habits, health, and spiritual growth
          </p>
        </div>

        {/* Overall Score Card - Mobile First */}
        <Card className={cn("mb-4 sm:mb-6 bg-gradient-to-br", getScoreBg(overallScore))}>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <div className="flex flex-col items-center text-center sm:text-left sm:items-start">
                <span className="text-xs sm:text-sm text-muted-foreground mb-1">Overall Wellness Score</span>
                <span className={cn("text-4xl sm:text-5xl font-bold", getScoreColor(overallScore))}>{overallScore}</span>
                <span className="text-xs text-muted-foreground mt-1">out of 100</span>
              </div>
              <div className="flex-1 w-full sm:w-auto">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  <div className="p-2 sm:p-3 rounded-lg bg-background/80 text-center">
                    <Activity className="h-4 w-4 mx-auto mb-1 text-blue-500" />
                    <p className="text-xs text-muted-foreground">Balance</p>
                    <p className="text-sm sm:text-lg font-bold">{lifeBalance.score}</p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-background/80 text-center">
                    <Heart className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                    <p className="text-xs text-muted-foreground">Salah</p>
                    <p className="text-sm sm:text-lg font-bold">{salahQuality.qualityScore}</p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-background/80 text-center">
                    <Brain className="h-4 w-4 mx-auto mb-1 text-purple-500" />
                    <p className="text-xs text-muted-foreground">Mental</p>
                    <p className="text-sm sm:text-lg font-bold">{100 - cognitiveLoad.score}</p>
                  </div>
                  <div className="p-2 sm:p-3 rounded-lg bg-background/80 text-center">
                    <Zap className="h-4 w-4 mx-auto mb-1 text-amber-500" />
                    <p className="text-xs text-muted-foreground">Energy</p>
                    <p className="text-sm sm:text-lg font-bold capitalize">
                      {burnoutPrediction.riskLevel === 'none' ? '100' : burnoutPrediction.riskLevel === 'mild' ? '70' : burnoutPrediction.riskLevel === 'moderate' ? '40' : '20'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Critical Alerts Section */}
        {(burnoutPrediction.riskLevel !== 'none' || recoveryMode.isActive) && (
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 mb-4 sm:mb-6">
            <BurnoutAlert 
              riskLevel={burnoutPrediction.riskLevel}
              daysAtRisk={burnoutPrediction.daysAtRisk}
              warning={burnoutPrediction.warning}
            />
            <RecoveryMode 
              isActive={recoveryMode.isActive}
              missedDays={recoveryMode.missedDays}
              recoveryPlan={recoveryMode.recoveryPlan}
              streakProtected={recoveryMode.streakProtected}
            />
          </div>
        )}

        {/* Insights from Data */}
        {moodCorrelation.insights.length > 0 && (
          <Card className="mb-4 sm:mb-6 border-primary/20 bg-primary/5">
            <CardHeader className="pb-2 px-3 sm:px-6 pt-3 sm:pt-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Key Insights from Your Data
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
              <div className="grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-2">
                {moodCorrelation.insights.map((insight, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 sm:p-3 rounded-lg bg-background/80">
                    <TrendingUp className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm">{insight}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview" className="space-y-4">
          {/* Mobile-optimized tabs */}
          <TabsList className="grid grid-cols-4 sm:grid-cols-8 w-full h-auto gap-1 p-1 bg-muted/50">
            <TabsTrigger value="overview" className="text-xs px-2 py-2 data-[state=active]:bg-background">
              <Sparkles className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="text-xs px-2 py-2 data-[state=active]:bg-background">
              <Lightbulb className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">AI</span>
            </TabsTrigger>
            <TabsTrigger value="predict" className="text-xs px-2 py-2 data-[state=active]:bg-background">
              <BarChart className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Predict</span>
            </TabsTrigger>
            <TabsTrigger value="mental" className="text-xs px-2 py-2 data-[state=active]:bg-background">
              <Brain className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Mental</span>
            </TabsTrigger>
            <TabsTrigger value="spiritual" className="text-xs px-2 py-2 data-[state=active]:bg-background">
              <Heart className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Spiritual</span>
            </TabsTrigger>
            <TabsTrigger value="balance" className="text-xs px-2 py-2 data-[state=active]:bg-background">
              <Activity className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Balance</span>
            </TabsTrigger>
            <TabsTrigger value="quran" className="text-xs px-2 py-2 data-[state=active]:bg-background">
              <BookOpen className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Qur'an</span>
            </TabsTrigger>
            <TabsTrigger value="goals" className="text-xs px-2 py-2 data-[state=active]:bg-background">
              <Target className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Goals</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <CognitiveLoadMeter 
                score={cognitiveLoad.score}
                status={cognitiveLoad.status}
                warning={cognitiveLoad.warning}
              />
              <LifeBalanceScore 
                score={lifeBalance.score}
                status={lifeBalance.status}
                daily={lifeBalance.daily}
                weekly={lifeBalance.weekly}
                monthly={lifeBalance.monthly}
              />
            </div>
            <MirrorMode 
              dueDate={mirrorMode.dueDate}
              lastGenerated={mirrorMode.lastGenerated}
              summary={mirrorMode.summary}
              traits={mirrorMode.traits}
              improvements={mirrorMode.improvements}
              strengths={mirrorMode.strengths}
            />
          </TabsContent>

          {/* AI Insights Tab */}
          <TabsContent value="ai" className="space-y-4 mt-4">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 lg:grid-cols-2">
              <PatternInsights />
              <SmartGoalSuggestions />
            </div>
          </TabsContent>

          {/* Predictive Analytics Tab */}
          <TabsContent value="predict" className="space-y-4 mt-4">
            <PredictiveAnalytics />
          </TabsContent>

          {/* Mental Health Tab */}
          <TabsContent value="mental" className="space-y-4 mt-4">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <CognitiveLoadMeter 
                score={cognitiveLoad.score}
                status={cognitiveLoad.status}
                warning={cognitiveLoad.warning}
              />
              <MoodProductivityCorrelation 
                lowMoodHighDevice={moodCorrelation.lowMoodHighDevice}
                highMoodHighProductivity={moodCorrelation.highMoodHighProductivity}
                insights={moodCorrelation.insights}
              />
            </div>
            
            {/* Mental Health Tips */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Brain className="h-4 w-4 text-purple-500" />
                  Mental Wellness Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                  <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                    <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">🧘 Reduce Cognitive Load</p>
                    <p className="text-xs text-muted-foreground">Take 5-min breaks every 25 mins of focused work</p>
                  </div>
                  <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">😴 Prioritize Sleep</p>
                    <p className="text-xs text-muted-foreground">Aim for 7-8 hours of quality sleep nightly</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Spiritual Tab */}
          <TabsContent value="spiritual" className="space-y-4 mt-4">
            <SalahQualityCard 
              totalCompleted={salahQuality.totalCompleted}
              onTimeCount={salahQuality.onTimeCount}
              avgKhushu={salahQuality.avgKhushu}
              consistencyScore={salahQuality.consistencyScore}
              qualityScore={salahQuality.qualityScore}
            />
            
            {/* Spiritual Growth Tips */}
            <Card className="bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Moon className="h-4 w-4 text-emerald-600" />
                  Spiritual Growth Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background/80">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <span className="text-sm">🕌</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">Prayer Consistency</p>
                        <p className="text-xs text-muted-foreground">{salahQuality.consistencyScore}% of prayers completed</p>
                      </div>
                    </div>
                    <Badge variant={salahQuality.consistencyScore >= 80 ? "default" : "secondary"}>
                      {salahQuality.consistencyScore >= 80 ? "Excellent" : salahQuality.consistencyScore >= 60 ? "Good" : "Needs Work"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-background/80">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <span className="text-sm">⏰</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium">On-Time Rate</p>
                        <p className="text-xs text-muted-foreground">{salahQuality.onTimeCount} prayers on time</p>
                      </div>
                    </div>
                    <Badge variant="outline">{Math.round((salahQuality.onTimeCount / Math.max(salahQuality.totalCompleted, 1)) * 100)}%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Balance Tab */}
          <TabsContent value="balance" className="space-y-4 mt-4">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <LifeBalanceScore 
                score={lifeBalance.score}
                status={lifeBalance.status}
                daily={lifeBalance.daily}
                weekly={lifeBalance.weekly}
                monthly={lifeBalance.monthly}
              />
              <MoodProductivityCorrelation 
                lowMoodHighDevice={moodCorrelation.lowMoodHighDevice}
                highMoodHighProductivity={moodCorrelation.highMoodHighProductivity}
                insights={moodCorrelation.insights}
              />
            </div>
          </TabsContent>

          {/* Qur'an Tab */}
          <TabsContent value="quran" className="space-y-4 mt-4">
            <QuranHeatmap />
          </TabsContent>

          {/* Goals Tab */}
          <TabsContent value="goals" className="space-y-4 mt-4">
            <GoalAdjustmentCard adjustments={goalAdjustments} />
            {goalAdjustments.length === 0 && (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Target className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="font-medium mb-1">Great job! 🌟</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    No goal adjustments needed right now. Keep up the excellent work!
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
