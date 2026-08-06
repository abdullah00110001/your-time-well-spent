import { useState, useEffect, useCallback } from 'react';
import { format, subDays, differenceInDays } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface DailyEntryData {
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
  quran_minutes: number;
  device_time_minutes: number;
  social_media_minutes: number;
  shorts_reels_minutes: number;
  exercise_done: boolean;
  exercise_duration_minutes: number;
  sleep_duration_minutes: number;
  sleep_quality: number;
  energy_level: number;
  focus_level: number;
  discipline_level: number;
  overall_day_rating: number;
}

export interface MoodProductivityCorrelation {
  lowMoodHighDevice: boolean;
  highMoodHighProductivity: boolean;
  insights: string[];
}

export interface CognitiveLoadData {
  score: number;
  status: 'low' | 'medium' | 'high' | 'overload';
  warning: string | null;
}

export interface SalahQualityData {
  totalCompleted: number;
  onTimeCount: number;
  avgKhushu: number;
  consistencyScore: number;
  qualityScore: number;
}

export interface LifeBalanceData {
  score: number;
  status: 'low' | 'medium' | 'high';
  daily: number;
  weekly: number;
  monthly: number;
}

export interface BurnoutPrediction {
  riskLevel: 'none' | 'mild' | 'moderate' | 'high';
  daysAtRisk: number;
  warning: string | null;
  shouldAlert: boolean;
}

export interface RecoveryModeData {
  isActive: boolean;
  missedDays: number;
  recoveryPlan: string[];
  streakProtected: boolean;
}

export interface GoalAdjustment {
  goalId: string;
  goalTitle: string;
  currentTarget: number;
  suggestedTarget: number;
  failureRate: number;
  reason: string;
}

export interface MirrorModeSummary {
  dueDate: string | null;
  lastGenerated: string | null;
  summary: string | null;
  traits: string[];
  improvements: string[];
  strengths: string[];
}

export interface AdvancedInsights {
  moodCorrelation: MoodProductivityCorrelation;
  cognitiveLoad: CognitiveLoadData;
  salahQuality: SalahQualityData;
  lifeBalance: LifeBalanceData;
  burnoutPrediction: BurnoutPrediction;
  recoveryMode: RecoveryModeData;
  goalAdjustments: GoalAdjustment[];
  mirrorMode: MirrorModeSummary;
  loading: boolean;
}

export function useAdvancedInsights(): AdvancedInsights {
  const { user } = useAuth();
  const [insights, setInsights] = useState<AdvancedInsights>({
    moodCorrelation: { lowMoodHighDevice: false, highMoodHighProductivity: false, insights: [] },
    cognitiveLoad: { score: 0, status: 'low', warning: null },
    salahQuality: { totalCompleted: 0, onTimeCount: 0, avgKhushu: 0, consistencyScore: 0, qualityScore: 0 },
    lifeBalance: { score: 0, status: 'medium', daily: 0, weekly: 0, monthly: 0 },
    burnoutPrediction: { riskLevel: 'none', daysAtRisk: 0, warning: null, shouldAlert: false },
    recoveryMode: { isActive: false, missedDays: 0, recoveryPlan: [], streakProtected: false },
    goalAdjustments: [],
    mirrorMode: { dueDate: null, lastGenerated: null, summary: null, traits: [], improvements: [], strengths: [] },
    loading: true,
  });

  const analyzeData = useCallback(async () => {
    if (!user) return;

    const last30Days = format(subDays(new Date(), 30), 'yyyy-MM-dd');
    const last7Days = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    // Fetch daily entries
    const { data: entries } = await supabase
      .from('daily_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', last30Days)
      .order('date', { ascending: false });

    if (!entries || entries.length === 0) {
      setInsights(prev => ({ ...prev, loading: false }));
      return;
    }

    const recentEntries = entries.slice(0, 7) as DailyEntryData[];
    const allEntries = entries as DailyEntryData[];

    // 2️⃣ MOOD ↔ PRODUCTIVITY CORRELATION
    const moodCorrelation = analyzeMoodProductivity(allEntries);

    // 3️⃣ COGNITIVE LOAD METER
    const todayEntry = allEntries.find(e => e.date === today) || allEntries[0];
    const cognitiveLoad = calculateCognitiveLoad(todayEntry);

    // 4️⃣ SALAH QUALITY TRACKER
    const salahQuality = analyzeSalahQuality(allEntries);

    // 8️⃣ LIFE BALANCE SCORE
    const lifeBalance = calculateLifeBalance(allEntries);

    // 9️⃣ BURNOUT PREDICTION
    const burnoutPrediction = detectBurnout(recentEntries);

    // 7️⃣ MISSED DAY RECOVERY MODE
    const recoveryMode = checkRecoveryMode(allEntries, today);

    // 6️⃣ AUTO GOAL ADJUSTMENT - Fetch goals and analyze
    const { data: goals } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', user.id);

    const { data: habitEntries } = await supabase
      .from('habit_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', last30Days);

    const goalAdjustments = analyzeGoalAdjustments(goals || [], habitEntries || []);

    // 🔟 MIRROR MODE
    const mirrorMode = generateMirrorMode(allEntries, user.id);

    setInsights({
      moodCorrelation,
      cognitiveLoad,
      salahQuality,
      lifeBalance,
      burnoutPrediction,
      recoveryMode,
      goalAdjustments,
      mirrorMode,
      loading: false,
    });
  }, [user]);

  useEffect(() => {
    analyzeData();
  }, [analyzeData]);

  return insights;
}

