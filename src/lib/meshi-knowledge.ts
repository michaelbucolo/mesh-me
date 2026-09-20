/**
 * Older clients stored Mesh context and conversations without an account key.
 * Neither is safe to reuse after signing out. Context now lives only in the
 * current session; the separate, consented Meshi journal remains server-owned.
 * Never read these legacy values, even during cleanup.
 */
export function clearLegacyMeshiContext(): void {
  if (typeof window === "undefined") return;
  for (const key of ["meshi-knowledge", "meshi-chat-history"]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Storage may be unavailable. No caller reads either legacy key anymore.
    }
  }
}
