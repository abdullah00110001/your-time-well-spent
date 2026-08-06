import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Plus, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface QuarterlyGoal {
  id: string;
  quarter: number;
  title: string;
  completed: boolean;
  year: number;
}

const quarterLabels = {
  en: ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'],
  bn: ['প্র১ (জানু-মার্চ)', 'প্র২ (এপ্রি-জুন)', 'প্র৩ (জুলা-সেপ্ট)', 'প্র৪ (অক্টো-ডিসে)'],
};

const quarterColors = [
  'from-emerald-500/20 to-emerald-500/5',
  'from-blue-500/20 to-blue-500/5',
  'from-amber-500/20 to-amber-500/5',
  'from-purple-500/20 to-purple-500/5',
];

export default function QuarterlyGoals() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [goals, setGoals] = useState<QuarterlyGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGoals, setNewGoals] = useState<{ [key: number]: string }>({});
  const currentYear = new Date().getFullYear();
  const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);

  useEffect(() => {
    if (user) fetchGoals();
  }, [user]);

  const fetchGoals = async () => {
    const { data } = await supabase
      .from('quarterly_goals')
      .select('*')
      .eq('user_id', user!.id)
      .eq('year', currentYear)
      .order('quarter')
      .order('created_at');
    
    if (data) setGoals(data);
    setLoading(false);
  };

  const addGoal = async (quarter: number) => {
    const title = newGoals[quarter]?.trim();
    if (!title) return;

    const { error } = await supabase
      .from('quarterly_goals')
      .insert({
        user_id: user!.id,
        quarter,
        year: currentYear,
        title,
      });

    if (error) {
      toast.error(language === 'bn' ? 'সংরক্ষণ করা যায়নি' : 'Could not save');
      return;
    }

    setNewGoals({ ...newGoals, [quarter]: '' });
    fetchGoals();
    toast.success(language === 'bn' ? 'লক্ষ্য যোগ হয়েছে!' : 'Goal added!');
  };

  const toggleGoal = async (goal: QuarterlyGoal) => {
    const { error } = await supabase
      .from('quarterly_goals')
      .update({ completed: !goal.completed })
      .eq('id', goal.id);

    if (!error) {
      setGoals(goals.map(g => 
        g.id === goal.id ? { ...g, completed: !g.completed } : g
      ));
      if (!goal.completed) {
        toast.success('🎉 ' + (language === 'bn' ? 'অভিনন্দন!' : 'Congratulations!'));
      }
    }
  };

  const deleteGoal = async (id: string) => {
    const { error } = await supabase
      .from('quarterly_goals')
      .delete()
      .eq('id', id);

    if (!error) {
      setGoals(goals.filter(g => g.id !== id));
      toast.success(language === 'bn' ? 'মুছে ফেলা হয়েছে' : 'Deleted');
    }
  };

  const getQuarterGoals = (quarter: number) => 
    goals.filter(g => g.quarter === quarter);

  const getQuarterProgress = (quarter: number) => {
    const quarterGoals = getQuarterGoals(quarter);
    if (quarterGoals.length === 0) return 0;
    return Math.round((quarterGoals.filter(g => g.completed).length / quarterGoals.length) * 100);
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            {language === 'bn' ? 'ত্রৈমাসিক লক্ষ্য' : 'Quarterly Goals'}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {language === 'bn' 
              ? `${currentYear} সালের জন্য আপনার বড় লক্ষ্যগুলো` 
              : `Your major objectives for ${currentYear}`}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {[1, 2, 3, 4].map((quarter) => {
            const quarterGoals = getQuarterGoals(quarter);
            const progress = getQuarterProgress(quarter);
            const isCurrentQuarter = quarter === currentQuarter;
            const labels = language === 'bn' ? quarterLabels.bn : quarterLabels.en;

            return (
              <Card 
                key={quarter} 
                className={`overflow-hidden ${isCurrentQuarter ? 'ring-2 ring-primary' : ''}`}
              >
                <div className={`h-2 bg-gradient-to-r ${quarterColors[quarter - 1]}`} />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {labels[quarter - 1]}
                        {isCurrentQuarter && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            {language === 'bn' ? 'বর্তমান' : 'Current'}
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {quarterGoals.filter(g => g.completed).length}/{quarterGoals.length} {language === 'bn' ? 'সম্পন্ন' : 'completed'}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold">{progress}%</span>
                    </div>
                  </div>
                  <Progress value={progress} className="mt-2" />
                </CardHeader>
                <CardContent className="space-y-3">
                  {quarterGoals.map((goal) => (
                    <div
                      key={goal.id}
                      className="flex items-center gap-3 rounded-lg border p-3 group"
                    >
                      <Checkbox
                        checked={goal.completed}
                        onCheckedChange={() => toggleGoal(goal)}
                      />
                      <span className={`flex-1 ${goal.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {goal.title}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                        onClick={() => deleteGoal(goal.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {quarterGoals.length < 5 && (
                    <div className="flex gap-2">
                      <Input
                        placeholder={language === 'bn' ? 'নতুন লক্ষ্য যোগ করুন...' : 'Add a goal...'}
                        value={newGoals[quarter] || ''}
                        onChange={(e) => setNewGoals({ ...newGoals, [quarter]: e.target.value })}
                        onKeyPress={(e) => e.key === 'Enter' && addGoal(quarter)}
                      />
                      <Button 
                        size="icon"
                        onClick={() => addGoal(quarter)}
                        disabled={!newGoals[quarter]?.trim()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {quarterGoals.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-2">
                      {language === 'bn' ? '৩-৫টি বড় লক্ষ্য যোগ করুন' : 'Add 3-5 major goals'}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Summary */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {language === 'bn' ? 'বার্ষিক সারাংশ' : 'Yearly Summary'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-4">
              {[1, 2, 3, 4].map((quarter) => {
                const progress = getQuarterProgress(quarter);
                const labels = language === 'bn' ? quarterLabels.bn : quarterLabels.en;
                return (
                  <div key={quarter} className="text-center">
                    <div className="text-2xl font-bold">{progress}%</div>
                    <div className="text-sm text-muted-foreground">{labels[quarter - 1].split(' ')[0]}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