// 2️⃣ MOOD ↔ PRODUCTIVITY CORRELATION
function analyzeMoodProductivity(entries: DailyEntryData[]): MoodProductivityCorrelation {
  const insights: string[] = [];
  let lowMoodHighDevice = false;
  let highMoodHighProductivity = false;

  const lowMoodDays = entries.filter(e => (e.energy_level || 0) <= 2);
  const highMoodDays = entries.filter(e => (e.energy_level || 0) >= 4);

  if (lowMoodDays.length > 0) {
    const avgDeviceOnLowMood = lowMoodDays.reduce((sum, e) => sum + (e.device_time_minutes || 0), 0) / lowMoodDays.length;
    const avgDeviceOverall = entries.reduce((sum, e) => sum + (e.device_time_minutes || 0), 0) / entries.length;
    
    if (avgDeviceOnLowMood > avgDeviceOverall * 1.3) {
      lowMoodHighDevice = true;
      insights.push("📱 Low mood days show 30%+ higher device usage");
    }
  }

  if (highMoodDays.length > 0) {
    const avgStudyHighMood = highMoodDays.reduce((sum, e) => 
      sum + (e.focused_study_minutes || 0) + (e.revision_minutes || 0), 0) / highMoodDays.length;
    const avgStudyOverall = entries.reduce((sum, e) => 
      sum + (e.focused_study_minutes || 0) + (e.revision_minutes || 0), 0) / entries.length;
    
    if (avgStudyHighMood > avgStudyOverall * 1.2) {
      highMoodHighProductivity = true;
      insights.push("✨ High energy days boost your study by 20%+");
    }
  }

  // More correlations
  const salahDays = entries.filter(e => {
    const count = [e.fajr_completed, e.dhuhr_completed, e.asr_completed, e.maghrib_completed, e.isha_completed].filter(Boolean).length;
    return count >= 4;
  });
  
  if (salahDays.length >= entries.length * 0.5) {
    const avgEnergyWithSalah = salahDays.reduce((sum, e) => sum + (e.energy_level || 0), 0) / salahDays.length;
    const avgEnergyOverall = entries.reduce((sum, e) => sum + (e.energy_level || 0), 0) / entries.length;
    if (avgEnergyWithSalah > avgEnergyOverall) {
      insights.push("🕌 Days with 4+ prayers show higher energy levels");
    }
  }

  // Sleep correlation
  const goodSleepDays = entries.filter(e => (e.sleep_quality || 0) >= 4);
  if (goodSleepDays.length > 0) {
    const avgFocusGoodSleep = goodSleepDays.reduce((sum, e) => sum + (e.focus_level || 0), 0) / goodSleepDays.length;
    const avgFocusOverall = entries.reduce((sum, e) => sum + (e.focus_level || 0), 0) / entries.length;
    if (avgFocusGoodSleep > avgFocusOverall + 0.5) {
      insights.push("😴 Quality sleep improves next-day focus significantly");
    }
  }

  return { lowMoodHighDevice, highMoodHighProductivity, insights };
}

