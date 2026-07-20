"use client";

import { useContactPresence } from "./use-contact-presence";

/**
 * "Active now" line for a MeChat thread header — the same live presence that
 * powers Meshi on the mesh, surfaced where a conversation happens.
 */
export function ActiveNow({ userId, fallback }: { userId: string; fallback?: string }) {
  const online = useContactPresence();
  if (!online.has(userId)) {
    return fallback ? <p className="truncate text-xs text-[var(--mesh-text-secondary)] md:text-sm">{fallback}</p> : null;
  }
  return (
    <p className="flex items-center gap-1.5 truncate text-xs font-medium text-emerald-400 md:text-sm">
      <span className="mesh-presence-ping inline-flex h-2 w-2 rounded-full bg-emerald-400 text-emerald-400" />
      Active now
    </p>
  );
}
