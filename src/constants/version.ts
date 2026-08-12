/**
 * App version constants.
 *
 * IMPORTANT: A previously published APK shipped versionCode 3473498. Android
 * refuses to install a build with a LOWER versionCode ("App not installed"),
 * so all builds are offset by VERSION_CODE_BASE.
 *
 * Effective native versionCode = VERSION_CODE_BASE + CI run number
 * (see android/app/build.gradle — keep both files in sync).
 */
export const VERSION_CODE_BASE = 3500000;

// CI run number of the currently released build (versionName 1.0.20).
export const CURRENT_BUILD_NUMBER = 20;

export const CURRENT_APP_VERSION_CODE = VERSION_CODE_BASE + CURRENT_BUILD_NUMBER;

export const CURRENT_APP_VERSION_NAME = `1.0.${CURRENT_BUILD_NUMBER}`;
