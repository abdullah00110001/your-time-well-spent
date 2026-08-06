import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { Plus, Smile, Meh, Frown, Clock, TrendingUp, Calendar, Play, Pause, Square } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, subWeeks, subDays } from 'date-fns';
import NiyyahValidator from '@/components/islamic/NiyyahValidator';

interface ActivityTag {
  id: string;
  name: string;
  name_bn: string;
  color: string;
  icon: string | null;
}

interface DailyLog {
  id: string;
  date: string;
  mood: string | null;
  tag_id: string | null;
  hours: number;
  notes: string | null;
  activity_tags?: ActivityTag;
}

interface TimeEntry {
  id: string;
  date: string;
  hours: number;
  activity: string;
  notes: string | null;
}

const ACTIVITIES = [
  { value: "study", labelEn: "Study", labelBn: "পড়াশোনা" },
  { value: "exercise", labelEn: "Exercise", labelBn: "ব্যায়াম" },
  { value: "reading", labelEn: "Reading", labelBn: "বই পড়া" },
  { value: "meditation", labelEn: "Meditation", labelBn: "মেডিটেশন" },
  { value: "skill_dev", labelEn: "Skill Development", labelBn: "স্কিল ডেভেলপমেন্ট" },
  { value: "deep_work", labelEn: "Deep Work", labelBn: "ডিপ ওয়ার্ক" },
  { value: "other", labelEn: "Other", labelBn: "অন্যান্য" },
];

