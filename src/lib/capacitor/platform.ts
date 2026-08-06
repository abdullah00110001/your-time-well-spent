import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Device, DeviceInfo } from '@capacitor/device';

// Platform detection
export const isNative = Capacitor.isNativePlatform();
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isIOS = Capacitor.getPlatform() === 'ios';
export const isWeb = Capacitor.getPlatform() === 'web';

// Get platform name
export const getPlatform = (): 'android' | 'ios' | 'web' => {
  return Capacitor.getPlatform() as 'android' | 'ios' | 'web';
};

// Device info cache
let cachedDeviceInfo: DeviceInfo | null = null;

// Device info
export const getDeviceInfo = async (): Promise<DeviceInfo | null> => {
  if (cachedDeviceInfo) return cachedDeviceInfo;
  
  try {
    cachedDeviceInfo = await Device.getInfo();
    return cachedDeviceInfo;
  } catch {
    return null;
  }
};

// Get device ID (unique identifier)
export const getDeviceId = async (): Promise<string | null> => {
  try {
    const { identifier } = await Device.getId();
    return identifier;
  } catch {
    return null;
  }
};

// Check if device has notch/safe area
export const hasSafeArea = async (): Promise<boolean> => {
  const info = await getDeviceInfo();
  if (!info) return false;
  
  // Common notch devices
  const notchModels = ['iPhone X', 'iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 14', 'iPhone 15'];
  return notchModels.some(model => info.model?.includes(model));
};

// Initialize Capacitor app
export const initializeCapacitor = async (
  onBackButton?: () => boolean,
  onDeepLink?: (url: string) => void
) => {
  if (!isNative) return;

  try {
    // Hide splash screen after app is ready
    await SplashScreen.hide({ fadeOutDuration: 500 });

    // Configure status bar for Android
    if (isAndroid) {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#0f172a' });
      await StatusBar.setOverlaysWebView({ overlay: false });
    }

    // Configure status bar for iOS
    if (isIOS) {
      await StatusBar.setStyle({ style: Style.Dark });
    }

    // Handle Android back button
    App.addListener('backButton', ({ canGoBack }) => {
      // Route-level suppression: Rise & Shield own their own back behavior
      // (Rise flashes the header red; Shield is a lock screen). Never auto-navigate
      // or exit from these routes — let their components handle the event.
      try {
        const path = window.location.pathname || '';
        if (path.startsWith('/rise') || path.startsWith('/shield')) {
          return;
        }
      } catch {}

      // Allow custom handler to prevent default
      if (onBackButton && onBackButton()) {
        return;
      }
      
      // Check if any dialogs are open
      const dialogs = document.querySelectorAll('[role="dialog"][data-state="open"]');
      if (dialogs.length > 0) {
        // Close the topmost dialog
        const closeButton = dialogs[dialogs.length - 1].querySelector('[aria-label="Close"]');
        if (closeButton) {
          (closeButton as HTMLElement).click();
          return;
        }
      }
      
      // Check if drawer/sheet is open
      const drawers = document.querySelectorAll('[data-vaul-drawer][data-state="open"]');
      if (drawers.length > 0) {
        document.body.click(); // Close drawer
        return;
      }
      
      // Default behavior: go back or exit
      if (canGoBack) {
        window.history.back();
      } else {
        App.exitApp();
      }
    });

    // Handle app state changes
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        console.log('[Capacitor] App became active');
        // Trigger any sync or refresh logic
        window.dispatchEvent(new CustomEvent('app:resume'));
      } else {
        console.log('[Capacitor] App went to background');
        // Save any pending data
        window.dispatchEvent(new CustomEvent('app:pause'));
      }
    });

    // Handle deep links
    App.addListener('appUrlOpen', ({ url }) => {
      console.log('[Capacitor] Deep link:', url);
      
      if (onDeepLink) {
        onDeepLink(url);
        return;
      }
      
      // Handle Supabase auth redirects
      if (url.includes('auth/callback')) {
        window.location.href = url;
        return;
      }
      
      // Handle app routes
      try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        if (path && path !== '/') {
          window.location.href = path;
        }
      } catch {
        console.log('[Capacitor] Invalid deep link URL');
      }
    });

    console.log('[Capacitor] Initialized successfully');
  } catch (error) {
    console.error('[Capacitor] Initialization error:', error);
  }
};

// App lifecycle utilities
export const exitApp = () => {
  if (isNative) {
    App.exitApp();
  }
};

export const minimizeApp = () => {
  if (isNative) {
    App.minimizeApp();
  }
};

// Get app info
export const getAppInfo = async () => {
  if (!isNative) return null;
  
  try {
    return await App.getInfo();
  } catch {
    return null;
  }
};

// Check if app can be launched via URL
export const canOpenUrl = async (url: string): Promise<boolean> => {
  // Would need custom plugin for this
  return true;
};

// Open external URL
export const openUrl = async (url: string): Promise<void> => {
  if (isNative) {
    // Use Capacitor Browser plugin in production
    window.open(url, '_blank');
  } else {
    window.open(url, '_blank');
  }
};

// Show splash screen (useful for reload scenarios)
export const showSplash = async () => {
  if (isNative) {
    await SplashScreen.show({
      autoHide: false,
      fadeInDuration: 300
    });
  }
};

export const hideSplash = async () => {
  if (isNative) {
    await SplashScreen.hide({ fadeOutDuration: 500 });
  }
};

// Status bar utilities
export const setStatusBarColor = async (color: string) => {
  if (isAndroid) {
    await StatusBar.setBackgroundColor({ color });
  }
};

export const setStatusBarStyle = async (style: 'light' | 'dark') => {
  if (isNative) {
    await StatusBar.setStyle({ style: style === 'light' ? Style.Light : Style.Dark });
  }
};

export const hideStatusBar = async () => {
  if (isNative) {
    await StatusBar.hide();
  }
};

export const showStatusBar = async () => {
  if (isNative) {
    await StatusBar.show();
  }
};
