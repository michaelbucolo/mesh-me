"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";
type ThemePreset = "default" | "instagram" | "ocean" | "sunset" | "forest" | "mono";

interface ThemeCustomization {
  accent: string;
  bgPrimary: string;
  bgSecondary: string;
  textPrimary: string;
  textSecondary: string;
  borderPrimary: string;
}

interface ThemeContextType {
  mode: ThemeMode;
  theme: ResolvedTheme;
  preset: ThemePreset;
  customTheme: ThemeCustomization | null;
  setMode: (mode: ThemeMode) => void;
  setPreset: (preset: ThemePreset) => void;
  setCustomTheme: (colors: ThemeCustomization) => void;
  clearCustomTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "system",
  theme: "dark",
  preset: "default",
  customTheme: null,
  setMode: () => {},
  setPreset: () => {},
  setCustomTheme: () => {},
  clearCustomTheme: () => {},
});

const THEME_MODE_KEY = "mesh-theme";
const THEME_PRESET_KEY = "mesh-theme-preset";
const THEME_CUSTOM_KEY = "mesh-theme-custom";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredMode(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_MODE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "dark";
}

function readStoredPreset(): ThemePreset {
  if (typeof window === "undefined") return "default";
  const stored = localStorage.getItem(THEME_PRESET_KEY);
  return stored === "instagram" || stored === "ocean" || stored === "sunset" || stored === "forest" || stored === "mono" || stored === "default"
    ? stored
    : "default";
}

function readStoredCustomTheme(): ThemeCustomization | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(THEME_CUSTOM_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as ThemeCustomization;
  } catch {
    localStorage.removeItem(THEME_CUSTOM_KEY);
    return null;
  }
}

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return mode === "system" ? getSystemTheme() : mode;
}

function updateBrowserThemeColor(resolved: ResolvedTheme) {
  const color = resolved === "light" ? "#f7f9fc" : "#0d1117";
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    if (!meta.media) meta.content = color;
  });
}

function applyTheme(mode: ThemeMode, resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.dataset.themeMode = mode;
  root.dataset.resolvedTheme = resolved;
  root.style.colorScheme = resolved;
  updateBrowserThemeColor(resolved);
}

function applyPreset(preset: ThemePreset) {
  document.documentElement.setAttribute("data-theme", preset);
}

function applyCustomTheme(customTheme: ThemeCustomization | null) {
  const root = document.documentElement;
  if (!customTheme) {
    root.removeAttribute("data-custom-theme");
    root.style.removeProperty("--accent");
    root.style.removeProperty("--accent-hover");
    root.style.removeProperty("--accent-muted");
    root.style.removeProperty("--accent-subtle");
    root.style.removeProperty("--bg-primary");
    root.style.removeProperty("--bg-secondary");
    root.style.removeProperty("--text-primary");
    root.style.removeProperty("--text-secondary");
    root.style.removeProperty("--border-primary");
    root.style.removeProperty("--brand-gradient");
    root.style.removeProperty("--brand-gradient-vibrant");
    return;
  }

  root.setAttribute("data-custom-theme", "true");
  root.style.setProperty("--accent", customTheme.accent);
  root.style.setProperty("--accent-hover", customTheme.accent);
  root.style.setProperty("--accent-muted", `${customTheme.accent}33`);
  root.style.setProperty("--accent-subtle", `${customTheme.accent}1f`);
  root.style.setProperty("--bg-primary", customTheme.bgPrimary);
  root.style.setProperty("--bg-secondary", customTheme.bgSecondary);
  root.style.setProperty("--text-primary", customTheme.textPrimary);
  root.style.setProperty("--text-secondary", customTheme.textSecondary);
  root.style.setProperty("--border-primary", customTheme.borderPrimary);
  root.style.setProperty("--brand-gradient", `linear-gradient(135deg, ${customTheme.accent} 0%, ${customTheme.textPrimary} 100%)`);
  root.style.setProperty("--brand-gradient-vibrant", `linear-gradient(135deg, ${customTheme.accent} 0%, ${customTheme.bgSecondary} 50%, ${customTheme.textPrimary} 100%)`);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(readStoredMode()));
  const [preset, setPresetState] = useState<ThemePreset>(() => readStoredPreset());
  const [customTheme, setCustomThemeState] = useState<ThemeCustomization | null>(() => readStoredCustomTheme());

  const resolve = useCallback((m: ThemeMode): ResolvedTheme => {
    return resolveTheme(m);
  }, []);

  useEffect(() => {
    applyTheme(mode, resolvedTheme);
    applyPreset(preset);
    applyCustomTheme(customTheme);
  }, [customTheme, mode, preset, resolvedTheme]);

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (mode === "system") {
        const resolved = getSystemTheme();
        setResolvedTheme(resolved);
        applyTheme(mode, resolved);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(THEME_MODE_KEY, newMode);
    const resolved = resolve(newMode);
    setResolvedTheme(resolved);
    applyTheme(newMode, resolved);
  };

  const setPreset = (newPreset: ThemePreset) => {
    setPresetState(newPreset);
    localStorage.setItem(THEME_PRESET_KEY, newPreset);
    applyPreset(newPreset);
  };

  const setCustomTheme = (colors: ThemeCustomization) => {
    setCustomThemeState(colors);
    localStorage.setItem(THEME_CUSTOM_KEY, JSON.stringify(colors));
    applyCustomTheme(colors);
  };

  const clearCustomTheme = () => {
    setCustomThemeState(null);
    localStorage.removeItem(THEME_CUSTOM_KEY);
    applyCustomTheme(null);
  };

  return (
    <ThemeContext.Provider value={{ mode, theme: resolvedTheme, preset, customTheme, setMode, setPreset, setCustomTheme, clearCustomTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
