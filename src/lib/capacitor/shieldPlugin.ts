import { registerPlugin } from '@capacitor/core';

export interface InstalledApp {
  packageName: string;
  appName: string;
  isSystem: boolean;
  /** base64 PNG data-URL of the real launcher icon (Android only). */
  icon?: string;
}

export interface ShieldPluginInterface {
  // ১. বেসিক কন্ট্রোল
  enable(): Promise<void>;
  disable(): Promise<void>;
  isEnabled(): Promise<{ enabled: boolean }>;

  // ২. অ্যাপ ব্লকিং
  // Native method names are exact — the old `setBlockedApps?` / `setBlockedSites?` /
  // `setBlockedKeywords?` optional aliases did not exist in ShieldPlugin.java, so
  // every call through them silently no-opped.
  blockApps(options: { apps: string[] }): Promise<void>;
  getBlockedApps(): Promise<{ apps: string[] }>;
  blockSites(options: { sites: string[] }): Promise<void>;
  getBlockedSites(): Promise<{ sites: string[] }>;
  blockKeywords(options: { keywords: string[] }): Promise<void>;
  getBlockedKeywords(): Promise<{ keywords: string[] }>;
  getInstalledApps(options?: { icons?: boolean }): Promise<{ apps: InstalledApp[] }>;
  getBlockStats(): Promise<{ blockedAttemptsToday: number }>;

  // ৩. মোড ম্যানেজমেন্ট
  activateFocusMode(): Promise<void>;
  activateSleepMode(): Promise<void>;
  activateStrictMode(): Promise<void>;
  deactivateMode(): Promise<void>;
  getCurrentMode(): Promise<{ mode: string; strict: boolean }>;

  // ৪. স্ট্যাটাস ও অ্যানালিটিক্স
  getScreenTimeStats(): Promise<{
    totalMinutes: number;
    totalLaunches: number;
    apps: Array<{
      packageName: string;
      appName: string;
      usageMinutes: number;
      launchCount: number;
      lastUsed: number;
    }>;
    error?: string;
  }>;

  // ৫. পারমিশন হ্যান্ডলিং
  checkPermissions(): Promise<{
    accessibility: boolean;
    usageStats: boolean;
    overlay: boolean;
    battery: boolean;
    deviceAdmin: boolean;
  }>;
  requestAccessibility(): Promise<void>;
  requestUsageStats(): Promise<void>;
  requestOverlay(): Promise<void>;
  requestBattery(): Promise<void>;
  // ✅ NEW: Device Admin request
  requestDeviceAdmin(): Promise<void>;

  // 🛡️ অ্যাডভান্সড প্রোটেকশন
  toggleAdultFilter(options: { enable: boolean }): Promise<void>;
  updateHardcoreSettings(options: { key: string; value: boolean }): Promise<void>;
  setEscalationBase(options: { minutes: number }): Promise<{ success: boolean }>;
  requestUninstall(): Promise<void>;
  getDailyHistory(): Promise<{ history: any }>;
  clearHistory(): Promise<{ success: boolean }>;
  updateNotificationSettings(options: { key: string; value: boolean }): Promise<void>;

  // ✅ NEW: Adult Filter Screen style save
  updateAdultFilterScreen(options: {
    style: string;
    customMessage: string;
  }): Promise<{ success: boolean }>;
  getAdultFilterScreen(): Promise<{ style: string; customMessage: string }>;
  // [SHIELD-CARD] Block Screen Style -> native block card
  updateBlockScreenOptions(options: {
    countdown?: boolean;
    theme?: string;
    text?: string;
  }): Promise<{ success: boolean }>;
  getBlockScreenOptions(): Promise<{ countdown: boolean; theme: string; text: string }>;

  // 🔑 Emergency Bypass & Light Orb Timer
  setEmergencyPin(options: { pin: string }): Promise<void>;
  triggerEmergencyBypass(options: { pin: string }): Promise<{ success: boolean }>;
  toggleFloatingTimer(options: { enable: boolean }): Promise<void>;
  updateFloatingTimerStyle(options: {
    opacity?: number;
    size?: number;
    countdown?: boolean;
    showSeconds?: boolean;
    pulse?: boolean;
    x?: number;
    y?: number;
    icon?: string;
    format?: string;
    theme?: string;
  }): Promise<void>;

  // ✨ Focus session (drives the native Light Orb; survives backgrounding)
  startFocusSession(options: { minutes: number }): Promise<FocusSessionState>;
  pauseFocusSession(): Promise<FocusSessionState>;
  resumeFocusSession(): Promise<FocusSessionState>;
  addFocusMinutes(options: { minutes: number }): Promise<FocusSessionState>;
  stopFocusSession(): Promise<FocusSessionState>;
  getFocusSession(): Promise<FocusSessionState>;

  // ⏱️ Daily app limits (enforced natively by ShieldTimerManager)
  setAppLimit(options: { packageName: string; minutes: number }): Promise<{ success: boolean }>;
  getAppLimits(): Promise<{
    limits: Record<string, number>;
    usedMinutes: Record<string, number>;
  }>;

  // 🔒 App Lock
  getAppLockStatus(): Promise<AppLockStatus>;
  setAppLock(options: { enabled: boolean; pin?: string; biometric?: boolean }): Promise<{ success: boolean }>;
  verifyAppLockPin(options: { pin: string }): Promise<{ valid: boolean }>;
  authenticateBiometric(): Promise<{ authenticated: boolean }>;

  // 🌅 Day boundary / notification prefs
  setDayBoundary(options: { startHour?: number; autoReset?: boolean }): Promise<DayBoundary>;
  getDayBoundary(): Promise<DayBoundary>;
  getNotificationSettings(): Promise<{ vibrate: boolean; sound: boolean; lowTimeAlert: boolean }>;

  // 💬 Telegram Guard (offline, accessibility-based)
  getTelegramGuard(): Promise<TelegramGuardSettings>;
  setTelegramGuard(options: Partial<TelegramGuardSettings>): Promise<TelegramGuardSettings>;
}

export interface TelegramGuardSettings {
  enabled: boolean;
  blockChats: boolean;
  blockSearch: boolean;
  blockInviteLinks: boolean;
  blockAllInvites: boolean;
  blockMedia: boolean;
  blockAllMedia: boolean;
}

export const DEFAULT_TELEGRAM_GUARD: TelegramGuardSettings = {
  enabled: true,
  blockChats: true,
  blockSearch: true,
  blockInviteLinks: true,
  blockAllInvites: false,
  blockMedia: true,
  blockAllMedia: false,
};

export interface FocusSessionState {
  active: boolean;
  paused: boolean;
  remainingMs: number;
  orbEnabled: boolean;
}

export interface AppLockStatus {
  enabled: boolean;
  hasPin: boolean;
  biometric: boolean;
  biometricAvailable: boolean;
}

export interface DayBoundary {
  startHour: number;
  autoReset: boolean;
}


const Shield = registerPlugin<ShieldPluginInterface>('Shield');
export default Shield;
