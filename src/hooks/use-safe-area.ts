/**
 * React hook for safe area insets.
 * Uses a hidden probe element to measure CSS environment variable
 * values for safe-area-inset-* and exposes them as numeric pixels.
 */

"use client";

import { useState, useEffect } from "react";

interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function useSafeArea(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    // Measure insets via a hidden probe element
    const probe = document.createElement("div");
    probe.style.cssText = `
      position: fixed;
      top: env(safe-area-inset-top, 0px);
      right: env(safe-area-inset-right, 0px);
      bottom: env(safe-area-inset-bottom, 0px);
      left: env(safe-area-inset-left, 0px);
      pointer-events: none;
      visibility: hidden;
      z-index: -1;
    `;
    document.body.appendChild(probe);

    const measure = () => {
      const rect = probe.getBoundingClientRect();
      setInsets({
        top: rect.top,
        right: window.innerWidth - rect.right,
        bottom: window.innerHeight - rect.bottom,
        left: rect.left,
      });
    };

    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
      document.body.removeChild(probe);
    };
  }, []);

  return insets;
}
