// Native Haptics Bridge for Capacitor
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './platform';

// Light impact - for subtle feedback
export async function lightImpact(): Promise<void> {
  if (!isNative) {
    // Web fallback with vibration API
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    return;
  }
  
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    console.log('[Haptics] Light impact failed:', error);
  }
}

// Medium impact - for standard feedback
export async function mediumImpact(): Promise<void> {
  if (!isNative) {
    if ('vibrate' in navigator) {
      navigator.vibrate(25);
    }
    return;
  }
  
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (error) {
    console.log('[Haptics] Medium impact failed:', error);
  }
}

// Heavy impact - for significant actions
export async function heavyImpact(): Promise<void> {
  if (!isNative) {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    return;
  }
  
  try {
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (error) {
    console.log('[Haptics] Heavy impact failed:', error);
  }
}

// Success notification - for positive outcomes
export async function successNotification(): Promise<void> {
  if (!isNative) {
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 50, 10]);
    }
    return;
  }
  
  try {
    await Haptics.notification({ type: NotificationType.Success });
  } catch (error) {
    console.log('[Haptics] Success notification failed:', error);
  }
}

// Warning notification - for caution states
export async function warningNotification(): Promise<void> {
  if (!isNative) {
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 30, 50]);
    }
    return;
  }
  
  try {
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (error) {
    console.log('[Haptics] Warning notification failed:', error);
  }
}

// Error notification - for failure states
export async function errorNotification(): Promise<void> {
  if (!isNative) {
    if ('vibrate' in navigator) {
      navigator.vibrate([100, 30, 100, 30, 100]);
    }
    return;
  }
  
  try {
    await Haptics.notification({ type: NotificationType.Error });
  } catch (error) {
    console.log('[Haptics] Error notification failed:', error);
  }
}

// Selection change - for scroll/picker
export async function selectionChanged(): Promise<void> {
  if (!isNative) {
    if ('vibrate' in navigator) {
      navigator.vibrate(5);
    }
    return;
  }
  
  try {
    await Haptics.selectionChanged();
  } catch (error) {
    console.log('[Haptics] Selection changed failed:', error);
  }
}

// Selection start - begin selection feedback
export async function selectionStart(): Promise<void> {
  if (!isNative) return;
  
  try {
    await Haptics.selectionStart();
  } catch (error) {
    console.log('[Haptics] Selection start failed:', error);
  }
}

// Selection end - end selection feedback
export async function selectionEnd(): Promise<void> {
  if (!isNative) return;
  
  try {
    await Haptics.selectionEnd();
  } catch (error) {
    console.log('[Haptics] Selection end failed:', error);
  }
}

// Custom vibration pattern
export async function customVibration(duration: number): Promise<void> {
  if (!isNative) {
    if ('vibrate' in navigator) {
      navigator.vibrate(duration);
    }
    return;
  }
  
  try {
    await Haptics.vibrate({ duration });
  } catch (error) {
    console.log('[Haptics] Custom vibration failed:', error);
  }
}

// Haptic patterns for specific app actions
export const HapticPatterns = {
  // Button taps
  buttonTap: lightImpact,
  primaryButtonTap: mediumImpact,
  
  // Toggle switches
  toggleOn: () => successNotification(),
  toggleOff: () => lightImpact(),
  
  // List interactions
  listItemTap: lightImpact,
  listItemLongPress: mediumImpact,
  
  // Swipe actions
  swipeAction: mediumImpact,
  swipeComplete: successNotification,
  
  // Navigation
  pageChange: selectionChanged,
  tabChange: lightImpact,
  
  // Forms
  inputFocus: selectionChanged,
  formSubmit: successNotification,
  formError: errorNotification,
  
  // Achievements/rewards
  achievement: () => customVibration(300),
  levelUp: () => successNotification(),
  streakMilestone: () => successNotification(),
  
  // Alarms
  alarmDismiss: heavyImpact,
  alarmSnooze: mediumImpact,
  
  // Shield
  shieldActivate: heavyImpact,
  shieldDeactivate: mediumImpact,
  shieldBlock: warningNotification,
  
  // Timers
  timerComplete: successNotification,
  timerWarning: warningNotification,
  
  // Pull to refresh
  pullRefreshStart: selectionStart,
  pullRefreshTrigger: mediumImpact,
  pullRefreshEnd: selectionEnd,
  
  // Deletion
  deleteWarning: warningNotification,
  deleteConfirm: heavyImpact,
};

// Convenience method for common feedback
export const Feedback = {
  tap: lightImpact,
  press: mediumImpact,
  success: successNotification,
  warning: warningNotification,
  error: errorNotification,
  select: selectionChanged,
};
