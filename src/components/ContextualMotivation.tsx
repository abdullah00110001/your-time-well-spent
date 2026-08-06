import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/hooks/useAuth';
import { Sparkles, RefreshCw, BookOpen, Target, Heart, Zap } from 'lucide-react';
import { format, subDays } from 'date-fns';

interface PerformanceContext {
  salahStreak: number;
  quranStreak: number;
  avgDeviceTime: number;
  avgStudyTime: number;
  avgEnergy: number;
  recentMissedSalah: boolean;
  highDeviceUsage: boolean;
  lowEnergy: boolean;
  isConsistent: boolean;
}

interface MotivationalMessage {
  text: string;
  textBn: string;
  type: 'islamic' | 'productivity' | 'encouragement' | 'reminder';
  icon: React.ReactNode;
}

const islamicReminders: MotivationalMessage[] = [
  {
    text: "Indeed, with hardship comes ease.",
    textBn: "নিশ্চয়ই কষ্টের সাথে স্বস্তি আছে।",
    type: 'islamic',
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    text: "Allah does not burden a soul beyond that it can bear.",
    textBn: "আল্লাহ কোন আত্মাকে তার সাধ্যের বাইরে বোঝা দেন না।",
    type: 'islamic',
    icon: <Heart className="h-4 w-4" />,
  },
  {
    text: "Verily, in the remembrance of Allah do hearts find rest.",
    textBn: "জেনে রাখ, আল্লাহর স্মরণেই অন্তর প্রশান্তি লাভ করে।",
    type: 'islamic',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    text: "Take benefit of five before five: your youth before your old age.",
    textBn: "পাঁচটি বিষয়কে পাঁচটির আগে সুযোগ হিসেবে নাও: বার্ধক্যের আগে যৌবনকে।",
    type: 'islamic',
    icon: <Zap className="h-4 w-4" />,
  },
  {
    text: "The best among you is the one who learns the Quran and teaches it.",
    textBn: "তোমাদের মধ্যে সর্বোত্তম সে যে কুরআন শেখে এবং শেখায়।",
    type: 'islamic',
    icon: <BookOpen className="h-4 w-4" />,
  },
];

const productivityMessages: MotivationalMessage[] = [
  {
    text: "Small consistent steps lead to extraordinary results.",
    textBn: "ছোট ধারাবাহিক পদক্ষেপ অসাধারণ ফলাফলের দিকে নিয়ে যায়।",
    type: 'productivity',
    icon: <Target className="h-4 w-4" />,
  },
  {
    text: "Focus is your superpower. Protect it.",
    textBn: "ফোকাস আপনার সুপারপাওয়ার। এটি রক্ষা করুন।",
    type: 'productivity',
    icon: <Zap className="h-4 w-4" />,
  },
  {
    text: "The discipline you build today shapes the success of tomorrow.",
    textBn: "আজ যে শৃঙ্খলা গড়ে তুলবেন তা আগামীকালের সাফল্য গঠন করবে।",
    type: 'productivity',
    icon: <Target className="h-4 w-4" />,
  },
];

const encouragementMessages: MotivationalMessage[] = [
  {
    text: "Your Salah streak is amazing! Keep it up!",
    textBn: "আপনার নামাজের ধারাবাহিকতা অসাধারণ! চালিয়ে যান!",
    type: 'encouragement',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    text: "You're building something beautiful. One day at a time.",
    textBn: "আপনি সুন্দর কিছু গড়ে তুলছেন। একদিন করে।",
    type: 'encouragement',
    icon: <Heart className="h-4 w-4" />,
  },
];

const reminderMessages: MotivationalMessage[] = [
  {
    text: "Your device time was high recently. Consider a digital detox.",
    textBn: "সম্প্রতি আপনার ডিভাইস সময় বেশি ছিল। ডিজিটাল ডিটক্স বিবেচনা করুন।",
    type: 'reminder',
    icon: <RefreshCw className="h-4 w-4" />,
  },
  {
    text: "Haven't engaged with Quran lately? Even 5 minutes counts.",
    textBn: "সম্প্রতি কুরআন পড়েননি? এমনকি ৫ মিনিটও গণনা করা হয়।",
    type: 'reminder',
    icon: <BookOpen className="h-4 w-4" />,
  },
];

