import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  ShieldCheck, Heart, AlertTriangle, Eye, Brain, Users,
  Ban, Lightbulb, TrendingDown, Sparkles, Lock, HandHeart
} from 'lucide-react';

export default function AdminSafetyEthics() {
  const [ethicalLimits, setEthicalLimits] = useState({
    maxNudgesPerDay: [5],
    maxNotificationsPerDay: [8],
    comparisonExposureLimit: [3],
    pressureIntensity: [40],
  });

  const saveSettings = () => toast.success('Safety & ethics settings saved');

  return (
    <div className="space-y-6">
      {/* Safety Score Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Ethical Safety Score', value: '94%', icon: ShieldCheck, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Dark Pattern Risk', value: 'Low', icon: Ban, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Pressure Signals', value: '12', icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Users at Emotional Risk', value: '8', icon: Heart, color: 'text-destructive', bg: 'bg-destructive/10' },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bg}`}><s.icon className={`h-5 w-5 ${s.color}`} /></div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="psychological" className="space-y-6">
        <TabsList>
          <TabsTrigger value="psychological">Psychological Safety</TabsTrigger>
          <TabsTrigger value="social">Social Pressure</TabsTrigger>
          <TabsTrigger value="ai-ethics">AI Ethics</TabsTrigger>
          <TabsTrigger value="self-critique">System Self-Critique</TabsTrigger>
          <TabsTrigger value="education">User Education</TabsTrigger>
        </TabsList>

        {/* PSYCHOLOGICAL SAFETY */}
        <TabsContent value="psychological" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5" /> Psychological Safety Dashboard</CardTitle>
              <CardDescription>Monitor and prevent system-induced stress</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { indicator: 'System-induced anxiety', level: 'Low', users: 5, action: 'Monitor', color: 'border-green-500/30' },
                { indicator: 'Perfectionism pressure', level: 'Medium', users: 18, action: 'Reduce scoring visibility', color: 'border-amber-500/30' },
                { indicator: 'Comparison stress', level: 'Low', users: 7, action: 'Limit leaderboard exposure', color: 'border-green-500/30' },
                { indicator: 'Achievement addiction', level: 'Medium', users: 12, action: 'Reduce gamification', color: 'border-amber-500/30' },
                { indicator: 'Guilt from missed targets', level: 'High', users: 32, action: 'Soften failure messaging', color: 'border-destructive/30' },
                { indicator: 'Over-optimization fatigue', level: 'Medium', users: 15, action: 'Simplify daily view', color: 'border-amber-500/30' },
              ].map(i => (
                <div key={i.indicator} className={`flex items-center justify-between p-4 rounded-lg border ${i.color}`}>
                  <div>
                    <p className="text-sm font-medium">{i.indicator}</p>
                    <p className="text-xs text-muted-foreground">{i.users} users affected → {i.action}</p>
                  </div>
                  <Badge variant={i.level === 'High' ? 'destructive' : i.level === 'Medium' ? 'default' : 'secondary'}>
                    {i.level}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Ethical Limits</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {[
                { label: 'Max nudges per day', key: 'maxNudgesPerDay' as const, max: 15 },
                { label: 'Max notifications per day', key: 'maxNotificationsPerDay' as const, max: 20 },
                { label: 'Comparison exposure limit', key: 'comparisonExposureLimit' as const, max: 10 },
                { label: 'Pressure intensity level', key: 'pressureIntensity' as const, max: 100 },
              ].map(s => (
                <div key={s.label} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{s.label}</span>
                    <span className="text-muted-foreground">{ethicalLimits[s.key][0]}</span>
                  </div>
                  <Slider value={ethicalLimits[s.key]} onValueChange={v => setEthicalLimits(p => ({ ...p, [s.key]: v }))} max={s.max} step={1} />
                </div>
              ))}
              <Button onClick={saveSettings} className="w-full">Save Ethical Limits</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SOCIAL PRESSURE */}
        <TabsContent value="social" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Social Pressure Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Leaderboard visibility', desc: 'Users can see rankings', enabled: true, critical: false },
                { label: 'Progress comparison', desc: 'Show how user compares to others', enabled: false, critical: true },
                { label: 'Social shaming prevention', desc: 'Never display failure publicly', enabled: true, critical: true },
                { label: 'Opt-out from all social features', desc: 'Always allow complete opt-out', enabled: true, critical: true },
                { label: 'Peer pressure dampening', desc: 'Reduce group pressure on struggling users', enabled: true, critical: false },
                { label: 'Toxic behavior detection', desc: 'Auto-detect harmful group dynamics', enabled: true, critical: false },
              ].map(c => (
                <div key={c.label} className={`flex items-center justify-between p-4 rounded-lg border ${c.critical ? 'border-primary/30' : ''}`}>
                  <div className="flex items-center gap-3">
                    {c.critical && <Lock className="h-4 w-4 text-primary" />}
                    <div>
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.desc}</p>
                    </div>
                  </div>
                  <Switch defaultChecked={c.enabled} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-sm">Ethical Rules (Non-Negotiable)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[
                  '❌ Never shame users for failures',
                  '❌ Never punish vulnerability or honesty',
                  '❌ Never create artificial urgency',
                  '✅ Always allow complete opt-out',
                  '✅ Always celebrate recovery, not just achievement',
                  '✅ Always prioritize wellbeing over productivity',
                ].map(rule => (
                  <div key={rule} className="p-2 rounded bg-muted/50 text-sm">{rule}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI ETHICS */}
        <TabsContent value="ai-ethics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> AI Safety Boundaries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: 'Disable manipulative nudges', desc: 'AI cannot use FOMO, guilt, or fear', enabled: true },
                { label: 'Transparency mode', desc: 'Show users why AI made a suggestion', enabled: true },
                { label: 'Emotional vulnerability detection', desc: 'Reduce AI intensity for vulnerable users', enabled: true },
                { label: 'Auto-escalate to rest mode', desc: 'AI suggests rest when detecting distress', enabled: true },
                { label: 'AI suggestion review queue', desc: 'Human review before mass AI actions', enabled: false },
                { label: 'Over-nudging prevention', desc: 'Hard limit on AI interactions per user', enabled: true },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                  <Switch defaultChecked={s.enabled} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SYSTEM SELF-CRITIQUE */}
        <TabsContent value="self-critique" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Eye className="h-5 w-5" /> System Self-Critique</CardTitle>
              <CardDescription>"What are we doing wrong?" — Honest system evaluation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { question: 'Are we causing more stress than we solve?', answer: 'For 8% of users, system adds pressure', severity: 'medium' },
                { question: 'Are gamification rewards becoming addictive?', answer: '12 users show unhealthy engagement patterns', severity: 'medium' },
                { question: 'Are we respecting user autonomy?', answer: 'Yes — opt-out available for all features', severity: 'low' },
                { question: 'Do users resent any features?', answer: 'Streak penalties reported as discouraging by 15%', severity: 'high' },
                { question: 'Is the scoring system fair?', answer: 'Morning people score 12% higher — bias detected', severity: 'high' },
                { question: 'Are we tracking too much?', answer: 'Data minimization audit needed', severity: 'medium' },
              ].map(q => (
                <div key={q.question} className={`p-4 rounded-lg border ${
                  q.severity === 'high' ? 'border-destructive/30 bg-destructive/5' :
                  q.severity === 'medium' ? 'border-amber-500/30 bg-amber-500/5' :
                  'border-green-500/30 bg-green-500/5'
                }`}>
                  <p className="text-sm font-medium">{q.question}</p>
                  <p className="text-xs text-muted-foreground mt-1">{q.answer}</p>
                  <Badge variant={q.severity === 'high' ? 'destructive' : q.severity === 'medium' ? 'default' : 'secondary'} className="mt-2">
                    {q.severity} priority
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Lightbulb className="h-5 w-5" /> AI Improvement Suggestions</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { suggestion: 'Remove streak penalties — they discourage rather than motivate', impact: 'High', effort: 'Low' },
                { suggestion: 'Add "rest day" as a positive action, not a failure', impact: 'High', effort: 'Low' },
                { suggestion: 'Reduce scoring visibility for new users (first 30 days)', impact: 'Medium', effort: 'Medium' },
                { suggestion: 'Simplify daily input — too many fields cause abandonment', impact: 'High', effort: 'High' },
                { suggestion: 'Normalize failure in onboarding messaging', impact: 'Medium', effort: 'Low' },
              ].map(s => (
                <div key={s.suggestion} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex-1">
                    <p className="text-sm">{s.suggestion}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge variant="outline">Impact: {s.impact}</Badge>
                    <Badge variant="outline">Effort: {s.effort}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* USER EDUCATION */}
        <TabsContent value="education" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HandHeart className="h-5 w-5" /> User Education & Guidance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { path: 'New User Onboarding', stages: 5, completion: '78%', target: 'All new users' },
                { path: 'Goal Setting Mastery', stages: 3, completion: '45%', target: 'Users with 3+ abandoned goals' },
                { path: 'Habit Science 101', stages: 4, completion: '62%', target: 'Users with broken streaks' },
                { path: 'Recovery After Failure', stages: 3, completion: '34%', target: 'Users in recovery mode' },
                { path: 'Time Management Basics', stages: 4, completion: '51%', target: 'Users with time leaks' },
              ].map(p => (
                <div key={p.path} className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{p.path}</p>
                    <p className="text-xs text-muted-foreground">{p.stages} stages • Target: {p.target}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{p.completion}</p>
                    <p className="text-xs text-muted-foreground">completion</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Contextual Tips Engine</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { trigger: 'User creates unrealistic goal', tip: '"Start small — research shows tiny habits stick 5x better"' },
                { trigger: 'Streak broken after 20+ days', tip: '"Missing one day doesn\'t erase your progress. 20/21 is still amazing."' },
                { trigger: 'First time using focus timer', tip: '"The Pomodoro technique: 25 min focus, 5 min break. Science-backed."' },
                { trigger: 'User comparing themselves negatively', tip: '"Compare yourself to yesterday\'s you, not today\'s someone else."' },
              ].map(t => (
                <div key={t.trigger} className="p-3 rounded-lg border">
                  <p className="text-xs text-muted-foreground">When: {t.trigger}</p>
                  <p className="text-sm font-medium mt-1">{t.tip}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
