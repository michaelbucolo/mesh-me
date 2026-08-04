// PUTTING A CELL ON A SCREEN.
//
// Separate from the map component on purpose: projection is arithmetic with
// exact answers, so it can be gated, while the component is pixels and cannot.
// Every "the pin was in the wrong place" bug lives in here, where a test can
// reach it.
//
// ── WHY WEB MERCATOR ───────────────────────────────────────────────────────
//
// Not because it is a good projection — it badly inflates high latitudes — but
// because it is the one every slippy map on Earth uses, so a MeshiMap tile and
// anyone's mental model of "where things are" agree. An equal-area projection
// would be more honest about Greenland and more surprising about everything.

/** The visible window, as a centre plus a zoom. */
export type Camera = {
  lat: number;
  lng: number;
  /** Slippy-map zoom: each step doubles the scale. */
  zoom: number;
};

export type Viewport = { width: number; height: number };

/** Pixels per tile at zoom 0 — the universal slippy-map constant. */
const TILE = 256;

export const MIN_ZOOM = 2;
export const MAX_ZOOM = 16;

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/**
 * Latitude → Mercator y in 0..1.
 *
 * Mercator diverges at the poles, so latitude is clamped to ±85.05113° (the
 * standard web-map limit) BEFORE the tangent. Without the clamp a pin near a
 * pole projects to infinity, and an infinite coordinate does not render as a
 * missing pin — it renders as a broken layout, because one NaN transform can
 * take the whole surface with it.
 */
export function latToY(lat: number): number {
  const clamped = Math.min(85.05113, Math.max(-85.05113, lat));
  const rad = (clamped * Math.PI) / 180;
  const y = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
  // The result is clamped too, not just the input. 85.05113° is where the
  // Mercator y works out to 0 — but only to about fifteen decimal places, so
  // the float lands a hair OUTSIDE 0..1 and a pole pin renders a hair off the
  // map. y is a fraction of the map by definition; it cannot be outside it.
  return Math.min(1, Math.max(0, y));
}

export function lngToX(lng: number): number {
  return (lng + 180) / 360;
}

/** Inverse of {@link latToY}, for turning a drag back into a centre. */
export function yToLat(y: number): number {
  const n = Math.PI * (1 - 2 * y);
  return (180 / Math.PI) * Math.atan(Math.sinh(n));
}

export function xToLng(x: number): number {
  return x * 360 - 180;
}

/** Where a coordinate lands in the viewport, in pixels from its top-left. */
export function project(
  point: { lat: number; lng: number },
  camera: Camera,
  viewport: Viewport,
): { x: number; y: number } {
  const scale = TILE * 2 ** camera.zoom;
  const cx = lngToX(camera.lng) * scale;
  const cy = latToY(camera.lat) * scale;
  return {
    x: lngToX(point.lng) * scale - cx + viewport.width / 2,
    y: latToY(point.lat) * scale - cy + viewport.height / 2,
  };
}

/** The inverse — a screen point back to a coordinate. Used by dragging, so an
 * error here shows up as the map sliding at the wrong speed under your finger. */
export function unproject(
  screen: { x: number; y: number },
  camera: Camera,
  viewport: Viewport,
): { lat: number; lng: number } {
  const scale = TILE * 2 ** camera.zoom;
  const cx = lngToX(camera.lng) * scale;
  const cy = latToY(camera.lat) * scale;
  return {
    lat: yToLat((screen.y - viewport.height / 2 + cy) / scale),
    lng: xToLng((screen.x - viewport.width / 2 + cx) / scale),
  };
}

/** Move the camera by a screen-space drag. Panning in pixels and converting
 * once is the only way the map tracks the finger exactly at every zoom. */
export function panCamera(camera: Camera, dxPixels: number, dyPixels: number): Camera {
  const scale = TILE * 2 ** camera.zoom;
  const x = lngToX(camera.lng) - dxPixels / scale;
  const y = latToY(camera.lat) - dyPixels / scale;
  return {
    // Latitude is CLAMPED, longitude WRAPS. That asymmetry is the globe's, not
    // a shortcut: you can circle the world sideways forever and there is
    // nothing past the pole.
    lat: Math.min(85.05113, Math.max(-85.05113, yToLat(Math.min(1, Math.max(0, y))))),
    lng: xToLng(x - Math.floor(x)),
    zoom: camera.zoom,
  };
}

