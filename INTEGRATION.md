# Sleep to Rise — integration steps (v2, matches real JS contract)

## 1. AndroidManifest.xml
Add inside `<application>` (same as before — skip if already added):

```xml
<service
    android:name=".rise.nighttorise.NightToRiseAccessibilityService"
    android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
    android:exported="true">
    <intent-filter>
        <action android:name="android.accessibilityservice.AccessibilityService" />
    </intent-filter>
    <meta-data
        android:name="android.accessibilityservice"
        android:resource="@xml/night_to_rise_accessibility_config" />
</service>

<activity
    android:name=".rise.nighttorise.NightToRiseBlockActivity"
    android:exported="false"
    android:launchMode="singleTask"
    android:excludeFromRecents="true"
    android:theme="@style/Theme.AppCompat.NoActionBar" />

<receiver
    android:name=".rise.nighttorise.NightToRisePhaseReceiver"
    android:exported="false" />
```

## 2. Accessibility service config
`android/app/src/main/res/xml/night_to_rise_accessibility_config.xml`:

```xml
<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:notificationTimeout="100"
    android:canRetrieveWindowContent="false"
    android:description="@string/night_to_rise_accessibility_description" />
```

## 3. Register the plugin
`MainActivity.java`:
```java
registerPlugin(com.mylifeos.app.plugins.NightToRisePlugin.class);
```
(Your last grep found this missing — the plugin is inert until this line is added.)

## 4. Confirmed decisions this build is based on
- Rise Guard duration: user-configurable (`riseLockMinutesAfter`, already in your `NightToRiseConfig`/UI slider) — not hardcoded.
- Blocklist: Sleep Guard and Rise Guard share the same `blockedApps` / `allowedApps` / `blocklistMode`.
- Rise Guard **starts on alarm dismissal**, not at the scheduled alarm clock time — hooked directly into `AlarmStateManager.clearRinging()`. A snooze delays it; an early manual stop starts it early. Sleep Guard's own end time is still the scheduled rise-alarm epoch (matches `useNightToRise.ts`'s existing clock-based math), so there's a small gap between "alarm firing" and "alarm dismissed" where nothing is locked — intentional, so the ringing alarm's own screen isn't blocked.

## 5. Open item — permissions UI accuracy
`NightToRisePermissions.tsx` checks accessibility status via the existing
`Shield` plugin (`Shield.checkPermissions().accessibility`), which most
likely reports on `ShieldAccessibilityService`, not the new standalone
`NightToRiseAccessibilityService`. Until this is wired up, that row can
show "granted" while Sleep to Rise's own service is actually off (or vice
versa). Two ways to fix — tell me which and I'll do it:
- **(a)** Send `ShieldPlugin.java` and I'll extend `checkPermissions()` to
  also check `NightToRiseAccessibilityService`.
- **(b)** Wire the UI to the new `NightToRise.isAccessibilityEnabled()`
  method (already added to `NightToRisePlugin.java`) instead — needs a
  small addition to `nightToRiseBridge.ts` + the permissions row.

## 6. Known limitations
- Native block screen's "Emergency unlock" does **not** check the PIN
  (`app_lock_pin` lives in web `localStorage`, unreachable from native).
  It does honor the strict-mode 10-minute cooldown.
- Native can't show the live streak count on the block screen — the
  streak lives in a separate localStorage key never pushed to native.
  `showStreakOnBlock` is read but currently has no number to show; the
  streak pill is left out of the native screen.
- Not compiled/tested against your actual Gradle project.

