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

export type ShareResult = "shared" | "copied" | "cancelled" | "unsupported";

/**
 * Open the native share sheet. Falls back to Web Share API on web,
 * or copies to clipboard as a last resort.
 */
export async function shareContent(options: ShareOptions): Promise<ShareResult> {
  // Native share via Capacitor
  if (isPluginAvailable("Share")) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.dialogTitle,
      });
      return "shared";
    } catch {
      return "cancelled";
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
      return "shared";
    } catch {
      return "cancelled";
    }
  }

  // Last resort: copy URL to clipboard
  if (options.url && typeof navigator !== "undefined" && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(options.url);
      return "copied";
    } catch {
      return "unsupported";
    }
  }

  return "unsupported";
}
