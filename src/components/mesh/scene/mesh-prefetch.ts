"use client";

// First-load prefetch for /api/mesh. The scene bundle is heavy and only
// fetches its data after being downloaded, parsed, and mounted — a strict
// waterfall on the primary post-login surface. The lightweight loader shell
// starts the request immediately so it runs in parallel with the chunk
// download; the scene consumes the in-flight promise on first load and falls
// back to a normal fetch for refreshes.

type MeshPrefetchEntry = { promise: Promise<Response>; startedAt: number };

const PREFETCH_MAX_AGE_MS = 15000;
const meshPrefetches = new Map<string, MeshPrefetchEntry>();

export function meshApiUrl(viewUserId?: string, viewMode: "mesh" | "global" = "mesh") {
  // Global is the guest-viewable world supply (already privacy-safe); it never
  // takes a ?user= and is mutually exclusive with viewing a specific person.
  if (viewMode === "global") return "/api/mesh/global";
  return viewUserId ? `/api/mesh?user=${encodeURIComponent(viewUserId)}` : "/api/mesh";
}

export function prefetchMesh(url: string) {
  if (meshPrefetches.has(url)) return;
  meshPrefetches.set(url, {
    promise: fetch(url, { cache: "no-store" }),
    startedAt: Date.now(),
  });
}

/** One-shot: returns the in-flight first-load request if it's still fresh. */
export function takeMeshPrefetch(url: string): Promise<Response> | undefined {
  const entry = meshPrefetches.get(url);
  if (!entry) return undefined;
  meshPrefetches.delete(url);
  if (Date.now() - entry.startedAt > PREFETCH_MAX_AGE_MS) {
    entry.promise.then((res) => res.body?.cancel()).catch(() => {});
    return undefined;
  }
  return entry.promise;
}
