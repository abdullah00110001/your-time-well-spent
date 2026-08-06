import { useState, useEffect, useMemo } from 'react';
import { format, isToday, parseISO, differenceInHours, setHours, setMinutes } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import HabitFrictionSystem from '@/components/insights/HabitFrictionSystem';
import { CustomFieldsManager } from '@/components/daily/CustomFieldsManager';
import { cn } from '@/lib/utils';
import { 
  BookOpen, Clock, Dumbbell, Moon, Brain, Target, Smartphone,
  CheckCircle2, AlertTriangle, Save, Lock, Eye, AlertCircle, Check, X, CircleCheck
} from 'lucide-react';

interface DailyEntry {
  id?: string;
  date: string;
  focused_study_minutes: number;
  revision_minutes: number;
  skill_learning_minutes: number;
  fajr_completed: boolean;
  fajr_on_time: boolean;
  dhuhr_completed: boolean;
  dhuhr_on_time: boolean;
  asr_completed: boolean;
  asr_on_time: boolean;
  maghrib_completed: boolean;
  maghrib_on_time: boolean;
  isha_completed: boolean;
  isha_on_time: boolean;
  khushu_level: number;
  quran_read: boolean;
  quran_surah: string;
  quran_ayah_from: number;
  quran_ayah_to: number;
  quran_type: string;
  quran_minutes: number;
  device_time_minutes: number;
  social_media_minutes: number;
  shorts_reels_minutes: number;
  exercise_done: boolean;
  exercise_type: string;
  exercise_intensity: string;
  exercise_duration_minutes: number;
  sleep_duration_minutes: number;
  sleep_quality: number;
  energy_level: number;
  focus_level: number;
  discipline_level: number;
  overall_day_rating: number;
  task_status: string;
  mental_state: string;
  most_important_task: string;
  biggest_time_leak: string;
  regret_of_day: string;
  free_reflection: string;
  is_locked: boolean;
  created_at?: string;
}

const defaultEntry: Omit<DailyEntry, 'date'> = {
  focused_study_minutes: 0,
  revision_minutes: 0,
  skill_learning_minutes: 0,
  fajr_completed: false,
  fajr_on_time: false,
  dhuhr_completed: false,
  dhuhr_on_time: false,
  asr_completed: false,
  asr_on_time: false,
  maghrib_completed: false,
  maghrib_on_time: false,
  isha_completed: false,
  isha_on_time: false,
  khushu_level: 3,
  quran_read: false,
  quran_surah: '',
  quran_ayah_from: 0,
  quran_ayah_to: 0,
  quran_type: 'reading',
  quran_minutes: 0,
  device_time_minutes: 0,
  social_media_minutes: 0,
  shorts_reels_minutes: 0,
  exercise_done: false,
  exercise_type: '',
  exercise_intensity: 'medium',
  exercise_duration_minutes: 0,
  sleep_duration_minutes: 420,
  sleep_quality: 3,
  energy_level: 3,
  focus_level: 3,
  discipline_level: 3,
  overall_day_rating: 5,
  task_status: 'not_submitted',
  mental_state: 'calm',
  most_important_task: '',
  biggest_time_leak: '',
  regret_of_day: '',
  free_reflection: '',
  is_locked: false,
};

const SALAH_PRAYERS = [
  { key: 'fajr', name: 'Fajr', namebn: 'ফজর', icon: '🌅' },
  { key: 'dhuhr', name: 'Dhuhr', namebn: 'যোহর', icon: '☀️' },
  { key: 'asr', name: 'Asr', namebn: 'আসর', icon: '🌤️' },
  { key: 'maghrib', name: 'Maghrib', namebn: 'মাগরিব', icon: '🌅' },
  { key: 'isha', name: 'Isha', namebn: 'ইশা', icon: '🌙' },
];

// DB constraint expects: low | medium | high
// UI shows: light | medium | intense
const intensityToDb = (value?: string) => {
  if (!value) return 'medium';
  if (value === 'light') return 'low';
  if (value === 'intense') return 'high';
  return value;
};

const intensityFromDb = (value?: string) => {
  if (!value) return 'medium';
  if (value === 'low') return 'light';
  if (value === 'high') return 'intense';
  return value;
};

