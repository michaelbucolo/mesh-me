"use client";

import { useEffect } from "react";
import { ConnectionSnappedError } from "@/components/errors/connection-snapped-error";
import "./globals.css";

const themeFallbackScript = `
(function () {
  try {
    var root = document.documentElement;
    var storedMode = localStorage.getItem("mesh-theme");
    var mode = storedMode === "light" || storedMode === "dark" || storedMode === "system" ? storedMode : "dark";
    var resolved = mode === "system" && window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : mode === "light" ? "light" : "dark";
    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    root.dataset.themeMode = mode;
    root.dataset.resolvedTheme = resolved;
    root.style.colorScheme = resolved;
  } catch {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="mesh-app-surface font-sans antialiased" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
        <script dangerouslySetInnerHTML={{ __html: themeFallbackScript }} />
        <ConnectionSnappedError reset={reset} homeHref="/" fullScreen />
      </body>
    </html>
  );
}
