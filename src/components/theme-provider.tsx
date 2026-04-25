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

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
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
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [preset, setPresetState] = useState<ThemePreset>("default");
  const [customTheme, setCustomThemeState] = useState<ThemeCustomization | null>(null);
  const [mounted, setMounted] = useState(false);

  const resolve = useCallback((m: ThemeMode): ResolvedTheme => {
    return m === "system" ? getSystemTheme() : m;
  }, []);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      setMounted(true);
      const stored = localStorage.getItem("mesh-theme") as ThemeMode | null;
      const initial: ThemeMode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
      const storedPreset = localStorage.getItem("mesh-theme-preset") as ThemePreset | null;
      const initialPreset: ThemePreset = storedPreset ?? "default";
      const storedCustom = localStorage.getItem("mesh-theme-custom");
      const initialCustom: ThemeCustomization | null = storedCustom ? JSON.parse(storedCustom) : null;
      setModeState(initial);
      const resolved = resolve(initial);
      setResolvedTheme(resolved);
      setPresetState(initialPreset);
      setCustomThemeState(initialCustom);
      applyTheme(resolved);
      applyPreset(initialPreset);
      applyCustomTheme(initialCustom);
    }, 0);
    return () => clearTimeout(initTimer);
  }, [resolve]);

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    if (!mounted) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (mode === "system") {
        const resolved = getSystemTheme();
        setResolvedTheme(resolved);
        applyTheme(resolved);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode, mounted]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem("mesh-theme", newMode);
    const resolved = resolve(newMode);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  };

  const setPreset = (newPreset: ThemePreset) => {
    setPresetState(newPreset);
    localStorage.setItem("mesh-theme-preset", newPreset);
    applyPreset(newPreset);
  };

  const setCustomTheme = (colors: ThemeCustomization) => {
    setCustomThemeState(colors);
    localStorage.setItem("mesh-theme-custom", JSON.stringify(colors));
    applyCustomTheme(colors);
  };

  const clearCustomTheme = () => {
    setCustomThemeState(null);
    localStorage.removeItem("mesh-theme-custom");
    applyCustomTheme(null);
  };

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ mode, theme: resolvedTheme, preset, customTheme, setMode, setPreset, setCustomTheme, clearCustomTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
