// TODO(PR4-delete): transitional adapter — the ONLY doorway through which the
// old mesh-scene consumes the new core modules (camera / viewer / store), so
// every legacy entry point stays explicit and greppable until the scene is
// hollowed out and this file is deleted with it. New code must import from
// ../core directly, never from here.

export {
  clampZoom,
  createCamera,
  unprojectPoint,
  MIN_ZOOM,
  MAX_ZOOM,
  type Camera,
} from "../core/camera";
export { deriveViewerCaps } from "../core/viewer";
export { createMeshStore, type MeshStore } from "../core/store";
