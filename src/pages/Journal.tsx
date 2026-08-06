import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, subWeeks, addWeeks } from 'date-fns';
import { ChevronLeft, ChevronRight, Loader2, Save, Smile, Meh, Frown, Heart, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Reflection {
  id: string;
  week_start: string;
  wins: string | null;
  challenges: string | null;
  intentions: string | null;
  mood: number | null;
  created_at: string;
}

const moodIcons = [
  { value: 1, icon: Frown, label: 'Tough', color: 'text-muted-foreground' },
  { value: 2, icon: Meh, label: 'Okay', color: 'text-secondary' },
  { value: 3, icon: Smile, label: 'Good', color: 'text-primary' },
  { value: 4, icon: Heart, label: 'Great', color: 'text-pink-500' },
  { value: 5, icon: Sparkles, label: 'Amazing', color: 'text-accent' },
];

export default function Journal() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [currentWeek, setCurrentWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [reflection, setReflection] = useState<Partial<Reflection>>({
    wins: '',
    challenges: '',
    intentions: '',
    mood: null,
  });
  const [pastReflections, setPastReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const weekStart = format(currentWeek, 'yyyy-MM-dd');
  const weekEnd = format(addWeeks(currentWeek, 1), 'MMM d');
  const weekDisplay = `${format(currentWeek, 'MMM d')} - ${weekEnd}`;

  useEffect(() => {
    if (user) {
      fetchReflection();
      fetchPastReflections();
    }
  }, [user, currentWeek]);

  const fetchReflection = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('reflections')
      .select('*')
      .eq('user_id', user!.id)
      .eq('week_start', weekStart)
      .single();

    if (data) {
      setReflection(data);
    } else {
      setReflection({
        wins: '',
        challenges: '',
        intentions: '',
        mood: null,
      });
    }
    setLoading(false);
  };

  const fetchPastReflections = async () => {
    const { data } = await supabase
      .from('reflections')
      .select('*')
      .eq('user_id', user!.id)
      .lt('week_start', weekStart)
      .order('week_start', { ascending: false })
      .limit(5);

    setPastReflections(data || []);
  };

  const handleSave = async () => {
    setSaving(true);

    const payload = {
      user_id: user!.id,
      week_start: weekStart,
      wins: reflection.wins || null,
      challenges: reflection.challenges || null,
      intentions: reflection.intentions || null,
      mood: reflection.mood || null,
    };

    if (reflection.id) {
      await supabase
        .from('reflections')
        .update(payload)
        .eq('id', reflection.id);
    } else {
      await supabase
        .from('reflections')
        .insert(payload);
    }

    toast.success(t('journal.saved'));
    setSaving(false);
    fetchReflection();
    fetchPastReflections();
  };

  const isCurrentWeek = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd') === weekStart;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-headline font-bold tracking-tight">{t('journal.title')}</h1>
          <p className="mt-1 text-body text-muted-foreground">
            {t('journal.subtitle')}
          </p>
        </div>

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Current Week Reflection */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-subtitle">{t('journal.thisWeek')}</CardTitle>
                    <CardDescription className="text-caption">{weekDisplay}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentWeek(startOfWeek(new Date(), { weekStartsOn: 1 }))}
                      disabled={isCurrentWeek}
                    >
                      {t('calendar.today')}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
                      disabled={isCurrentWeek}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Mood Selection */}
                    <div className="space-y-3">
                      <Label>{t('journal.mood')}</Label>
                      <div className="grid grid-cols-5 gap-1 sm:gap-2">
                        {moodIcons.map(({ value, icon: Icon, label, color }) => (
                          <Button
                            key={value}
                            variant={reflection.mood === value ? 'default' : 'outline'}
                            size="sm"
                            className={cn(
                              'flex flex-col gap-0.5 sm:gap-1 h-auto py-2 sm:py-3 px-1 sm:px-2',
                              reflection.mood === value && 'ring-2 ring-primary'
                            )}
                            onClick={() => setReflection({ ...reflection, mood: value })}
                          >
                            <Icon className={cn('h-4 w-4 sm:h-6 sm:w-6', reflection.mood !== value && color)} />
                            <span className="text-[9px] sm:text-xs truncate">{label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Wins */}
                    <div className="space-y-2">
                      <Label htmlFor="wins">{t('journal.wins')} 🎉</Label>
                      <Textarea
                        id="wins"
                        value={reflection.wins || ''}
                        onChange={(e) => setReflection({ ...reflection, wins: e.target.value })}
                        placeholder={t('journal.winsPlaceholder')}
                        rows={3}
                      />
                    </div>

                    {/* Challenges */}
                    <div className="space-y-2">
                      <Label htmlFor="challenges">{t('journal.challenges')} 💪</Label>
                      <Textarea
                        id="challenges"
                        value={reflection.challenges || ''}
                        onChange={(e) => setReflection({ ...reflection, challenges: e.target.value })}
                        placeholder={t('journal.challengesPlaceholder')}
                        rows={3}
                      />
                    </div>

                    {/* Intentions */}
                    <div className="space-y-2">
                      <Label htmlFor="intentions">{t('journal.intentions')} 🎯</Label>
                      <Textarea
                        id="intentions"
                        value={reflection.intentions || ''}
                        onChange={(e) => setReflection({ ...reflection, intentions: e.target.value })}
                        placeholder={t('journal.intentionsPlaceholder')}
                        rows={3}
                      />
                    </div>

                    <Button onClick={handleSave} disabled={saving} className="w-full">
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {t('journal.save')}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Past Reflections */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="text-subtitle">{t('journal.pastReflections')}</CardTitle>
              </CardHeader>
              <CardContent>
                {pastReflections.length === 0 ? (
                  <p className="text-caption text-muted-foreground text-center py-8">
                    {t('journal.noReflections')}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {pastReflections.map((ref) => {
                      const mood = moodIcons.find(m => m.value === ref.mood);
                      const MoodIcon = mood?.icon || Meh;
                      
                      return (
                        <div
                          key={ref.id}
                          className="cursor-pointer rounded-lg border p-4 transition-colors hover:bg-muted/50"
                          onClick={() => setCurrentWeek(new Date(ref.week_start))}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">
                              {format(new Date(ref.week_start), 'MMM d, yyyy')}
                            </span>
                            {mood && (
                              <MoodIcon className={cn('h-4 w-4', mood.color)} />
                            )}
                          </div>
                          {ref.wins && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {ref.wins}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
