import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { isNative, isAndroid } from './platform';
import { supabase } from '@/integrations/supabase/client';

export interface ShieldSession {
  id: string;
  profileId: string;
  profileName: string;
  strictnessLevel: 'normal' | 'hard' | 'absolute';
  startedAt: Date;
  scheduledEndAt: Date;
  blockedApps: string[];
  blockedWebsites: string[];
  blockedKeywords: string[];
  blockInfiniteContent: boolean;
  blockAdultContent: boolean;
}

export interface UsageStats {
  packageName: string;
  appName: string;
  totalTimeMs: number;
  lastUsed: Date;
  launchCount: number;
}

export interface BypassAttempt {
  sessionId: string;
  attemptType: 'app_switch' | 'notification_dismiss' | 'settings_access' | 'uninstall_attempt' | 'website_access';
  details?: Record<string, any>;
  timestamp: string;
  wasBlocked: boolean;
}

// Session state
let activeSession: ShieldSession | null = null;
const sessionNotificationId = 99999;

// Bypass attempt counter for discipline score
let bypassAttemptCount = 0;

// Start a Shield focus session
export const startShieldSession = async (
  session: ShieldSession,
  userId?: string
): Promise<boolean> => {
  try {
    activeSession = session;
    bypassAttemptCount = 0;
    
    // Calculate duration string
    const durationMs = session.scheduledEndAt.getTime() - session.startedAt.getTime();
    const durationMins = Math.round(durationMs / 60000);
    const durationStr = durationMins >= 60 
      ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
      : `${durationMins}m`;
    
    // Show persistent notification for session
    await LocalNotifications.schedule({
      notifications: [{
        id: sessionNotificationId,
        title: `🛡️ Shield Active: ${session.profileName}`,
        body: `${session.strictnessLevel.toUpperCase()} mode • ${durationStr} remaining`,
        ongoing: true,
        autoCancel: false,
        channelId: 'shield_sessions',
        extra: {
          type: 'shield_session',
          sessionId: session.id,
          strictnessLevel: session.strictnessLevel,
          profileId: session.profileId
        },
        actionTypeId: 'shield_actions'
      }]
    });

    // Haptic feedback for session start
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Success });
    }

    console.log('[NativeShield] Session started:', session.id, 'until', session.scheduledEndAt.toLocaleString());
    
    // Dispatch event for web layer
    window.dispatchEvent(new CustomEvent('shield:sessionStarted', { detail: session }));
    
    // Log to database
    if (userId) {
      try {
        await supabase.from('shield_sessions').insert({
          user_id: userId,
          profile_id: session.profileId,
          profile_name: session.profileName,
          strictness_level: session.strictnessLevel,
          started_at: session.startedAt.toISOString(),
          scheduled_end_at: session.scheduledEndAt.toISOString(),
          status: 'active'
        });
      } catch (dbError) {
        console.error('[NativeShield] Failed to log to database:', dbError);
      }
    }
    
    return true;
  } catch (error) {
    console.error('[NativeShield] Failed to start session:', error);
    return false;
  }
};

// End a Shield session
export const endShieldSession = async (
  reason?: string,
  userId?: string
): Promise<boolean> => {
  try {
    if (!activeSession) return false;
    
    const sessionId = activeSession.id;
    
    // Cancel persistent notification
    await LocalNotifications.cancel({ notifications: [{ id: sessionNotificationId }] });
    
    // Calculate stats
    const sessionDuration = Date.now() - activeSession.startedAt.getTime();
    const minutesSaved = Math.round(sessionDuration / 60000);
    
    // Show completion notification
    await LocalNotifications.schedule({
      notifications: [{
        id: sessionNotificationId + 1,
        title: '🛡️ Shield Session Complete!',
        body: reason || `Great job! You saved ${minutesSaved} minutes of focused time.`,
        channelId: 'shield_sessions'
      }]
    });

    // Update database
    if (userId) {
      try {
        await supabase
          .from('shield_sessions')
          .update({
            status: 'completed',
            actual_end_at: new Date().toISOString(),
            bypass_attempts: bypassAttemptCount
          })
          .eq('id', sessionId);
        
        // Update discipline score
        const { data: currentScore } = await supabase
          .from('discipline_scores')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (currentScore) {
          await supabase
            .from('discipline_scores')
            .update({
              total_focus_minutes: (currentScore.total_focus_minutes || 0) + minutesSaved,
              total_time_saved_minutes: (currentScore.total_time_saved_minutes || 0) + minutesSaved,
              current_score: Math.min(100, (currentScore.current_score || 50) + 5),
              bypass_penalty: (currentScore.bypass_penalty || 0) + bypassAttemptCount
            })
            .eq('user_id', userId);
        }
      } catch (dbError) {
        console.error('[NativeShield] Failed to update database:', dbError);
      }
    }

    activeSession = null;
    bypassAttemptCount = 0;

    // Haptic feedback
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Success });
    }

    console.log('[NativeShield] Session ended:', sessionId, reason);
    
    // Dispatch event for web layer
    window.dispatchEvent(new CustomEvent('shield:sessionEnded', { detail: { sessionId, reason } }));
    
    return true;
  } catch (error) {
    console.error('[NativeShield] Failed to end session:', error);
    return false;
  }
};

