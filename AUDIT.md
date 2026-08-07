# LifeOS Structural Audit — 2026-08-07

Scope: Rise alarm/mission flows, dead UI controls, performance hotspots, native (Capacitor/Android) bridge alignment.
Status: findings only — no fixes applied yet.

---

## 🔴 CRITICAL — Alarm / Mission flow breakage

### 1. Ring screen cannot find the alarm (per-day UUID mismatch)
- `src/lib/capacitor/riseAlarmBridge.ts:266` schedules each weekday shot as `uuid: ${uuid}_day{i}` (e.g. `abc123_day2`).
- `android/.../rise/receiver/RiseAlarmReceiver.java:32,49,142` deep-links `capacitor://localhost/rise/ring/{suffixed-uuid}`.
- `src/pages/RiseRingScreen.tsx:97` looks up `local_alarms` by plain id → **always misses**.
- Falls back to the generic alarm object (`RiseRingScreen.tsx:109-119`): `verification_type: 'none'`, no `mission_config`, no ringtone/wallpaper/intention.
- **Impact: every mission is silently skipped; user gets "Dismiss Alarm" instead of the configured mission.**
- Fix: strip the `_dayN` suffix before lookup (and/or pass the base id as a separate intent extra).

### 2. Two disconnected alarm data models
- `src/pages/Rise.tsx:171-205` uses `localStorage['local_alarms']` + direct `nativeAlarm.ts` / `riseAlarmBridge.ts` calls.
- `src/hooks/useNativeAlarm.ts` is a full CRUD layer over the Supabase `rise_alarms` table and has **no consumers** (only re-exported in `src/hooks/mobile/index.ts`).
- Any screen wired to the hook would manage alarms nothing else reads, and DB alarms wouldn't be scheduled/cancelled in sync.

### 3. Group-wake alarms never reach the native scheduler
- `src/hooks/useGroupWakeAlarm.ts:185-201` (`upsertAlarm`) only writes `group_wake_alarms`; no `scheduleRecurringAlarm` / `riseAlarmBridge` call anywhere in the file or its consumers (`GroupWakeAdminPanel.tsx`, `RiseGroupWake.tsx`).
- On-device group alarms cannot fire; only server "wake-up calls" (`send-group-wake`) exist.
- Open: confirm whether group ringing is intentionally push-only.

### 4. `handleSnooze` computes the wrong day-of-week
- `RiseRingScreen.tsx:201-212` passes `next.getDay()` into `scheduleRecurringAlarm`; `getNextDayOfWeek` (`nativeAlarm.ts:306-315`) then resolves the *next occurrence of that weekday* — a midnight-crossing snooze can land up to 6 days out. No minute-only fast path for same-day snoozes.

### 5. Dead re-navigation loop on background
- `RiseRingScreen.tsx:74-79`: on `appStateChange` `isActive=false` it navigates to the route it is already on after 500ms. No debounce/guard; fires on every background while ringing; does not stop the alarm or foreground the app.

### 6. Duplicate / uncoordinated vibration & audio
- `RiseRingScreen.tsx:144-153` runs a JS `Haptics.impact` loop while native `AlarmSoundService` (via `RiseAlarmReceiver.java`) already does sound + vibration.
- Cleanup (`:155-159`) never calls `stopNativeRinging()`, so effect re-runs can leave native ringing while JS stops.

### 7. Unsafe async listener cleanup
- `Rise.tsx:91-106`, `RiseRingScreen.tsx:69-85`: `App.addListener(...).then(h => h.remove())` with no `cancelled` guard — under StrictMode double-invoke / fast nav this can remove a *newer* listener or leak the old one.

---

## 🟠 HIGH — Dead / no-op interactive elements

### 8. `src/components/shield/ShieldModes.tsx`
- `:136` Sleep Mode card uses `active={resolvedMode === 'normal'}` — should be `'strict'`. Shows "Active" when Shield is off, never when Sleep is on.
- `:96-99` `toggleStrictMode` off-path only calls `applyMode('normal')`; never `Shield.deactivateMode()` (unlike `toggleMode` at `:71`). Native strict mode stays ON while UI shows OFF.

