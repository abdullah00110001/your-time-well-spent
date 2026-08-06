# Sukoon OS — Application Blueprint

> Last updated: 2026-04-18
> Version: 1.0 (Production baseline)

A premium, glassmorphic daily-tracker app focused on mindfulness, discipline, Islamic practice, and accountability. This document is the single source of truth for architecture, data model, navigation, and customization points.

---

## 1. High-level Architecture

```
┌─────────────────────────────────────────────────┐
│  React 18 + Vite + Tailwind + shadcn-ui         │
│  Routing: react-router-dom                       │
│  State: React Query, Context, local hooks        │
│  Animations: framer-motion                       │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Supabase (Postgres + Auth + Edge Functions)    │
│  - Auth: email + OAuth                           │
│  - DB: 40+ tables, RLS on every user table       │
│  - Edge: send-wake-signal (FCM dispatch)         │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│  Capacitor Native Bridge (com.mylifeos.app)     │
│  - LocalNotifications (Rise alarms)              │
│  - RiseAlarmPlugin (exact alarms / wake lock)    │
│  - ShieldService (foreground service + a11y)     │
│  - AppUpdate (OTA APK install)                   │
│  - FCM push notifications                        │
└─────────────────────────────────────────────────┘
```

---

## 2. Top-level Pages (route map)

| Route | File | Purpose |
|---|---|---|
| `/` | `pages/Dashboard.tsx` | Main daily dashboard |
| `/rise` | `pages/Rise.tsx` | Wake-up alarms + groups + community |
| `/shield` | `pages/Shield.tsx` | Focus / app-blocking |
| `/daily` | `pages/DailyInput.tsx` | Daily life input + custom fields |
| `/habits` | `pages/Habits.tsx` | Habit tracker |
| `/goals` | `pages/Goals.tsx` | Quarterly + monthly goals |
| `/journal` | `pages/Journal.tsx` | Reflections |
| `/insights` | `pages/Insights.tsx` | Analytics + AI insights |
| `/life-calendar` | `pages/LifeCalendar.tsx` | Lifetime week grid |
| `/islamic` | `pages/IslamicDashboard.tsx` | Salah, Quran, Niyyah, etc. |
| `/settings` | `pages/Settings.tsx` | App + account |
| `/admin/*` | `pages/admin/*` | Admin panel (role-protected) |

Bottom nav (mobile): **Home → Habits → Rise (centered, emphasized) → Shield → Settings**

---

## 3. Database Schema (key tables)

All tables enable RLS and follow the rule: **roles never live on profiles** — use the `user_roles` table + `has_role()` SECURITY DEFINER.

### Identity
- `auth.users` — Supabase
- `profiles` — display info (no roles)
- `user_roles` — `(user_id, role)` with `app_role` enum

### Daily tracking
- `daily_entries` — fixed daily metrics (salah, quran, sleep, …)
- `daily_custom_fields` — user-defined fields (label, type, unit)
- `daily_custom_values` — value per field per date
- `user_scores` — derived deen / discipline / focus / productivity scores

### Rise (wake-up)
- `rise_alarms` — alarm definitions
- `rise_streaks` — per-user streak record
- `rise_user_profile` — bio, DND, blocked users
- `accountability_groups` — wake-up groups
- `accountability_group_members` — `(group_id, user_id, role: admin|member)`
- `group_wake_status` — daily wake state per member
- `wake_signals` — sender → target nudge audit log + cooldown source
- `community_wake_events` — public wake feed (anonymous)
- `user_locations` — opted-in city for community feed

### Shield (focus)
- `discipline_profiles` — blocking profiles
- `shield_sessions` — active/past focus sessions
- `discipline_scores` — score + strictness mode
- `unlock_requests` — emergency bypass approvals
- `app_settings` — generic key/value (legacy)

### RLS helpers (SECURITY DEFINER)
- `has_role(_user_id, _role)`
- `is_group_member(_group_id, _user_id)`
- `is_group_admin(_group_id, _user_id)`

