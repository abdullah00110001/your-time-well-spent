import { useEffect, useState, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { 
  Plus, Trash2, Edit, Loader2, CheckCircle2, Circle, 
  Flame, TrendingUp, TrendingDown, ArrowRightLeft, Zap,
  Trophy, Target, Shield, Sparkles, BarChart3
} from 'lucide-react';
import { toast } from 'sonner';
import { format, subDays, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface Habit {
  id: string;
  name: string;
  description: string | null;
  frequency: string;
  color: string;
  is_active: boolean;
  goal_id: string | null;
  target_per_period: number | null;
}

interface Goal {
  id: string;
  title: string;
  color: string;
}

interface HabitEntry {
  habit_id: string;
  completed: boolean;
  date: string;
}

// Habit types: build, reduce, replace
type HabitType = 'build' | 'reduce' | 'replace';

interface HabitWithMeta extends Habit {
  habitType: HabitType;
  weight: number;
  currentStreak: number;
  longestStreak: number;
  consistencyPercent: number;
  recoveryRate: number;
  weeklyData: boolean[];
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#eab308', '#84cc16', '#22c55e', '#14b8a6',
];

const HABIT_TYPE_CONFIG = {
  build: { label: 'Build', icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', desc: 'Develop new positive habits' },
  reduce: { label: 'Reduce', icon: TrendingDown, color: 'text-amber-500', bg: 'bg-amber-500/10', desc: 'Decrease negative behaviors' },
  replace: { label: 'Replace', icon: ArrowRightLeft, color: 'text-blue-500', bg: 'bg-blue-500/10', desc: 'Swap bad habits for good ones' },
};

const WEIGHT_OPTIONS = [
  { value: 1, label: '1 — Low' },
  { value: 2, label: '2 — Medium' },
  { value: 3, label: '3 — High' },
  { value: 4, label: '4 — Very High' },
  { value: 5, label: '5 — Critical' },
];

const IDENTITY_MESSAGES = [
  "You acted like a disciplined person today.",
  "A strong-willed person just showed up.",
  "Your future self is thanking you right now.",
  "Consistency is your identity. You proved it.",
  "Champions do what others skip. You didn't skip.",
];

export default function Habits() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [habits, setHabits] = useState<HabitWithMeta[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [todayEntries, setTodayEntries] = useState<Map<string, boolean>>(new Map());
  const [allEntries, setAllEntries] = useState<HabitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [showIdentityMessage, setShowIdentityMessage] = useState(false);
  const [identityMessage, setIdentityMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    frequency: 'daily',
    color: COLORS[0],
    goal_id: '',
    habitType: 'build' as HabitType,
    weight: 3,
  });
  const [saving, setSaving] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    if (location.pathname === '/habits/new') {
      setIsDialogOpen(true);
      navigate('/habits', { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');

    const [habitsRes, goalsRes, entriesRes, allEntriesRes] = await Promise.all([
      supabase.from('habits').select('*').eq('user_id', user!.id).eq('is_active', true).order('created_at', { ascending: false }),
      supabase.from('goals').select('id, title, color').eq('user_id', user!.id).eq('year', new Date().getFullYear()),
      supabase.from('habit_entries').select('habit_id, completed').eq('user_id', user!.id).eq('date', today),
      supabase.from('habit_entries').select('habit_id, completed, date').eq('user_id', user!.id).gte('date', thirtyDaysAgo),
    ]);

    const rawHabits = habitsRes.data || [];
    const entriesMap = new Map<string, boolean>();
    entriesRes.data?.forEach((e) => entriesMap.set(e.habit_id, e.completed ?? false));
    
    const allEntriesData = allEntriesRes.data || [];
    setAllEntries(allEntriesData);

    // Enrich habits with meta
    const enriched: HabitWithMeta[] = rawHabits.map((h) => {
      const habitEntries = allEntriesData.filter(e => e.habit_id === h.id);
      const completedEntries = habitEntries.filter(e => e.completed);
      
      // Calculate streaks
      let currentStreak = 0;
      let longestStreak = 0;
      let tempStreak = 0;
      for (let i = 0; i < 30; i++) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const entry = habitEntries.find(e => e.date === d);
        if (entry?.completed) {
          if (i === 0 || currentStreak > 0) currentStreak++;
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          if (i === 0) currentStreak = 0;
          tempStreak = 0;
        }
      }

      // Consistency % (last 30 days)
      const consistencyPercent = habitEntries.length > 0 
        ? Math.round((completedEntries.length / Math.min(30, habitEntries.length)) * 100)
        : 0;

      // Recovery rate (times resumed after a break)
      let breaks = 0;
      let recoveries = 0;
      let wasBreak = false;
      for (let i = 29; i >= 0; i--) {
        const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
        const entry = habitEntries.find(e => e.date === d);
        if (!entry?.completed) {
          wasBreak = true;
        } else if (wasBreak) {
          recoveries++;
          breaks++;
          wasBreak = false;
        }
      }
      const recoveryRate = breaks > 0 ? Math.round((recoveries / breaks) * 100) : 100;

      // Weekly heatmap data
      const weeklyData = weekDays.map(d => {
        const dateStr = format(d, 'yyyy-MM-dd');
        const entry = habitEntries.find(e => e.date === dateStr);
        return entry?.completed || false;
      });

      // Parse habit type from description tag or default
      const descLower = (h.description || '').toLowerCase();
      let habitType: HabitType = 'build';
      if (descLower.includes('[reduce]')) habitType = 'reduce';
      else if (descLower.includes('[replace]')) habitType = 'replace';

      return {
        ...h,
        habitType,
        weight: h.target_per_period || 3,
        currentStreak,
        longestStreak,
        consistencyPercent,
        recoveryRate,
        weeklyData,
      };
    });

    setHabits(enriched);
    setGoals(goalsRes.data || []);
    setTodayEntries(entriesMap);
    setLoading(false);
  };

  // Daily discipline score
  const dailyScore = useMemo(() => {
    if (habits.length === 0) return { earned: 0, total: 0, percent: 0 };
    const earned = habits.reduce((sum, h) => {
      const completed = todayEntries.get(h.id) || false;
      return sum + (completed ? h.weight : 0);
    }, 0);
    const total = habits.reduce((sum, h) => sum + h.weight, 0);
    return { earned, total, percent: total > 0 ? Math.round((earned / total) * 100) : 0 };
  }, [habits, todayEntries]);

  const toggleHabit = async (habitId: string) => {
    const currentStatus = todayEntries.get(habitId) || false;
    const newStatus = !currentStatus;

    setTodayEntries(new Map(todayEntries.set(habitId, newStatus)));

    const { error } = await supabase
      .from('habit_entries')
      .upsert({
        user_id: user!.id,
        habit_id: habitId,
        date: today,
        completed: newStatus,
      }, { onConflict: 'habit_id,date' });

    if (error) {
      setTodayEntries(new Map(todayEntries.set(habitId, currentStatus)));
      toast.error('Failed to update habit');
      return;
    }

    // Identity reinforcement
    if (newStatus) {
      const completedNow = [...todayEntries.values()].filter(v => v).length;
      if (completedNow >= Math.ceil(habits.length * 0.7)) {
        const msg = IDENTITY_MESSAGES[Math.floor(Math.random() * IDENTITY_MESSAGES.length)];
        setIdentityMessage(msg);
        setShowIdentityMessage(true);
        setTimeout(() => setShowIdentityMessage(false), 3000);
      }
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter a habit name');
      return;
    }

    setSaving(true);

    const typeTag = formData.habitType !== 'build' ? `[${formData.habitType}] ` : '';
    const desc = formData.description ? `${typeTag}${formData.description}` : typeTag || null;

    if (editingHabit) {
      const { error } = await supabase
        .from('habits')
        .update({
          name: formData.name,
          description: desc,
          frequency: formData.frequency,
          color: formData.color,
          goal_id: formData.goal_id || null,
          target_per_period: formData.weight,
        })
        .eq('id', editingHabit.id);

      if (error) toast.error('Failed to update habit');
      else { toast.success('Habit updated!'); fetchData(); }
    } else {
      const { error } = await supabase.from('habits').insert({
        user_id: user!.id,
        name: formData.name,
        description: desc,
        frequency: formData.frequency,
        color: formData.color,
        goal_id: formData.goal_id || null,
        target_per_period: formData.weight,
      });

      if (error) toast.error('Failed to create habit');
      else { toast.success('Habit created!'); fetchData(); }
    }

    setSaving(false);
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('habits').delete().eq('id', id);
    if (error) toast.error('Failed to delete habit');
    else {
      toast.success('Habit deleted');
      setHabits(habits.filter((h) => h.id !== id));
    }
  };

  const openEditDialog = (habit: HabitWithMeta) => {
    setEditingHabit(habit);
    const cleanDesc = (habit.description || '').replace(/\[(build|reduce|replace)\]\s*/i, '');
    setFormData({
      name: habit.name,
      description: cleanDesc,
      frequency: habit.frequency,
      color: habit.color,
      goal_id: habit.goal_id || '',
      habitType: habit.habitType,
      weight: habit.weight,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingHabit(null);
    setFormData({ name: '', description: '', frequency: 'daily', color: COLORS[0], goal_id: '', habitType: 'build', weight: 3 });
  };

  const completedCount = habits.filter((h) => todayEntries.get(h.id)).length;

  // Monthly heatmap (last 30 days)
  const heatmapDays = useMemo(() => {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      const dayEntries = allEntries.filter(e => e.date === d);
      const completed = dayEntries.filter(e => e.completed).length;
      const total = habits.length || 1;
      days.push({ date: d, percent: Math.round((completed / total) * 100) });
    }
    return days;
  }, [allEntries, habits]);

  const getScoreColor = (p: number) => {
    if (p >= 80) return 'bg-emerald-500';
    if (p >= 60) return 'bg-emerald-400';
    if (p >= 40) return 'bg-amber-400';
    if (p >= 20) return 'bg-amber-500';
    if (p > 0) return 'bg-red-400';
    return 'bg-muted';
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto pb-24 lg:pb-8">
        {/* Identity Message Toast */}
        <AnimatePresence>
          {showIdentityMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-sm"
            >
              <Card className="border-2 border-primary/50 shadow-xl">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{identityMessage}</p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-headline font-bold tracking-tight">Habits</h1>
            <p className="mt-1 text-body text-muted-foreground">
              {completedCount} of {habits.length} completed today
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Habit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingHabit ? 'Edit Habit' : 'Create New Habit'}</DialogTitle>
                <DialogDescription>
                  {editingHabit ? 'Update your habit details' : 'Define a habit with type and weight'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {/* Habit Type Selection */}
                <div className="space-y-2">
                  <Label>Habit Type</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(HABIT_TYPE_CONFIG) as [HabitType, typeof HABIT_TYPE_CONFIG.build][]).map(([type, config]) => {
                      const Icon = config.icon;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFormData({ ...formData, habitType: type })}
                          className={cn(
                            'p-3 rounded-xl border-2 transition-all text-center',
                            formData.habitType === type
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          )}
                        >
                          <Icon className={cn('h-5 w-5 mx-auto mb-1', config.color)} />
                          <span className="text-xs font-medium">{config.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Habit Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Morning meditation"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Add more details..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                {/* Weight */}
                <div className="space-y-2">
                  <Label>Weight (Impact Score)</Label>
                  <div className="flex gap-2">
                    {WEIGHT_OPTIONS.map((w) => (
                      <button
                        key={w.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, weight: w.value })}
                        className={cn(
                          'flex-1 p-2 rounded-lg border text-center text-xs font-medium transition-all',
                          formData.weight === w.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        {w.value}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">Higher weight = more impact on your daily score</p>
                </div>

                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {goals.length > 0 && (
                  <div className="space-y-2">
                    <Label>Link to Goal (optional)</Label>
                    <Select value={formData.goal_id} onValueChange={(v) => setFormData({ ...formData, goal_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select a goal" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">No goal</SelectItem>
                        {goals.map((goal) => (
                          <SelectItem key={goal.id} value={goal.id}>{goal.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex flex-wrap gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`h-8 w-8 rounded-full transition-transform ${
                          formData.color === color ? 'scale-110 ring-2 ring-offset-2 ring-primary' : ''
                        }`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingHabit ? 'Update Habit' : 'Create Habit'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : habits.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 rounded-full bg-muted p-4">
                <Target className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-subtitle font-semibold">No habits yet</h3>
              <p className="mb-4 text-center text-caption text-muted-foreground">
                Start building your identity system
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Habit
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Daily Discipline Score */}
            <Card className="border-2 border-primary/20 overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary to-accent" style={{ width: `${dailyScore.percent}%` }} />
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Daily Discipline Score</h3>
                      <p className="text-xs text-muted-foreground">
                        {dailyScore.earned}/{dailyScore.total} points earned
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-primary">{dailyScore.percent}%</span>
                  </div>
                </div>
                <Progress value={dailyScore.percent} className="h-2" />
              </CardContent>
            </Card>

            {/* Habit Heatmap (last 30 days) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  30-Day Heatmap
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex gap-1 flex-wrap">
                  {heatmapDays.map((day) => (
                    <div
                      key={day.date}
                      className={cn('w-[calc(100%/15-4px)] sm:w-7 aspect-square rounded-sm transition-colors', getScoreColor(day.percent))}
                      title={`${day.date}: ${day.percent}%`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                  <span>Less</span>
                  <div className="flex gap-0.5">
                    <div className="w-3 h-3 rounded-sm bg-muted" />
                    <div className="w-3 h-3 rounded-sm bg-red-400" />
                    <div className="w-3 h-3 rounded-sm bg-amber-400" />
                    <div className="w-3 h-3 rounded-sm bg-emerald-400" />
                    <div className="w-3 h-3 rounded-sm bg-emerald-500" />
                  </div>
                  <span>More</span>
                </div>
              </CardContent>
            </Card>

            {/* Habit List */}
            <div className="space-y-3">
              {habits.map((habit) => {
                const isCompleted = todayEntries.get(habit.id) || false;
                const typeConfig = HABIT_TYPE_CONFIG[habit.habitType];
                const TypeIcon = typeConfig.icon;

                return (
                  <motion.div
                    key={habit.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className={cn('group transition-all', isCompleted && 'bg-muted/50 border-emerald-500/30')}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <button
                              onClick={() => toggleHabit(habit.id)}
                              className="flex h-10 w-10 items-center justify-center rounded-full transition-all hover:bg-muted shrink-0"
                            >
                              {isCompleted ? (
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                                  <CheckCircle2 className="h-7 w-7" style={{ color: habit.color }} />
                                </motion.div>
                              ) : (
                                <Circle className="h-7 w-7 text-muted-foreground" />
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className={cn('font-medium truncate', isCompleted && 'text-muted-foreground line-through')}>
                                  {habit.name}
                                </h3>
                                <Badge variant="outline" className={cn('text-[10px] shrink-0', typeConfig.color)}>
                                  <TypeIcon className="h-3 w-3 mr-0.5" />
                                  {typeConfig.label}
                                </Badge>
                              </div>
                              {/* Stats Row */}
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Flame className="h-3 w-3 text-orange-500" />
                                  {habit.currentStreak}d
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  Best: {habit.longestStreak}d
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {habit.consistencyPercent}% consistent
                                </span>
                                <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                  <Zap className="h-3 w-3 text-primary" />
                                  ×{habit.weight}
                                </span>
                              </div>
                              {/* Mini weekly view */}
                              <div className="flex gap-0.5 mt-1.5">
                                {habit.weeklyData.map((done, i) => (
                                  <div
                                    key={i}
                                    className={cn(
                                      'w-4 h-1.5 rounded-full',
                                      done ? 'bg-emerald-500' : 'bg-muted'
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity lg:opacity-100">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(habit)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(habit.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
