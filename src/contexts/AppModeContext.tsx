import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AppMode = 'islamic' | 'regular';

// Dynamic label dictionary for dual-mode system
export const modeLabels = {
  islamic: {
    // Core terminology
    modeName: 'Islamic Mode',
    anchor1: 'Fajr',
    anchor2: 'Dhuhr',
    anchor3: 'Asr',
    anchor4: 'Maghrib',
    anchor5: 'Isha',
    intention: 'Niyyah',
    reset: 'Tawbah',
    badHabit: 'Nafs',
    goal: 'Akhirah',
    reading: 'Quran',
    service: 'Sadaqah',
    
    // Feature-specific labels
    intentionValidator: {
      title: 'Set Your Intention (Niyyah)',
      subtitle: 'Before you begin, purify your intention.',
      quote: '"Actions are judged by intentions" — Hadith',
      question: 'For whose sake?',
      optionDivine: 'For Allah (Deen)',
      optionWorld: 'For Career (Dunya)',
      optionEgo: 'Ego/Fame',
      divineBonus: 'Barakah activated! Your effort will be counted double, In Sha Allah.',
      egoWarning: 'Working for ego yields no reward. Consider redirecting your intention.',
      confirmButton: 'Begin with Bismillah',
    },
    qualityIndex: {
      title: 'Barakah Index',
      description: 'Quality over quantity — blessed productivity',
      peakTime: 'Peak Barakah Time',
      formula: 'Barakah = (Output × Niyyah Multiplier) / Time',
    },
    impulseControl: {
      title: 'Nafs Control',
      subtitle: 'Resist the urge with divine remembrance',
      buttonText: 'I feel an urge',
      countdownText: 'Hold on... Remember Allah',
      resistedLabel: 'Urges Resisted',
      succumbedLabel: 'Urges Succumbed',
      successMessage: 'Alhamdulillah! You resisted.',
      failMessage: 'Seek forgiveness. Tomorrow is new.',
    },
    dayReset: {
      title: 'Tawbah Protocol',
      description: "A rough morning? The day isn't over yet.",
      activeMessage: 'Fresh start already activated. Keep going!',
      onTrackMessage: "You're on track. No reset needed.",
      quote: '"Say: O My servants who have transgressed against themselves, do not despair of the mercy of Allah." — Az-Zumar 39:53',
      buttonText: 'Activate Fresh Start',
      confirmTitle: '🌅 Start Fresh?',
      hadith: '"Every son of Adam sins, and the best of sinners are those who repent." — Hadith',
    },
    dopamineMeter: {
      title: 'Ghaflah Meter',
      description: 'Heedlessness warning',
      warningLabel: 'Ghaflah (Heedlessness) Warning',
      activeLearning: 'Active Learning',
      mindlessScrolling: 'Mindless Scrolling',
      criticalMessage: 'Your heart is becoming heedless. Disconnect and reconnect with Allah.',
    },
    serviceTracker: {
      title: 'Sadaqah of Time',
      description: 'Time spent in service of others',
      hoursLabel: 'Service Hours',
      moodBoost: 'Mood Boost from Giving',
    },
    emotionalAnchor: {
      title: 'Quranic Anchor',
      description: 'Find healing in the words of Allah',
      moodPrompt: 'How are you feeling?',
      suggestionLabel: 'Recommended Surah',
      feedbackQuestion: 'Did this shift your state?',
    },
    realityCheck: {
      title: 'Mawt (Death) Remembrance',
      description: 'If this was your last week, are you ready?',
      prompt: 'Rate your preparedness for meeting Allah',
      weeklyTrigger: 'Jumu\'ah Reflection',
    },
    earlyRising: {
      title: 'Tahajjud Analytics',
      description: 'Pre-dawn worship correlation',
      wakeUpLabel: 'Tahajjud Wake-up',
      energyCorrelation: 'Energy Level Correlation',
    },
    weightedScore: {
      title: 'Akhirah Ratio',
      description: 'Weighted daily scoring',
      worshipLabel: 'Worship (60%)',
      worldLabel: 'Dunya (40%)',
      failedDayMessage: 'High work output with zero prayer results in a Failed Day.',
    },
    
    // Colors
    primaryColor: 'emerald',
    accentColor: 'amber',
  },
  regular: {
    // Core terminology
    modeName: 'Regular Mode',
    anchor1: 'Morning Routine',
    anchor2: 'Mid-Morning',
    anchor3: 'Afternoon',
    anchor4: 'Evening',
    anchor5: 'Night',
    intention: 'Purpose',
    reset: 'Pivot',
    badHabit: 'Distraction',
    goal: 'Legacy',
    reading: 'Reading',
    service: 'Volunteering',
    
    // Feature-specific labels
    intentionValidator: {
      title: 'Set Your Purpose',
      subtitle: 'Before you begin, clarify your intention.',
      quote: '"He who has a why to live can bear almost any how." — Nietzsche',
      question: 'What drives this session?',
      optionDivine: 'For Mission/Purpose',
      optionWorld: 'For Career/Growth',
      optionEgo: 'For Recognition',
      divineBonus: 'Purpose-driven work unlocks 2x productivity multiplier!',
      egoWarning: 'Ego-driven work leads to burnout. Consider your true purpose.',
      confirmButton: 'Begin Session',
    },
    qualityIndex: {
      title: 'Flow Efficiency',
      description: 'Quality over quantity — peak performance',
      peakTime: 'Peak Flow Time',
      formula: 'Flow = (Output × Purpose Multiplier) / Time',
    },
    impulseControl: {
      title: 'Urge Surfer',
      subtitle: 'Ride the wave of distraction',
      buttonText: 'I feel an urge',
      countdownText: 'Hold on... This too shall pass',
      resistedLabel: 'Urges Resisted',
      succumbedLabel: 'Urges Given In',
      successMessage: 'Well done! You stayed focused.',
      failMessage: 'Learn from it. Tomorrow is new.',
    },
    dayReset: {
      title: 'The Pivot Protocol',
      description: "Rough morning? The day isn't over yet.",
      activeMessage: 'Fresh start already activated. Keep going!',
      onTrackMessage: "You're on track. No reset needed.",
      quote: '"The only real mistake is the one from which we learn nothing." — Henry Ford',
      buttonText: 'Activate Fresh Start',
      confirmTitle: '🌅 Start Fresh?',
      hadith: '"Fall seven times, stand up eight." — Japanese Proverb',
    },
    dopamineMeter: {
      title: 'Dopamine Meter',
      description: 'Digital wellness warning',
      warningLabel: 'Dopamine Overload Warning',
      activeLearning: 'Active Learning',
      mindlessScrolling: 'Mindless Scrolling',
      criticalMessage: 'Your brain needs a break. Step away from screens.',
    },
    serviceTracker: {
      title: 'Contribution Tracker',
      description: 'Time spent helping others',
      hoursLabel: 'Volunteer Hours',
      moodBoost: 'Mood Boost from Giving',
    },
    emotionalAnchor: {
      title: 'Bibliotherapy',
      description: 'Find wisdom in great writings',
      moodPrompt: 'How are you feeling?',
      suggestionLabel: 'Recommended Reading',
      feedbackQuestion: 'Did this help?',
    },
    realityCheck: {
      title: 'Memento Mori',
      description: 'Remember you are mortal — make it count.',
      prompt: 'Rate your life satisfaction',
      weeklyTrigger: 'Weekly Reflection',
    },
    earlyRising: {
      title: '5 AM Club Analytics',
      description: 'Early rising correlation',
      wakeUpLabel: 'Early Wake-up',
      energyCorrelation: 'Energy Level Correlation',
    },
    weightedScore: {
      title: 'Legacy Ratio',
      description: 'Weighted daily scoring',
      worshipLabel: 'Core Values (60%)',
      worldLabel: 'Work (40%)',
      failedDayMessage: 'High work output with zero self-care results in a Failed Day.',
    },
    
    // Colors
    primaryColor: 'blue',
    accentColor: 'slate',
  },
} as const;