### 9. `src/components/shield/ShieldProfilesSection.tsx:217`
- `<DropdownMenuItem onClick={() => {}}>` — genuine no-op menu entry.

### 10. `src/components/admin/panel/AdminSafetyEthics.tsx:131`, `:178`
- `<Switch defaultChecked={...} />` with **no `onCheckedChange`** — uncontrolled toggles that never persist.

### 11. `src/pages/TimeTracking.tsx:1-20`
- Entire page is a "Coming Soon" placeholder; verify whether nav links to it (dead-end route).

### 12. `src/pages/Journey.tsx:285`
- Inline `'🚀 This target is coming soon. Get ready!'` — confirm it isn't gating a real action.

### 13. `src/hooks/useNativeAlarm.ts`
- Orphaned relative to the shipped Rise flow (see #2): every handler it exposes is effectively unreachable.

---

## 🟡 MEDIUM — Performance

### 14. Listener leak in `restoreAlarmsOnBoot`
- `src/lib/capacitor/nativeAlarm.ts:284-299` adds an `appStateChange` listener per call (called via `rescheduleAllAlarmsAfterBoot` `:301-304`) with **no guard**, unlike `setupAlarmListeners` (`:274-275`). Repeated calls stack listeners and re-run reschedule work N times per resume.

### 15. Per-second re-render of the ring screen
- `RiseRingScreen.tsx:124-127` ticks every 1000ms for an `HH:MM` display (`:270-274`), on a screen also running audio/haptics loops. Should tick per minute.

### 16. Unmemoized `local_alarms` JSON parsing
- `Rise.tsx:171-197` re-parses the whole blob on every toggle/delete/duplicate; `RiseRingScreen.tsx:96,216` re-parses per snooze/status action. Synchronous main-thread work with no cache.

### 17. Interval churn
- `Rise.tsx:145-149`: `setInterval(updateNextAlarm, 60000)` depends on `[alarms]`, so it is torn down/recreated on every alarm mutation.

---

## 🟢 LOW — Native bridge alignment

### 18. `shieldPlugin.ts` ↔ `ShieldPlugin.java` mismatches
- Android implements `updateAdultFilterScreen` (`:283`), `getAdultFilterScreen` (`:303`), `updateFloatingTimerStyle` (`:588`) — none declared in `src/lib/capacitor/shieldPlugin.ts`, and not referenced anywhere in `src/`.
- TS declares `getStats(options)` (`shieldPlugin.ts:36`) but Android exposes `getBlockStats` — **likely a runtime-failing name mismatch**.

### 19. `PureShieldPlugin.java:351-355` alias layer
- 5 aliases (`startService`, `stopService`, `isEnabled`, `saveConfig`, `loadConfig`) forward to canonical methods; `pureShieldPlugin.ts:96-100` declares both sets. Redundant surface — identify dead aliases against `usePureShield.ts`.

### 20. `RiseAlarmPlugin` — clean
- TS/Android method sets match 1:1 (schedule/cancel/stopRinging/getRingingAlarmId/clearRingingAlarmId/isAlarmRinging/getSnoozeInfo/getAlarmState/exact-alarm + battery helpers).

### 21. Plugin registration — clean
- All plugins used from TS are registered in `MainActivity.java:157-163`. Note: `MainActivity.java:1-127` is a large commented-out duplicate of the class (dead code).

---

## Open questions / not yet covered
- Is `rise_alarms` (+ `useNativeAlarm`) read by any other surface, or fully orphaned?
- Is group-wake ringing intentionally push-notification-only (#3)?
- Confirm `Shield.getStats` call sites to grade #18 severity.
- Not read in this pass: `AlarmSoundService.java`, `AlarmRecoveryReceiver.java`, and mission components (`MathMission`, `ShakeMission`, `BarcodeMission`, `PhotoMission`, `TypingMission`) — needs a follow-up pass for mission-bypass edge cases, given #1 sits upstream of all of them.

---

## Recommended fix order
1. #1 (mission-killing UUID mismatch) → #4 → #6 → #5 → #7
2. #8 (Shield mode state lies) → #9, #10
3. #14 (listener leak) → #15, #17, #16
4. #18 bridge naming, then decide #2/#3/#13 (delete orphan vs. wire up)
