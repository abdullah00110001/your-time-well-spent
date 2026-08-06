import { useCallback } from 'react';
import {
  lightImpact,
  mediumImpact,
  heavyImpact,
  successNotification,
  warningNotification,
  errorNotification,
  selectionChanged,
  HapticPatterns,
  Feedback
} from '@/lib/capacitor/nativeHaptics';
import { isNative } from '@/lib/capacitor/platform';

export function useNativeHaptics() {
  // Core feedback
  const tap = useCallback(() => {
    if (isNative) lightImpact();
  }, []);

  const press = useCallback(() => {
    if (isNative) mediumImpact();
  }, []);

  const heavy = useCallback(() => {
    if (isNative) heavyImpact();
  }, []);

  // Notification feedback
  const success = useCallback(() => {
    if (isNative) successNotification();
  }, []);

  const warning = useCallback(() => {
    if (isNative) warningNotification();
  }, []);

  const error = useCallback(() => {
    if (isNative) errorNotification();
  }, []);

  // Selection feedback
  const select = useCallback(() => {
    if (isNative) selectionChanged();
  }, []);

  // Button handlers with haptics
  const withHaptics = useCallback(<T extends (...args: any[]) => any>(
    handler: T,
    hapticFn: () => void = tap
  ) => {
    return ((...args: Parameters<T>) => {
      hapticFn();
      return handler(...args);
    }) as T;
  }, [tap]);

  // Specific action handlers
  const onButtonTap = useCallback((handler: () => void) => {
    return () => {
      tap();
      handler();
    };
  }, [tap]);

  const onToggle = useCallback((isOn: boolean, handler: (value: boolean) => void) => {
    return (value: boolean) => {
      if (value) {
        HapticPatterns.toggleOn();
      } else {
        HapticPatterns.toggleOff();
      }
      handler(value);
    };
  }, []);

  const onSwipe = useCallback((handler: () => void) => {
    return () => {
      HapticPatterns.swipeAction();
      handler();
    };
  }, []);

  const onDelete = useCallback((handler: () => void) => {
    return () => {
      HapticPatterns.deleteConfirm();
      handler();
    };
  }, []);

  return {
    // Core feedback
    tap,
    press,
    heavy,
    success,
    warning,
    error,
    select,
    
    // Helpers
    withHaptics,
    onButtonTap,
    onToggle,
    onSwipe,
    onDelete,
    
    // Direct access to patterns
    patterns: HapticPatterns,
    feedback: Feedback,
    
    // Platform check
    isNative,
  };
}
