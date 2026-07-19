"use client";

import { useEffect } from "react";
import { ConnectionSnappedError } from "@/components/errors/connection-snapped-error";
import "./globals.css";

// Applied from an effect rather than an inline <script>: raw inline tags
// carry no nonce, so the production script-src policy would block them.
function applyThemeFallback() {
  try {
    const root = document.documentElement;
    const storedMode = localStorage.getItem("mesh-theme");
    const mode = storedMode === "light" || storedMode === "dark" || storedMode === "system" ? storedMode : "dark";
    const resolved = mode === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : mode === "light" ? "light" : "dark";
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.dataset.themeMode = mode;
    root.dataset.resolvedTheme = resolved;
    root.style.colorScheme = resolved;
  } catch {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    applyThemeFallback();
  }, []);

  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="mesh-app-surface font-sans antialiased" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <ConnectionSnappedError reset={reset} homeHref="/" fullScreen />
      </body>
    </html>
  );
}
