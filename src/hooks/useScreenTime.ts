import { useState, useEffect, useCallback } from 'react';
import { isNative, isAndroid } from '@/lib/capacitor/platform';
import Shield from '@/lib/capacitor/shieldPlugin';

export interface AppUsage {
  packageName: string;
  appName: string;
  usageMinutes: number;
  launchCount: number;
  lastUsed: string;
  icon?: string;
  category?: 'social' | 'entertainment' | 'productivity' | 'communication' | 'other';
}

export interface ScreenTimeData {
  totalScreenTimeMinutes: number;
  totalAppLaunches: number;
  appUsage: AppUsage[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refreshData: () => Promise<void>;
}

// App category mapping
const APP_CATEGORIES: Record<string, 'social' | 'entertainment' | 'productivity' | 'communication' | 'other'> = {
  'instagram': 'social',
  'tiktok': 'social',
  'facebook': 'social',
  'twitter': 'social',
  'snapchat': 'social',
  'pinterest': 'social',
  'reddit': 'social',
  'linkedin': 'social',
  'youtube': 'entertainment',
  'netflix': 'entertainment',
  'spotify': 'entertainment',
  'twitch': 'entertainment',
  'disney': 'entertainment',
  'whatsapp': 'communication',
  'telegram': 'communication',
  'messenger': 'communication',
  'slack': 'communication',
  'discord': 'communication',
  'gmail': 'productivity',
  'calendar': 'productivity',
  'notes': 'productivity',
  'docs': 'productivity',
  'sheets': 'productivity',
};

const categorizeApp = (appName: string): AppUsage['category'] => {
  const lowerName = appName.toLowerCase();
  for (const [key, category] of Object.entries(APP_CATEGORIES)) {
    if (lowerName.includes(key)) {
      return category;
    }
  }
  return 'other';
};

// Mock data generator for web preview - in native app, this comes from UsageStatsManager
const generateMockData = (): { screenTime: number; appLaunches: number; apps: AppUsage[] } => {
  // Randomize slightly for realistic feel
  const randomFactor = () => 0.8 + Math.random() * 0.4;
  
  const apps: AppUsage[] = [
    { 
      packageName: 'com.instagram.android', 
      appName: 'Instagram', 
      usageMinutes: Math.round(127 * randomFactor()), 
      launchCount: Math.round(45 * randomFactor()), 
      lastUsed: new Date().toISOString(),
      category: 'social'
    },
    { 
      packageName: 'com.zhiliaoapp.musically', 
      appName: 'TikTok', 
      usageMinutes: Math.round(98 * randomFactor()), 
      launchCount: Math.round(32 * randomFactor()), 
      lastUsed: new Date().toISOString(),
      category: 'social'
    },
    { 
      packageName: 'com.whatsapp', 
      appName: 'WhatsApp', 
      usageMinutes: Math.round(76 * randomFactor()), 
      launchCount: Math.round(89 * randomFactor()), 
      lastUsed: new Date().toISOString(),
      category: 'communication'
    },
    { 
      packageName: 'com.google.android.youtube', 
      appName: 'YouTube', 
      usageMinutes: Math.round(65 * randomFactor()), 
      launchCount: Math.round(12 * randomFactor()), 
      lastUsed: new Date().toISOString(),
      category: 'entertainment'
    },
    { 
      packageName: 'com.twitter.android', 
      appName: 'X (Twitter)', 
      usageMinutes: Math.round(43 * randomFactor()), 
      launchCount: Math.round(28 * randomFactor()), 
      lastUsed: new Date().toISOString(),
      category: 'social'
    },
    { 
      packageName: 'com.facebook.katana', 
      appName: 'Facebook', 
      usageMinutes: Math.round(38 * randomFactor()), 
      launchCount: Math.round(15 * randomFactor()), 
      lastUsed: new Date().toISOString(),
      category: 'social'
    },
    { 
      packageName: 'com.snapchat.android', 
      appName: 'Snapchat', 
      usageMinutes: Math.round(29 * randomFactor()), 
      launchCount: Math.round(21 * randomFactor()), 
      lastUsed: new Date().toISOString(),
      category: 'social'
    },
    { 
      packageName: 'com.spotify.music', 
      appName: 'Spotify', 
      usageMinutes: Math.round(52 * randomFactor()), 
      launchCount: Math.round(8 * randomFactor()), 
      lastUsed: new Date().toISOString(),
      category: 'entertainment'
    },
    { 
      packageName: 'com.google.android.gm', 
      appName: 'Gmail', 
      usageMinutes: Math.round(25 * randomFactor()), 
      launchCount: Math.round(35 * randomFactor()), 
      lastUsed: new Date().toISOString(),
      category: 'productivity'
    },
    { 
      packageName: 'com.slack', 
      appName: 'Slack', 
      usageMinutes: Math.round(45 * randomFactor()), 
      launchCount: Math.round(42 * randomFactor()), 
      lastUsed: new Date().toISOString(),
      category: 'communication'
    },
  ];

  const totalScreenTime = apps.reduce((sum, app) => sum + app.usageMinutes, 0);
  const totalLaunches = apps.reduce((sum, app) => sum + app.launchCount, 0);

  return {
    screenTime: totalScreenTime,
    appLaunches: totalLaunches,
    apps: apps.sort((a, b) => b.usageMinutes - a.usageMinutes),
  };
};

// Fetch screen time from native layer (real UsageStatsManager on Android)
const fetchNativeScreenTime = async (): Promise<{ screenTime: number; appLaunches: number; apps: AppUsage[] }> => {
  if (isNative && isAndroid) {
    try {
      const result = await Shield.getScreenTimeStats();
      if (result?.error) {
        console.warn('[ScreenTime] Native error:', result.error);
        // No permission yet — return empty (UI will prompt)
        return { screenTime: 0, appLaunches: 0, apps: [] };
      }
      const apps: AppUsage[] = (result.apps || []).map((app: any) => ({
        packageName: app.packageName,
        appName: app.appName,
        usageMinutes: app.usageMinutes || 0,
        launchCount: app.launchCount || 0,
        lastUsed: new Date(app.lastUsed || Date.now()).toISOString(),
        category: categorizeApp(app.appName),
      }));
      return {
        screenTime: result.totalMinutes || 0,
        appLaunches: result.totalLaunches || 0,
        apps,
      };
    } catch (err) {
      console.error('[ScreenTime] Failed to get native screen time:', err);
      return { screenTime: 0, appLaunches: 0, apps: [] };
    }
  }

  // Web preview only — mock data so the UI is reviewable
  return generateMockData();
};

export function useScreenTime(): ScreenTimeData {
  const [totalScreenTimeMinutes, setTotalScreenTimeMinutes] = useState(0);
  const [totalAppLaunches, setTotalAppLaunches] = useState(0);
  const [appUsage, setAppUsage] = useState<AppUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const data = await fetchNativeScreenTime();
      setTotalScreenTimeMinutes(data.screenTime);
      setTotalAppLaunches(data.appLaunches);
      setAppUsage(data.apps);
      setLastUpdated(new Date());
    } catch (err) {
      setError('Failed to load screen time data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
    
    // Refresh every 5 minutes
    const interval = setInterval(refreshData, 5 * 60 * 1000);
    
    // Also refresh when app resumes
    const handleResume = () => {
      refreshData();
    };
    
    window.addEventListener('app:resume', handleResume);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener('app:resume', handleResume);
    };
  }, [refreshData]);

  return {
    totalScreenTimeMinutes,
    totalAppLaunches,
    appUsage,
    isLoading,
    error,
    lastUpdated,
    refreshData,
  };
}

// Helper hook to get usage by category
export function useScreenTimeByCategory() {
  const { appUsage, ...rest } = useScreenTime();
  
  const usageByCategory = appUsage.reduce((acc, app) => {
    const category = app.category || 'other';
    if (!acc[category]) {
      acc[category] = { totalMinutes: 0, totalLaunches: 0, apps: [] };
    }
    acc[category].totalMinutes += app.usageMinutes;
    acc[category].totalLaunches += app.launchCount;
    acc[category].apps.push(app);
    return acc;
  }, {} as Record<string, { totalMinutes: number; totalLaunches: number; apps: AppUsage[] }>);
  
  return {
    ...rest,
    appUsage,
    usageByCategory,
    socialMediaMinutes: usageByCategory.social?.totalMinutes || 0,
    entertainmentMinutes: usageByCategory.entertainment?.totalMinutes || 0,
    productivityMinutes: usageByCategory.productivity?.totalMinutes || 0,
    communicationMinutes: usageByCategory.communication?.totalMinutes || 0,
  };
}