export default function LifeDistribution() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [tags, setTags] = useState<ActivityTag[]>([]);
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [hours, setHours] = useState<string>('1');
  const [mood, setMood] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [activity, setActivity] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pieData, setPieData] = useState<any[]>([]);
  const [weeklyData, setWeeklyData] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);
  
  // Deep Work Timer
  const [showNiyyah, setShowNiyyah] = useState(false);
  const [currentNiyyah, setCurrentNiyyah] = useState<{ type: string; multiplier: number } | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const fetchData = async () => {
    setLoading(true);
    
    // Fetch tags
    const { data: tagsData } = await supabase.from('activity_tags').select('*');
    if (tagsData) setTags(tagsData);

    // Fetch logs for current year
    const currentYear = new Date().getFullYear();
    const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    
    const { data: logsData } = await supabase
      .from('daily_logs')
      .select('*, activity_tags(*)')
      .eq('user_id', user!.id)
      .gte('date', `${currentYear}-01-01`)
      .order('date', { ascending: false });

    if (logsData) {
      setLogs(logsData);
      processLifeAnalytics(logsData);
    }

    // Fetch time entries
    const { data: timeData } = await supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', user!.id)
      .gte('date', thirtyDaysAgo)
      .order('date', { ascending: false });

    if (timeData) {
      setTimeEntries(timeData);
      processTimeAnalytics(timeData);
    }

    setLoading(false);
  };

  const processLifeAnalytics = (logsData: any[]) => {
    const tagHours: Record<string, { hours: number; color: string; name: string }> = {};
    
    logsData.forEach((log) => {
      if (log.activity_tags) {
        const tagName = language === 'bn' ? log.activity_tags.name_bn : log.activity_tags.name;
        if (!tagHours[tagName]) {
          tagHours[tagName] = { hours: 0, color: log.activity_tags.color, name: tagName };
        }
        tagHours[tagName].hours += Number(log.hours) || 0;
      }
    });

    const pieChartData = Object.values(tagHours)
      .filter(t => t.hours > 0)
      .map(t => ({
        name: t.name,
        value: Math.round(t.hours * 10) / 10,
        color: t.color,
      }));
    setPieData(pieChartData);
  };

  const processTimeAnalytics = (entriesData: TimeEntry[]) => {
    // Weekly bar chart
    const weeks: any[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i));
      const weekEnd = endOfWeek(subWeeks(new Date(), i));
      const weekEntries = entriesData.filter(entry => {
        const logDate = new Date(entry.date);
        return logDate >= weekStart && logDate <= weekEnd;
      });
      
      const totalHours = weekEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
      weeks.push({
        week: format(weekStart, 'MMM d'),
        hours: Math.round(totalHours * 10) / 10,
      });
    }
    setWeeklyData(weeks);

    // Activity breakdown
    const activityBreakdown = ACTIVITIES.map(act => {
      const totalHours = entriesData
        .filter(e => e.activity === act.value)
        .reduce((sum, e) => sum + Number(e.hours), 0);
      return {
        name: language === 'bn' ? act.labelBn : act.labelEn,
        hours: Math.round(totalHours * 10) / 10,
      };
    }).filter(a => a.hours > 0);
    setActivityData(activityBreakdown);
  };

  const handleLifeLogSubmit = async () => {
    if (!selectedTag) {
      toast.error(language === 'bn' ? 'ক্যাটাগরি নির্বাচন করুন' : 'Please select a category');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('daily_logs')
      .upsert({
        user_id: user!.id,
        date: selectedDate,
        tag_id: selectedTag,
        hours: parseFloat(hours) || 0,
        mood: mood || null,
        notes: notes || null,
      }, { onConflict: 'user_id,date,tag_id' });

    if (error) {
      toast.error(language === 'bn' ? 'সংরক্ষণ করা যায়নি' : 'Could not save');
    } else {
      toast.success(language === 'bn' ? 'সংরক্ষিত!' : 'Saved!');
      setSelectedTag('');
      setHours('1');
      setMood('');
      setNotes('');
      fetchData();
    }
    setSaving(false);
  };

  const handleTimeSubmit = async () => {
    if (!activity || !hours) {
      toast.error(language === 'bn' ? 'কাজ ও সময় নির্বাচন করুন' : 'Select activity and hours');
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from('time_entries')
      .upsert({
        user_id: user!.id,
        date: selectedDate,
        hours: parseFloat(hours),
        activity,
        notes: notes || null,
      }, { onConflict: 'user_id,date,activity' });

    if (error) {
      toast.error(language === 'bn' ? 'সেভ করতে সমস্যা হয়েছে' : 'Failed to save');
    } else {
      toast.success(language === 'bn' ? 'সেভ হয়েছে!' : 'Saved!');
      setActivity('');
      setHours('1');
      setNotes('');
      fetchData();
    }
    setSaving(false);
  };

  // Timer handlers
  const handleStartSession = () => setShowNiyyah(true);

  const handleNiyyahConfirm = async (niyyah: string, multiplier: number) => {
    setCurrentNiyyah({ type: niyyah, multiplier });
    setShowNiyyah(false);
    setIsTimerRunning(true);
    setTimerStartTime(new Date());
    setTimerSeconds(0);
    
    if (user) {
      await supabase.from('study_sessions').insert({
        user_id: user.id,
        date: format(new Date(), 'yyyy-MM-dd'),
        niyyah,
        niyyah_multiplier: multiplier,
        started_at: new Date().toISOString(),
        duration_minutes: 0,
      });
    }
    
    toast.success(language === 'bn' ? 'বিসমিল্লাহ! সেশন শুরু হয়েছে' : 'Bismillah! Session started');
  };

  const handleStopTimer = async () => {
    setIsTimerRunning(false);
    const durationMinutes = Math.round(timerSeconds / 60);
    
    if (user && timerStartTime) {
      await supabase
        .from('study_sessions')
        .update({
          ended_at: new Date().toISOString(),
          duration_minutes: durationMinutes,
        })
        .eq('user_id', user.id)
        .eq('started_at', timerStartTime.toISOString());

      const barakahScore = durationMinutes * (currentNiyyah?.multiplier || 1);
      
      toast.success(
        language === 'bn' 
          ? `সেশন শেষ! ${durationMinutes} মিনিট × ${currentNiyyah?.multiplier || 1}x = ${barakahScore} বারাকাহ পয়েন্ট` 
          : `Session complete! ${durationMinutes} min × ${currentNiyyah?.multiplier || 1}x = ${barakahScore} Barakah points`
      );
    }
    
    setTimerSeconds(0);
    setTimerStartTime(null);
    setCurrentNiyyah(null);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const moodOptions = [
    { value: 'good', icon: Smile, label: language === 'bn' ? 'ভালো' : 'Good', color: 'text-green-500' },
    { value: 'average', icon: Meh, label: language === 'bn' ? 'মাঝামাঝি' : 'Average', color: 'text-yellow-500' },
    { value: 'bad', icon: Frown, label: language === 'bn' ? 'খারাপ' : 'Bad', color: 'text-red-400' },
  ];

  // Stats
  const todayTimeEntries = timeEntries.filter(e => e.date === format(new Date(), 'yyyy-MM-dd'));
  const todayHours = todayTimeEntries.reduce((s, e) => s + Number(e.hours), 0);
  const totalWeekHours = weeklyData.reduce((sum, d) => sum + d.hours, 0);
  const totalMonthHours = timeEntries.reduce((sum, e) => sum + Number(e.hours), 0);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <NiyyahValidator
          isOpen={showNiyyah}
          onClose={() => setShowNiyyah(false)}
          onConfirm={handleNiyyahConfirm}
          sessionType="deep work"
        />

        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">
            {language === 'bn' ? 'জীবন ও সময় ট্র্যাকিং' : 'Life & Time Tracking'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {language === 'bn' ? 'আপনার সময় কোথায় যাচ্ছে তা ট্র্যাক করুন' : 'Track where your time goes'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{language === 'bn' ? 'আজ' : 'Today'}</p>
                <p className="text-xl font-bold">{todayHours.toFixed(1)}h</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{language === 'bn' ? 'এই সপ্তাহ' : 'This Week'}</p>
                <p className="text-xl font-bold">{totalWeekHours.toFixed(1)}h</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{language === 'bn' ? '৩০ দিন' : '30 Days'}</p>
                <p className="text-xl font-bold">{totalMonthHours.toFixed(1)}h</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{language === 'bn' ? 'দৈনিক গড়' : 'Daily Avg'}</p>
                <p className="text-xl font-bold">{(totalWeekHours / 7).toFixed(1)}h</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Deep Work Timer */}
        <Card className={`mb-6 ${currentNiyyah ? "border-primary/50 bg-primary/5" : ""}`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              {language === 'bn' ? 'ডিপ ওয়ার্ক টাইমার' : 'Deep Work Timer'}
              {currentNiyyah && (
                <span className={`text-xs font-normal px-2 py-0.5 rounded ${
                  currentNiyyah.multiplier === 2 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300" :
                  currentNiyyah.multiplier === 1 ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
                  "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300"
                }`}>
                  {currentNiyyah.multiplier}x Barakah
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4">
              <div className="text-4xl sm:text-5xl font-mono font-bold tabular-nums">
                {formatTime(timerSeconds)}
              </div>
              
              <div className="flex gap-2 flex-wrap justify-center">
                {!isTimerRunning && !currentNiyyah && (
                  <Button onClick={handleStartSession} className="gap-2">
                    <Play className="h-4 w-4" />
                    {language === 'bn' ? 'সেশন শুরু করুন' : 'Start Session'}
                  </Button>
                )}
                
                {isTimerRunning && (
                  <>
                    <Button onClick={() => setIsTimerRunning(false)} variant="outline" className="gap-2">
                      <Pause className="h-4 w-4" />
                      {language === 'bn' ? 'বিরতি' : 'Pause'}
                    </Button>
                    <Button onClick={handleStopTimer} variant="destructive" className="gap-2">
                      <Square className="h-4 w-4" />
                      {language === 'bn' ? 'শেষ করুন' : 'Stop'}
                    </Button>
                  </>
                )}
                
                {!isTimerRunning && currentNiyyah && (
                  <>
                    <Button onClick={() => setIsTimerRunning(true)} className="gap-2">
                      <Play className="h-4 w-4" />
                      {language === 'bn' ? 'চালিয়ে যান' : 'Resume'}
                    </Button>
                    <Button onClick={handleStopTimer} variant="destructive" className="gap-2">
                      <Square className="h-4 w-4" />
                      {language === 'bn' ? 'শেষ করুন' : 'Stop'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="time" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="time">{language === 'bn' ? 'সময় ট্র্যাকিং' : 'Time Tracking'}</TabsTrigger>
            <TabsTrigger value="life">{language === 'bn' ? 'জীবন বিতরণ' : 'Life Distribution'}</TabsTrigger>
          </TabsList>

          {/* Time Tracking Tab */}
          <TabsContent value="time">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Entry Form */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Plus className="h-5 w-5" />
                    {language === 'bn' ? 'সময় যোগ করুন' : 'Add Time Entry'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">{language === 'bn' ? 'তারিখ' : 'Date'}</Label>
                      <Input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        max={format(new Date(), 'yyyy-MM-dd')}
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">{language === 'bn' ? 'ঘন্টা' : 'Hours'}</Label>
                      <Input
                        type="number"
                        step="0.5"
                        min="0"
                        max="24"
                        value={hours}
                        onChange={(e) => setHours(e.target.value)}
                        placeholder="2.5"
                        className="h-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">{language === 'bn' ? 'কাজ' : 'Activity'}</Label>
                    <Select value={activity} onValueChange={setActivity}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={language === 'bn' ? 'সিলেক্ট করুন' : 'Select activity'} />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTIVITIES.map((act) => (
                          <SelectItem key={act.value} value={act.value}>
                            {language === 'bn' ? act.labelBn : act.labelEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">{language === 'bn' ? 'নোট (ঐচ্ছিক)' : 'Notes (optional)'}</Label>
                    <Input
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={language === 'bn' ? 'কী করলেন...' : 'What did you do...'}
                      className="h-9"
                    />
                  </div>

                  <Button onClick={handleTimeSubmit} className="w-full" disabled={saving || !hours || !activity}>
                    {saving ? (language === 'bn' ? 'সেভ হচ্ছে...' : 'Saving...') : (language === 'bn' ? 'সেভ করুন' : 'Save')}
                  </Button>
                </CardContent>
              </Card>

              {/* Charts */}
              <div className="space-y-4 lg:col-span-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{language === 'bn' ? 'সাপ্তাহিক গ্রাফ' : 'Weekly Graph'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="week" className="text-xs" tick={{ fontSize: 10 }} />
                          <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                          <Tooltip 
                            formatter={(value: number) => [`${value}h`, language === 'bn' ? 'ঘন্টা' : 'Hours']}
                            contentStyle={{ 
                              borderRadius: '8px',
                              border: '1px solid hsl(var(--border))',
                              backgroundColor: 'hsl(var(--background))',
                              fontSize: '12px'
                            }}
                          />
                          <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {activityData.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{language === 'bn' ? 'কার্যকলাপ ভাঙ্গন' : 'Activity Breakdown'}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={activityData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis type="number" className="text-xs" tick={{ fontSize: 10 }} />
                            <YAxis dataKey="name" type="category" className="text-xs" width={80} tick={{ fontSize: 10 }} />
                            <Tooltip 
                              formatter={(value: number) => [`${value}h`, '']}
                              contentStyle={{ 
                                borderRadius: '8px',
                                border: '1px solid hsl(var(--border))',
                                backgroundColor: 'hsl(var(--background))',
                                fontSize: '12px'
                              }}
                            />
                            <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Life Distribution Tab */}
          <TabsContent value="life">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Log Entry Form */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Plus className="h-5 w-5" />
                    {language === 'bn' ? 'নতুন এন্ট্রি' : 'New Entry'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {language === 'bn' ? 'আজকের কার্যকলাপ লগ করুন' : 'Log your activities'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs">{language === 'bn' ? 'তারিখ' : 'Date'}</Label>
                    <Input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">{language === 'bn' ? 'ক্যাটাগরি' : 'Category'}</Label>
                    <Select value={selectedTag} onValueChange={setSelectedTag}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder={language === 'bn' ? 'নির্বাচন করুন' : 'Select category'} />
                      </SelectTrigger>
                      <SelectContent>
                        {tags.map((tag) => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="h-2.5 w-2.5 rounded-full" 
                                style={{ backgroundColor: tag.color }} 
                              />
                              <span className="text-sm">{language === 'bn' ? tag.name_bn : tag.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">{language === 'bn' ? 'ঘন্টা' : 'Hours'}</Label>
                    <Input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      className="h-9"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">{language === 'bn' ? 'মেজাজ' : 'Mood'}</Label>
                    <div className="flex gap-2">
                      {moodOptions.map((option) => (
                        <Button
                          key={option.value}
                          variant={mood === option.value ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-9"
                          onClick={() => setMood(mood === option.value ? '' : option.value)}
                        >
                          <option.icon className={`h-4 w-4 ${mood === option.value ? '' : option.color}`} />
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">{language === 'bn' ? 'নোট' : 'Notes'}</Label>
                    <Textarea
                      placeholder={language === 'bn' ? 'ঐচ্ছিক নোট...' : 'Optional notes...'}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  <Button onClick={handleLifeLogSubmit} className="w-full" disabled={saving}>
                    {saving ? (language === 'bn' ? 'সংরক্ষণ হচ্ছে...' : 'Saving...') : (language === 'bn' ? 'সংরক্ষণ করুন' : 'Save Entry')}
                  </Button>
                </CardContent>
              </Card>

              {/* Pie Chart */}
              <div className="space-y-4 lg:col-span-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {language === 'bn' ? 'বছরের বিতরণ' : 'Year Distribution'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {pieData.length > 0 ? (
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={{ strokeWidth: 1 }}
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip 
                              formatter={(value: number) => [`${value} hours`, '']}
                              contentStyle={{ 
                                borderRadius: '8px',
                                border: '1px solid hsl(var(--border))',
                                backgroundColor: 'hsl(var(--background))',
                                fontSize: '12px'
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
                        {language === 'bn' ? 'ডেটা যোগ করুন' : 'Add some data to see your distribution'}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Logs */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{language === 'bn' ? 'সাম্প্রতিক এন্ট্রি' : 'Recent Entries'}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {logs.slice(0, 5).map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between rounded-lg border p-2.5 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            {log.activity_tags && (
                              <div
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: log.activity_tags.color }}
                              />
                            )}
                            <div className="min-w-0">
                              <span className="font-medium truncate">
                                {log.activity_tags 
                                  ? (language === 'bn' ? log.activity_tags.name_bn : log.activity_tags.name)
                                  : 'Unknown'
                                }
                              </span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {format(new Date(log.date), 'MMM d')}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {log.mood && (
                              <span>
                                {log.mood === 'good' && <Smile className="h-3.5 w-3.5 text-green-500" />}
                                {log.mood === 'average' && <Meh className="h-3.5 w-3.5 text-yellow-500" />}
                                {log.mood === 'bad' && <Frown className="h-3.5 w-3.5 text-red-400" />}
                              </span>
                            )}
                            <span className="text-xs font-medium">{log.hours}h</span>
                          </div>
                        </div>
                      ))}
                      {logs.length === 0 && (
                        <p className="py-4 text-center text-muted-foreground text-sm">
                          {language === 'bn' ? 'কোন এন্ট্রি নেই' : 'No entries yet'}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
