"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";
const SURFACE_THEME_STORAGE_KEY = "mesh-surface-theme";

interface ThemeContextType {
  mode: ThemeMode;
  theme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "system",
  theme: "dark",
  setMode: () => {},
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

function applySurfaceTheme(themeId: string) {
  document.documentElement.setAttribute("data-surface-theme", themeId);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);

  const resolve = useCallback((m: ThemeMode): ResolvedTheme => {
    return m === "system" ? getSystemTheme() : m;
  }, []);

  useEffect(() => {
    const initTimer = setTimeout(() => {
      setMounted(true);
      const stored = localStorage.getItem("mesh-theme") as ThemeMode | null;
      const initial: ThemeMode = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
      setModeState(initial);
      const resolved = resolve(initial);
      setResolvedTheme(resolved);
      applyTheme(resolved);
      const storedSurfaceTheme = localStorage.getItem(SURFACE_THEME_STORAGE_KEY) || "midnight";
      applySurfaceTheme(storedSurfaceTheme);
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

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ mode, theme: resolvedTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
