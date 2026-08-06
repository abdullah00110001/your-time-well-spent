#!/bin/bash
OUT="sleep_to_rise_files.txt"
> "$OUT"

FILES=(
  # Phase 1 - Night to Rise core (Android native)
  "android/app/src/main/java/com/mylifeos/app/nighttorise/NightToRiseManager.java"
  "android/app/src/main/java/com/mylifeos/app/nighttorise/NightToRisePlugin.java"
  "android/app/src/main/java/com/mylifeos/app/nighttorise/NightToRiseBlockActivity.java"
  "android/app/src/main/java/com/mylifeos/app/nighttorise/NightToRisePreferences.java"
  "android/app/src/main/res/layout/activity_night_to_rise_block.xml"

  # Phase 1 - React/TS UI
  "src/components/rise/night-to-rise/NightToRiseCard.tsx"
  "src/components/rise/night-to-rise/NightToRiseGuard.tsx"
  "src/components/rise/night-to-rise/NightToRisePage.tsx"
  "src/components/rise/night-to-rise/types.ts"
  "src/components/rise/night-to-rise/useNightToRise.ts"
  "src/components/rise/night-to-rise/useNightToRiseStreak.ts"
  "src/pages/NightToRise.tsx"

  # Phase 1 - Bridge
  "src/lib/capacitor/nightToRiseBridge.ts"
  "src/lib/capacitor/riseAlarmBridge.ts"
  "src/lib/capacitor/nativeAlarm.ts"

  # Phase 2 - Rise Alarm
  "android/app/src/main/java/com/mylifeos/app/rise/core/AlarmConstants.java"
  "android/app/src/main/java/com/mylifeos/app/rise/state/AlarmSettingsPreferences.java"
  "android/app/src/main/java/com/mylifeos/app/rise/state/AlarmStateManager.java"
  "android/app/src/main/java/com/mylifeos/app/rise/scheduler/RiseAlarmScheduler.java"
  "android/app/src/main/java/com/mylifeos/app/rise/receiver/RiseAlarmReceiver.java"
  "android/app/src/main/java/com/mylifeos/app/rise/recovery/AlarmRecoveryReceiver.java"
  "android/app/src/main/java/com/mylifeos/app/plugins/RiseAlarmPlugin.java"

  # Phase 2 - Shield enforcement
  "android/app/src/main/java/com/mylifeos/app/shield/ShieldAccessibilityService.java"
  "android/app/src/main/java/com/mylifeos/app/shield/OverlayWindowBlocker.java"
  "android/app/src/main/java/com/mylifeos/app/shield/ShieldAppFirewall.java"
  "android/app/src/main/java/com/mylifeos/app/shield/ShieldPreferences.java"
  "android/app/src/main/java/com/mylifeos/app/plugins/ShieldPlugin.java"
  "src/lib/capacitor/nativeShield.ts"
  "src/lib/capacitor/shieldPlugin.ts"
  "src/components/shield/AppSelector.tsx"
  "src/components/shield/pages/BlockAppsPage.tsx"
  "src/components/shield/pages/BlockSitesPage.tsx"
  "src/components/shield/pages/BlockKeywordsPage.tsx"

  # Phase 3 - Strict Mode + Boot recovery + Permissions
  "android/app/src/main/java/com/mylifeos/app/shield/ShieldDeviceAdminReceiver.java"
  "android/app/src/main/java/com/mylifeos/app/plugins/BootReceiver.java"
  "android/app/src/main/AndroidManifest.xml"
  "android/app/src/main/res/xml/device_admin.xml"
  "android/app/src/main/res/xml/device_admin_rules.xml"
  "android/app/src/main/res/xml/accessibility_service_config.xml"
  "src/components/mobile/PermissionOnboarding.tsx"
  "src/utils/permissions.ts"

  # Phase 4 - Analytics, Streak, Community
  "android/app/src/main/java/com/mylifeos/app/shield/core/ShieldStatsManager.java"
  "src/components/rise/WeeklyRecapSheet.tsx"
  "src/components/rise/RiseAnalytics.tsx"
  "src/hooks/useGroupWakeAlarm.ts"
)

MISSING=()

for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    echo "===== FILE: $f =====" >> "$OUT"
    cat "$f" >> "$OUT"
    echo -e "\n===== END: $f =====\n\n" >> "$OUT"
  else
    MISSING+=("$f")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "===== MISSING FILES (এগুলো এখনো তৈরি হয়নি) =====" >> "$OUT"
  for m in "${MISSING[@]}"; do
    echo "$m" >> "$OUT"
  done
fi

echo "Done. Output: $OUT"
echo "Missing files: ${#MISSING[@]}"
