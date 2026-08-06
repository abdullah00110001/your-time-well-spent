import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type Language = 'en' | 'bn';

interface Translations {
  [key: string]: {
    en: string;
    bn: string;
  };
}

const translations: Translations = {
  // Navigation
  'nav.dashboard': { en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
  'nav.journey': { en: '12-Month Journey', bn: '১২ মাসের যাত্রা' },
  'nav.goals': { en: 'Goals', bn: 'লক্ষ্য' },
  'nav.habits': { en: 'Habits', bn: 'অভ্যাস' },
  'nav.calendar': { en: 'Calendar', bn: 'ক্যালেন্ডার' },
  'nav.analytics': { en: 'Analytics', bn: 'বিশ্লেষণ' },
  'nav.settings': { en: 'Settings', bn: 'সেটিংস' },
  'nav.journal': { en: 'Journal', bn: 'জার্নাল' },
  'nav.heatmap': { en: 'Heatmap', bn: 'হিটম্যাপ' },
  'nav.signOut': { en: 'Sign Out', bn: 'সাইন আউট' },
  'nav.newHabit': { en: 'New Habit', bn: 'নতুন অভ্যাস' },
  'nav.timeTracking': { en: 'Time Tracking', bn: 'টাইম ট্র্যাকিং' },
  'nav.leaderboard': { en: 'Leaderboard', bn: 'লিডারবোর্ড' },
  'nav.lifeDistribution': { en: 'Life Distribution', bn: 'জীবন বিতরণ' },
  'nav.knowledgeShelf': { en: 'Knowledge Shelf', bn: 'জ্ঞানের সংগ্রহ' },
  'nav.quarterlyGoals': { en: 'Quarterly Goals', bn: 'ত্রৈমাসিক লক্ষ্য' },
  'nav.monthlyHighlights': { en: 'Monthly Highlights', bn: 'মাসিক হাইলাইট' },
  'nav.futureLetter': { en: 'Future Letter', bn: 'ভবিষ্যতের চিঠি' },
  'nav.wrapped': { en: 'Year Wrapped', bn: 'বছরের সারসংক্ষেপ' },
  'nav.export': { en: 'Export Data', bn: 'ডেটা এক্সপোর্ট' },
  'nav.admin': { en: 'Admin Dashboard', bn: 'অ্যাডমিন ড্যাশবোর্ড' },
  'nav.dailyInput': { en: 'Daily Input', bn: 'দৈনিক ইনপুট' },
  'nav.nightMuhasaba': { en: 'Night Muhasaba', bn: 'নাইট মুহাসাবা' },
  'nav.weeklyReview': { en: 'Weekly Review', bn: 'সাপ্তাহিক রিভিউ' },
  'nav.monthlyReview': { en: 'Monthly Review', bn: 'মাসিক রিভিউ' },
  'nav.intelligence': { en: 'Intelligence', bn: 'ইন্টেলিজেন্স' },
  'nav.gamification': { en: 'Gamification', bn: 'গ্যামিফিকেশন' },
  'nav.adminCommand': { en: 'Admin Command', bn: 'অ্যাডমিন কমান্ড' },

  // Dashboard
  'dashboard.greeting.morning': { en: 'Good morning', bn: 'সুপ্রভাত' },
  'dashboard.greeting.afternoon': { en: 'Good afternoon', bn: 'শুভ অপরাহ্ন' },
  'dashboard.greeting.evening': { en: 'Good evening', bn: 'শুভ সন্ধ্যা' },
  'dashboard.todayProgress': { en: "Today's Progress", bn: 'আজকের অগ্রগতি' },
  'dashboard.activeGoals': { en: 'Active Goals', bn: 'সক্রিয় লক্ষ্য' },
  'dashboard.activeHabits': { en: 'Active Habits', bn: 'সক্রিয় অভ্যাস' },
  'dashboard.currentStreak': { en: 'Current Streak', bn: 'বর্তমান স্ট্রিক' },
  'dashboard.consistency': { en: 'Consistency', bn: 'ধারাবাহিকতা' },
  'dashboard.todayHabits': { en: "Today's Habits", bn: 'আজকের অভ্যাস' },
  'dashboard.completeDaily': { en: 'Complete your daily habits', bn: 'আপনার দৈনিক অভ্যাস সম্পূর্ণ করুন' },
  'dashboard.goalsOverview': { en: 'Goals Overview', bn: 'লক্ষ্য সারাংশ' },
  'dashboard.yearlyObjectives': { en: 'Your yearly objectives', bn: 'আপনার বার্ষিক উদ্দেশ্য' },
  'dashboard.viewAll': { en: 'View All', bn: 'সব দেখুন' },
  'dashboard.noHabits': { en: 'No habits yet', bn: 'এখনো কোন অভ্যাস নেই' },
  'dashboard.createFirst': { en: 'Create your first habit', bn: 'আপনার প্রথম অভ্যাস তৈরি করুন' },
  'dashboard.noGoals': { en: 'No goals set', bn: 'কোন লক্ষ্য সেট করা হয়নি' },
  'dashboard.setFirst': { en: 'Set your first goal', bn: 'আপনার প্রথম লক্ষ্য সেট করুন' },
  'dashboard.days': { en: 'days', bn: 'দিন' },
  'dashboard.keepGoing': { en: 'Keep it going!', bn: 'চালিয়ে যান!' },
  'dashboard.trackingDaily': { en: 'tracking daily', bn: 'দৈনিক ট্র্যাকিং' },

  // Goals
  'goals.title': { en: 'Goals', bn: 'লক্ষ্য' },
  'goals.subtitle': { en: 'Set and track your yearly objectives', bn: 'আপনার বার্ষিক উদ্দেশ্য সেট করুন এবং ট্র্যাক করুন' },
  'goals.new': { en: 'New Goal', bn: 'নতুন লক্ষ্য' },
  'goals.create': { en: 'Create Goal', bn: 'লক্ষ্য তৈরি করুন' },
  'goals.edit': { en: 'Edit Goal', bn: 'লক্ষ্য সম্পাদনা করুন' },
  'goals.delete': { en: 'Delete', bn: 'মুছে ফেলুন' },
  'goals.noGoals': { en: 'No goals yet', bn: 'এখনো কোন লক্ষ্য নেই' },

  // Habits
  'habits.title': { en: 'Habits', bn: 'অভ্যাস' },
  'habits.subtitle': { en: 'Track your daily habits', bn: 'আপনার দৈনিক অভ্যাস ট্র্যাক করুন' },
  'habits.new': { en: 'New Habit', bn: 'নতুন অভ্যাস' },
  'habits.create': { en: 'Create Habit', bn: 'অভ্যাস তৈরি করুন' },
  'habits.complete': { en: 'Complete', bn: 'সম্পূর্ণ' },
  'habits.completed': { en: 'Completed', bn: 'সম্পন্ন' },
  'habits.noHabits': { en: 'No habits yet', bn: 'এখনো কোন অভ্যাস নেই' },

  // Calendar
  'calendar.title': { en: 'Calendar', bn: 'ক্যালেন্ডার' },
  'calendar.subtitle': { en: 'View your habit completion history', bn: 'আপনার অভ্যাস সম্পন্নতার ইতিহাস দেখুন' },
  'calendar.today': { en: 'Today', bn: 'আজ' },
  'calendar.noHabits': { en: 'No habits', bn: 'কোন অভ্যাস নেই' },
  'calendar.some': { en: 'Some', bn: 'কিছু' },
  'calendar.allDone': { en: 'All done', bn: 'সব সম্পন্ন' },

  // Heatmap
  'heatmap.title': { en: 'Yearly Heatmap', bn: 'বার্ষিক হিটম্যাপ' },
  'heatmap.subtitle': { en: 'Your habit completion throughout the year', bn: 'সারা বছর আপনার অভ্যাস সম্পন্নতা' },
  'heatmap.less': { en: 'Less', bn: 'কম' },
  'heatmap.more': { en: 'More', bn: 'বেশি' },
  'heatmap.totalDays': { en: 'Total active days', bn: 'মোট সক্রিয় দিন' },
  'heatmap.bestStreak': { en: 'Best streak', bn: 'সেরা স্ট্রিক' },

  // Journal
  'journal.title': { en: 'Weekly Journal', bn: 'সাপ্তাহিক জার্নাল' },
  'journal.subtitle': { en: 'Reflect on your progress', bn: 'আপনার অগ্রগতি প্রতিফলন করুন' },
  'journal.thisWeek': { en: 'This Week', bn: 'এই সপ্তাহ' },
  'journal.wins': { en: 'Wins', bn: 'সাফল্য' },
  'journal.winsPlaceholder': { en: 'What went well this week?', bn: 'এই সপ্তাহে কী ভালো হয়েছে?' },
  'journal.challenges': { en: 'Challenges', bn: 'চ্যালেঞ্জ' },
  'journal.challengesPlaceholder': { en: 'What challenges did you face?', bn: 'আপনি কী চ্যালেঞ্জের মুখোমুখি হয়েছেন?' },
  'journal.intentions': { en: 'Intentions', bn: 'উদ্দেশ্য' },
  'journal.intentionsPlaceholder': { en: 'What are your intentions for next week?', bn: 'পরের সপ্তাহের জন্য আপনার উদ্দেশ্য কী?' },
  'journal.mood': { en: 'Weekly Mood', bn: 'সাপ্তাহিক মেজাজ' },
  'journal.save': { en: 'Save Reflection', bn: 'প্রতিফলন সংরক্ষণ করুন' },
  'journal.saved': { en: 'Reflection saved!', bn: 'প্রতিফলন সংরক্ষিত!' },
  'journal.pastReflections': { en: 'Past Reflections', bn: 'পূর্ববর্তী প্রতিফলন' },
  'journal.noReflections': { en: 'No reflections yet', bn: 'এখনো কোন প্রতিফলন নেই' },

  // Analytics
  'analytics.title': { en: 'Analytics', bn: 'বিশ্লেষণ' },
  'analytics.subtitle': { en: 'Track your progress over time', bn: 'সময়ের সাথে আপনার অগ্রগতি ট্র্যাক করুন' },
  'analytics.weeklyProgress': { en: 'Weekly Progress', bn: 'সাপ্তাহিক অগ্রগতি' },
  'analytics.completionRate': { en: 'Completion Rate', bn: 'সম্পন্নতার হার' },

  // Settings
  'settings.title': { en: 'Settings', bn: 'সেটিংস' },
  'settings.subtitle': { en: 'Manage your account settings', bn: 'আপনার অ্যাকাউন্ট সেটিংস পরিচালনা করুন' },
  'settings.profile': { en: 'Profile', bn: 'প্রোফাইল' },
  'settings.updateInfo': { en: 'Update your personal information', bn: 'আপনার ব্যক্তিগত তথ্য আপডেট করুন' },
  'settings.email': { en: 'Email', bn: 'ইমেইল' },
  'settings.fullName': { en: 'Full Name', bn: 'পুরো নাম' },
  'settings.bio': { en: 'Bio', bn: 'বায়ো' },
  'settings.save': { en: 'Save Changes', bn: 'পরিবর্তন সংরক্ষণ করুন' },
  'settings.appearance': { en: 'Appearance', bn: 'উপস্থিতি' },
  'settings.theme': { en: 'Theme', bn: 'থিম' },
  'settings.light': { en: 'Light', bn: 'হালকা' },
  'settings.dark': { en: 'Dark', bn: 'গাঢ়' },
  'settings.system': { en: 'System', bn: 'সিস্টেম' },
  'settings.language': { en: 'Language', bn: 'ভাষা' },
  'settings.english': { en: 'English', bn: 'ইংরেজি' },
  'settings.bangla': { en: 'বাংলা', bn: 'বাংলা' },
  'settings.account': { en: 'Account', bn: 'অ্যাকাউন্ট' },
  'settings.updated': { en: 'Profile updated!', bn: 'প্রোফাইল আপডেট হয়েছে!' },

  // Common
  'common.loading': { en: 'Loading...', bn: 'লোড হচ্ছে...' },
  'common.save': { en: 'Save', bn: 'সংরক্ষণ' },
  'common.cancel': { en: 'Cancel', bn: 'বাতিল' },
  'common.delete': { en: 'Delete', bn: 'মুছে ফেলুন' },
  'common.edit': { en: 'Edit', bn: 'সম্পাদনা' },
  'common.for': { en: 'for', bn: 'জন্য' },

  // App name
  'app.name': { en: 'OPORAJEYO', bn: 'অপরাজেয়' },
  'app.tagline': { en: 'Unconquerable You', bn: 'অপরাজেয় তুমি' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    if (user) {
      fetchLanguagePreference();
    }
  }, [user]);

  const fetchLanguagePreference = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('language')
      .eq('user_id', user!.id)
      .single();

    if (data?.language) {
      setLanguageState(data.language as Language);
    }
  };

  const setLanguage = async (lang: Language) => {
    setLanguageState(lang);
    if (user) {
      await supabase
        .from('profiles')
        .update({ language: lang })
        .eq('user_id', user.id);
    }
  };

  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) return key;
    return translation[language] || translation.en || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
