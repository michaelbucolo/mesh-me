"use client";

import { useEffect, useState } from "react";
import { initializePresenceAccount } from "@/lib/presence-account";
import { reconcileGhostAccount } from "@/hooks/use-ghost-mode";
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
export function MeshiPrefsBootstrap({ serverPref, account }: {
  serverPref: ServerMeshiPreference;
  account: { id: string; ghostMode: boolean; hideActivityStatus: boolean };
}) {
  useState(() => {
    if (typeof window === "undefined") return null;
    initializePresenceAccount(account.id, account.hideActivityStatus);
    reconcileGhostAccount(account.id, account.ghostMode);
    try {
      applyServerMeshiPreferences(serverPref);
    } catch {
      // Storage may be unavailable; surfaces fall back to their local read.
    }
    return null;
  });

  useEffect(() => {
    initializePresenceAccount(account.id, account.hideActivityStatus);
  }, [account.id, account.hideActivityStatus]);
  useEffect(() => {
    reconcileGhostAccount(account.id, account.ghostMode);
  }, [account.id, account.ghostMode]);

  return null;
}
