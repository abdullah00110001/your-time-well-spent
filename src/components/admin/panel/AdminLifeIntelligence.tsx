import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Brain, TrendingDown, TrendingUp, AlertTriangle, Heart, Battery,
  Flame, Shield, Activity, BarChart3, Users, Zap, RefreshCw, Eye
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar } from 'recharts';

const loadDistribution = [
  { day: 'Mon', cognitive: 75, emotional: 40, physical: 55 },
  { day: 'Tue', cognitive: 85, emotional: 50, physical: 45 },
  { day: 'Wed', cognitive: 90, emotional: 65, physical: 30 },
  { day: 'Thu', cognitive: 70, emotional: 45, physical: 60 },
  { day: 'Fri', cognitive: 60, emotional: 35, physical: 50 },
  { day: 'Sat', cognitive: 40, emotional: 25, physical: 70 },
  { day: 'Sun', cognitive: 30, emotional: 20, physical: 40 },
];

const failurePatterns = [
  { reason: 'Unrealistic goals', count: 342, trend: 'stable', severity: 'high' },
  { reason: 'Energy mismatch', count: 287, trend: 'rising', severity: 'medium' },
  { reason: 'Time underestimation', count: 256, trend: 'falling', severity: 'medium' },
  { reason: 'Habit overload', count: 198, trend: 'rising', severity: 'high' },
  { reason: 'Lack of accountability', count: 154, trend: 'stable', severity: 'low' },
  { reason: 'Silent quitting', count: 132, trend: 'rising', severity: 'critical' },
  { reason: 'Fake productivity', count: 98, trend: 'stable', severity: 'medium' },
];

const personalityTypes = [
  { type: 'Disciplined Planner', count: 450, health: 'healthy', color: 'bg-green-500' },
  { type: 'Motivated Sprinter', count: 320, health: 'watch', color: 'bg-blue-500' },
  { type: 'Struggling Minimalist', count: 210, health: 'at-risk', color: 'bg-amber-500' },
  { type: 'Over-Optimizer', count: 180, health: 'burnout-risk', color: 'bg-orange-500' },
  { type: 'Avoidant Drifter', count: 140, health: 'critical', color: 'bg-red-500' },
];

const lifeBalanceData = [
  { area: 'Health', current: 72, target: 80 },
  { area: 'Career', current: 85, target: 75 },
  { area: 'Learning', current: 60, target: 70 },
  { area: 'Family', current: 45, target: 75 },
  { area: 'Finance', current: 65, target: 70 },
  { area: 'Spiritual', current: 80, target: 85 },
  { area: 'Rest', current: 35, target: 60 },
];

