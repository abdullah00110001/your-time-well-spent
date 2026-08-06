// Native Keyboard Bridge for Capacitor
import { Keyboard, KeyboardInfo, KeyboardStyle, KeyboardResize } from '@capacitor/keyboard';
import { isNative, isIOS, isAndroid } from './platform';

let keyboardListenerHandles: any[] = [];

// Show keyboard
export async function showKeyboard(): Promise<void> {
  if (!isNative) return;
  
  try {
    await Keyboard.show();
  } catch (error) {
    console.error('[Keyboard] Show failed:', error);
  }
}

// Hide keyboard
export async function hideKeyboard(): Promise<void> {
  if (!isNative) return;
  
  try {
    await Keyboard.hide();
  } catch (error) {
    console.error('[Keyboard] Hide failed:', error);
  }
}

// Set keyboard style (iOS only)
export async function setKeyboardStyle(style: 'dark' | 'light' | 'default'): Promise<void> {
  if (!isNative || !isIOS) return;
  
  try {
    const keyboardStyle = style === 'dark' ? KeyboardStyle.Dark : 
                         style === 'light' ? KeyboardStyle.Light : 
                         KeyboardStyle.Default;
    await Keyboard.setStyle({ style: keyboardStyle });
  } catch (error) {
    console.error('[Keyboard] Set style failed:', error);
  }
}

// Set keyboard resize mode (iOS only)
export async function setKeyboardResizeMode(mode: 'body' | 'ionic' | 'native' | 'none'): Promise<void> {
  if (!isNative || !isIOS) return;
  
  try {
    const resizeMode = mode === 'body' ? KeyboardResize.Body :
                      mode === 'ionic' ? KeyboardResize.Ionic :
                      mode === 'native' ? KeyboardResize.Native :
                      KeyboardResize.None;
    await Keyboard.setResizeMode({ mode: resizeMode });
  } catch (error) {
    console.error('[Keyboard] Set resize mode failed:', error);
  }
}

// Set accessory bar visibility (iOS only)
export async function setAccessoryBarVisible(visible: boolean): Promise<void> {
  if (!isNative || !isIOS) return;
  
  try {
    await Keyboard.setAccessoryBarVisible({ isVisible: visible });
  } catch (error) {
    console.error('[Keyboard] Set accessory bar visible failed:', error);
  }
}

// Enable scroll (iOS only)
export async function setScrollEnabled(enabled: boolean): Promise<void> {
  if (!isNative || !isIOS) return;
  
  try {
    await Keyboard.setScroll({ isDisabled: !enabled });
  } catch (error) {
    console.error('[Keyboard] Set scroll enabled failed:', error);
  }
}

// Setup keyboard listeners
export function setupKeyboardListeners(callbacks: {
  onShow?: (info: KeyboardInfo) => void;
  onHide?: () => void;
  onWillShow?: (info: KeyboardInfo) => void;
  onWillHide?: () => void;
}): void {
  if (!isNative) return;
  
  if (callbacks.onShow) {
    const handle = Keyboard.addListener('keyboardDidShow', (info: KeyboardInfo) => {
      callbacks.onShow?.(info);
    });
    keyboardListenerHandles.push(handle);
  }
  
  if (callbacks.onHide) {
    const handle = Keyboard.addListener('keyboardDidHide', () => {
      callbacks.onHide?.();
    });
    keyboardListenerHandles.push(handle);
  }
  
  if (callbacks.onWillShow) {
    const handle = Keyboard.addListener('keyboardWillShow', (info: KeyboardInfo) => {
      callbacks.onWillShow?.(info);
    });
    keyboardListenerHandles.push(handle);
  }
  
  if (callbacks.onWillHide) {
    const handle = Keyboard.addListener('keyboardWillHide', () => {
      callbacks.onWillHide?.();
    });
    keyboardListenerHandles.push(handle);
  }
}

// Remove keyboard listeners
export function removeKeyboardListeners(): void {
  keyboardListenerHandles.forEach(handle => {
    if (handle && handle.remove) {
      handle.remove();
    }
  });
  keyboardListenerHandles = [];
}

// Initialize keyboard for optimal mobile experience
export async function initializeKeyboard(): Promise<void> {
  if (!isNative) return;
  
  try {
    if (isIOS) {
      // iOS-specific settings for better UX
      await setAccessoryBarVisible(true);
      await setScrollEnabled(true);
      await setKeyboardResizeMode('body');
    }
    
    console.log('[Keyboard] Initialized');
  } catch (error) {
    console.error('[Keyboard] Initialize failed:', error);
  }
}

// Utility: Focus input and show keyboard
export function focusWithKeyboard(element: HTMLInputElement | HTMLTextAreaElement): void {
  element.focus();
  if (isNative) {
    showKeyboard();
  }
}

// Utility: Blur input and hide keyboard
export function blurWithKeyboard(element: HTMLInputElement | HTMLTextAreaElement): void {
  element.blur();
  if (isNative) {
    hideKeyboard();
  }
}