// 3️⃣ COGNITIVE LOAD METER
function calculateCognitiveLoad(entry: DailyEntryData | undefined): CognitiveLoadData {
  if (!entry) {
    return { score: 0, status: 'low', warning: null };
  }

  const sleepFactor = entry.sleep_quality ? (5 - entry.sleep_quality) * 10 : 20;
  const focusFactor = entry.focus_level ? (5 - entry.focus_level) * 10 : 20;
  const taskLoad = ((entry.focused_study_minutes || 0) + (entry.revision_minutes || 0)) / 30;
  const deviceStress = (entry.device_time_minutes || 0) / 20;

  const score = Math.min(100, Math.max(0, sleepFactor + focusFactor + taskLoad + deviceStress));

  let status: 'low' | 'medium' | 'high' | 'overload' = 'low';
  let warning: string | null = null;

  if (score >= 80) {
    status = 'overload';
    warning = "⚠️ Mental overload detected. Consider taking a break and prioritizing rest.";
  } else if (score >= 60) {
    status = 'high';
    warning = "Your cognitive load is high. Try to reduce multitasking.";
  } else if (score >= 40) {
    status = 'medium';
  }

  return { score, status, warning };
}

// 4️⃣ SALAH QUALITY TRACKER
function analyzeSalahQuality(entries: DailyEntryData[]): SalahQualityData {
  let totalCompleted = 0;
  let onTimeCount = 0;
  let totalKhushu = 0;
  let khushuDays = 0;

  entries.forEach(entry => {
    const prayers = [
      { completed: entry.fajr_completed, onTime: entry.fajr_on_time },
      { completed: entry.dhuhr_completed, onTime: entry.dhuhr_on_time },
      { completed: entry.asr_completed, onTime: entry.asr_on_time },
      { completed: entry.maghrib_completed, onTime: entry.maghrib_on_time },
      { completed: entry.isha_completed, onTime: entry.isha_on_time },
    ];

    prayers.forEach(p => {
      if (p.completed) totalCompleted++;
      if (p.completed && p.onTime) onTimeCount++;
    });

    if (entry.khushu_level) {
      totalKhushu += entry.khushu_level;
      khushuDays++;
    }
  });

  const totalPossible = entries.length * 5;
  const consistencyScore = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
  const avgKhushu = khushuDays > 0 ? totalKhushu / khushuDays : 0;
  const onTimeRate = totalCompleted > 0 ? (onTimeCount / totalCompleted) : 0;
  const qualityScore = Math.round((consistencyScore * 0.4) + (onTimeRate * 100 * 0.3) + (avgKhushu * 20 * 0.3));

  return { totalCompleted, onTimeCount, avgKhushu, consistencyScore, qualityScore };
}

// 8️⃣ LIFE BALANCE SCORE
function calculateLifeBalance(entries: DailyEntryData[]): LifeBalanceData {
  const calculateScore = (entryList: DailyEntryData[]): number => {
    if (entryList.length === 0) return 50;

    const avgStudy = entryList.reduce((sum, e) => 
      sum + (e.focused_study_minutes || 0) + (e.revision_minutes || 0), 0) / entryList.length;
    const avgSalah = entryList.reduce((sum, e) => {
      const count = [e.fajr_completed, e.dhuhr_completed, e.asr_completed, e.maghrib_completed, e.isha_completed].filter(Boolean).length;
      return sum + count * 20;
    }, 0) / entryList.length;
    const avgSleep = entryList.reduce((sum, e) => sum + (e.sleep_duration_minutes || 0), 0) / entryList.length;
    const avgExercise = entryList.reduce((sum, e) => sum + (e.exercise_done ? 30 : 0) + (e.exercise_duration_minutes || 0), 0) / entryList.length;
    const avgDevice = entryList.reduce((sum, e) => sum + (e.device_time_minutes || 0), 0) / entryList.length;

    const positive = avgStudy + avgSalah + (avgSleep / 60 * 10) + avgExercise;
    const negative = avgDevice || 1;
    
    return Math.min(100, Math.max(0, Math.round((positive / negative) * 10)));
  };

  const daily = calculateScore(entries.slice(0, 1));
  const weekly = calculateScore(entries.slice(0, 7));
  const monthly = calculateScore(entries);

  const score = Math.round((daily + weekly + monthly) / 3);
  const status: 'low' | 'medium' | 'high' = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';

  return { score, status, daily, weekly, monthly };
}

