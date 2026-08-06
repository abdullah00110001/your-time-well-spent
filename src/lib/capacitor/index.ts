// Capacitor Native Bridge - Central Export

// Platform utilities
export {
  isNative,
  isAndroid,
  isIOS,
  isWeb,
  getPlatform,
  getDeviceInfo,
  getDeviceId,
  hasSafeArea,
  initializeCapacitor,
  exitApp,
  minimizeApp,
  getAppInfo,
  openUrl,
  showSplash,
  hideSplash,
  setStatusBarColor,
  setStatusBarStyle,
  hideStatusBar,
  showStatusBar
} from './platform';

// Permissions (from permissions.ts only to avoid conflicts)
export {
  checkNotificationPermission as checkNotificationPerm,
  requestNotificationPermission as requestNotificationPerm,
  checkPushPermission,
  requestPushPermission,
  checkExactAlarmPermission,
  checkUsageStatsPermission,
  openAppSettings,
  openUsageStatsSettings,
  openBatterySettings,
  getAllPermissions,
  hasRisePermissions,
  hasShieldPermissions,
  requestRisePermissions,
  requestShieldPermissions,
  type PermissionStatus,
  type PermissionState
} from './permissions';

// Native Alarm (Rise)
export {
  scheduleAlarm,
  scheduleRecurringAlarm,
  cancelAlarm,
  cancelAlarmByUuid,
  cancelAllAlarms,
  snoozeAlarm,
  dismissAlarm,
  getPendingAlarms,
  checkAlarmPermission,
  requestAlarmPermission,
  triggerAlarmVibration,
  initializeAlarmChannel,
  rescheduleAllAlarmsAfterBoot,
  setupAlarmListeners,
  registerAlarmActions,
  uuidToNumericId,
  type AlarmConfig,
  type AlarmNotification
} from './nativeAlarm';

// Native Shield
export {
  startShieldSession,
  endShieldSession,
  extendSession as extendShieldSession,
  logBypassAttempt,
  shouldBlockApp,
  shouldBlockWebsite,
  getActiveSession,
  isSessionActive,
  getSessionTimeRemaining,
  requestEmergencyBypass,
  initializeShieldChannel,
  setupShieldListeners,
  showBlockNotification,
  getUsageStats,
  type ShieldSession,
  type UsageStats,
  type BypassAttempt
} from './nativeShield';

// Native Notifications
export {
  registerPushNotifications,
  unregisterPushNotifications,
  setupPushListeners,
  sendGroupWakeNotification,
  sendShieldReminder,
  sendDailyInputReminder,
  sendPrayerReminder,
  sendAchievementNotification,
  initializeNotificationChannels,
  clearAllNotifications,
  clearNotification,
  getBadgeCount,
  setBadgeCount,
  checkNotificationPermission,
  requestNotificationPermission,
  type GroupWakeSignal,
  type MentorFeedback
} from './nativeNotifications';

// Native Camera
export {
  checkCameraPermission,
  requestCameraPermission,
  takePhoto,
  pickPhoto,
  pickMultiplePhotos,
  getPhotoWithPrompt,
  type CapturedImage
} from './nativeCamera';

// Native Filesystem
export {
  checkFilesystemPermission,
  requestFilesystemPermission,
  writeTextFile,
  writeBinaryFile,
  readTextFile,
  readBinaryFile,
  deleteFile,
  createDirectory,
  listDirectory,
  fileExists,
  getFileInfo,
  copyFile,
  renameFile,
  getFileUri,
  downloadToFile,
  OfflineStorage
} from './nativeFilesystem';

// Native Network
export {
  getNetworkStatus,
  isConnected,
  isOnWifi,
  isOnCellular,
  setupNetworkListeners,
  removeNetworkListeners,
  getCachedNetworkStatus,
  networkAwareFetch,
  retryFetch,
  waitForNetwork
} from './nativeNetwork';

// Native Keyboard
export {
  showKeyboard,
  hideKeyboard,
  setKeyboardStyle,
  setKeyboardResizeMode,
  setAccessoryBarVisible,
  setScrollEnabled,
  setupKeyboardListeners,
  removeKeyboardListeners,
  initializeKeyboard,
  focusWithKeyboard,
  blurWithKeyboard
} from './nativeKeyboard';

// Native Share & Browser
export {
  canShare,
  share,
  shareAchievement,
  shareProgress,
  shareChallenge,
  shareVia,
  openInAppBrowser,
  closeInAppBrowser
} from './nativeShare';

// Native Storage
export {
  setItem,
  getItem,
  removeItem,
  clear,
  keys,
  setJSON,
  getJSON,
  migrateFromLocalStorage,
  AppStorage,
  OfflineQueue
} from './nativeStorage';

// Native Haptics
export {
  lightImpact,
  mediumImpact,
  heavyImpact,
  successNotification,
  warningNotification,
  errorNotification,
  selectionChanged,
  selectionStart,
  selectionEnd,
  customVibration,
  HapticPatterns,
  Feedback
} from './nativeHaptics';

// Offline Sync
export {
  getSyncStatus,
  queueOfflineOperation,
  syncPendingOperations,
  subscribeSyncStatus,
  initializeOfflineSync,
  OfflineCache,
  offlineQuery,
  type SyncOperation,
  type SyncStatus
} from './offlineSync';