/**
 * Frame a set of points.
 *
 * A fixed opening zoom is wrong in both directions: too tight and the map
 * opens on an empty patch with everyone off-screen, too loose and the people
 * near you are three pixels apart. Worse, this map's basemap is a coarse world
 * outline, so a fixed street-level zoom shows no land at all and the whole
 * surface reads as broken.
 *
 * So the camera frames whatever there is. One person is a sensible
 * neighbourhood view; a spread-out set zooms out until they all fit.
 */
export function fitCamera(
  points: ReadonlyArray<{ lat: number; lng: number }>,
  viewport: Viewport,
  fallback: Camera = { lat: 20, lng: 0, zoom: MIN_ZOOM },
): Camera {
  if (points.length === 0) return fallback;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const x = lngToX(p.lng);
    const y = latToY(p.lat);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const centre = { lat: yToLat((minY + maxY) / 2), lng: xToLng((minX + maxX) / 2) };

  // Everyone in one cell — or one person — has no extent to fit, so there is
  // nothing to solve for and a neighbourhood view is the useful answer.
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX <= 0 && spanY <= 0) return { ...centre, zoom: clampZoom(11) };

  // Padded so nobody sits against an edge, where half their Meshi is cut off.
  const usableW = Math.max(1, viewport.width * 0.72);
  const usableH = Math.max(1, viewport.height * 0.72);
  const zoomX = spanX > 0 ? Math.log2(usableW / (TILE * spanX)) : Infinity;
  const zoomY = spanY > 0 ? Math.log2(usableH / (TILE * spanY)) : Infinity;

  return { ...centre, zoom: clampZoom(Math.floor(Math.min(zoomX, zoomY))) };
}

/**
 * Spread pins that landed on the same spot.
 *
 * Everyone in one cell reports the IDENTICAL coordinate — that is the whole
 * privacy design — so at any zoom a populated cell stacks every Meshi in it
 * into one body and the rest are invisible. The fan-out is cosmetic and
 * deterministic (seeded by user id, never random), so a person does not
 * jitter between renders and nobody's apparent offset carries information
 * about where they actually are.
 */
export function fanOut(index: number, total: number, radiusPx = 34): { dx: number; dy: number } {
  if (total <= 1) return { dx: 0, dy: 0 };
  // The ring GROWS with the crowd. A fixed radius packs six people into the
  // same circumference two used, and since each body carries a name label
  // roughly as tall as it is, they overlap: photographed at 22px, one Meshi's
  // label sat across the next Meshi's face and swallowed the tap meant for it.
  // Spacing the ring by member count keeps the gap between neighbours roughly
  // constant however many turn up.
  // 38px of circumference each: a 34px body plus a little air. Measured at
  // 26 the ring was tight enough that a name label still grazed the face of
  // the Meshi below it.
  const spaced = Math.max(radiusPx, (total * 38) / (2 * Math.PI));
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
  return { dx: Math.cos(angle) * spaced, dy: Math.sin(angle) * spaced };
}

/** Group pins that share a cell, in a stable order so the fan-out is stable. */
export function clusterByCell<T extends { userId: string; at: { lat: number; lng: number } }>(
  pins: readonly T[],
): Array<{ key: string; members: T[] }> {
  const cells = new Map<string, T[]>();
  for (const pin of pins) {
    const key = `${pin.at.lat},${pin.at.lng}`;
    const bucket = cells.get(key);
    if (bucket) bucket.push(pin);
    else cells.set(key, [pin]);
  }
  return [...cells.entries()].map(([key, members]) => ({
    key,
    // Sorted by id, not by arrival: the same set of people must fan out the
    // same way on every client and every refresh.
    members: members.slice().sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0)),
  }));
}
