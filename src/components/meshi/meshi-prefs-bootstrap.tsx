"use client";

import { useState } from "react";
import {
  applyServerMeshiPreferences,
  type ServerMeshiPreference,
} from "@/hooks/use-meshi-preferences";

/**
 * Seeds the server-backed Meshi preference into local storage on the very
 * first client render, before any Meshi surface paints. This keeps the
 * formation loader, floating companion, sidebar brand and settings preview
 * showing the same unified Meshi with no default-blue flash on a fresh
 * device or after a server-side navigation.
 */
export function MeshiPrefsBootstrap({ serverPref }: { serverPref: ServerMeshiPreference }) {
  useState(() => {
    if (typeof window === "undefined") return null;
    try {
      applyServerMeshiPreferences(serverPref);
    } catch {
      // Storage may be unavailable; surfaces fall back to their local read.
    }
    return null;
  });

  return null;
}
