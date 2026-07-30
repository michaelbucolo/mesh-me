"use client";

import { useEffect } from "react";

type SpatialDevice = "vision" | "quest" | "generic" | null;

function readForcedSpatialMode(): SpatialDevice {
  try {
    const value = window.localStorage.getItem("meshSpatialMode");
    if (value === "vision" || value === "quest" || value === "generic") return value;
    if (value === "on") return "generic";
  } catch {
    return null;
  }
  return null;
}

function detectSpatialDevice(): SpatialDevice {
  const forced = readForcedSpatialMode();
  if (forced) return forced;

  const ua = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  const navWithXr = navigator as Navigator & {
    userAgentData?: { platform?: string };
    xr?: unknown;
  };
  const uaDataPlatform = navWithXr.userAgentData?.platform?.toLowerCase() || "";

  if (/quest|oculus|oculusbrowser|meta quest|wolvic/.test(ua)) return "quest";
  if (/visionos|apple vision|vision pro|reality/.test(ua) || uaDataPlatform.includes("vision")) return "vision";

  const looksLikeVisionSafari =
    platform === "macintel" &&
    navigator.maxTouchPoints > 0 &&
    navigator.maxTouchPoints <= 2 &&
    window.devicePixelRatio >= 2 &&
    Math.min(window.screen.width, window.screen.height) >= 900 &&
    !/ipad|iphone|android/.test(ua);

  if (looksLikeVisionSafari) return "vision";

  return null;
}

/* THE "generic" BRANCH USED TO BE `typeof navigator.xr !== "undefined" &&
 * innerWidth >= 1100` — and `navigator.xr` EXISTS in every desktop Chromium,
 * headset or not. Measured on the built page at 1440x900 in plain headless
 * Chrome: body carried `platform-spatial platform-xr-generic`, which inflated
 * every button to 48px min-height (breaking the dock's 44px keys and its
 * concentric 56px tray, overlapping popover rows on a 42px pitch) and
 * re-enabled a hover-lift transform the press model had deliberately removed.
 * Every wide-viewport user on Chrome was getting the headset layout.
 *
 * The presence of the API OBJECT is not a headset. The API's own question is:
 * `navigator.xr.isSessionSupported("immersive-vr")` — async, so it cannot run
 * inside the sync detector. It resolves here and stamps the classes on the
 * devices that actually answer yes. */
async function detectGenericXr(): Promise<boolean> {
  const xr = (navigator as Navigator & { xr?: { isSessionSupported?: (mode: string) => Promise<boolean> } }).xr;
  if (!xr?.isSessionSupported) return false;
  try {
    return await xr.isSessionSupported("immersive-vr");
  } catch {
    return false;
  }
}

function applySpatialClasses(device: SpatialDevice) {
  const body = document.body;
  body.classList.remove("platform-spatial", "platform-visionos", "platform-quest", "platform-xr-generic");
  body.removeAttribute("data-spatial-device");

  if (!device) return;

  body.classList.add("platform-spatial");
  body.dataset.spatialDevice = device;

  if (device === "vision") body.classList.add("platform-visionos");
  else if (device === "quest") body.classList.add("platform-quest");
  else body.classList.add("platform-xr-generic");
}

export function SpatialInit() {
  useEffect(() => {
    let disposed = false;
    const refresh = () => {
      const device = detectSpatialDevice();
      applySpatialClasses(device);
      // UA/heuristic detection found nothing — ask the XR API itself. Only a
      // device that answers yes to immersive-vr gets the generic spatial skin.
      if (!device && window.innerWidth >= 1100) {
        void detectGenericXr().then((supported) => {
          if (!disposed && supported) applySpatialClasses("generic");
        });
      }
    };
    refresh();

    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      disposed = true;
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
      window.removeEventListener("storage", refresh);
      applySpatialClasses(null);
    };
  }, []);

  return null;
}
