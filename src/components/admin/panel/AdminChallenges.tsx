import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trophy, Plus, Flame, Target, Users, Clock, TrendingUp, Zap, Trash2, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Challenge {
  id: string;
  title: string;
  description: string;
  challenge_type: string;
  target_metric: string;
  target_value: number;
  reward_points: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  mode: string | null;
}

export default function AdminChallenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newChallenge, setNewChallenge] = useState({
    title: '', description: '', challenge_type: 'weekly', target_metric: 'study_minutes',
    target_value: 300, reward_points: 100, mode: 'both',
  });

  useEffect(() => { fetchChallenges(); }, []);

  const fetchChallenges = async () => {
    setLoading(true);
    const { data } = await supabase.from('challenges').select('*').order('created_at', { ascending: false });
    setChallenges(data || []);
    setLoading(false);
  };

  const createChallenge = async () => {
    if (!newChallenge.title) { toast.error('Title required'); return; }
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + (newChallenge.challenge_type === 'weekly' ? 7 : 30));

    const { error } = await supabase.from('challenges').insert({
      ...newChallenge,
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    });

    if (error) { toast.error('Failed to create challenge'); return; }
    toast.success('Challenge created');
    setIsCreateOpen(false);
    setNewChallenge({ title: '', description: '', challenge_type: 'weekly', target_metric: 'study_minutes', target_value: 300, reward_points: 100, mode: 'both' });
    fetchChallenges();
  };

  const toggleChallenge = async (id: string, active: boolean) => {
    await supabase.from('challenges').update({ is_active: !active }).eq('id', id);
    fetchChallenges();
  };

  const deleteChallenge = async (id: string) => {
    await supabase.from('challenges').delete().eq('id', id);
    toast.success('Challenge deleted');
    fetchChallenges();
  };

  const activeChallenges = challenges.filter(c => c.is_active);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Challenges', value: challenges.length, icon: Trophy, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Active', value: activeChallenges.length, icon: Flame, color: 'text-green-500', bg: 'bg-green-500/10' },
          { label: 'Weekly', value: challenges.filter(c => c.challenge_type === 'weekly').length, icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Monthly', value: challenges.filter(c => c.challenge_type === 'monthly').length, icon: Target, color: 'text-purple-500', bg: 'bg-purple-500/10' },
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

      {/* Challenge Templates */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" /> Life Challenges & Experiments</CardTitle>
            <CardDescription>Create and manage life challenges, sprints, and bootcamps</CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> New Challenge</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Life Challenge</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input placeholder="e.g. 7-Day Focus Sprint" value={newChallenge.title} onChange={e => setNewChallenge(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea placeholder="Challenge description..." value={newChallenge.description} onChange={e => setNewChallenge(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={newChallenge.challenge_type} onValueChange={v => setNewChallenge(p => ({ ...p, challenge_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">7-Day Sprint</SelectItem>
                        <SelectItem value="monthly">30-Day Challenge</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Target Metric</Label>
                    <Select value={newChallenge.target_metric} onValueChange={v => setNewChallenge(p => ({ ...p, target_metric: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="study_minutes">Study Minutes</SelectItem>
                        <SelectItem value="quran_minutes">Quran Minutes</SelectItem>
                        <SelectItem value="exercise_minutes">Exercise Minutes</SelectItem>
                        <SelectItem value="focus_sessions">Focus Sessions</SelectItem>
                        <SelectItem value="habit_completion">Habit Completion %</SelectItem>
                        <SelectItem value="screen_reduction">Screen Time Reduction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Target Value</Label>
                    <Input type="number" value={newChallenge.target_value} onChange={e => setNewChallenge(p => ({ ...p, target_value: parseInt(e.target.value) || 0 }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Reward Points</Label>
                    <Input type="number" value={newChallenge.reward_points} onChange={e => setNewChallenge(p => ({ ...p, reward_points: parseInt(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Select value={newChallenge.mode || 'both'} onValueChange={v => setNewChallenge(p => ({ ...p, mode: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">All Users</SelectItem>
                      <SelectItem value="iman">Iman Mode Only</SelectItem>
                      <SelectItem value="dunya">Dunya Mode Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button onClick={createChallenge}>Create Challenge</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Challenge</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Reward</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : challenges.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">No challenges created yet</TableCell></TableRow>
              ) : (
                challenges.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{c.description}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{c.challenge_type}</Badge></TableCell>
                    <TableCell className="text-sm">{c.target_value} {c.target_metric.replace(/_/g, ' ')}</TableCell>
                    <TableCell><Badge>{c.reward_points} pts</Badge></TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? 'default' : 'secondary'} className={c.is_active ? 'bg-green-500' : ''}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {c.start_date && format(new Date(c.start_date), 'MMM d')} — {c.end_date && format(new Date(c.end_date), 'MMM d')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => toggleChallenge(c.id, c.is_active || false)}>
                          {c.is_active ? 'Disable' : 'Enable'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteChallenge(c.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pre-built Templates */}
      <Card>
        <CardHeader><CardTitle>Quick Launch Templates</CardTitle></CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { name: '🎯 7-Day Focus Sprint', desc: 'No social media, deep work only', type: 'weekly' },
              { name: '📖 30-Day Quran Challenge', desc: 'Read 1 page daily', type: 'monthly' },
              { name: '🏃 Fitness Bootcamp', desc: '30 min exercise daily for 30 days', type: 'monthly' },
              { name: '📵 Digital Detox', desc: 'Under 30 min screen time for 7 days', type: 'weekly' },
              { name: '🌙 Tahajjud Challenge', desc: 'Wake for Tahajjud 7 consecutive nights', type: 'weekly' },
              { name: '📝 Daily Journaling', desc: 'Write reflection every day for 30 days', type: 'monthly' },
            ].map(t => (
              <Button key={t.name} variant="outline" className="h-auto p-4 flex-col items-start text-left" onClick={() => {
                setNewChallenge(p => ({ ...p, title: t.name, description: t.desc, challenge_type: t.type }));
                setIsCreateOpen(true);
              }}>
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.desc}</span>
                <Badge variant="outline" className="mt-2 capitalize">{t.type}</Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
