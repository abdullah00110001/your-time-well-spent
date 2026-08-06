import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mylifeosv2.app',
  appName: 'Life OS',
  webDir: 'dist',
  server: {
    cleartext: true,
    androidScheme: 'https',
    allowNavigation: [
      'nxvtoviyldffcqbtgriw.supabase.co',
      '*.supabase.co'
    ]
  },
  plugins: {
    CapacitorHttp: {
      enabled: false,
    },
    SplashScreen: {
      // We hide the native splash manually after auth resolves, so the
      // React splash can take over without a gap.
      LaunchShowDuration: 1500,
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ffffff'
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#1a80d4',
      sound: 'alarm_sound.wav'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true
    }
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
    backgroundColor: '#ffffff',
    buildOptions: {
      keystorePath: undefined,
      keystoreAlias: undefined
    }
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
    scheme: 'Life OS'
  }
};

export default config;
