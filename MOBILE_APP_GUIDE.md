# Life OS - Mobile App Build Guide

## Complete Capacitor Native App Setup

This guide covers building the Life OS mobile app for Android and iOS using Capacitor.

---

## 📋 Prerequisites

### Required Software
- **Node.js** 18+ 
- **Android Studio** (for Android)
- **Xcode 15+** (for iOS, Mac only)
- **Java 17+** (for Android)

### Environment Setup

```bash
# Install Capacitor CLI globally (optional but recommended)
npm install -g @capacitor/cli
```

---

## 🚀 Quick Start

### 1. Clone & Install

```bash
# Clone the repository
git clone <your-repo-url>
cd life-os

# Install dependencies
npm install
```

### 2. Build Web Assets

```bash
npm run build
```

### 3. Add Platforms

```bash
# Add Android
npx cap add android

# Add iOS (Mac only)
npx cap add ios
```

### 4. Sync & Open

```bash
# Sync web assets to native platforms
npx cap sync

# Open in Android Studio
npx cap open android

# Or open in Xcode
npx cap open ios
```

---

## 📱 Android Setup

### Android Manifest Permissions

Add these permissions to `android/app/src/main/AndroidManifest.xml`:

```xml
<manifest>
    <!-- Internet -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    
    <!-- Notifications -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
    
    <!-- Alarms (Rise feature) -->
    <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.USE_EXACT_ALARM" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.USE_FULL_SCREEN_INTENT" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
    
    <!-- Shield feature (App Blocker) -->
    <uses-permission android:name="android.permission.PACKAGE_USAGE_STATS" 
        tools:ignore="ProtectedPermissions" />
    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES"
        tools:ignore="QueryAllPackagesPermission" />
    
    <!-- Camera & Storage -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" 
        android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" 
        android:maxSdkVersion="29" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    
    <application>
        <!-- Boot receiver for alarm persistence -->
        <receiver
            android:name="com.capacitorjs.plugins.localnotifications.LocalNotificationBootReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.QUICKBOOT_POWERON" />
            </intent-filter>
        </receiver>
        
        <!-- Full-screen alarm activity -->
        <activity
            android:name=".AlarmActivity"
            android:showOnLockScreen="true"
            android:turnScreenOn="true"
            android:exported="false" />
    </application>
</manifest>
```

### Build APK

```bash
# Debug build
cd android
./gradlew assembleDebug

# Release build (requires signing)
./gradlew assembleRelease
```

APK location: `android/app/build/outputs/apk/`

### Build AAB (for Play Store)

```bash
cd android
./gradlew bundleRelease
```

---

## 🍎 iOS Setup

### Configure Capabilities

In Xcode, enable these capabilities:
- Push Notifications
- Background Modes (Remote notifications, Background fetch)
- App Groups (for data sharing)

### Info.plist Additions

```xml
<!-- Camera -->
<key>NSCameraUsageDescription</key>
<string>Life OS needs camera access to capture photos for your highlights</string>

<!-- Photo Library -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Life OS needs access to your photos for highlights and profile pictures</string>

<!-- Notifications -->
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
    <string>fetch</string>
</array>
```

### Build for iOS

```bash
# Open in Xcode
npx cap open ios

# Or build via command line
cd ios
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release
```

---

## 🔧 Native Features

### Implemented Plugins

| Feature | Plugin | Status |
|---------|--------|--------|
| Push Notifications | @capacitor/push-notifications | ✅ |
| Local Notifications | @capacitor/local-notifications | ✅ |
| Camera | @capacitor/camera | ✅ |
| File System | @capacitor/filesystem | ✅ |
| Network | @capacitor/network | ✅ |
| Keyboard | @capacitor/keyboard | ✅ |
| Haptics | @capacitor/haptics | ✅ |
| Share | @capacitor/share | ✅ |
| Browser | @capacitor/browser | ✅ |
| Storage | @capacitor/preferences | ✅ |
| Status Bar | @capacitor/status-bar | ✅ |
| Splash Screen | @capacitor/splash-screen | ✅ |
| App | @capacitor/app | ✅ |
| Device | @capacitor/device | ✅ |

