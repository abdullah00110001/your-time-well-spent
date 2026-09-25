import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FocusShieldUI } from '@/components/shield/lantern/FocusShieldUI';
import { useNavigate } from 'react-router-dom';
import ShieldNativePlugin from '@/lib/capacitor/shieldPlugin';
import { ShieldHeader } from '@/components/shield/ShieldHeader';
import { ShieldProfilesSection } from '@/components/shield/ShieldProfilesSection';
import { ShieldModes } from '@/components/shield/ShieldModes';
import { ShieldSettings } from '@/components/shield/ShieldSettings';
import { ShieldBlockScreen } from '@/components/shield/ShieldBlockScreen';
import { ShieldAnalytics } from '@/components/shield/ShieldAnalytics';
import { ShieldAccountability } from '@/components/shield/ShieldAccountability';
import { ShieldUsageStats } from '@/components/shield/ShieldUsageStats';
import { ShieldFocusTimer } from '@/components/shield/ShieldFocusTimer';
import { ShieldQuickActions } from '@/components/shield/ShieldQuickActions';
import { ShieldReports } from '@/components/shield/ShieldReports';
import { LifeosGroupsHome } from '@/components/groups/LifeosGroupsHome';
import { BlockAppsPage } from '@/components/shield/pages/BlockAppsPage';
import { BlockSitesPage } from '@/components/shield/pages/BlockSitesPage';
import { BlockKeywordsPage } from '@/components/shield/pages/BlockKeywordsPage';
import { TelegramGuardPage } from '@/components/shield/pages/TelegramGuardPage';
import { FloatingTimerSettings } from '@/components/shield/FloatingTimerSettings';
import { BlockScreenSettingsPage } from '@/components/shield/BlockScreenSettingsPage';
import { OrbTimerSettingsPage } from '@/components/shield/OrbTimerSettingsPage';
import { BlockingDatabasesPage } from '@/components/shield/BlockingDatabasesPage';
import { AppLockSettingsPage } from '@/components/shield/AppLockSettingsPage';
import { AdultFilterPage } from '@/components/shield/AdultFilterPage';
import { DailyLimitsPage } from '@/components/shield/DailyLimitsPage';
import { PureShieldMainSettings } from '@/components/shield/pureShield/PureShieldMainSettings';
import { isNative } from '@/lib/capacitor/platform';
import { App } from '@capacitor/app';
import {
  startShieldSession as startNativeSession,
  endShieldSession as endNativeSession,
  requestEmergencyBypass
} from '@/lib/capacitor/nativeShield';

import {
  ShieldCheck,
  BarChart3,
  AlertOctagon,
  Accessibility,
  BatteryWarning
} from 'lucide-react';

import {
  getAllPermissions,
  requestUsageStatsPermission,
  requestOverlayPermission,
  requestAccessibilityPermission,
  requestBatteryPermission
} from '@/lib/capacitor/permissions';

import type { StrictnessMode } from '@/components/shield/ShieldModes';
import { normalizeShieldMode } from '@/components/shield/ShieldModes';
type SubPage = 'main' | 'block-screen' | 'block-apps' | 'block-sites' | 'block-keywords' | 'telegram-guard' | 'floating-timer' | 'pure-shield' | 'blocking-db' | 'app-lock' | 'daily-limits' | 'adult-filter';

interface DisciplineProfile {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  strictness_level: string;
  is_active: boolean;
  blocked_apps: string[];
  blocked_websites: string[];
  blocked_keywords: string[];
  block_infinite_content: boolean;
  block_adult_content: boolean;
  default_duration_minutes: number;
}

interface DisciplineScore {
  current_score: number;
  current_streak_days: number;
  total_focus_minutes: number;
  total_time_saved_minutes: number;
  can_use_absolute_mode: boolean;
}

interface ShieldSession {
  id: string;
  profile_name: string;
  strictness_level: string;
  started_at: string;
  scheduled_end_at: string | null;
  status: string;
  bypass_attempts: number;
}

interface PermissionStatus {
  usageAccess: boolean;
  overlay: boolean;
  accessibility: boolean;
  battery: boolean;
}

