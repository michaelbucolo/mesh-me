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
  const hasXrApi = typeof navWithXr.xr !== "undefined";

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
  if (hasXrApi && window.innerWidth >= 1100) return "generic";

  return null;
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
    const refresh = () => applySpatialClasses(detectSpatialDevice());
    refresh();

    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
      window.removeEventListener("storage", refresh);
      applySpatialClasses(null);
    };
  }, []);

  return null;
}
