import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Target, Plus, Trash2, Edit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Goal {
  id: string;
  title: string;
  description: string | null;
  year: number;
  target_completion: number;
  color: string;
  created_at: string;
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#eab308', '#84cc16', '#22c55e', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6',
];

export default function Goals() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    color: COLORS[0],
  });
  const [saving, setSaving] = useState(false);

  // Auto-open dialog when navigating to /goals/new
  useEffect(() => {
    if (location.pathname === '/goals/new') {
      setIsDialogOpen(true);
      navigate('/goals', { replace: true });
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (user) fetchGoals();
  }, [user]);

  const fetchGoals = async () => {
    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user!.id)
      .eq('year', new Date().getFullYear())
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load goals');
    } else {
      setGoals(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a goal title');
      return;
    }

    setSaving(true);

    if (editingGoal) {
      const { error } = await supabase
        .from('goals')
        .update({
          title: formData.title,
          description: formData.description || null,
          color: formData.color,
        })
        .eq('id', editingGoal.id);

      if (error) {
        toast.error('Failed to update goal');
      } else {
        toast.success('Goal updated!');
        fetchGoals();
      }
    } else {
      const { error } = await supabase.from('goals').insert({
        user_id: user!.id,
        title: formData.title,
        description: formData.description || null,
        color: formData.color,
        year: new Date().getFullYear(),
      });

      if (error) {
        toast.error('Failed to create goal');
      } else {
        toast.success('Goal created!');
        fetchGoals();
      }
    }

    setSaving(false);
    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete goal');
    } else {
      toast.success('Goal deleted');
      setGoals(goals.filter((g) => g.id !== id));
    }
  };

  const openEditDialog = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      title: goal.title,
      description: goal.description || '',
      color: goal.color,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingGoal(null);
    setFormData({ title: '', description: '', color: COLORS[0] });
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-headline font-bold tracking-tight">Goals</h1>
            <p className="mt-1 text-body text-muted-foreground">
              Set and track your yearly objectives
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                New Goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingGoal ? 'Edit Goal' : 'Create New Goal'}</DialogTitle>
                <DialogDescription>
                  {editingGoal ? 'Update your goal details' : 'Define a new yearly goal to work towards'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Goal Title</Label>
                  <Input
                    id="title"
                    placeholder="e.g., Run a marathon"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Add more details about your goal..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
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
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingGoal ? 'Update Goal' : 'Create Goal'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : goals.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 rounded-full bg-muted p-4">
                <Target className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-subtitle font-semibold">No goals yet</h3>
              <p className="mb-4 text-center text-caption text-muted-foreground">
                Start by creating your first yearly goal
              </p>
              <Button onClick={() => setIsDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Goal
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => (
              <Card key={goal.id} className="group relative overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-1 w-full"
                  style={{ backgroundColor: goal.color }}
                />
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${goal.color}20` }}
                      >
                        <Target className="h-5 w-5" style={{ color: goal.color }} />
                      </div>
                      <div>
                        <CardTitle className="text-subtitle">{goal.title}</CardTitle>
                        <CardDescription className="text-caption">{goal.year}</CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(goal)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(goal.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {goal.description && (
                  <CardContent>
                    <p className="text-caption text-muted-foreground">{goal.description}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}