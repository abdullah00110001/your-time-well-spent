import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Moon, Lock, CheckCircle2, AlertCircle } from 'lucide-react';

interface Muhasaba {
  id?: string;
  date: string;
  what_went_right: string;
  what_went_wrong: string;
  helpful_habit: string;
  harmful_habit: string;
  fix_tomorrow: string;
}

export default function NightMuhasaba() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [muhasaba, setMuhasaba] = useState<Muhasaba>({
    date: selectedDate,
    what_went_right: '',
    what_went_wrong: '',
    helpful_habit: '',
    harmful_habit: '',
    fix_tomorrow: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [hasEntry, setHasEntry] = useState(false);

  useEffect(() => {
    if (user) {
      fetchMuhasaba();
      checkDailyEntry();
    }
  }, [user, selectedDate]);

  const fetchMuhasaba = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('night_muhasaba')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setMuhasaba(data as Muhasaba);
        setIsLocked(true);
      } else {
        setMuhasaba({
          date: selectedDate,
          what_went_right: '',
          what_went_wrong: '',
          helpful_habit: '',
          harmful_habit: '',
          fix_tomorrow: '',
        });
        setIsLocked(false);
      }
    } catch (error) {
      console.error('Error fetching muhasaba:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDailyEntry = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('daily_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .maybeSingle();
      
      setHasEntry(!!data);
    } catch (error) {
      console.error('Error checking daily entry:', error);
    }
  };

  const handleSubmit = async () => {
    if (!user || isLocked) return;
    
    // Validate all fields are filled
    if (!muhasaba.what_went_right || !muhasaba.what_went_wrong || 
        !muhasaba.helpful_habit || !muhasaba.harmful_habit || !muhasaba.fix_tomorrow) {
      toast.error('Please fill in all reflection fields');
      return;
    }

    setSaving(true);
    try {
      // Get the daily entry ID if it exists
      const { data: dailyEntry } = await supabase
        .from('daily_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .maybeSingle();

      // Insert muhasaba
      const { error: muhasabaError } = await supabase
        .from('night_muhasaba')
        .insert({
          ...muhasaba,
          user_id: user.id,
          date: selectedDate,
          daily_entry_id: dailyEntry?.id || null,
        });

      if (muhasabaError) throw muhasabaError;

      // Lock the daily entry
      if (dailyEntry) {
        await supabase
          .from('daily_entries')
          .update({ is_locked: true, locked_at: new Date().toISOString() })
          .eq('id', dailyEntry.id);
      }

      toast.success('Night Muhasaba submitted! Day is now locked.');
      setIsLocked(true);
    } catch (error) {
      console.error('Error saving muhasaba:', error);
      toast.error('Failed to submit reflection');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 pb-20">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Moon className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold">Night Muhasaba</h1>
          <p className="text-muted-foreground">End-of-day self-accounting</p>
          <p className="text-sm text-muted-foreground italic">
            "Call yourselves to account before you are called to account." — Umar ibn Al-Khattab
          </p>
        </div>

        {/* Date Selection */}
        <div className="flex justify-center">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            max={format(new Date(), 'yyyy-MM-dd')}
            className="px-4 py-2 border rounded-lg bg-background"
          />
        </div>

        {/* Status Messages */}
        {isLocked && (
          <div className="flex items-center justify-center gap-2 p-4 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 rounded-lg">
            <Lock className="h-5 w-5" />
            <span>This day's reflection has been submitted and locked.</span>
          </div>
        )}

        {!hasEntry && !isLocked && (
          <div className="flex items-center justify-center gap-2 p-4 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-lg">
            <AlertCircle className="h-5 w-5" />
            <span>You haven't logged your daily entry yet. Consider doing that first.</span>
          </div>
        )}

        {/* Reflection Questions */}
        <Card>
          <CardHeader>
            <CardTitle>5 Questions for Self-Reflection</CardTitle>
            <CardDescription>Answer honestly. This will lock your day after submission.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                1. What went RIGHT today?
              </Label>
              <Textarea
                value={muhasaba.what_went_right}
                onChange={(e) => setMuhasaba({ ...muhasaba, what_went_right: e.target.value })}
                placeholder="List your wins, accomplishments, and positive moments..."
                rows={3}
                disabled={isLocked}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="text-2xl">❌</span>
                2. What went WRONG today?
              </Label>
              <Textarea
                value={muhasaba.what_went_wrong}
                onChange={(e) => setMuhasaba({ ...muhasaba, what_went_wrong: e.target.value })}
                placeholder="Be honest about mistakes, failures, and areas of improvement..."
                rows={3}
                disabled={isLocked}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="text-2xl">💪</span>
                3. Which habit HELPED you today?
              </Label>
              <Textarea
                value={muhasaba.helpful_habit}
                onChange={(e) => setMuhasaba({ ...muhasaba, helpful_habit: e.target.value })}
                placeholder="What positive habit served you well today?"
                rows={2}
                disabled={isLocked}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="text-2xl">⚠️</span>
                4. Which habit HARMED you today?
              </Label>
              <Textarea
                value={muhasaba.harmful_habit}
                onChange={(e) => setMuhasaba({ ...muhasaba, harmful_habit: e.target.value })}
                placeholder="What negative habit held you back today?"
                rows={2}
                disabled={isLocked}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <span className="text-2xl">🎯</span>
                5. What ONE thing must you FIX tomorrow?
              </Label>
              <Textarea
                value={muhasaba.fix_tomorrow}
                onChange={(e) => setMuhasaba({ ...muhasaba, fix_tomorrow: e.target.value })}
                placeholder="Your single most important focus for tomorrow..."
                rows={2}
                disabled={isLocked}
                className="resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        {!isLocked && (
          <div className="flex justify-center">
            <Button 
              onClick={handleSubmit}
              disabled={saving}
              size="lg"
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Submitting...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Submit & Lock Day
                </>
              )}
            </Button>
          </div>
        )}

        {isLocked && (
          <div className="flex justify-center">
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Reflection Complete</span>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}