// Extend session duration
export const extendSession = async (additionalMinutes: number): Promise<boolean> => {
  if (!activeSession) return false;
  
  try {
    const newEndTime = new Date(activeSession.scheduledEndAt.getTime() + additionalMinutes * 60000);
    activeSession.scheduledEndAt = newEndTime;
    
    // Update notification
    await LocalNotifications.cancel({ notifications: [{ id: sessionNotificationId }] });
    await LocalNotifications.schedule({
      notifications: [{
        id: sessionNotificationId,
        title: `🛡️ Shield Extended: ${activeSession.profileName}`,
        body: `Session extended by ${additionalMinutes} minutes`,
        ongoing: true,
        autoCancel: false,
        channelId: 'shield_sessions',
        extra: {
          type: 'shield_session',
          sessionId: activeSession.id,
          strictnessLevel: activeSession.strictnessLevel
        }
      }]
    });
    
    // Haptic feedback
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Success });
    }
    
    window.dispatchEvent(new CustomEvent('shield:sessionExtended', { 
      detail: { sessionId: activeSession.id, newEndTime } 
    }));
    
    return true;
  } catch (error) {
    console.error('[NativeShield] Failed to extend session:', error);
    return false;
  }
};

// Log bypass attempt (for discipline score)
export const logBypassAttempt = async (
  attemptType: BypassAttempt['attemptType'],
  wasBlocked: boolean,
  details?: Record<string, any>,
  userId?: string
): Promise<void> => {
  if (!activeSession) return;

  bypassAttemptCount++;
  console.log('[NativeShield] Bypass attempt:', attemptType, details);
  
  // Warning haptic
  if (isNative) {
    await Haptics.notification({ type: NotificationType.Warning });
  }

  // Log to database
  if (userId) {
    try {
      await supabase.from('shield_bypass_logs').insert({
        user_id: userId,
        session_id: activeSession.id,
        attempt_type: attemptType,
        was_blocked: wasBlocked,
        details: details || {}
      });
    } catch (dbError) {
      console.error('[NativeShield] Failed to log bypass attempt:', dbError);
    }
  }

  // Dispatch event for web layer
  window.dispatchEvent(new CustomEvent('shield:bypassAttempt', {
    detail: {
      sessionId: activeSession.id,
      attemptType,
      details,
      timestamp: new Date().toISOString(),
      wasBlocked,
      totalAttempts: bypassAttemptCount
    }
  }));
};

// Check if an app should be blocked
export const shouldBlockApp = (packageName: string): boolean => {
  if (!activeSession) return false;
  
  const lowerPackage = packageName.toLowerCase();
  
  // Check blocked apps list
  const isBlocked = activeSession.blockedApps.some(app => 
    lowerPackage.includes(app.toLowerCase())
  );
  
  // Check for infinite content apps if enabled
  if (activeSession.blockInfiniteContent) {
    const infiniteContentApps = [
      'instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'snapchat',
      'reddit', 'pinterest', 'tumblr', 'vine', 'musically'
    ];
    if (infiniteContentApps.some(app => lowerPackage.includes(app))) {
      return true;
    }
  }
  
  return isBlocked;
};

// Check if a website should be blocked
export const shouldBlockWebsite = (url: string): boolean => {
  if (!activeSession) return false;
  
  const hostname = extractHostname(url).toLowerCase();
  
  // Check blocked websites list
  const isBlocked = activeSession.blockedWebsites.some(site => {
    const cleanSite = site.replace(/^\*\.?/, '').toLowerCase();
    return hostname.includes(cleanSite);
  });
  
  if (isBlocked) return true;
  
  // Check blocked keywords in URL
  const urlLower = url.toLowerCase();
  const hasBlockedKeyword = activeSession.blockedKeywords.some(keyword =>
    urlLower.includes(keyword.toLowerCase())
  );
  
  if (hasBlockedKeyword) return true;
  
  // Check for infinite content
  if (activeSession.blockInfiniteContent) {
    const infinitePatterns = [
      'shorts', 'reels', 'stories', 'explore', 'fyp', 'foryou', 'trending'
    ];
    if (infinitePatterns.some(pattern => urlLower.includes(pattern))) {
      return true;
    }
  }
  
  // Check for adult content
  if (activeSession.blockAdultContent) {
    // This would integrate with a content filter service in production
    // For now, check common adult keywords
    const adultKeywords = ['adult', 'xxx', 'porn', 'nsfw'];
    if (adultKeywords.some(keyword => urlLower.includes(keyword))) {
      return true;
    }
  }
  
  return false;
};

// Get active session
export const getActiveSession = (): ShieldSession | null => activeSession;