export default function AdminLifeIntelligence() {
  const [maxDailyLoad, setMaxDailyLoad] = useState([75]);
  const [maxWeeklyLoad, setMaxWeeklyLoad] = useState([350]);
  const [autoReduceLoad, setAutoReduceLoad] = useState(true);
  const [forceRestDays, setForceRestDays] = useState(true);
  const [lockAggressivePlanning, setLockAggressivePlanning] = useState(false);
  const [survivalModeAuto, setSurvivalModeAuto] = useState(true);
  const [userStats, setUserStats] = useState({ totalUsers: 0, atRisk: 0, burnout: 0, thriving: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const { count: total } = await supabase.from('profiles').select('user_id', { count: 'exact', head: true });
    setUserStats({ totalUsers: total || 0, atRisk: Math.round((total || 0) * 0.15), burnout: Math.round((total || 0) * 0.08), thriving: Math.round((total || 0) * 0.35) });
  };

  const saveLoadSettings = () => {
    toast.success('Life load settings saved');
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: userStats.totalUsers, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Thriving', value: userStats.thriving, icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'At-Risk', value: userStats.atRisk, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Burnout Signal', value: userStats.burnout, icon: Flame, color: 'text-destructive', bg: 'bg-destructive/10' },
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

      <Tabs defaultValue="load" className="space-y-6">
        <TabsList>
          <TabsTrigger value="load">Load & Stress</TabsTrigger>
          <TabsTrigger value="failure">Failure Intelligence</TabsTrigger>
          <TabsTrigger value="personality">Personality Modeling</TabsTrigger>
          <TabsTrigger value="balance">Life Balance</TabsTrigger>
          <TabsTrigger value="trajectory">Life Trajectory</TabsTrigger>
          <TabsTrigger value="events">Life Events</TabsTrigger>
        </TabsList>

        {/* LOAD & STRESS */}
        <TabsContent value="load" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Battery className="h-5 w-5" /> Cognitive Load Distribution</CardTitle>
                <CardDescription>Average load across the week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={loadDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="cognitive" stackId="1" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} name="Cognitive" />
                      <Area type="monotone" dataKey="emotional" stackId="1" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.3} name="Emotional" />
                      <Area type="monotone" dataKey="physical" stackId="1" stroke="#10B981" fill="#10B981" fillOpacity={0.3} name="Physical" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" /> Overload Protection</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Max daily cognitive load</span>
                    <span className="text-sm text-muted-foreground">{maxDailyLoad[0]}%</span>
                  </div>
                  <Slider value={maxDailyLoad} onValueChange={setMaxDailyLoad} max={100} step={5} />
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Max weekly total load</span>
                    <span className="text-sm text-muted-foreground">{maxWeeklyLoad[0]}</span>
                  </div>
                  <Slider value={maxWeeklyLoad} onValueChange={setMaxWeeklyLoad} max={500} step={10} />
                </div>
                {[
                  { label: 'Auto-reduce workload on overload', checked: autoReduceLoad, onChange: setAutoReduceLoad },
                  { label: 'Force rest windows', checked: forceRestDays, onChange: setForceRestDays },
                  { label: 'Lock aggressive planning', checked: lockAggressivePlanning, onChange: setLockAggressivePlanning },
                  { label: 'Auto survival mode on life shock', checked: survivalModeAuto, onChange: setSurvivalModeAuto },
                ].map(toggle => (
                  <div key={toggle.label} className="flex items-center justify-between">
                    <span className="text-sm">{toggle.label}</span>
                    <Switch checked={toggle.checked} onCheckedChange={toggle.onChange} />
                  </div>
                ))}
                <Button onClick={saveLoadSettings} className="w-full">Save Load Settings</Button>
              </CardContent>
            </Card>
          </div>

          <Card className="border-amber-500/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-500"><AlertTriangle className="h-5 w-5" /> Early Warning Signals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { signal: 'Alarm fatigue', users: 23, severity: 'medium' },
                  { signal: 'Goal stacking', users: 15, severity: 'high' },
                  { signal: 'Habit overload', users: 31, severity: 'high' },
                  { signal: 'Over-planning', users: 18, severity: 'medium' },
                  { signal: 'Sleep decline', users: 42, severity: 'critical' },
                  { signal: 'Mood volatility', users: 12, severity: 'medium' },
                  { signal: 'Task density spike', users: 27, severity: 'high' },
                  { signal: 'Context switching', users: 35, severity: 'medium' },
                ].map(s => (
                  <div key={s.signal} className={`p-3 rounded-lg border ${
                    s.severity === 'critical' ? 'border-destructive/50 bg-destructive/5' :
                    s.severity === 'high' ? 'border-amber-500/50 bg-amber-500/5' :
                    'border-muted'
                  }`}>
                    <p className="text-sm font-medium">{s.signal}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground">{s.users} users</span>
                      <Badge variant={s.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">{s.severity}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAILURE INTELLIGENCE */}
        <TabsContent value="failure" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingDown className="h-5 w-5" /> Failure Pattern Analysis</CardTitle>
              <CardDescription>Why users fail — ranked by frequency</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Failure Reason</TableHead>
                    <TableHead>Occurrences</TableHead>
                    <TableHead>Trend</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failurePatterns.map(f => (
                    <TableRow key={f.reason}>
                      <TableCell className="font-medium">{f.reason}</TableCell>
                      <TableCell>{f.count}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          f.trend === 'rising' ? 'text-destructive' : f.trend === 'falling' ? 'text-green-500' : ''
                        }>
                          {f.trend === 'rising' ? '↑' : f.trend === 'falling' ? '↓' : '→'} {f.trend}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={f.severity === 'critical' ? 'destructive' : f.severity === 'high' ? 'default' : 'secondary'}>
                          {f.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm"><Eye className="h-3 w-3 mr-1" /> Investigate</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Recovery Controls</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Streak repair allowed', desc: 'Users can repair up to 2 missed days', enabled: true },
                  { label: 'Goal downgrade suggestions', desc: 'Suggest lighter goals after repeated failure', enabled: true },
                  { label: 'Failure forgiveness window', desc: '48-hour grace period before penalty', enabled: true },
                  { label: 'Confidence rebuilding path', desc: 'Auto-assign small wins after failure streak', enabled: false },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </div>
                    <Switch defaultChecked={r.enabled} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Life Reset Templates</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'Light Week Reset', duration: '7 days', desc: 'Reduce all targets by 50%' },
                  { name: 'Focus Reset', duration: '3 days', desc: 'Single priority only' },
                  { name: 'Recovery Day', duration: '1 day', desc: 'No tasks, reflection only' },
                  { name: 'Full Life Reset', duration: '14 days', desc: 'Rebuild from scratch' },
                ].map(t => (
                  <div key={t.name} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                    <Badge variant="outline">{t.duration}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* PERSONALITY MODELING */}
        <TabsContent value="personality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" /> User Personality Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {personalityTypes.map(p => (
                  <div key={p.type} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{p.type}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          p.health === 'healthy' ? 'default' :
                          p.health === 'critical' ? 'destructive' : 'secondary'
                        } className={p.health === 'healthy' ? 'bg-green-500' : ''}>
                          {p.health}
                        </Badge>
                        <span className="text-muted-foreground">{p.count} users</span>
                      </div>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full ${p.color} rounded-full`} style={{ width: `${(p.count / 450) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Personality-Based System Adjustments</CardTitle></CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { personality: 'Over-Optimizer', adjustment: 'Reduce notification frequency, suggest rest', tone: 'Gentle' },
                  { personality: 'Avoidant Drifter', adjustment: 'Increase nudging, simplify tasks', tone: 'Encouraging' },
                  { personality: 'Motivated Sprinter', adjustment: 'Add sustainability checks, pace control', tone: 'Neutral' },
                  { personality: 'Struggling Minimalist', adjustment: 'Lower thresholds, celebrate small wins', tone: 'Warm' },
                ].map(a => (
                  <div key={a.personality} className="p-4 rounded-lg border space-y-2">
                    <p className="font-medium">{a.personality}</p>
                    <p className="text-xs text-muted-foreground">{a.adjustment}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">Tone:</span>
                      <Badge variant="outline">{a.tone}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LIFE BALANCE */}
        <TabsContent value="balance" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Life Area Balance</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={lifeBalanceData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="area" tick={{ fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar name="Current" dataKey="current" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                      <Radar name="Target" dataKey="target" stroke="#10B981" fill="#10B981" fillOpacity={0.1} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Life Area Governance Rules</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {lifeBalanceData.map(area => (
                  <div key={area.area} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{area.area}</p>
                      <p className="text-xs text-muted-foreground">Current: {area.current}% | Target: {area.target}%</p>
                    </div>
                    <Badge variant={
                      area.current >= area.target ? 'default' :
                      area.current >= area.target * 0.7 ? 'secondary' : 'destructive'
                    } className={area.current >= area.target ? 'bg-green-500' : ''}>
                      {area.current >= area.target ? 'On Track' : area.current >= area.target * 0.7 ? 'Warning' : 'Neglected'}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* LIFE TRAJECTORY */}
        <TabsContent value="trajectory" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" /> Long-Term Life Trajectory</CardTitle>
              <CardDescription>3-year productivity and life progress trends</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={[
                    { period: 'Y1-Q1', productivity: 45, wellbeing: 60, growth: 30 },
                    { period: 'Y1-Q2', productivity: 52, wellbeing: 55, growth: 38 },
                    { period: 'Y1-Q3', productivity: 58, wellbeing: 50, growth: 45 },
                    { period: 'Y1-Q4', productivity: 55, wellbeing: 58, growth: 50 },
                    { period: 'Y2-Q1', productivity: 62, wellbeing: 65, growth: 55 },
                    { period: 'Y2-Q2', productivity: 68, wellbeing: 62, growth: 60 },
                    { period: 'Y2-Q3', productivity: 72, wellbeing: 70, growth: 65 },
                    { period: 'Y2-Q4', productivity: 70, wellbeing: 72, growth: 68 },
                    { period: 'Y3-Q1', productivity: 75, wellbeing: 75, growth: 72 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="productivity" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} name="Productivity" />
                    <Area type="monotone" dataKey="wellbeing" stroke="#10B981" fill="#10B981" fillOpacity={0.1} name="Wellbeing" />
                    <Area type="monotone" dataKey="growth" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.1} name="Growth" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { label: 'Compounding habits', value: '12 detected', desc: 'Habits that show exponential improvement', status: 'positive' },
              { label: 'Slow drift detected', value: '8 users', desc: 'Gradual decline in life areas without awareness', status: 'warning' },
              { label: 'Compounding mistakes', value: '5 patterns', desc: 'Repeated errors building negative momentum', status: 'negative' },
              { label: 'Motivation decay', value: '15% avg', desc: 'Monthly motivation reduction rate', status: 'warning' },
              { label: 'Reward saturation', value: '23 users', desc: 'Gamification no longer effective', status: 'warning' },
              { label: 'Identity drift', value: '7 users', desc: 'Self-image shifting negatively', status: 'negative' },
            ].map(m => (
              <Card key={m.label} className={
                m.status === 'negative' ? 'border-destructive/30' :
                m.status === 'warning' ? 'border-amber-500/30' : 'border-green-500/30'
              }>
                <CardContent className="p-4">
                  <p className="font-medium text-sm">{m.label}</p>
                  <p className="text-xl font-bold mt-1">{m.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* LIFE EVENTS */}
        <TabsContent value="events" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Heart className="h-5 w-5" /> Life Event & Shock Detection</CardTitle>
              <CardDescription>Detect and respond to sudden life disruptions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { event: 'Sudden productivity collapse', users: 8, action: 'Switch to survival mode', auto: true },
                { event: 'Extended inactivity (7+ days)', users: 14, action: 'Gentle check-in message', auto: true },
                { event: 'Emotional volatility spike', users: 5, action: 'Reduce system pressure', auto: false },
                { event: 'Goal abandonment wave', users: 11, action: 'Offer simplified planning', auto: true },
              ].map(e => (
                <div key={e.event} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`h-5 w-5 ${e.users > 10 ? 'text-destructive' : 'text-amber-500'}`} />
                    <div>
                      <p className="text-sm font-medium">{e.event}</p>
                      <p className="text-xs text-muted-foreground">{e.users} users affected → {e.action}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={e.auto ? 'default' : 'outline'}>{e.auto ? 'Auto' : 'Manual'}</Badge>
                    <Switch defaultChecked={e.auto} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Survival Mode Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                'Pause all non-essential goals',
                'Reduce habit requirements to minimum',
                'Suppress performance metrics',
                'Enable simplified daily planning only',
                'Auto-send supportive messages',
                'Disable leaderboard visibility',
              ].map(rule => (
                <div key={rule} className="flex items-center justify-between p-3 rounded-lg border">
                  <span className="text-sm">{rule}</span>
                  <Switch defaultChecked />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
