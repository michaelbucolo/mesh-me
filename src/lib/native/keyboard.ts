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

/** Browser/PWA fallback: detect keyboard occlusion only during text entry.
 * Pinch zoom changes the visual viewport too, but must never hide navigation. */
function observeWebKeyboard(onShow: (info: KeyboardInfo) => void, onHide: () => void): (() => void) | null {
  if (typeof window === "undefined" || !window.visualViewport) return null;
  const viewport = window.visualViewport;
  let restingHeight = window.innerHeight;
  let restingWidth = window.innerWidth;
  let lastHeight = 0;
  let frame = 0;
  const measure = () => {
    const width = window.innerWidth;
    if (Math.abs(width - restingWidth) > 80) {
      restingHeight = window.innerHeight;
      restingWidth = width;
    }
    const focused = document.activeElement;
    const editing = focused instanceof HTMLElement && (
      focused.isContentEditable || focused instanceof HTMLTextAreaElement ||
      (focused instanceof HTMLInputElement && !["button", "checkbox", "color", "file", "hidden", "radio", "range", "reset", "submit"].includes(focused.type))
    );
    if (!editing) restingHeight = Math.max(restingHeight, window.innerHeight);
    const occluded = Math.max(0, restingHeight - viewport.height - viewport.offsetTop);
    const nextHeight = editing && viewport.scale < 1.1 && occluded > Math.max(120, restingHeight * .15)
      ? Math.round(occluded) : 0;
    if (nextHeight === lastHeight) return;
    lastHeight = nextHeight;
    if (nextHeight > 0) onShow({ keyboardHeight: nextHeight });
    else onHide();
  };
  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  };
  viewport.addEventListener("resize", schedule);
  viewport.addEventListener("scroll", schedule);
  window.addEventListener("resize", schedule);
  document.addEventListener("focusin", schedule);
  document.addEventListener("focusout", schedule);
  schedule();
  return () => {
    cancelAnimationFrame(frame);
    viewport.removeEventListener("resize", schedule);
    viewport.removeEventListener("scroll", schedule);
    window.removeEventListener("resize", schedule);
    document.removeEventListener("focusin", schedule);
    document.removeEventListener("focusout", schedule);
  };
}

/** Native keyboard events, with visual-viewport support in the browser/PWA. */
export async function onKeyboardChange(
  onShow: (info: KeyboardInfo) => void,
  onHide: () => void,
): Promise<(() => void) | null> {
  const keyboard = await getKeyboardPlugin();
  if (!keyboard) return observeWebKeyboard(onShow, onHide);

  const showHandle = await keyboard.addListener("keyboardWillShow", (info) => {
    onShow({ keyboardHeight: info.keyboardHeight });
  });
  const hideHandle = await keyboard.addListener("keyboardWillHide", onHide);

  return () => {
    void showHandle.remove();
    void hideHandle.remove();
  };
}

/** Set keyboard accessory bar visibility. */
export async function setAccessoryBarVisible(
  visible: boolean
): Promise<void> {
  const keyboard = await getKeyboardPlugin();
  if (!keyboard) return;
  await keyboard.setAccessoryBarVisible({ isVisible: visible });
}
