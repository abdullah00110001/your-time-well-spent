# Sleep to Rise: fix the phone restart, then simplify blocking

## What the requirement is
Sleep to Rise runs these steps in order: Idle, then Wind-down (a warning only, no block), then Sleep Guard (blocks until the alarm, or for a set time if there is no alarm), then Rise Guard (blocks for the set minutes after the alarm is dismissed, or until the Morning Mission is done), then back to Idle. During Sleep Guard and Rise Guard, apps and sites on the Sleep to Rise list are blocked. Phone, Clock, Emergency and apps you add are always allowed. Right now, turning it on restarts the phone.

## What the code shows (checked before planning)
- No reboot, wipe or device-admin call is made when you turn it on. The device-admin code only runs when you try to uninstall. That rules out cause 1.
- Sleep to Rise has no VPN of its own. Only Shield has one, so cause 3 (two VPNs fighting) is also ruled out.
- **Most likely cause (2, a crash loop):** the accessibility service checks Sleep to Rise on every screen change. In "allow-list" mode, anything not on the list is blocked, and that includes Android's own parts: the status bar, the home screen, the keyboard, the Settings app and the recent-apps screen. When a lock window is active, or starts right as you turn the feature on, each screen change opens the block screen. Opening it causes another screen change, which opens it again. This has **no loop guard**: Shield's guard does not cover it, and a new manager is created and files are re-read on every event. Android's core process gets flooded, its watchdog trips and the phone restarts.
- Shield and Sleep to Rise can also both react to the same event and open two block screens on top of each other. That makes the flood worse.

## Approach A: fix the root cause directly (small, fast)
1. Build a list of apps Sleep to Rise must never block: the status bar, every home screen app (found by asking Android), keyboards, Settings, the phone and dialer apps, emergency, the clock, our own app and the block screen.
2. Add a loop guard just for Sleep to Rise: at most one block screen every 1.5 seconds per app. If it fires more than 5 times in 10 seconds, Sleep to Rise stops blocking for 60 seconds and logs it.
3. Keep one decision-maker in memory. Only re-read settings when they change, not on every event.
4. Only one of Shield and Sleep to Rise shows a block screen per event.
- Cost: low. Risk: a similar path (for example site blocking) could still slip through if we miss it.

## Approach B: route Sleep to Rise through Shield's blocking engine
Sleep to Rise stops launching screens on its own. It only answers "is a lock window active, and is this app or site on my list?" Shield's existing engine does the actual blocking, including its loop guard, cooldowns and single block screen, and shows the Sleep to Rise message.
- Cost: more restructuring of the accessibility service and block screens. Risk: lower over time. There is one blocking loop instead of two, and two blocks can never collide.

## Recommendation
**Do A and B together in this change.** The cause is clear enough that A's safeguards (never block system apps, loop guard) are needed either way. B is where they should live, so Sleep to Rise gets all of Shield's protections. This stays offline: everything runs on the phone.

## Safety valve so it can never restart the phone again
- System apps are never blocked, whatever the settings say.
- There is a hard cap on how often a block screen can open. If the cap trips, blocking pauses for 60 seconds.
- A startup check: if the block screen opened more than 20 times in the last minute before a crash or restart, Sleep to Rise turns itself off on the next start and shows a notice in the app.
- All Sleep to Rise code runs inside error handling, so a crash in it can't take down the accessibility service.

## Failure modes covered
- **Permission revoked mid-window:** blocking stops quietly. The app shows a "Permission needed" card and the Android side does not crash or retry in a loop.
- **Shield and Sleep to Rise both on:** one engine and one block screen. Sleep to Rise takes priority during its window.
- **Low-RAM phone:** the decision-maker is cached with no extra files read per event, and the block screen reuses one instance instead of stacking copies.
- **Offline:** no network is used at all.
- **Rapid on/off:** turning it on only saves settings. It never opens a block screen directly.

## Technical details (files)
- `NightToRiseManager.java`: add a never-block list, one shared cached instance, and a settings-changed flag.
- New `nighttorise/SystemSafeList.java`: finds the home screen, keyboard and dialer apps at runtime.
- `ShieldAccessibilityService.java`: remove the separate Sleep to Rise launch paths (lines 214-238 and 408-437). Ask Sleep to Rise for a decision, then block through the existing `BlockLoopGuard` and one launch path.
- `NightToRiseBlockActivity.java`: set `singleTask`, and add a guard that finishes it if it is opened again within 1.5 seconds.
- `NightToRisePreferences.java`: add a launch counter and a startup safe-mode flag, and show the notice in `NightToRisePage.tsx`.

## How to check it on your phone after the build
1. Turn Sleep to Rise on and off 20 times quickly. It should never restart or freeze.
2. Set the sleep time 2 minutes from now and wait. The block screen should open once; the home screen, status bar and Phone should still work.
3. Turn Shield on at the same time and open a blocked app. You should see only one block screen.
4. During a lock, go to Settings and turn off Accessibility. Blocking should stop, the app should warn you, and there should be no restart.
5. Leave it on overnight with an alarm. It should block at night, switch to Rise Guard after the alarm and release after the set minutes.
6. Optional: check the phone's log for the Sleep to Rise loop guard firing, using `adb logcat -s NightToRise BlockLoopGuard`.
