// The camera — and the ONLY world↔screen projection in the codebase.
//
// Screen origin is the viewport centre plus the pan, and world units scale by
// the zoom. Every module that needs to map between the mesh's world
// coordinates and the screen goes through `projectPoint`/`unprojectPoint`;
// nothing may inline this math again (the old scene reimplemented it seven
// times, and the copies drifted).

export interface Camera {
  panX: number;
  panY: number;
  zoom: number;
}

export const MIN_ZOOM = 0.22;
export const MAX_ZOOM = 2.4;

/** The camera every mesh starts with, before fit-to-content takes over. */
export function createCamera(): Camera {
  return { panX: 0, panY: 0, zoom: 0.6 };
}

export function clampZoom(zoom: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

/** World position → screen position, for a viewport of width×height. */
export function projectPoint(
  camera: Camera,
  width: number,
  height: number,
  wx: number,
  wy: number,
): { x: number; y: number } {
  return {
    x: width / 2 + camera.panX + wx * camera.zoom,
    y: height / 2 + camera.panY + wy * camera.zoom,
  };
}

/** Screen position → world position — the exact inverse of `projectPoint`. */
export function unprojectPoint(
  camera: Camera,
  width: number,
  height: number,
  sx: number,
  sy: number,
): { x: number; y: number } {
  return {
    x: (sx - width / 2 - camera.panX) / camera.zoom,
    y: (sy - height / 2 - camera.panY) / camera.zoom,
  };
}
