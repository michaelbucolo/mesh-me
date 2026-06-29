"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  MeshiAccessory,
  MeshiBadge,
  MeshiColor,
  MeshiEyeStyle,
  MeshiHair,
  MeshiHat,
  MeshiMood,
  MeshiOutfit,
} from "@/components/meshi/meshi-mascot";
import { getMeshiPreference } from "@/lib/actions";

export interface MeshiPreferences {
  color: MeshiColor;
  hat: MeshiHat;
  face: MeshiMood;
  hair: MeshiHair;
  accessory: MeshiAccessory;
  eye: MeshiEyeStyle;
  badge: MeshiBadge;
  outfit: MeshiOutfit;
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
  hair: "meshiHair",
  accessory: "meshiAccessory",
  eye: "meshiEye",
  badge: "meshiBadge",
  outfit: "meshiOutfit",
  enabled: "meshiEnabled",
  appLogo: "meshiAppLogo",
  appLogoColor: "meshiAppLogoColor",
  title: "meshiTitle",
} as const;

const DEFAULTS: MeshiPreferences = {
  color: "blue",
  hat: "none",
  face: "happy",
  hair: "none",
  accessory: "none",
  eye: "regular",
  badge: "none",
  outfit: "none",
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

  const storedAccessory = localStorage.getItem(STORAGE_KEYS.accessory);

  return {
    color: (localStorage.getItem(STORAGE_KEYS.color) as MeshiColor) || DEFAULTS.color,
    hat: (localStorage.getItem(STORAGE_KEYS.hat) as MeshiHat) || DEFAULTS.hat,
    face: (localStorage.getItem(STORAGE_KEYS.face) as MeshiMood) || DEFAULTS.face,
    hair: (localStorage.getItem(STORAGE_KEYS.hair) as MeshiHair) || DEFAULTS.hair,
    accessory: ((storedAccessory === "lashes" ? "none" : storedAccessory) as MeshiAccessory) || DEFAULTS.accessory,
    eye: ((localStorage.getItem(STORAGE_KEYS.eye) || (storedAccessory === "lashes" ? "lashes" : "")) as MeshiEyeStyle) || DEFAULTS.eye,
    badge: (localStorage.getItem(STORAGE_KEYS.badge) as MeshiBadge) || DEFAULTS.badge,
    outfit: (localStorage.getItem(STORAGE_KEYS.outfit) as MeshiOutfit) || DEFAULTS.outfit,
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
  localStorage.setItem(STORAGE_KEYS.hair, prefs.hair);
  localStorage.setItem(STORAGE_KEYS.accessory, prefs.accessory);
  localStorage.setItem(STORAGE_KEYS.eye, prefs.eye);
  localStorage.setItem(STORAGE_KEYS.badge, prefs.badge);
  localStorage.setItem(STORAGE_KEYS.outfit, prefs.outfit);
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

export type ServerMeshiPreference = Awaited<ReturnType<typeof getMeshiPreference>>;

/**
 * Merge a server-side Meshi preference record into local storage and notify
 * every Meshi surface synchronously. The server record is the source of truth
 * for the cosmetic fields; local-only fields (enabled, app logo, title) are
 * preserved. Returns the merged preferences.
 */
export function applyServerMeshiPreferences(serverPref: ServerMeshiPreference): MeshiPreferences {
  const local = readMeshiPreferencesFromStorage();

  if (!serverPref) return local;

  const merged: MeshiPreferences = {
    ...local,
    color: (serverPref.colorTheme as MeshiColor) || local.color,
    hat: (serverPref.hatStyle as MeshiHat) || local.hat,
    face: (serverPref.faceStyle as MeshiMood) || local.face,
    hair: (serverPref.hairStyle as MeshiHair) || local.hair,
    accessory: (serverPref.accessoryStyle as MeshiAccessory) || local.accessory,
    eye: (serverPref.eyeStyle as MeshiEyeStyle) || local.eye,
    badge: (serverPref.badgeStyle as MeshiBadge) || local.badge,
    outfit: (serverPref.outfitStyle as MeshiOutfit) || local.outfit,
  };

  writeMeshiPreferencesToStorage(merged);
  broadcastMeshiPreferences(merged);
  return merged;
}

async function hydrateMeshiPreferencesFromServer() {
  const serverPref = await getMeshiPreference();
  return applyServerMeshiPreferences(serverPref);
}

/**
 * Shared hook for Meshi preferences.
 *
 * This is the single client-side source of truth for Meshi customization.
 * It keeps sidebar Meshi, floating Meshi, mesh-page Meshi, and settings in sync
 * across the current tab and other tabs.
 */
export function useMeshiPreferences(): MeshiPreferences & { refresh: () => void } {
  const [prefs, setPrefs] = useState<MeshiPreferences>(DEFAULTS);

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
