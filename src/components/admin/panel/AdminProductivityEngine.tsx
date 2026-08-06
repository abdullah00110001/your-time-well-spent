import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Calculator, Clock, Target, TrendingUp, Zap, ArrowUpDown,
  Timer, BarChart3, AlertTriangle, Settings, Gauge, Trophy
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

const timeDistribution = [
  { area: 'Deep Work', hours: 3.2, color: '#8B5CF6' },
  { area: 'Shallow Work', hours: 2.1, color: '#06B6D4' },
  { area: 'Planning', hours: 0.8, color: '#10B981' },
  { area: 'Wasted', hours: 1.5, color: '#EF4444' },
  { area: 'Rest', hours: 1.4, color: '#F59E0B' },
];

export default function AdminProductivityEngine() {
  const [scoreWeights, setScoreWeights] = useState({
    tasks: 30, habits: 25, goals: 20, focus: 15, energy: 10,
  });
  const [penalties, setPenalties] = useState({
    overloadPenalty: 15, contextSwitching: 10, missedAlarms: 5,
  });
  const [bonuses, setBonuses] = useState({
    recoveryBonus: 10, consistencyBonus: 15, deepWorkBonus: 20,
  });
  const [decisionFatiguePrevention, setDecisionFatiguePrevention] = useState(true);
  const [autoRanking, setAutoRanking] = useState(true);
  const [timeBankruptcyWarning, setTimeBankruptcyWarning] = useState(true);

  const totalWeight = Object.values(scoreWeights).reduce((a, b) => a + b, 0);

  const saveSettings = () => toast.success('Productivity engine settings saved');

  return (
    <div className="space-y-6">
      <Tabs defaultValue="scoring" className="space-y-6">
        <TabsList>
          <TabsTrigger value="scoring">Scoring Formula</TabsTrigger>
          <TabsTrigger value="time">Time Economy</TabsTrigger>
          <TabsTrigger value="priority">Priority Engine</TabsTrigger>
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
        </TabsList>

        {/* SCORING FORMULA */}
        <TabsContent value="scoring" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5" /> Score Weight Configuration</CardTitle>
                <CardDescription>Total must equal 100%. Current: {totalWeight}%</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(scoreWeights).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="capitalize">{key} weight</Label>
                      <span className="text-sm font-mono">{value}%</span>
                    </div>
                    <Slider
                      value={[value]}
                      onValueChange={([v]) => setScoreWeights(p => ({ ...p, [key]: v }))}
                      max={50} step={5}
                    />
                  </div>
                ))}
                <div className={`p-3 rounded-lg ${totalWeight === 100 ? 'bg-green-500/10 border-green-500/30' : 'bg-destructive/10 border-destructive/30'} border`}>
                  <p className="text-sm font-medium">
                    {totalWeight === 100 ? '✅ Weights balanced' : `⚠️ Weights sum to ${totalWeight}%, should be 100%`}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Penalties & Bonuses</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <p className="text-sm font-medium mb-3 text-destructive">Penalties</p>
                  {Object.entries(penalties).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between mb-3">
                      <Label className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" value={value} onChange={e => setPenalties(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))} className="w-20 h-8" />
                        <span className="text-xs text-muted-foreground">pts</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-sm font-medium mb-3 text-green-500">Bonuses</p>
                  {Object.entries(bonuses).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between mb-3">
                      <Label className="text-sm capitalize">{key.replace(/([A-Z])/g, ' $1')}</Label>
                      <div className="flex items-center gap-2">
                        <Input type="number" value={value} onChange={e => setBonuses(p => ({ ...p, [key]: parseInt(e.target.value) || 0 }))} className="w-20 h-8" />
                        <span className="text-xs text-muted-foreground">pts</span>
                      </div>
                    </div>
                  ))}
                </div>
                <Button onClick={saveSettings} className="w-full">Save Scoring Formula</Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Score Fairness Analysis</CardTitle></CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { metric: 'Score bias detection', value: 'Low bias', status: 'good', desc: 'No significant demographic skew' },
                  { metric: 'Penalty fairness', value: '92% fair', status: 'good', desc: 'Penalties proportional to capability' },
                  { metric: 'Recovery opportunity', value: '78%', status: 'warning', desc: 'Users can recover from bad days' },
                ].map(m => (
                  <div key={m.metric} className={`p-4 rounded-lg border ${m.status === 'good' ? 'border-green-500/30' : 'border-amber-500/30'}`}>
                    <p className="text-sm font-medium">{m.metric}</p>
                    <p className="text-xl font-bold mt-1">{m.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{m.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TIME ECONOMY */}
        <TabsContent value="time" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Time Distribution (Avg User)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={timeDistribution} dataKey="hours" nameKey="area" cx="50%" cy="50%" outerRadius={100}
                        label={({ area, hours }) => `${area}: ${hours}h`}>
                        {timeDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Time Economy Controls</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Time budget per life area', desc: 'Auto-distribute hours across areas', enabled: true },
                  { label: 'Time debt tracking', desc: 'Track borrowed time from rest/health', enabled: true },
                  { label: 'Wasted time detection', desc: 'Flag mindless scrolling as time leak', enabled: true },
                  { label: 'Time bankruptcy warnings', desc: 'Alert when obligations exceed capacity', enabled: timeBankruptcyWarning, onChange: setTimeBankruptcyWarning },
                  { label: 'Deep/shallow work ratio enforcement', desc: 'Maintain minimum 2:1 deep:shallow', enabled: true },
                ].map(t => (
                  <div key={t.label} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{t.label}</p>
                      <p className="text-xs text-muted-foreground">{t.desc}</p>
                    </div>
                    <Switch defaultChecked={t.enabled} onCheckedChange={t.onChange} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Time ROI by Activity</CardTitle></CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={[
                    { activity: 'Focused Study', roi: 92, hours: 2.5 },
                    { activity: 'Exercise', roi: 85, hours: 1.0 },
                    { activity: 'Quran', roi: 88, hours: 0.5 },
                    { activity: 'Planning', roi: 72, hours: 0.8 },
                    { activity: 'Social Media', roi: 12, hours: 1.5 },
                    { activity: 'Meetings', roi: 35, hours: 1.2 },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="activity" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="roi" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="ROI Score" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* PRIORITY ENGINE */}
        <TabsContent value="priority" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" /> Priority Scoring Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <p className="text-sm font-medium">Priority Weights</p>
                  {[
                    { label: 'Urgency', value: 35 },
                    { label: 'Importance', value: 40 },
                    { label: 'Energy match', value: 15 },
                    { label: 'Goal alignment', value: 10 },
                  ].map(w => (
                    <div key={w.label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{w.label}</span><span className="text-muted-foreground">{w.value}%</span>
                      </div>
                      <Slider defaultValue={[w.value]} max={50} step={5} />
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <p className="text-sm font-medium">Priority Controls</p>
                  {[
                    { label: 'Decision fatigue prevention', desc: 'Limit daily decisions to 5', enabled: decisionFatiguePrevention, onChange: setDecisionFatiguePrevention },
                    { label: 'Auto-ranking', desc: 'AI ranks tasks by priority score', enabled: autoRanking, onChange: setAutoRanking },
                    { label: 'Long-term bias correction', desc: 'Boost important but non-urgent tasks', enabled: true },
                    { label: 'Priority conflict resolution', desc: 'Auto-resolve competing priorities', enabled: false },
                  ].map(c => (
                    <div key={c.label} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-xs text-muted-foreground">{c.desc}</p>
                      </div>
                      <Switch defaultChecked={c.enabled} onCheckedChange={c.onChange} />
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SIMULATION */}
        <TabsContent value="simulation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5" /> Score Simulation Mode</CardTitle>
              <CardDescription>Test scoring changes before deploying to users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Simulated Users', value: '1,300' },
                  { label: 'Avg Score (current)', value: '67.4' },
                  { label: 'Avg Score (new)', value: '71.2' },
                  { label: 'Score Change', value: '+5.6%' },
                ].map(s => (
                  <div key={s.label} className="p-4 rounded-lg border text-center">
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1">Run Simulation</Button>
                <Button className="flex-1">Deploy New Scoring</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
