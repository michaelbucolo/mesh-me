"use client";

import { useState, useEffect, useCallback } from "react";
import type { MeshiColor, MeshiHat, MeshiMood } from "@/components/meshi/meshi-mascot";
import { getMeshiPreference } from "@/lib/actions";

export interface MeshiPreferences {
  color: MeshiColor;
  hat: MeshiHat;
  face: MeshiMood;
  /** App logo style — MeshPro feature. "default" uses the standard Meshi. */
  appLogo: "default" | "custom";
  /** Custom logo color override for MeshPro users */
  appLogoColor: MeshiColor;
}

const DEFAULTS: MeshiPreferences = {
  color: "blue",
  hat: "none",
  face: "happy",
  appLogo: "default",
  appLogoColor: "blue",
};

/**
 * Shared hook for Meshi preferences. Reads from localStorage first (instant),
 * then hydrates from the server. Listens for storage events so all components
 * update together when the user changes preferences in Settings.
 */
export function useMeshiPreferences(): MeshiPreferences & { refresh: () => void } {
  const [prefs, setPrefs] = useState<MeshiPreferences>(() => {
    if (typeof window === "undefined") return DEFAULTS;
    return {
      color: (localStorage.getItem("meshiColor") as MeshiColor) || DEFAULTS.color,
      hat: (localStorage.getItem("meshiHat") as MeshiHat) || DEFAULTS.hat,
      face: (localStorage.getItem("meshiFace") as MeshiMood) || DEFAULTS.face,
      appLogo: (localStorage.getItem("meshiAppLogo") as "default" | "custom") || DEFAULTS.appLogo,
      appLogoColor: (localStorage.getItem("meshiAppLogoColor") as MeshiColor) || DEFAULTS.appLogoColor,
    };
  });

  // Hydrate from server on mount
  useEffect(() => {
    getMeshiPreference()
      .then((pref) => {
        if (pref) {
          const updated: MeshiPreferences = {
            color: (pref.colorTheme as MeshiColor) || DEFAULTS.color,
            hat: (pref.hatStyle as MeshiHat) || DEFAULTS.hat,
            face: (pref.faceStyle as MeshiMood) || DEFAULTS.face,
            appLogo: DEFAULTS.appLogo,
            appLogoColor: DEFAULTS.appLogoColor,
          };
          setPrefs(updated);
          // Sync to localStorage for instant access elsewhere
          localStorage.setItem("meshiColor", updated.color);
          localStorage.setItem("meshiHat", updated.hat);
          localStorage.setItem("meshiFace", updated.face);
        }
      })
      .catch(() => {});
  }, []);

  // Listen for cross-component preference changes via storage events
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "meshiColor") setPrefs((p) => ({ ...p, color: (e.newValue as MeshiColor) || DEFAULTS.color }));
      if (e.key === "meshiHat") setPrefs((p) => ({ ...p, hat: (e.newValue as MeshiHat) || DEFAULTS.hat }));
      if (e.key === "meshiFace") setPrefs((p) => ({ ...p, face: (e.newValue as MeshiMood) || DEFAULTS.face }));
      if (e.key === "meshiAppLogo") setPrefs((p) => ({ ...p, appLogo: (e.newValue as "default" | "custom") || DEFAULTS.appLogo }));
      if (e.key === "meshiAppLogoColor") setPrefs((p) => ({ ...p, appLogoColor: (e.newValue as MeshiColor) || DEFAULTS.appLogoColor }));
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const refresh = useCallback(() => {
    getMeshiPreference()
      .then((pref) => {
        if (pref) {
          setPrefs((prev) => ({
            ...prev,
            color: (pref.colorTheme as MeshiColor) || prev.color,
            hat: (pref.hatStyle as MeshiHat) || prev.hat,
            face: (pref.faceStyle as MeshiMood) || prev.face,
          }));
        }
      })
      .catch(() => {});
  }, []);

  return { ...prefs, refresh };
}

/**
 * Static preference reader for components that only need a one-time read
 * (e.g. loading screens). Does NOT listen for updates.
 */
export function getMeshiPrefsStatic(): MeshiPreferences {
  if (typeof window === "undefined") return DEFAULTS;
  return {
    color: (localStorage.getItem("meshiColor") as MeshiColor) || DEFAULTS.color,
    hat: (localStorage.getItem("meshiHat") as MeshiHat) || DEFAULTS.hat,
    face: (localStorage.getItem("meshiFace") as MeshiMood) || DEFAULTS.face,
    appLogo: (localStorage.getItem("meshiAppLogo") as "default" | "custom") || DEFAULTS.appLogo,
    appLogoColor: (localStorage.getItem("meshiAppLogoColor") as MeshiColor) || DEFAULTS.appLogoColor,
  };
}
