/**
 * Native share sheet — wraps @capacitor/share so the app can
 * invoke the iOS share sheet with a single call.
 */

import { isPluginAvailable } from "./platform";

export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  dialogTitle?: string;
}

/**
 * Open the native share sheet. Falls back to Web Share API on web,
 * or copies to clipboard as a last resort.
 */
export async function shareContent(options: ShareOptions): Promise<boolean> {
  // Native share via Capacitor
  if (isPluginAvailable("Share")) {
    const { Share } = await import("@capacitor/share");
    try {
      await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.dialogTitle,
      });
      return true;
    } catch {
      // User cancelled or error
      return false;
    }
  }

  // Web Share API fallback
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url: options.url,
      });
      return true;
    } catch {
      return false;
    }
  }

  // Last resort: copy URL to clipboard
  if (options.url && typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(options.url);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