export default function DailyInput() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);
  const [entry, setEntry] = useState<DailyEntry>({ ...defaultEntry, date: selectedDate });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState(false); // View-only mode for past days
  const [isLateSubmission, setIsLateSubmission] = useState(false);

  // Check if it's late submission window (12 AM - 6 AM for previous day)
  const checkLateSubmission = (date: string) => {
    const now = new Date();
    const currentHour = now.getHours();
    const yesterday = format(new Date(now.getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
    
    // Between 12 AM and 6 AM, allow late submission for yesterday
    if (currentHour >= 0 && currentHour < 6 && date === yesterday) {
      return true;
    }
    return false;
  };

  // Determine if editing is allowed
  const canEdit = () => {
    if (entry.is_locked) return false;
    if (selectedDate === today) return true;
    if (checkLateSubmission(selectedDate)) return true;
    return false;
  };

  useEffect(() => {
    if (user) fetchEntry();
  }, [user, selectedDate]);

  useEffect(() => {
    setIsLateSubmission(checkLateSubmission(selectedDate));
    setViewMode(!canEdit());
  }, [selectedDate, entry.is_locked]);

  const fetchEntry = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const normalized = {
          ...(data as any),
          exercise_intensity: intensityFromDb((data as any)?.exercise_intensity),
        };
        setEntry(normalized as DailyEntry);
      } else {
        setEntry({ ...defaultEntry, date: selectedDate });
      }
    } catch (error) {
      console.error('Error fetching entry:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !canEdit()) return;
    setSaving(true);
    try {
      // Valid task_status values: 'complete_on_time', 'complete_late', 'incomplete', 'not_submitted'
      const taskStatus = isLateSubmission ? 'complete_late' : 'complete_on_time';
      
      // Clean entry data - remove id and created_at for insert, keep only valid fields
      const cleanEntry = {
        focused_study_minutes: entry.focused_study_minutes || 0,
        revision_minutes: entry.revision_minutes || 0,
        skill_learning_minutes: entry.skill_learning_minutes || 0,
        fajr_completed: entry.fajr_completed || false,
        fajr_on_time: entry.fajr_on_time || false,
        dhuhr_completed: entry.dhuhr_completed || false,
        dhuhr_on_time: entry.dhuhr_on_time || false,
        asr_completed: entry.asr_completed || false,
        asr_on_time: entry.asr_on_time || false,
        maghrib_completed: entry.maghrib_completed || false,
        maghrib_on_time: entry.maghrib_on_time || false,
        isha_completed: entry.isha_completed || false,
        isha_on_time: entry.isha_on_time || false,
        khushu_level: entry.khushu_level || 3,
        quran_read: entry.quran_read || false,
        quran_surah: entry.quran_surah || '',
        quran_ayah_from: entry.quran_ayah_from || null,
        quran_ayah_to: entry.quran_ayah_to || null,
        quran_type: entry.quran_type || 'reading',
        quran_minutes: entry.quran_minutes || 0,
        device_time_minutes: entry.device_time_minutes || 0,
        social_media_minutes: entry.social_media_minutes || 0,
        shorts_reels_minutes: entry.shorts_reels_minutes || 0,
        exercise_done: entry.exercise_done || false,
        exercise_type: entry.exercise_type || '',
        exercise_intensity: intensityToDb(entry.exercise_intensity),
        exercise_duration_minutes: entry.exercise_duration_minutes || 0,
        sleep_duration_minutes: entry.sleep_duration_minutes || 420,
        sleep_quality: entry.sleep_quality || 3,
        energy_level: entry.energy_level || 3,
        focus_level: entry.focus_level || 3,
        discipline_level: entry.discipline_level || 3,
        overall_day_rating: entry.overall_day_rating || 5,
        mental_state: entry.mental_state || 'calm',
        most_important_task: entry.most_important_task || '',
        biggest_time_leak: entry.biggest_time_leak || '',
        regret_of_day: entry.regret_of_day || '',
        free_reflection: entry.free_reflection || '',
        is_locked: entry.is_locked || false,
        task_status: taskStatus,
      };
      
      // First check if entry exists
      const { data: existingEntry, error: existingEntryError } = await supabase
        .from('daily_entries')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .maybeSingle();

      if (existingEntryError) {
        console.error('Supabase existing-entry lookup error:', existingEntryError);
        throw existingEntryError;
      }

      let error;
      
      if (existingEntry?.id) {
        // Update existing entry
        const { error: updateError } = await supabase
          .from('daily_entries')
          .update({
            ...cleanEntry,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingEntry.id);
        error = updateError;
      } else {
        // Insert new entry
        const { error: insertError } = await supabase
          .from('daily_entries')
          .insert({
            ...cleanEntry,
            user_id: user.id,
            date: selectedDate,
          });
        error = insertError;
      }

      if (error) {
        console.error('Supabase save error:', error);
        throw error;
      }
      
      const message = isLateSubmission 
        ? (language === 'bn' ? 'লেট সাবমিশন সংরক্ষিত!' : 'Late submission saved!')
        : (language === 'bn' ? 'সফলভাবে সংরক্ষিত!' : 'Entry saved successfully!');
      
      toast.success(message);
      await updateScores();
      await fetchEntry(); // Refresh data
    } catch (error: any) {
      console.error('Error saving entry:', error);
      const details =
        error?.message ||
        error?.error_description ||
        error?.hint ||
        (typeof error === 'string' ? error : JSON.stringify(error));

      toast.error(language === 'bn' ? 'সংরক্ষণ ব্যর্থ হয়েছে' : 'Failed to save entry', {
        description: details,
      });
    } finally {
      setSaving(false);
    }
  };

  const updateScores = async () => {
    if (!user) return;
    
    const salahCount = [
      entry.fajr_completed, entry.dhuhr_completed, entry.asr_completed,
      entry.maghrib_completed, entry.isha_completed
    ].filter(Boolean).length;

    const deenScore = Math.round((salahCount / 5 * 50) + (entry.quran_read ? 30 : 0) + (entry.khushu_level || 0) * 4);
    const disciplineScore = Math.round(((entry.discipline_level || 0) * 20) + ((entry.focus_level || 0) * 10) - (entry.device_time_minutes / 10));
    const focusScore = Math.round((entry.focused_study_minutes / 3) + ((entry.focus_level || 0) * 15));
    const productivityScore = Math.round((entry.overall_day_rating || 0) * 10);

    await supabase
      .from('user_scores')
      .upsert({
        user_id: user.id,
        date: selectedDate,
        deen_score: Math.max(0, Math.min(100, deenScore)),
        discipline_score: Math.max(0, Math.min(100, disciplineScore)),
        focus_score: Math.max(0, Math.min(100, focusScore)),
        productivity_score: Math.max(0, Math.min(100, productivityScore)),
      }, { onConflict: 'user_id,date' });
  };

  const formatMinutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  // Salah status helper
  const getSalahStatus = (completed: boolean, onTime: boolean) => {
    if (!completed) return { status: 'missed', color: 'text-muted-foreground', icon: X };
    if (onTime) return { status: 'onTime', color: 'text-primary', icon: Check };
    return { status: 'qaza', color: 'text-secondary', icon: AlertCircle };
  };

  // Check if current tab is complete
  const getTabCompletionStatus = useMemo(() => {
    const salahComplete = SALAH_PRAYERS.every(prayer => {
      const completed = entry[`${prayer.key}_completed` as keyof DailyEntry];
      const onTime = entry[`${prayer.key}_on_time` as keyof DailyEntry];
      // A prayer is "answered" if it's marked as on-time, qaza, or explicitly missed
      return completed !== undefined;
    });
    
    const quranComplete = entry.quran_read !== undefined;
    const studyComplete = entry.focused_study_minutes > 0 || entry.revision_minutes > 0;
    const digitalComplete = entry.device_time_minutes > 0;
    const healthComplete = entry.exercise_done !== undefined && entry.sleep_duration_minutes > 0;
    const energyComplete = entry.energy_level > 0 && entry.focus_level > 0;
    const reflectComplete = entry.overall_day_rating > 0;

    return {
      salah: salahComplete,
      quran: quranComplete,
      study: studyComplete,
      digital: digitalComplete,
      health: healthComplete,
      energy: energyComplete,
      reflect: reflectComplete,
    };
  }, [entry]);

  // Check if all tabs are complete
  const allComplete = useMemo(() => {
    return Object.values(getTabCompletionStatus).every(Boolean);
  }, [getTabCompletionStatus]);

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
      <div className="p-3 sm:p-4 lg:p-8 max-w-5xl mx-auto space-y-3 sm:space-y-4 pb-28 lg:pb-8">
        {/* Header with Completion Indicator */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap justify-between items-start gap-2">
            <div className="flex items-center gap-2">
              <div>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold flex items-center gap-2">
                  {language === 'bn' ? 'দৈনিক ইনপুট' : 'Daily Life Input'}
                  {allComplete && (
                    <CircleCheck className="h-5 w-5 text-green-500 animate-scale-in" />
                  )}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {language === 'bn' ? 'মনোযোগ দিয়ে আপনার দিন ট্র্যাক করুন' : 'Track your day mindfully'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-32 sm:w-40 text-xs sm:text-sm h-9"
                max={today}
              />
              {viewMode && !entry.is_locked && selectedDate !== today && (
                <Badge variant="outline" className="shrink-0 gap-1 text-[10px] sm:text-xs">
                  <Eye className="h-3 w-3" />
                  <span>{language === 'bn' ? 'দেখা' : 'View'}</span>
                </Badge>
              )}
              {entry.is_locked && (
                <Badge variant="secondary" className="shrink-0 gap-1 text-[10px] sm:text-xs">
                  <Lock className="h-3 w-3" />
                  <span>{language === 'bn' ? 'লক' : 'Locked'}</span>
                </Badge>
              )}
              {isLateSubmission && !entry.is_locked && (
                <Badge variant="destructive" className="shrink-0 gap-1 text-[10px] sm:text-xs">
                  <AlertCircle className="h-3 w-3" />
                  <span>{language === 'bn' ? 'লেট' : 'Late'}</span>
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* View-only notice for past days */}
        {viewMode && !entry.is_locked && selectedDate !== today && (
          <Card className="border-muted bg-muted/50">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <Eye className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium text-xs sm:text-sm">
                    {language === 'bn' ? 'শুধুমাত্র দেখার মোড' : 'View-Only Mode'}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {language === 'bn' 
                      ? 'লেট সাবমিশন রাত ১২টা থেকে সকাল ৬টার মধ্যে সম্ভব।'
                      : 'Late submission available 12 AM - 6 AM.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="salah" className="w-full">
          {/* Redesigned Daily Life Input Bar - Cleaner Grid Layout with Lucide Icons */}
          <Card className="mb-4 overflow-hidden">
            <CardContent className="p-4 sm:p-5">
              <TabsList className="w-full h-auto bg-muted/40 p-2 rounded-xl grid grid-cols-4 sm:grid-cols-7 gap-2">
                {[
                  { value: 'salah', icon: Moon, full: 'Salah', fullBn: 'নামাজ', color: 'text-amber-500' },
                  { value: 'quran', icon: BookOpen, full: "Qur'an", fullBn: 'কুরআন', color: 'text-emerald-500' },
                  { value: 'study', icon: Target, full: 'Study', fullBn: 'পড়াশোনা', color: 'text-blue-500' },
                  { value: 'digital', icon: Smartphone, full: 'Digital', fullBn: 'ডিজিটাল', color: 'text-purple-500' },
                  { value: 'health', icon: Dumbbell, full: 'Health', fullBn: 'স্বাস্থ্য', color: 'text-red-500' },
                  { value: 'energy', icon: Brain, full: 'Energy', fullBn: 'শক্তি', color: 'text-yellow-500' },
                  { value: 'reflect', icon: Clock, full: 'Reflect', fullBn: 'চিন্তন', color: 'text-indigo-500' },
                ].map((tab) => {
                  const isComplete = getTabCompletionStatus[tab.value as keyof typeof getTabCompletionStatus];
                  const TabIcon = tab.icon;
                  return (
                    <TabsTrigger 
                      key={tab.value}
                      value={tab.value} 
                      className={cn(
                        "relative flex flex-col items-center justify-center gap-1.5 h-auto py-3 px-1 sm:px-2 rounded-lg transition-all duration-200",
                        "bg-card/80 hover:bg-card shadow-sm",
                        "data-[state=active]:bg-primary/15 data-[state=active]:border-primary data-[state=active]:shadow-md",
                        "border border-transparent data-[state=active]:border-primary/50",
                        isComplete && "ring-1 ring-green-500/50"
                      )}
                    >
                      <TabIcon className={cn("h-5 w-5 sm:h-6 sm:w-6", tab.color)} />
                      <span className="text-[8px] sm:text-[10px] font-medium text-muted-foreground leading-tight text-center">
                        {language === 'bn' ? tab.fullBn : tab.full}
                      </span>
                      {isComplete && (
                        <div className="absolute -top-1 -right-1 h-3.5 w-3.5 bg-green-500 rounded-full flex items-center justify-center shadow-sm">
                          <Check className="h-2 w-2 text-white" />
                        </div>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </CardContent>
          </Card>

          {/* Salah Tab - Checkbox System */}
          <TabsContent value="salah" className="animate-fade-in">
            <Card>
              <CardHeader className="pb-3 sm:pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      🕌 {language === 'bn' ? 'নামাজ ট্র্যাকার' : 'Salah Tracker'}
                      {getTabCompletionStatus.salah && (
                        <CircleCheck className="h-4 w-4 text-green-500" />
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      {language === 'bn' ? 'প্রতিটি নামাজের জন্য একটি অপশন সিলেক্ট করুন' : 'Select one option for each prayer'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {/* Prayer Cards with Checkbox System */}
                <div className="space-y-2 sm:space-y-3">
                  {SALAH_PRAYERS.map((prayer) => {
                    const completed = entry[`${prayer.key}_completed` as keyof DailyEntry] as boolean;
                    const onTime = entry[`${prayer.key}_on_time` as keyof DailyEntry] as boolean;
                    
                    // Determine current status
                    const isOnTime = completed && onTime;
                    const isQaza = completed && !onTime;
                    const isMissed = !completed;

                    return (
                      <div 
                        key={prayer.key} 
                        className={cn(
                          "p-3 sm:p-4 rounded-lg border transition-all",
                          isOnTime && "bg-green-500/10 border-green-500/30",
                          isQaza && "bg-yellow-500/10 border-yellow-500/30",
                          isMissed && "bg-muted/30 border-border"
                        )}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg sm:text-xl">{prayer.icon}</span>
                            <div>
                              <span className="font-medium text-sm sm:text-base">{prayer.name}</span>
                              <span className="text-muted-foreground text-xs ml-1">({prayer.namebn})</span>
                            </div>
                          </div>
                          {/* Status Badge */}
                          {isOnTime && (
                            <Badge variant="default" className="bg-green-500 text-[10px] sm:text-xs">
                              ✓ {language === 'bn' ? 'আদায়' : 'On Time'}
                            </Badge>
                          )}
                          {isQaza && (
                            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-[10px] sm:text-xs">
                              ⏰ {language === 'bn' ? 'কাযা' : 'Qaza'}
                            </Badge>
                          )}
                        </div>

                        {/* Checkbox Options - Responsive Grid */}
                        <div className="grid grid-cols-3 gap-2">
                          {/* On Time */}
                          <label 
                            className={cn(
                              "flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg border cursor-pointer transition-all",
                              isOnTime ? "border-green-500 bg-green-500/10" : "border-border hover:border-primary/50",
                              viewMode && "cursor-not-allowed opacity-60"
                            )}
                          >
                            <Checkbox
                              checked={isOnTime}
                              onCheckedChange={() => {
                                if (viewMode) return;
                                setEntry({ 
                                  ...entry, 
                                  [`${prayer.key}_completed`]: true,
                                  [`${prayer.key}_on_time`]: true 
                                });
                              }}
                              disabled={viewMode}
                              className="data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                            />
                            <span className="text-[10px] sm:text-xs font-medium">
                              {language === 'bn' ? 'সময়মতো' : 'On Time'}
                            </span>
                          </label>

                          {/* Qaza */}
                          <label 
                            className={cn(
                              "flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg border cursor-pointer transition-all",
                              isQaza ? "border-yellow-500 bg-yellow-500/10" : "border-border hover:border-primary/50",
                              viewMode && "cursor-not-allowed opacity-60"
                            )}
                          >
                            <Checkbox
                              checked={isQaza}
                              onCheckedChange={() => {
                                if (viewMode) return;
                                setEntry({ 
                                  ...entry, 
                                  [`${prayer.key}_completed`]: true,
                                  [`${prayer.key}_on_time`]: false 
                                });
                              }}
                              disabled={viewMode}
                              className="data-[state=checked]:bg-yellow-500 data-[state=checked]:border-yellow-500"
                            />
                            <span className="text-[10px] sm:text-xs font-medium">
                              {language === 'bn' ? 'কাযা' : 'Qaza'}
                            </span>
                          </label>

                          {/* Missed */}
                          <label 
                            className={cn(
                              "flex items-center gap-1.5 sm:gap-2 p-2 sm:p-3 rounded-lg border cursor-pointer transition-all",
                              isMissed && !completed ? "border-muted-foreground/50 bg-muted/50" : "border-border hover:border-primary/50",
                              viewMode && "cursor-not-allowed opacity-60"
                            )}
                          >
                            <Checkbox
                              checked={isMissed}
                              onCheckedChange={() => {
                                if (viewMode) return;
                                setEntry({ 
                                  ...entry, 
                                  [`${prayer.key}_completed`]: false,
                                  [`${prayer.key}_on_time`]: false 
                                });
                              }}
                              disabled={viewMode}
                            />
                            <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">
                              {language === 'bn' ? 'মিস' : 'Miss'}
                            </span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <div className="space-y-2 pt-3 sm:pt-4 border-t">
                  <Label className="text-xs sm:text-sm">{language === 'bn' ? 'খুশু লেভেল (মনোযোগ)' : 'Khushu Level (Concentration)'}: {entry.khushu_level}/5</Label>
                  <Slider
                    value={[entry.khushu_level]}
                    onValueChange={([value]) => !viewMode && setEntry({ ...entry, khushu_level: value })}
                    min={1}
                    max={5}
                    step={1}
                    disabled={viewMode}
                  />
                  <div className="flex justify-between text-[10px] sm:text-xs text-muted-foreground">
                    <span>{language === 'bn' ? 'বিভ্রান্ত' : 'Distracted'}</span>
                    <span>{language === 'bn' ? 'খুব ফোকাসড' : 'Very Focused'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quran Tab */}
          <TabsContent value="quran">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  {language === 'bn' ? 'কুরআন এনগেজমেন্ট' : "Qur'an Engagement"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={entry.quran_read}
                    onCheckedChange={(checked) => !viewMode && setEntry({ ...entry, quran_read: checked })}
                    disabled={viewMode}
                  />
                  <Label>{language === 'bn' ? 'আজ কুরআন পড়েছেন?' : "Did you engage with Qur'an today?"}</Label>
                </div>
                {entry.quran_read && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{language === 'bn' ? 'সূরার নাম' : 'Surah Name'}</Label>
                      <Input
                        value={entry.quran_surah}
                        onChange={(e) => !viewMode && setEntry({ ...entry, quran_surah: e.target.value })}
                        placeholder="e.g., Al-Baqarah"
                        disabled={viewMode}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === 'bn' ? 'ধরন' : 'Type'}</Label>
                      <Select
                        value={entry.quran_type}
                        onValueChange={(value) => !viewMode && setEntry({ ...entry, quran_type: value })}
                        disabled={viewMode}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reading">{language === 'bn' ? 'তিলাওয়াত' : 'Reading'}</SelectItem>
                          <SelectItem value="memorization">{language === 'bn' ? 'হিফজ' : 'Memorization'}</SelectItem>
                          <SelectItem value="tafsir">{language === 'bn' ? 'তাফসীর' : 'Tafsir Study'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>{language === 'bn' ? 'আয়াত থেকে' : 'Ayah From'}</Label>
                        <Input
                          type="number"
                          min={1}
                          value={entry.quran_ayah_from || ''}
                          onChange={(e) => !viewMode && setEntry({ ...entry, quran_ayah_from: parseInt(e.target.value) || 0 })}
                          disabled={viewMode}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === 'bn' ? 'আয়াত পর্যন্ত' : 'Ayah To'}</Label>
                        <Input
                          type="number"
                          min={1}
                          value={entry.quran_ayah_to || ''}
                          onChange={(e) => !viewMode && setEntry({ ...entry, quran_ayah_to: parseInt(e.target.value) || 0 })}
                          disabled={viewMode}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{language === 'bn' ? 'সময় (মিনিট)' : 'Time (minutes)'}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={entry.quran_minutes}
                        onChange={(e) => !viewMode && setEntry({ ...entry, quran_minutes: parseInt(e.target.value) || 0 })}
                        disabled={viewMode}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Study Time Tab */}
          <TabsContent value="study">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  {language === 'bn' ? 'পড়াশোনার সময়' : 'Study Time Tracker'}
                </CardTitle>
                <CardDescription>{language === 'bn' ? 'আপনার ফোকাসড লার্নিং ঘন্টা লগ করুন' : 'Log your focused learning hours'}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{language === 'bn' ? 'ফোকাসড স্টাডি (মিনিট)' : 'Focused Study (minutes)'}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={entry.focused_study_minutes}
                      onChange={(e) => !viewMode && setEntry({ ...entry, focused_study_minutes: parseInt(e.target.value) || 0 })}
                      disabled={viewMode}
                    />
                    <p className="text-xs text-muted-foreground">{formatMinutesToTime(entry.focused_study_minutes)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'bn' ? 'রিভিশন (মিনিট)' : 'Revision (minutes)'}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={entry.revision_minutes}
                      onChange={(e) => !viewMode && setEntry({ ...entry, revision_minutes: parseInt(e.target.value) || 0 })}
                      disabled={viewMode}
                    />
                    <p className="text-xs text-muted-foreground">{formatMinutesToTime(entry.revision_minutes)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'bn' ? 'স্কিল লার্নিং (মিনিট)' : 'Skill Learning (minutes)'}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={entry.skill_learning_minutes}
                      onChange={(e) => !viewMode && setEntry({ ...entry, skill_learning_minutes: parseInt(e.target.value) || 0 })}
                      disabled={viewMode}
                    />
                    <p className="text-xs text-muted-foreground">{formatMinutesToTime(entry.skill_learning_minutes)}</p>
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium">{language === 'bn' ? 'আজকের মোট পড়াশোনার সময়' : 'Total Study Time Today'}</p>
                  <p className="text-2xl font-bold text-primary">
                    {formatMinutesToTime(entry.focused_study_minutes + entry.revision_minutes + entry.skill_learning_minutes)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Digital Tab */}
          <TabsContent value="digital">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  {language === 'bn' ? 'ডিজিটাল ওয়েলবিং' : 'Digital Wellbeing'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{language === 'bn' ? 'মোট স্ক্রিন টাইম (মিনিট)' : 'Total Screen Time (minutes)'}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={entry.device_time_minutes}
                      onChange={(e) => !viewMode && setEntry({ ...entry, device_time_minutes: parseInt(e.target.value) || 0 })}
                      disabled={viewMode}
                    />
                    <p className="text-xs text-muted-foreground">{formatMinutesToTime(entry.device_time_minutes)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'bn' ? 'সোশ্যাল মিডিয়া (মিনিট)' : 'Social Media (minutes)'}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={entry.social_media_minutes}
                      onChange={(e) => !viewMode && setEntry({ ...entry, social_media_minutes: parseInt(e.target.value) || 0 })}
                      disabled={viewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'bn' ? 'শর্টস/রিলস (মিনিট)' : 'Shorts/Reels (minutes)'}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={entry.shorts_reels_minutes}
                      onChange={(e) => !viewMode && setEntry({ ...entry, shorts_reels_minutes: parseInt(e.target.value) || 0 })}
                      disabled={viewMode}
                    />
                  </div>
                </div>
                
                {entry.device_time_minutes > 180 && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg text-destructive">
                    <AlertTriangle className="h-5 w-5" />
                    <p className="text-sm">
                      {language === 'bn' 
                        ? '⚠️ স্ক্রিন টাইম ৩ ঘণ্টার বেশি! কমানোর চেষ্টা করুন।'
                        : '⚠️ Screen time exceeds 3 hours! Consider reducing.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Health Tab */}
          <TabsContent value="health">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  {language === 'bn' ? 'ব্যায়াম ও স্বাস্থ্য' : 'Exercise & Health'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={entry.exercise_done}
                    onCheckedChange={(checked) => !viewMode && setEntry({ ...entry, exercise_done: checked })}
                    disabled={viewMode}
                  />
                  <Label>{language === 'bn' ? 'আজ ব্যায়াম করেছেন?' : 'Did you exercise today?'}</Label>
                </div>
                
                {entry.exercise_done && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>{language === 'bn' ? 'ব্যায়ামের ধরন' : 'Exercise Type'}</Label>
                      <Input
                        value={entry.exercise_type}
                        onChange={(e) => !viewMode && setEntry({ ...entry, exercise_type: e.target.value })}
                        placeholder="e.g., Running, Gym"
                        disabled={viewMode}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === 'bn' ? 'তীব্রতা' : 'Intensity'}</Label>
                      <Select
                        value={entry.exercise_intensity}
                        onValueChange={(value) => !viewMode && setEntry({ ...entry, exercise_intensity: value })}
                        disabled={viewMode}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">{language === 'bn' ? 'হালকা' : 'Light'}</SelectItem>
                          <SelectItem value="medium">{language === 'bn' ? 'মাঝারি' : 'Medium'}</SelectItem>
                          <SelectItem value="intense">{language === 'bn' ? 'তীব্র' : 'Intense'}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{language === 'bn' ? 'সময়কাল (মিনিট)' : 'Duration (minutes)'}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={entry.exercise_duration_minutes}
                        onChange={(e) => !viewMode && setEntry({ ...entry, exercise_duration_minutes: parseInt(e.target.value) || 0 })}
                        disabled={viewMode}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Energy Tab */}
          <TabsContent value="energy">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Moon className="h-5 w-5 text-primary" />
                  {language === 'bn' ? 'ঘুম ও শক্তি' : 'Sleep & Energy'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{language === 'bn' ? 'ঘুমের সময় (মিনিট)' : 'Sleep Duration (minutes)'}</Label>
                    <Input
                      type="number"
                      min={0}
                      value={entry.sleep_duration_minutes}
                      onChange={(e) => !viewMode && setEntry({ ...entry, sleep_duration_minutes: parseInt(e.target.value) || 0 })}
                      disabled={viewMode}
                    />
                    <p className="text-xs text-muted-foreground">{formatMinutesToTime(entry.sleep_duration_minutes)}</p>
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'bn' ? 'ঘুমের মান' : 'Sleep Quality'}: {entry.sleep_quality}/5</Label>
                    <Slider
                      value={[entry.sleep_quality]}
                      onValueChange={([value]) => !viewMode && setEntry({ ...entry, sleep_quality: value })}
                      min={1}
                      max={5}
                      step={1}
                      disabled={viewMode}
                    />
                  </div>
                </div>
                
                <div className="grid gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label>{language === 'bn' ? 'এনার্জি লেভেল' : 'Energy Level'}: {entry.energy_level}/5</Label>
                    <Slider
                      value={[entry.energy_level]}
                      onValueChange={([value]) => !viewMode && setEntry({ ...entry, energy_level: value })}
                      min={1}
                      max={5}
                      step={1}
                      disabled={viewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'bn' ? 'ফোকাস লেভেল' : 'Focus Level'}: {entry.focus_level}/5</Label>
                    <Slider
                      value={[entry.focus_level]}
                      onValueChange={([value]) => !viewMode && setEntry({ ...entry, focus_level: value })}
                      min={1}
                      max={5}
                      step={1}
                      disabled={viewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'bn' ? 'শৃঙ্খলা লেভেল' : 'Discipline Level'}: {entry.discipline_level}/5</Label>
                    <Slider
                      value={[entry.discipline_level]}
                      onValueChange={([value]) => !viewMode && setEntry({ ...entry, discipline_level: value })}
                      min={1}
                      max={5}
                      step={1}
                      disabled={viewMode}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reflect Tab */}
          <TabsContent value="reflect">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  {language === 'bn' ? 'প্রতিফলন' : 'Reflection'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>{language === 'bn' ? 'সার্বিক দিনের রেটিং' : 'Overall Day Rating'}: {entry.overall_day_rating}/10</Label>
                  <Slider
                    value={[entry.overall_day_rating]}
                    onValueChange={([value]) => !viewMode && setEntry({ ...entry, overall_day_rating: value })}
                    min={1}
                    max={10}
                    step={1}
                    disabled={viewMode}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{language === 'bn' ? 'সবচেয়ে গুরুত্বপূর্ণ কাজ' : 'Most Important Task'}</Label>
                    <Input
                      value={entry.most_important_task}
                      onChange={(e) => !viewMode && setEntry({ ...entry, most_important_task: e.target.value })}
                      placeholder={language === 'bn' ? 'আজকের প্রধান কাজ...' : 'Main task of the day...'}
                      disabled={viewMode}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === 'bn' ? 'সবচেয়ে বড় সময় অপচয়' : 'Biggest Time Leak'}</Label>
                    <Input
                      value={entry.biggest_time_leak}
                      onChange={(e) => !viewMode && setEntry({ ...entry, biggest_time_leak: e.target.value })}
                      placeholder={language === 'bn' ? 'কোথায় সময় নষ্ট হলো...' : 'Where time was wasted...'}
                      disabled={viewMode}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{language === 'bn' ? 'দিনের অনুশোচনা' : 'Regret of the Day'}</Label>
                  <Textarea
                    value={entry.regret_of_day}
                    onChange={(e) => !viewMode && setEntry({ ...entry, regret_of_day: e.target.value })}
                    placeholder={language === 'bn' ? 'কী অন্যভাবে করতে পারতাম...' : 'What could I have done differently...'}
                    rows={2}
                    disabled={viewMode}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{language === 'bn' ? 'ফ্রি রিফ্লেকশন' : 'Free Reflection'}</Label>
                  <Textarea
                    value={entry.free_reflection}
                    onChange={(e) => !viewMode && setEntry({ ...entry, free_reflection: e.target.value })}
                    placeholder={language === 'bn' ? 'আজকের দিন সম্পর্কে যা মনে আসছে...' : 'Anything on your mind about today...'}
                    rows={3}
                    disabled={viewMode}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* User-defined custom fields */}
        <CustomFieldsManager date={selectedDate} readOnly={viewMode} />

        {/* Save Button */}
        {!viewMode && (
          <div className="fixed bottom-20 lg:bottom-6 left-0 right-0 px-4 lg:px-0 lg:relative">
            <Button 
              onClick={handleSave} 
              disabled={saving} 
              className="w-full lg:w-auto gap-2"
              size="lg"
            >
              <Save className="h-4 w-4" />
              {saving 
                ? (language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') 
                : isLateSubmission
                  ? (language === 'bn' ? 'লেট সাবমিশন সংরক্ষণ করুন' : 'Save Late Submission')
                  : (language === 'bn' ? 'সংরক্ষণ করুন' : 'Save Entry')}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
