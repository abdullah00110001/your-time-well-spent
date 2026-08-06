import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ShieldBottomNav } from '@/components/shield/ShieldBottomNav';
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
import { FloatingTimerSettings } from '@/components/shield/FloatingTimerSettings';
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

type StrictnessMode = 'normal' | 'lock' | 'strict';
type SubPage = 'main' | 'block-screen' | 'block-apps' | 'block-sites' | 'block-keywords' | 'floating-timer' | 'pure-shield';

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
  const [activeTab, setActiveTab] = useState('dashboard');
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
      if (storedMode) setStrictnessMode(storedMode as StrictnessMode);

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

  const handleNavigate = (page: string) => {
    if (page === 'block-screen' || page === 'floating-timer' || page === 'pure-shield') {
      setSubPage(page as SubPage);
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

  if (subPage === 'block-screen') return <ShieldBlockScreen onBack={() => setSubPage('main')} />;
  if (subPage === 'block-apps') return <BlockAppsPage onBack={() => setSubPage('main')} />;
  if (subPage === 'block-sites') return <BlockSitesPage onBack={() => setSubPage('main')} />;
  if (subPage === 'block-keywords') return <BlockKeywordsPage onBack={() => setSubPage('main')} />;
  if (subPage === 'floating-timer') return <FloatingTimerSettings onBack={() => setSubPage('main')} />;
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
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-background w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden p-8 text-center animate-in zoom-in-95 duration-200">
            <span className="text-xs font-bold uppercase tracking-wider text-primary mb-4 block">
              {activePermission.step}
            </span>
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              {activePermission.icon}
            </div>
            <h2 className="text-2xl font-extrabold mb-3">{activePermission.title}</h2>
            <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
              {activePermission.description}
            </p>
            <button
              onClick={activePermission.action}
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all"
            >
              Grant Permission
            </button>
          </div>
        </div>
      )}

      <div className={`transition-opacity duration-300 ${isBlockingUI ? 'opacity-20 pointer-events-none' : 'opacity-100'}`}>
        <ShieldHeader />

        <div className="px-4 py-4 space-y-4">
          {activeTab === 'dashboard' && (
            <>
              <div className="mb-2">
                <p className="text-sm text-muted-foreground">Welcome back</p>
                <h1 className="text-2xl font-bold">{getGreeting()}</h1>
              </div>

              <ShieldUsageStats onViewDetails={() => handleTabChange('analytics')} />

              <ShieldFocusTimer
                isSessionActive={!!activeSession}
                onStartBreak={handleBreakStart}
                disabled={!!activeSession}
              />

              <ShieldProfilesSection
                profiles={profiles}
                onActivate={startSession}
                activeSession={activeSession}
                onRefresh={loadShieldDataLocal}
              />

              <ShieldQuickActions
                blockedAppsCount={allBlockedApps.length}
                blockedSitesCount={allBlockedWebsites.length}
                blockedKeywordsCount={allBlockedKeywords.length}
                reelsBlockEnabled={reelsToggle || reelsBlockEnabled}
                adultBlockEnabled={adultToggle || adultBlockEnabled}
                onReelsToggle={handleReelsToggle}
                onAdultToggle={handleAdultToggle}
                onManageApps={() => setSubPage('block-apps')}
                onManageSites={() => setSubPage('block-sites')}
                onManageKeywords={() => setSubPage('block-keywords')}
              />
            </>
          )}

          {activeTab === 'modes' && (
            <ShieldModes
              activeMode={strictnessMode}
              onModeChange={handleModeChange}
              disciplineScore={disciplineScore?.current_score}
            />
          )}

          {activeTab === 'reports' && <ShieldReports />}

          {activeTab === 'analytics' && (
            <ShieldAnalytics disciplineScore={disciplineScore} />
          )}

          {activeTab === 'groups' && <LifeosGroupsHome defaultType="shield" />}

          {activeTab === 'settings' && (
            <ShieldSettings
              settings={settings}
              onSettingChange={handleSettingChange}
              onNavigate={handleNavigate}
            />
          )}
        </div>

        <ShieldBottomNav activeTab={activeTab} onTabChange={handleTabChange} />
      </div>
    </div>
  );
}