// 9️⃣ BURNOUT PREDICTION
function detectBurnout(recentEntries: DailyEntryData[]): BurnoutPrediction {
  if (recentEntries.length < 5) {
    return { riskLevel: 'none', daysAtRisk: 0, warning: null, shouldAlert: false };
  }

  let daysAtRisk = 0;
  recentEntries.slice(0, 7).forEach(entry => {
    const lowSleep = (entry.sleep_quality || 3) <= 2;
    const lowEnergy = (entry.energy_level || 3) <= 2;
    const lowFocus = (entry.focus_level || 3) <= 2;
    
    if ((lowSleep && lowEnergy) || (lowEnergy && lowFocus) || (lowSleep && lowFocus)) {
      daysAtRisk++;
    }
  });

  let riskLevel: 'none' | 'mild' | 'moderate' | 'high' = 'none';
  let warning: string | null = null;
  let shouldAlert = false;

  if (daysAtRisk >= 5) {
    riskLevel = 'high';
    warning = "🚨 Burnout risk is high. Please take care of yourself. Rest is not laziness—it's recovery.";
    shouldAlert = true;
  } else if (daysAtRisk >= 3) {
    riskLevel = 'moderate';
    warning = "⚠️ Signs of exhaustion detected. Consider reducing workload and improving sleep.";
    shouldAlert = true;
  } else if (daysAtRisk >= 2) {
    riskLevel = 'mild';
    warning = "Your energy seems low lately. Pay attention to rest and self-care.";
  }

  return { riskLevel, daysAtRisk, warning, shouldAlert };
}

// 7️⃣ RECOVERY MODE
function checkRecoveryMode(entries: DailyEntryData[], today: string): RecoveryModeData {
  const dates = entries.map(e => e.date).sort();
  const lastEntry = dates[dates.length - 1];
  
  if (!lastEntry) {
    return { isActive: false, missedDays: 0, recoveryPlan: [], streakProtected: false };
  }

  const daysSinceLastEntry = differenceInDays(new Date(today), new Date(lastEntry));
  
  if (daysSinceLastEntry <= 1) {
    return { isActive: false, missedDays: 0, recoveryPlan: [], streakProtected: false };
  }

  const missedDays = daysSinceLastEntry - 1;
  const recoveryPlan: string[] = [];
  
  if (missedDays >= 1) {
    recoveryPlan.push("📝 Log today's entry with honesty, even if incomplete");
    recoveryPlan.push("🕌 Focus on completing all 5 prayers on time");
    recoveryPlan.push("📖 Read at least 1 page of Qur'an");
  }
  if (missedDays >= 2) {
    recoveryPlan.push("⏰ Set alarms for structured routine tomorrow");
    recoveryPlan.push("😴 Get 7-8 hours of quality sleep tonight");
  }
  if (missedDays >= 3) {
    recoveryPlan.push("🎯 Pick only ONE most important task for the next 3 days");
    recoveryPlan.push("📵 Limit device usage to under 2 hours");
  }

  return {
    isActive: missedDays >= 1,
    missedDays,
    recoveryPlan,
    streakProtected: missedDays <= 2, // Grace period
  };
}

