"use client";

import { useState, useEffect, useCallback } from "react";
import type { MeshiColor, MeshiHat, MeshiMood } from "@/components/meshi/meshi-mascot";
import { getMeshiPreference } from "@/lib/actions";

export interface MeshiPreferences {
  color: MeshiColor;
  hat: MeshiHat;
  face: MeshiMood;
  enabled: boolean;
  appLogo: "default" | "custom";
  appLogoColor: MeshiColor;
  title: string;
}

export const MESHI_PREFERENCES_EVENT = "meshi:preferences-updated";

const STORAGE_KEYS = {
  color: "meshiColor",
  hat: "meshiHat",
  face: "meshiFace",
  enabled: "meshiEnabled",
  appLogo: "meshiAppLogo",
  appLogoColor: "meshiAppLogoColor",
  title: "meshiTitle",
} as const;

const DEFAULTS: MeshiPreferences = {
  color: "blue",
  hat: "none",
  face: "happy",
  enabled: true,
  appLogo: "default",
  appLogoColor: "blue",
  title: "",
};

function canUseStorage() {
  return typeof window !== "undefined";
}

function readMeshiPreferencesFromStorage(): MeshiPreferences {
  if (!canUseStorage()) return DEFAULTS;

  return {
    color: (localStorage.getItem(STORAGE_KEYS.color) as MeshiColor) || DEFAULTS.color,
    hat: (localStorage.getItem(STORAGE_KEYS.hat) as MeshiHat) || DEFAULTS.hat,
    face: (localStorage.getItem(STORAGE_KEYS.face) as MeshiMood) || DEFAULTS.face,
    enabled: localStorage.getItem(STORAGE_KEYS.enabled) !== "false",
    appLogo: (localStorage.getItem(STORAGE_KEYS.appLogo) as "default" | "custom") || DEFAULTS.appLogo,
    appLogoColor: (localStorage.getItem(STORAGE_KEYS.appLogoColor) as MeshiColor) || DEFAULTS.appLogoColor,
    title: localStorage.getItem(STORAGE_KEYS.title) || DEFAULTS.title,
  };
}

function writeMeshiPreferencesToStorage(prefs: MeshiPreferences) {
  if (!canUseStorage()) return;

  localStorage.setItem(STORAGE_KEYS.color, prefs.color);
  localStorage.setItem(STORAGE_KEYS.hat, prefs.hat);
  localStorage.setItem(STORAGE_KEYS.face, prefs.face);
  localStorage.setItem(STORAGE_KEYS.enabled, String(prefs.enabled));
  localStorage.setItem(STORAGE_KEYS.appLogo, prefs.appLogo);
  localStorage.setItem(STORAGE_KEYS.appLogoColor, prefs.appLogoColor);

  if (prefs.title) localStorage.setItem(STORAGE_KEYS.title, prefs.title);
  else localStorage.removeItem(STORAGE_KEYS.title);
}

function broadcastMeshiPreferences(prefs: MeshiPreferences) {
  if (!canUseStorage()) return;
  window.dispatchEvent(new CustomEvent<MeshiPreferences>(MESHI_PREFERENCES_EVENT, { detail: prefs }));
}

export function updateMeshiLocalPreferences(patch: Partial<MeshiPreferences>) {
  const next = {
    ...readMeshiPreferencesFromStorage(),
    ...patch,
  } satisfies MeshiPreferences;

  writeMeshiPreferencesToStorage(next);
  broadcastMeshiPreferences(next);
  return next;
}

async function hydrateMeshiPreferencesFromServer() {
  const serverPref = await getMeshiPreference();
  const local = readMeshiPreferencesFromStorage();

  if (!serverPref) return local;

  const merged: MeshiPreferences = {
    ...local,
    color: (serverPref.colorTheme as MeshiColor) || local.color,
    hat: (serverPref.hatStyle as MeshiHat) || local.hat,
    face: (serverPref.faceStyle as MeshiMood) || local.face,
  };

  writeMeshiPreferencesToStorage(merged);
  broadcastMeshiPreferences(merged);
  return merged;
}

/**
 * Shared hook for Meshi preferences.
 *
 * This is the single client-side source of truth for Meshi customization.
 * It keeps sidebar Meshi, floating Meshi, mesh-page Meshi, and settings in sync
 * across the current tab and other tabs.
 */
export function useMeshiPreferences(): MeshiPreferences & { refresh: () => void } {
  const [prefs, setPrefs] = useState<MeshiPreferences>(() => readMeshiPreferencesFromStorage());

  useEffect(() => {
    let mounted = true;

    hydrateMeshiPreferencesFromServer()
      .then((next) => {
        if (mounted) setPrefs(next);
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || !Object.values(STORAGE_KEYS).includes(event.key as (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS])) return;
      setPrefs(readMeshiPreferencesFromStorage());
    };

    const handleMeshiPreferencesUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<MeshiPreferences>;
      if (customEvent.detail) setPrefs(customEvent.detail);
      else setPrefs(readMeshiPreferencesFromStorage());
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(MESHI_PREFERENCES_EVENT, handleMeshiPreferencesUpdate as EventListener);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(MESHI_PREFERENCES_EVENT, handleMeshiPreferencesUpdate as EventListener);
    };
  }, []);

  const refresh = useCallback(() => {
    hydrateMeshiPreferencesFromServer()
      .then((next) => setPrefs(next))
      .catch(() => {});
  }, []);

  return { ...prefs, refresh };
}

export function getMeshiPrefsStatic(): MeshiPreferences {
  return readMeshiPreferencesFromStorage();
}
