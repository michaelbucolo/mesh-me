// THE single source of truth for the mesh scene — a plain-TS external store
// the frame loop can read directly (no React) and React chrome can subscribe
// to via useSyncExternalStore. Mutations go through named actions only, so
// the view never reaches in and bumps model data itself.
//
// PR1 holds the coarse interactive facts (viewer, camera, selection); the
// full SceneSnapshot (nodes, roster, ui) moves in as later slices land. The
// old scene mirrors into this store through its transitional adapter so new
// modules can already read one authoritative state.

import { createCamera, type Camera } from "./camera";
import type { ViewerCaps } from "./viewer";

interface MeshStoreState {
  viewer: ViewerCaps;
  camera: Camera;
  /** Currently selected node id (lens/detail open), or null. */
  selectedId: string | null;
}

export interface MeshStore {
  getState(): MeshStoreState;
  /** useSyncExternalStore-compatible; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  // Named actions — the only way state changes.
  select(id: string | null): void;
  setCamera(camera: Camera): void;
  setViewer(viewer: ViewerCaps): void;
}

export function createMeshStore(viewer: ViewerCaps): MeshStore {
  let state: MeshStoreState = { viewer, camera: createCamera(), selectedId: null };
  const listeners = new Set<() => void>();

  const set = (next: Partial<MeshStoreState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select(id) {
      if (state.selectedId !== id) set({ selectedId: id });
    },
    setCamera(camera) {
      set({ camera });
    },
    setViewer(viewer) {
      if (state.viewer !== viewer) set({ viewer });
    },
  };
}