export default function ContextualMotivation() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [context, setContext] = useState<PerformanceContext | null>(null);
  const [currentMessage, setCurrentMessage] = useState<MotivationalMessage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) analyzeContext();
  }, [user]);

  const analyzeContext = async () => {
    if (!user) return;
    setLoading(true);

    const last7Days = format(subDays(new Date(), 7), 'yyyy-MM-dd');

    const { data: entries } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', last7Days)
      .order('date', { ascending: false });

    if (!entries || entries.length === 0) {
      setContext(null);
      selectMessage(null);
      setLoading(false);
      return;
    }

    // Calculate metrics
    let salahStreak = 0;
    let quranStreak = 0;
    let totalDevice = 0;
    let totalStudy = 0;
    let totalEnergy = 0;

    entries.forEach((entry, index) => {
      const salahCount = [
        entry.fajr_completed, entry.dhuhr_completed, entry.asr_completed,
        entry.maghrib_completed, entry.isha_completed
      ].filter(Boolean).length;

      if (salahCount >= 4 && salahStreak === index) salahStreak++;
      if (entry.quran_read && quranStreak === index) quranStreak++;
      
      totalDevice += entry.device_time_minutes || 0;
      totalStudy += (entry.focused_study_minutes || 0) + (entry.revision_minutes || 0);
      totalEnergy += entry.energy_level || 3;
    });

    const avgDevice = totalDevice / entries.length;
    const avgStudy = totalStudy / entries.length;
    const avgEnergy = totalEnergy / entries.length;

    const ctx: PerformanceContext = {
      salahStreak,
      quranStreak,
      avgDeviceTime: avgDevice,
      avgStudyTime: avgStudy,
      avgEnergy,
      recentMissedSalah: entries[0] && [
        entries[0].fajr_completed, entries[0].dhuhr_completed, entries[0].asr_completed,
        entries[0].maghrib_completed, entries[0].isha_completed
      ].filter(Boolean).length < 4,
      highDeviceUsage: avgDevice > 180,
      lowEnergy: avgEnergy < 3,
      isConsistent: entries.length >= 5,
    };

    setContext(ctx);
    selectMessage(ctx);
    setLoading(false);
  };

  const selectMessage = (ctx: PerformanceContext | null) => {
    let pool: MotivationalMessage[] = [];

    if (!ctx) {
      // No data, show general Islamic reminders
      pool = islamicReminders;
    } else if (ctx.highDeviceUsage) {
      // High device usage - show reminders
      pool = [...reminderMessages, ...islamicReminders];
    } else if (ctx.salahStreak >= 3 || ctx.quranStreak >= 3) {
      // Good streaks - show encouragement
      pool = [...encouragementMessages, ...islamicReminders];
    } else if (ctx.lowEnergy) {
      // Low energy - show gentle Islamic reminders
      pool = islamicReminders.filter(m => 
        m.text.includes('ease') || m.text.includes('burden')
      );
      if (pool.length === 0) pool = islamicReminders;
    } else {
      // Default - mix of everything
      pool = [...islamicReminders, ...productivityMessages];
    }

    const randomIndex = Math.floor(Math.random() * pool.length);
    setCurrentMessage(pool[randomIndex]);
  };

  const refreshMessage = () => {
    selectMessage(context);
  };

  if (loading) {
    return (
      <Card className="border-dashed bg-muted/30">
        <CardContent className="p-4">
          <div className="animate-pulse flex gap-3">
            <div className="w-8 h-8 bg-muted rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!currentMessage) return null;

  return (
    <Card className="border-dashed bg-gradient-to-br from-primary/5 to-accent/5">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {currentMessage.icon}
          </div>
          <div className="flex-1">
            <p className="text-sm italic text-foreground/80">
              "{language === 'bn' ? currentMessage.textBn : currentMessage.text}"
            </p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground capitalize">
                {currentMessage.type === 'islamic' ? '📿 Islamic Reminder' : 
                 currentMessage.type === 'productivity' ? '🎯 Productivity' :
                 currentMessage.type === 'encouragement' ? '🌟 Keep Going' : '💡 Gentle Reminder'}
              </span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2"
                onClick={refreshMessage}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                New
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