// Check if a session is currently active
export const isSessionActive = (): boolean => {
  if (!activeSession) return false;
  return new Date() < activeSession.scheduledEndAt;
};

// Check session time remaining
export const getSessionTimeRemaining = (): number | null => {
  if (!activeSession) return null;
  
  const now = new Date().getTime();
  const end = activeSession.scheduledEndAt.getTime();
  const remaining = end - now;
  
  return remaining > 0 ? remaining : 0;
};

// Emergency bypass (requires confirmation for hard/absolute modes)
export const requestEmergencyBypass = async (
  confirmationCallback: () => Promise<boolean>,
  userId?: string
): Promise<boolean> => {
  if (!activeSession) return false;
  
  if (activeSession.strictnessLevel === 'absolute') {
    // Absolute mode: No bypass allowed
    console.log('[NativeShield] Emergency bypass denied - Absolute mode');
    
    if (isNative) {
      await Haptics.notification({ type: NotificationType.Error });
    }
    
    await logBypassAttempt('settings_access', false, { type: 'emergency_bypass_denied' }, userId);
    return false;
  }
  
  if (activeSession.strictnessLevel === 'hard') {
    // Hard mode: Requires confirmation + penalty
    const confirmed = await confirmationCallback();
    if (!confirmed) {
      await logBypassAttempt('settings_access', false, { type: 'emergency_bypass_cancelled' }, userId);
      return false;
    }
    
    // Apply significant discipline score penalty
    if (userId) {
      try {
        const { data: currentScore } = await supabase
          .from('discipline_scores')
          .select('*')
          .eq('user_id', userId)
          .single();
        
        if (currentScore) {
          await supabase
            .from('discipline_scores')
            .update({
              current_score: Math.max(0, (currentScore.current_score || 50) - 15),
              unlock_penalty: (currentScore.unlock_penalty || 0) + 1,
              current_streak_days: 0 // Reset streak
            })
            .eq('user_id', userId);
        }
      } catch (dbError) {
        console.error('[NativeShield] Failed to apply bypass penalty:', dbError);
      }
    }
    
    await logBypassAttempt('settings_access', true, { type: 'emergency_bypass_used' }, userId);
  }
  
  // End the session
  return await endShieldSession('Emergency bypass used', userId);
};

// Initialize Shield notification channel (Android)
export const initializeShieldChannel = async () => {
  if (!isAndroid) return;
  
  try {
    await LocalNotifications.createChannel({
      id: 'shield_sessions',
      name: 'Shield Focus Sessions',
      description: 'Active focus session status and updates',
      importance: 4, // High - shows in notification bar
      visibility: 1, // Public
      vibration: false,
      lights: true,
      lightColor: '#22c55e' // Green for focus
    });
    
    // Create blocking alerts channel
    await LocalNotifications.createChannel({
      id: 'shield_blocks',
      name: 'Shield Blocking Alerts',
      description: 'Alerts when Shield blocks distracting content',
      importance: 3, // Default
      visibility: 1,
      vibration: true
    });
    
    // Register action types
    await LocalNotifications.registerActionTypes({
      types: [{
        id: 'shield_actions',
        actions: [
          {
            id: 'view_session',
            title: 'View Session',
            foreground: true
          },
          {
            id: 'extend_session',
            title: 'Extend +15min',
            foreground: false
          }
        ]
      }]
    });
    
    console.log('[NativeShield] Channels created');
  } catch (error) {
    console.error('[NativeShield] Channel creation failed:', error);
  }
};

// Listen for Shield notification actions
export const setupShieldListeners = (
  onViewSession: () => void,
  onExtendSession: () => void
) => {
  LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    if (action.notification.extra?.type === 'shield_session') {
      switch (action.actionId) {
        case 'view_session':
          onViewSession();
          break;
        case 'extend_session':
          extendSession(15);
          onExtendSession();
          break;
      }
    }
  });
};

// Show blocking notification when app/site is blocked
export const showBlockNotification = async (
  blockedItem: string,
  itemType: 'app' | 'website'
): Promise<void> => {
  if (!activeSession) return;
  
  const message = itemType === 'app'
    ? `${blockedItem} is blocked during ${activeSession.profileName}`
    : `This website is blocked during ${activeSession.profileName}`;
  
  await LocalNotifications.schedule({
    notifications: [{
      id: Date.now(),
      title: '🛡️ Shield Blocked',
      body: message,
      channelId: 'shield_blocks',
      autoCancel: true,
      extra: {
        type: 'shield_block',
        blockedItem,
        itemType,
        sessionId: activeSession.id
      }
    }]
  });
};

// Utility functions
const extractHostname = (url: string): string => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

// Get mock usage stats (would need native plugin for real data)
export const getUsageStats = async (days: number = 7): Promise<UsageStats[]> => {
  // This would require a custom Capacitor plugin to access UsageStatsManager
  console.log('[NativeShield] Usage stats requested for', days, 'days');
  return [];
};
