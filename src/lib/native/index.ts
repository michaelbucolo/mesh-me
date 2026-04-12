/**
 * Barrel export for all native bridge modules.
 */

export { isNative, isIOS, isWeb, isTabletOrDesktop, isPluginAvailable } from "./platform";
export { impactFeedback, notificationFeedback, selectionFeedback } from "./haptics";
export { registerPush, onPushReceived, onPushTapped, getPushPermissionStatus } from "./push";
export { shareContent } from "./share";
export type { ShareOptions } from "./share";
export { onKeyboardChange, hideKeyboard, setAccessoryBarVisible } from "./keyboard";
export { setStatusBarLight, setStatusBarDark, hideStatusBar, showStatusBar, setStatusBarColor, setStatusBarOverlay } from "./status-bar";