### Custom Native Bridges

Located in `src/lib/capacitor/`:

- `nativeAlarm.ts` - Exact alarm scheduling (Rise)
- `nativeShield.ts` - App blocking enforcement (Shield)
- `nativeNotifications.ts` - Push & local notifications
- `nativeCamera.ts` - Camera & gallery access
- `nativeFilesystem.ts` - File operations
- `nativeNetwork.ts` - Network status monitoring
- `nativeKeyboard.ts` - Keyboard management
- `nativeShare.ts` - Native sharing
- `nativeStorage.ts` - Persistent storage
- `nativeHaptics.ts` - Haptic feedback
- `offlineSync.ts` - Offline data synchronization

---

## 📂 Project Structure

```
life-os/
├── android/                  # Android native project
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml
│   │   │   ├── java/
│   │   │   └── res/
│   │   └── build.gradle
│   └── gradle/
├── ios/                      # iOS native project
│   └── App/
├── src/
│   ├── components/
│   │   └── mobile/           # Mobile-specific components
│   ├── hooks/
│   │   ├── useCapacitor.ts   # Main Capacitor hook
│   │   ├── useNativeAlarm.ts
│   │   ├── useNativeShield.ts
│   │   ├── useNativeCamera.ts
│   │   └── ...
│   └── lib/capacitor/        # Native bridges
├── capacitor.config.ts       # Capacitor configuration
└── package.json
```

---

## 🎨 App Icons & Splash Screens

### Android

Place icons in `android/app/src/main/res/`:
- `mipmap-hdpi/` - 72x72
- `mipmap-mdpi/` - 48x48
- `mipmap-xhdpi/` - 96x96
- `mipmap-xxhdpi/` - 144x144
- `mipmap-xxxhdpi/` - 192x192

### iOS

Update `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

### Generate Icons

Use a tool like https://icon.kitchen or:
```bash
npx capacitor-assets generate
```

---

## 🔐 Signing for Release

### Android

1. Create keystore:
```bash
keytool -genkey -v -keystore life-os-release.keystore -alias life-os -keyalg RSA -keysize 2048 -validity 10000
```

2. Add to `android/gradle.properties`:
```properties
LIFE_OS_STORE_FILE=life-os-release.keystore
LIFE_OS_STORE_PASSWORD=your_password
LIFE_OS_KEY_ALIAS=life-os
LIFE_OS_KEY_PASSWORD=your_password
```

3. Update `android/app/build.gradle`:
```gradle
android {
    signingConfigs {
        release {
            storeFile file(LIFE_OS_STORE_FILE)
            storePassword LIFE_OS_STORE_PASSWORD
            keyAlias LIFE_OS_KEY_ALIAS
            keyPassword LIFE_OS_KEY_PASSWORD
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

### iOS

Configure signing in Xcode with your Apple Developer account.

---

## 🧪 Testing

### Run on Device/Emulator

```bash
# Android
npx cap run android

# iOS (Mac only)
npx cap run ios
```

### Live Reload (Development)

The app is configured to connect to the Lovable preview URL for development:

For production, remove the `server.url` setting to use bundled web assets.

---

## 🚀 Deployment

### Google Play Store

1. Build signed AAB
2. Create Play Console listing
3. Upload AAB
4. Configure in-app purchases (if applicable)
5. Submit for review

### Apple App Store

1. Archive in Xcode
2. Upload to App Store Connect
3. Configure app details
4. Submit for review

---

## 🔄 Updates

### Sync Changes

After making web changes:
```bash
npm run build
npx cap sync
```

### Native Updates

For native code changes, rebuild in Android Studio/Xcode.

---

## 📞 Support

For issues specific to this mobile implementation, check:
- [Capacitor Docs](https://capacitorjs.com/docs)
- [Ionic Forum](https://forum.ionicframework.com/)
- Project README.md
