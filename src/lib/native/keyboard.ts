/**
 * Keyboard management — handles the iOS virtual keyboard so it
 * does not obscure input fields. Wraps @capacitor/keyboard.
 */

import { isPluginAvailable } from "./platform";

export interface KeyboardInfo {
  keyboardHeight: number;
}

async function getKeyboardPlugin() {
  if (!isPluginAvailable("Keyboard")) return null;
  const { Keyboard } = await import("@capacitor/keyboard");
  return Keyboard;
}

/**
 * Listen for keyboard show/hide events. Returns a cleanup function.
 * On web this is a no-op and returns null.
 */
export async function onKeyboardChange(
  onShow: (info: KeyboardInfo) => void,
  onHide: () => void
): Promise<(() => void) | null> {
  const keyboard = await getKeyboardPlugin();
  if (!keyboard) return null;

  const showHandle = await keyboard.addListener("keyboardWillShow", (info) => {
    onShow({ keyboardHeight: info.keyboardHeight });
  });

  const hideHandle = await keyboard.addListener("keyboardWillHide", () => {
    onHide();
  });

  return () => {
    showHandle.remove();
    hideHandle.remove();
  };
}

/** Programmatically hide the keyboard. */
export async function hideKeyboard(): Promise<void> {
  const keyboard = await getKeyboardPlugin();
  if (!keyboard) return;
  await keyboard.hide();
}

/** Set keyboard accessory bar visibility. */
export async function setAccessoryBarVisible(
  visible: boolean
): Promise<void> {
  const keyboard = await getKeyboardPlugin();
  if (!keyboard) return;
  await keyboard.setAccessoryBarVisible({ isVisible: visible });
}