// 6️⃣ AUTO GOAL ADJUSTMENT
function analyzeGoalAdjustments(goals: any[], habitEntries: any[]): GoalAdjustment[] {
  const adjustments: GoalAdjustment[] = [];
  
  // Group habit entries by habit_id
  const entriesByHabit = new Map<string, any[]>();
  habitEntries.forEach(entry => {
    const existing = entriesByHabit.get(entry.habit_id) || [];
    existing.push(entry);
    entriesByHabit.set(entry.habit_id, existing);
  });

  // Analyze each goal
  entriesByHabit.forEach((entries, habitId) => {
    const completed = entries.filter(e => e.completed).length;
    const total = entries.length;
    
    if (total >= 7) { // At least a week of data
      const successRate = completed / total;
      
      if (successRate < 0.4) { // Less than 40% success
        adjustments.push({
          goalId: habitId,
          goalTitle: `Habit ${habitId.slice(0, 8)}`,
          currentTarget: 7,
          suggestedTarget: 4,
          failureRate: Math.round((1 - successRate) * 100),
          reason: `Only ${Math.round(successRate * 100)}% completion rate. Consider smaller, achievable steps.`,
        });
      }
    }
  });

  return adjustments.slice(0, 3); // Max 3 suggestions
}

// 🔟 MIRROR MODE
function generateMirrorMode(entries: DailyEntryData[], userId: string): MirrorModeSummary {
  if (entries.length < 25) {
    const dueDate = format(subDays(new Date(), -30), 'yyyy-MM-dd');
    return {
      dueDate,
      lastGenerated: null,
      summary: null,
      traits: [],
      improvements: [],
      strengths: [],
    };
  }

  const strengths: string[] = [];
  const improvements: string[] = [];
  const traits: string[] = [];

  // Analyze patterns
  const avgSalah = entries.reduce((sum, e) => {
    const count = [e.fajr_completed, e.dhuhr_completed, e.asr_completed, e.maghrib_completed, e.isha_completed].filter(Boolean).length;
    return sum + count;
  }, 0) / entries.length;

  const quranDays = entries.filter(e => e.quran_read).length;
  const avgStudy = entries.reduce((sum, e) => sum + (e.focused_study_minutes || 0), 0) / entries.length;
  const avgDevice = entries.reduce((sum, e) => sum + (e.device_time_minutes || 0), 0) / entries.length;
  const avgEnergy = entries.reduce((sum, e) => sum + (e.energy_level || 0), 0) / entries.length;

  // Determine traits
  if (avgSalah >= 4) {
    strengths.push("Strong commitment to Salah");
    traits.push("Spiritually consistent");
  } else if (avgSalah < 3) {
    improvements.push("Salah consistency needs attention");
  }

  if (quranDays >= entries.length * 0.6) {
    strengths.push("Regular Qur'an engagement");
    traits.push("Connected to the Book of Allah");
  } else if (quranDays < entries.length * 0.3) {
    improvements.push("Qur'an reading could be more regular");
  }

  if (avgStudy >= 90) {
    strengths.push("Dedicated learner");
    traits.push("Academically focused");
  } else if (avgStudy < 30) {
    improvements.push("Study time needs increase");
  }

  if (avgDevice > 180) {
    improvements.push("Screen time is above healthy levels");
    traits.push("Prone to digital distraction");
  } else if (avgDevice < 90) {
    strengths.push("Healthy digital boundaries");
  }

  if (avgEnergy >= 3.5) {
    traits.push("Generally energetic");
  } else if (avgEnergy < 2.5) {
    improvements.push("Energy management needs work");
  }

  // Generate summary
  const summary = `Over the past 30 days, you have been ${traits.length > 0 ? traits[0].toLowerCase() : 'on a journey of self-improvement'}. ${
    strengths.length > 0 
      ? `Your strengths include: ${strengths.slice(0, 2).join(' and ').toLowerCase()}.` 
      : ''
  } ${
    improvements.length > 0 
      ? `Areas where you can grow: ${improvements.slice(0, 2).join(' and ').toLowerCase()}.` 
      : ''
  } Remember: growth is not about perfection, but consistent effort. Keep striving.`;

  return {
    dueDate: null,
    lastGenerated: format(new Date(), 'yyyy-MM-dd'),
    summary,
    traits,
    improvements,
    strengths,
  };
}
