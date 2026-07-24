// The PR3 runtime kill-switch: which paint core renders the mesh.
//
//   "next"   — the layered paint/ engine (default)
//   "legacy" — the untouched scene/scene-render.ts immediate-mode painter
//
// Read order: localStorage key `mesh_engine` (a deliberate operator/QA
// override that survives navigation), then the `?mesh_engine=` query param
// (one-off deep-link testing), then the default. Resolved ONCE at scene
// mount — the two cores share model, camera, physics, and hitmap, so
// flipping mid-session is unnecessary; a reload applies a new choice. The
// legacy core is deleted (with this flag) in PR4 after the soak window.

export type MeshEngineKind = "next" | "legacy";

const MESH_ENGINE_KEY = "mesh_engine";

function parse(value: string | null): MeshEngineKind | null {
  return value === "next" || value === "legacy" ? value : null;
}

export function resolveMeshEngine(): MeshEngineKind {
  if (typeof window === "undefined") return "next";
  try {
    const stored = parse(window.localStorage.getItem(MESH_ENGINE_KEY));
    if (stored) return stored;
  } catch {
    // Storage unavailable (private mode / embedded) — fall through.
  }
  try {
    const fromQuery = parse(new URLSearchParams(window.location.search).get(MESH_ENGINE_KEY));
    if (fromQuery) return fromQuery;
  } catch {
    // Malformed URL — fall through.
  }
  return "next";
}