> ⚠ **Never** write a policy that selects from the same table it protects — use these helpers instead. See `APPLY_MIGRATION.md` for the canonical fix.

---

## 4. Native Bridges

### Rise Alarm (custom plugin)
- `android/app/src/main/java/com/mylifeos/app/plugins/RiseAlarmPlugin.java`
  - `set(timestamp, title, body, missionType, alarmDbId)` → uses `AlarmManager.setAlarmClock` (Android Doze-bypass)
  - `cancel(timestamp)`
  - `canScheduleExactAlarms()` / `openAlarmSettings()`
- `RiseAlarmReceiver.java` — fires on alarm:
  1. Acquires `FULL_WAKE_LOCK`
  2. Plays system **alarm** ringtone (USAGE_ALARM)
  3. Vibrates with repeating pattern
  4. Launches `MainActivity` with `rise_alarm_trigger=true`
  5. Disables keyguard on legacy devices

> ⚠ The TS `nativeAlarm.ts` currently uses `LocalNotifications`. For guaranteed firing on hard-killed Android 13+ apps, call the `RiseAlarm` plugin directly via `Capacitor.Plugins.RiseAlarm.set({...})`. The plugin is registered in `MainActivity.java`.

### Shield Service
- `ShieldService.java` — foreground `dataSync` service
- `ShieldAccessibilityService.java` — detects blocked apps
- `ShieldBlockActivity.java` — fullscreen block overlay
- `ShieldDeviceAdminReceiver.java` — prevents uninstall while active

### AppUpdate
- `AppUpdatePlugin.java` — OTA APK download + install via FileProvider

---

## 5. Edge Functions

| Name | Trigger | Purpose |
|---|---|---|
| `send-wake-signal` | Client invoke | Sends FCM push to a target user. Reads `FIREBASE_SERVER_KEY` secret. |

---

## 6. Design Tokens

Defined in `src/index.css` and `tailwind.config.ts`. All colors **HSL**.

- Primary surfaces: `bg-background`, `bg-card`, `bg-muted`
- Accents: `bg-primary`, `bg-secondary`, `bg-destructive`
- Text: `text-foreground`, `text-muted-foreground`, `text-primary`
- Heading font: **DM Serif Display**
- Body font: **DM Sans**
- Glassmorphism: `bg-card/60 backdrop-blur-xl border border-white/10`

---

## 7. Customization Quick-Reference

| To change… | Edit |
|---|---|
| Bottom nav order or "Rise" emphasis | `src/components/layout/MobileNav.tsx` |
| Alarm sound | `RiseAlarmReceiver.java` (RingtoneManager) — or drop a file in `android/app/src/main/res/raw/` and pass via `LocalNotifications.sound` |
| Daily Input default fields | `src/pages/DailyInput.tsx` — `defaultEntry` |
| Custom-field types allowed | `src/hooks/useDailyCustomFields.ts` — `CustomFieldType` |
| Group admin permissions | `is_group_admin()` SQL function + `RiseGroupWake.tsx` |
| Theme colors | `src/index.css` (`:root` + `.dark`) |
| Push notification payloads | `supabase/functions/send-wake-signal/index.ts` |

---

## 8. Recommended Next Features

1. **Streak protection** — auto-detect missed days, offer 1 free freeze/week
2. **Sleep estimation** — bedtime → predict duration → warn if alarm <6h sleep
3. **Group leaderboard** — daily wake-on-time ranking inside each group
4. **Wake-up photo proof** — upload selfie at dismissal
5. **Fajr auto-alarm** — set by location prayer time

---

## 9. Known Operational Gotchas

- **Web preview cannot fire native alarms.** Always test alarms on a device APK build.
- **OEM doze (Xiaomi/Oppo/Vivo)** — guide users to whitelist the app under "battery optimization" in `RiseSettings.tsx`.
- **FCM key** — required for cross-device wake signals; stored as `FIREBASE_SERVER_KEY` secret.
- **`accountability_group_members` policies must use `is_group_member()`**, never query the table directly. See section 3.