// Stoic quotes for regular mode impulse control
export const stoicQuotes = [
  { text: "You have power over your mind, not outside events. Realize this, and you will find strength.", author: "Marcus Aurelius" },
  { text: "It is not the man who has too little that is poor, but the one who hankers after more.", author: "Seneca" },
  { text: "No man is free who is not master of himself.", author: "Epictetus" },
  { text: "The soul becomes dyed with the color of its thoughts.", author: "Marcus Aurelius" },
  { text: "Waste no more time arguing about what a good man should be. Be one.", author: "Marcus Aurelius" },
  { text: "He who fears death will never do anything worthy of a living man.", author: "Seneca" },
  { text: "Difficulties strengthen the mind, as labor does the body.", author: "Seneca" },
  { text: "First say to yourself what you would be; then do what you have to do.", author: "Epictetus" },
];

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  labels: typeof modeLabels.islamic | typeof modeLabels.regular;
  isLoading: boolean;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mode, setModeState] = useState<AppMode>('islamic');
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user's mode preference from database
  useEffect(() => {
    if (user) {
      fetchUserMode();
    } else {
      // Check localStorage for non-authenticated users
      const savedMode = localStorage.getItem('app_mode') as AppMode;
      if (savedMode && (savedMode === 'islamic' || savedMode === 'regular')) {
        setModeState(savedMode);
      }
      setIsLoading(false);
    }
  }, [user]);

  const fetchUserMode = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('app_mode')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('[AppMode] Profile fetch error:', error.message);
      } else if (data?.app_mode) {
        setModeState(data.app_mode as AppMode);
      } else if (!data) {
        // Profile doesn't exist yet — create one
        console.log('[AppMode] No profile found, creating default');
        try {
          await supabase.from('profiles').upsert({ user_id: user.id, app_mode: 'islamic' }, { onConflict: 'user_id' });
        } catch (insertErr) {
          console.warn('[AppMode] Profile auto-create failed:', insertErr);
        }
      }
    } catch (error) {
      console.error('[AppMode] Error fetching app mode:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setMode = async (newMode: AppMode) => {
    setModeState(newMode);
    localStorage.setItem('app_mode', newMode);

    if (user) {
      try {
        await supabase
          .from('profiles')
          .update({ app_mode: newMode })
          .eq('user_id', user.id);
      } catch (error) {
        console.error('Error saving app mode:', error);
      }
    }
  };

  const labels = mode === 'islamic' ? modeLabels.islamic : modeLabels.regular;

  return (
    <AppModeContext.Provider value={{ mode, setMode, labels, isLoading }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error('useAppMode must be used within an AppModeProvider');
  }
  return context;
}