// ✅ Helper — Android Shield plugin call
const callShieldNative = async (key: string, value: boolean) => {
  try {
    const Shield = (window as any)?.Capacitor?.Plugins?.Shield;
    if (Shield) {
      await Shield.updateHardcoreSettings({ key, value });
    }
  } catch (e) {
    console.error(`Shield native call failed [${key}]`, e);
  }
};

export default function ShieldPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [modeBusy, setModeBusy] = useState<null | 'focus' | 'sleep' | 'strict'>(null);
  const [subPage, setSubPage] = useState<SubPage>('main');
  const [profiles, setProfiles] = useState<DisciplineProfile[]>([]);
  const [disciplineScore, setDisciplineScore] = useState<DisciplineScore | null>(null);
  const [activeSession, setActiveSession] = useState<ShieldSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [permissions, setPermissions] = useState<PermissionStatus>({
    usageAccess: true,
    overlay: true,
    accessibility: true,
    battery: true,
  });

  const [strictnessMode, setStrictnessMode] = useState<StrictnessMode>('normal');

  const [settings, setSettings] = useState({
    pauseDurationEnabled: true,
    blockSplitScreen: false,
    blockPowerOff: false,
    blockRecentApps: false,
    preventUninstall: false,
    lowTimeAlert: true,
    pomodoroBreak: true,
    floatingTimer: false,
  });

  const [selectedBlockScreen, setSelectedBlockScreen] = useState('default');

  const newApps: string[] = (() => { try { return JSON.parse(localStorage.getItem('shield_blocked_apps_v2') || '[]'); } catch { return []; } })();
  const newSites: any[] = (() => { try { return JSON.parse(localStorage.getItem('shield_blocked_sites_v2') || '[]'); } catch { return []; } })();
  const newKeywords: string[] = (() => { try { return JSON.parse(localStorage.getItem('shield_blocked_keywords_v2') || '[]'); } catch { return []; } })();

  const allBlockedApps = [...new Set([...profiles.flatMap(p => p.blocked_apps), ...newApps])];
  const allBlockedWebsites = [...new Set([...profiles.flatMap(p => p.blocked_websites), ...newSites.filter(s => s.active).map(s => s.url)])];
  const allBlockedKeywords = [...new Set([...profiles.flatMap(p => p.blocked_keywords), ...newKeywords])];

  const reelsBlockEnabled = profiles.some(p => p.block_infinite_content);
  const adultBlockEnabled = profiles.some(p => p.block_adult_content);

  // ✅ Standalone toggles — localStorage থেকে initial state
  const [reelsToggle, setReelsToggle] = useState<boolean>(
    () => localStorage.getItem('shield_reels_block') === '1'
  );
  const [adultToggle, setAdultToggle] = useState<boolean>(
    () => localStorage.getItem('shield_adult_block') === '1'
  );

  useEffect(() => {
    loadShieldDataLocal();
    loadSettingsLocal();

    if (isNative) {
      verifyPermissions();

      const listener = App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) verifyPermissions();
      });

      return () => {
        listener.then(l => l.remove());
      };
    }
  }, [user]);

  const verifyPermissions = async () => {
    try {
      const status = await getAllPermissions();
      setPermissions({
        usageAccess: status.usageStats === 'granted',
        overlay: status.overlay === 'granted',
        accessibility: status.accessibility === 'granted',
        battery: status.battery === 'granted'
      });
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const loadShieldDataLocal = () => {
    setIsLoading(true);
    try {
      const storedProfiles = localStorage.getItem('shield_profiles');
      if (storedProfiles) {
        setProfiles(JSON.parse(storedProfiles));
      } else {
        setProfiles([]);
        saveLocalData('shield_profiles', []);
      }

      const storedScore = localStorage.getItem('shield_score');
      if (storedScore) {
        setDisciplineScore(JSON.parse(storedScore));
      } else {
        setDisciplineScore({
          current_score: 0,
          current_streak_days: 0,
          total_focus_minutes: 0,
          total_time_saved_minutes: 0,
          can_use_absolute_mode: false
        });
      }

      const storedSession = localStorage.getItem('shield_active_session');
      if (storedSession) {
        setActiveSession(JSON.parse(storedSession));
      } else {
        setActiveSession(null);
      }
    } catch (error) {
      console.error('Error loading local data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettingsLocal = () => {
    try {
      const storedSettings = localStorage.getItem('shield_settings');
      if (storedSettings) setSettings(JSON.parse(storedSettings));

      const storedMode = localStorage.getItem('shield_strictness_mode');
      if (storedMode) setStrictnessMode(normalizeShieldMode(storedMode));

      const storedScreen = localStorage.getItem('shield_block_screen');
      if (storedScreen) setSelectedBlockScreen(storedScreen);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveLocalData = (key: string, data: any) => {
    localStorage.setItem(key, JSON.stringify(data));
  };

  const startSession = async (profile: DisciplineProfile) => {
    if (!permissions.usageAccess || !permissions.overlay || !permissions.accessibility) {
      toast.error('Please complete the Shield setup first!');
      return;
    }

    const now = new Date();
    const endTime = new Date();
    endTime.setMinutes(endTime.getMinutes() + profile.default_duration_minutes);

    const newSession: ShieldSession = {
      id: crypto.randomUUID(),
      profile_name: profile.name,
      strictness_level: profile.strictness_level,
      started_at: now.toISOString(),
      scheduled_end_at: endTime.toISOString(),
      status: 'active',
      bypass_attempts: 0
    };

    if (isNative) {
      await startNativeSession({
        id: newSession.id,
        profileId: profile.id,
        profileName: profile.name,
        strictnessLevel: profile.strictness_level as any,
        startedAt: now,
        scheduledEndAt: endTime,
        blockedApps: profile.blocked_apps,
        blockedWebsites: profile.blocked_websites,
        blockedKeywords: profile.blocked_keywords,
        blockInfiniteContent: profile.block_infinite_content,
        blockAdultContent: profile.block_adult_content,
      }, user?.id || 'local_user');
    }

    const updatedProfiles = profiles.map(p =>
      p.id === profile.id ? { ...p, is_active: true } : p
    );
    setProfiles(updatedProfiles);
    saveLocalData('shield_profiles', updatedProfiles);
    setActiveSession(newSession);
    saveLocalData('shield_active_session', newSession);
    toast.success(`${profile.name} activated! Stay focused 🛡️`);
  };

  const handleEndSession = async (reason?: string) => {
    if (!activeSession) return;

    try {
      if (isNative) {
        await endNativeSession(reason, user?.id || 'local_user');
      }

      try {
        const history = JSON.parse(localStorage.getItem('shield_session_history') || '[]');
        history.unshift({
          ...activeSession,
          status: reason === 'bypass' ? 'bypassed' : 'completed',
          actual_end_at: new Date().toISOString(),
        });
        localStorage.setItem('shield_session_history', JSON.stringify(history.slice(0, 200)));
      } catch (e) {
        console.warn('Failed to persist session history', e);
      }

      setActiveSession(null);
      localStorage.removeItem('shield_active_session');

      const updatedProfiles = profiles.map(p => ({ ...p, is_active: false }));
      setProfiles(updatedProfiles);
      saveLocalData('shield_profiles', updatedProfiles);
      toast.success('Session ended');
    } catch (error) {
      console.error('Error ending session:', error);
    }
  };

  const handleSettingChange = (key: string, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveLocalData('shield_settings', newSettings);
  };

  const handleModeChange = (mode: StrictnessMode) => {
    setStrictnessMode(mode);
    localStorage.setItem('shield_strictness_mode', mode);
  };

  const handleBlockScreenChange = (screen: string) => {
    setSelectedBlockScreen(screen);
    localStorage.setItem('shield_block_screen', screen);
  };

  // ✅ FIX: Reels toggle — Android এ signal পাঠায়
  const handleReelsToggle = async (enabled: boolean) => {
    setReelsToggle(enabled);
    localStorage.setItem('shield_reels_block', enabled ? '1' : '0');

    if (isNative) {
      await callShieldNative('blockReels', enabled);
    }

    const updatedProfiles = profiles.map(p => ({
      ...p, block_infinite_content: enabled
    }));
    setProfiles(updatedProfiles);
    saveLocalData('shield_profiles', updatedProfiles);
  };

  // ✅ FIX: Adult toggle — Android এ signal পাঠায়
  const handleAdultToggle = async (enabled: boolean) => {
    setAdultToggle(enabled);
    localStorage.setItem('shield_adult_block', enabled ? '1' : '0');

    if (isNative) {
      await callShieldNative('blockAdult', enabled);
    }

    const updatedProfiles = profiles.map(p => ({
      ...p, block_adult_content: enabled
    }));
    setProfiles(updatedProfiles);
    saveLocalData('shield_profiles', updatedProfiles);
  };

  const VALID_SUBPAGES: SubPage[] = [
    'block-screen', 'block-apps', 'block-sites', 'block-keywords', 'telegram-guard',
    'floating-timer', 'pure-shield', 'blocking-db', 'app-lock', 'daily-limits', 'adult-filter',
  ];

  const handleNavigate = (page: string) => {
    if (VALID_SUBPAGES.includes(page as SubPage)) {
      setSubPage(page as SubPage);
    }
  };

  const toggleLanternMode = async (m: 'focus' | 'sleep') => {
    if (modeBusy) return;
    if (!isNative) { toast.info('Shield modes are only available in the Android app.'); return; }
    setModeBusy(m);
    try {
      if (strictnessMode === m) {
        await ShieldNativePlugin.deactivateMode();
        handleModeChange('normal');
        toast.info('Shield returned to Normal Mode');
      } else if (m === 'focus') {
        await ShieldNativePlugin.activateFocusMode();
        handleModeChange('focus');
        toast.success('Focus watch lit');
      } else {
        await ShieldNativePlugin.activateSleepMode();
        handleModeChange('sleep');
        toast.success('Sleep watch lit');
      }
    } catch (e: any) {
      toast.error(e?.message || `Failed to activate ${m} mode`);
    } finally {
      setModeBusy(null);
    }
  };

  const toggleLanternStrict = async (on: boolean) => {
    if (modeBusy) return;
    if (!isNative) { toast.info('Strict Mode is only available in the Android app.'); return; }
    setModeBusy('strict');
    try {
      if (!on) {
        await ShieldNativePlugin.deactivateMode();
        handleModeChange('normal');
        toast.info('Seal lifted');
      } else {
        await ShieldNativePlugin.activateStrictMode();
        handleModeChange('strict');
        toast.success('Lantern sealed — it cannot be opened early');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to toggle Strict Mode');
      try {
        const data = await ShieldNativePlugin.getCurrentMode();
        handleModeChange(data?.strict ? 'strict' : normalizeShieldMode(data?.mode));
      } catch {}
    } finally {
      setModeBusy(null);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    setSubPage('main');
  };

  const handleBreakStart = (minutes: number) => {
    toast.success(`Break started for ${minutes} minutes`);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getActivePermissionRequest = () => {
    if (!permissions.usageAccess) {
      return {
        step: "Step 1 of 4",
        title: "Usage Access",
        icon: <BarChart3 className="w-12 h-12 text-primary" />,
        description: "Shield needs to know when you open a distracting app so it can block it.",
        action: async () => {
          try { await requestUsageStatsPermission(); }
          catch (e) { toast.error("Failed to open Settings automatically."); }
        }
      };
    }
    if (!permissions.overlay) {
      return {
        step: "Step 2 of 4",
        title: "Overlay Permission",
        icon: <AlertOctagon className="w-12 h-12 text-primary" />,
        description: "Allow Shield to draw the 'Blocked' screen over your distracting apps.",
        action: async () => {
          try { await requestOverlayPermission(); }
          catch (e) { toast.error("Failed to open Settings automatically."); }
        }
      };
    }
    if (!permissions.accessibility) {
      return {
        step: "Step 3 of 4",
        title: "Accessibility",
        icon: <Accessibility className="w-12 h-12 text-primary" />,
        description: "Crucial for Strict Mode to prevent you from uninstalling or bypassing the block.",
        action: async () => {
          try { await requestAccessibilityPermission(); }
          catch (e) { toast.error("Failed to open Settings automatically."); }
        }
      };
    }
    if (!permissions.battery) {
      return {
        step: "Step 4 of 4",
        title: "Run in Background",
        icon: <BatteryWarning className="w-12 h-12 text-primary" />,
        description: "Ensures your phone's battery saver doesn't accidentally kill Shield while you are focusing.",
        action: async () => {
          try { await requestBatteryPermission(); }
          catch (e) { toast.error("Failed to open Settings automatically."); }
        }
      };
    }
    return null;
  };

  const activePermission = getActivePermissionRequest();
  const isBlockingUI = activePermission !== null;

  // V2 screens (the legacy ShieldBlockScreen / FloatingTimerSettings remain in the codebase)
  if (subPage === 'block-screen') return <BlockScreenSettingsPage onBack={() => setSubPage('main')} />;
  if (subPage === 'block-apps') return <BlockAppsPage onBack={() => setSubPage('main')} />;
  if (subPage === 'block-sites') return <BlockSitesPage onBack={() => setSubPage('main')} />;
  if (subPage === 'block-keywords') return <BlockKeywordsPage onBack={() => setSubPage('main')} />;
  if (subPage === 'telegram-guard') return <TelegramGuardPage onBack={() => setSubPage('main')} />;
  if (subPage === 'blocking-db') return <BlockingDatabasesPage onBack={() => setSubPage('main')} />;
  if (subPage === 'floating-timer') return <OrbTimerSettingsPage onBack={() => setSubPage('main')} />;
  if (subPage === 'app-lock') return <AppLockSettingsPage onBack={() => setSubPage('main')} />;
  if (subPage === 'daily-limits') return <DailyLimitsPage onBack={() => setSubPage('main')} />;
  if (subPage === 'adult-filter') return <AdultFilterPage onBack={() => setSubPage('main')} isActive={adultToggle} />;
  if (subPage === 'pure-shield') return <PureShieldMainSettings onBack={() => setSubPage('main')} />;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-muted rounded-2xl" />
          <div className="h-32 bg-muted rounded-2xl" />
          <div className="h-48 bg-muted rounded-2xl" />
          <div className="h-64 bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 relative">

      {isBlockingUI && (
        <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-card text-card-foreground border border-border w-full max-w-sm rounded-2xl shadow-lg overflow-hidden p-8 text-center animate-in zoom-in-95 duration-200">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4 block">
              {activePermission.step}
            </span>
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              {activePermission.icon}
            </div>
            <h2 className="text-xl font-bold mb-3">{activePermission.title}</h2>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
              {activePermission.description}
            </p>
            <Button onClick={activePermission.action} size="lg" className="w-full">
              Grant Permission
            </Button>
          </div>
        </div>
      )}

      <div className={`transition-opacity duration-300 ${isBlockingUI ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
        <FocusShieldUI
          activeTab={activeTab}
          onTabChange={handleTabChange}
          streak={disciplineScore?.current_streak_days ?? 0}
          score={disciplineScore?.current_score ?? 0}
          mode={strictnessMode as any}
          modeBusy={modeBusy}
          onToggleMode={toggleLanternMode}
          onToggleStrict={toggleLanternStrict}
          onBack={() => navigate('/')}
          onNavigate={handleNavigate}
          reelsBlocked={reelsToggle}
          adultBlocked={adultToggle}
          onReelsToggle={handleReelsToggle}
          onAdultToggle={handleAdultToggle}
          groupsSlot={<LifeosGroupsHome defaultType="shield" />}
          settingsSlot={
            <ShieldSettings
              settings={settings}
              onSettingChange={handleSettingChange}
              onNavigate={handleNavigate}
            />
          }
        />
      </div>

    </div>
  );
}
