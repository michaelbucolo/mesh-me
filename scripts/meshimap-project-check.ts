// THE MAP PROJECTION CONTRACT.
//
// Projection is the part of a map with exact answers, so it is the part worth
// gating. Every "the pin was in the wrong place" and "the map slid faster than
// my finger" bug is an arithmetic error in here, and a screenshot cannot tell
// a 3% scale error from a correct map.
//
// Run: npm run meshimap-project:check

import assert from "node:assert/strict";
import {
  clampZoom,
  clusterByCell,
  fanOut,
  fitCamera,
  latToY,
  lngToX,
  MAX_ZOOM,
  MIN_ZOOM,
  panCamera,
  project,
  unproject,
  xToLng,
  yToLat,
  type Camera,
} from "../src/lib/meshimap/project";

let n = 0;
function ok(condition: boolean, label: string): void {
  n++;
  assert.ok(condition, label);
}
function close(a: number, b: number, tol: number, label: string): void {
  n++;
  assert.ok(Math.abs(a - b) < tol, `${label} (got ${a}, wanted ${b} ±${tol})`);
}

const VIEW = { width: 800, height: 600 };

// ---------------------------------------------------------------------------
// 1. The projection itself.
// ---------------------------------------------------------------------------

close(lngToX(-180), 0, 1e-9, "the antimeridian is the left edge");
close(lngToX(0), 0.5, 1e-9, "Greenwich is the middle");
close(lngToX(180), 1, 1e-9, "…and the right edge");
close(latToY(0), 0.5, 1e-9, "the equator is the middle");
ok(latToY(45) < 0.5, "north is up (a smaller y)");
ok(latToY(-45) > 0.5, "south is down");

// THE POLE. Mercator diverges at ±90°, and an infinite coordinate does not
// render as a missing pin — it renders as a broken layout, because one NaN
// transform can take the whole surface down with it.
ok(Number.isFinite(latToY(90)), "the north pole projects to a finite y");
ok(Number.isFinite(latToY(-90)), "the south pole projects to a finite y");
ok(Number.isFinite(latToY(1e9)), "an absurd latitude still projects finitely");
ok(latToY(90) >= 0 && latToY(90) <= 1, "…and stays inside the map");

// Round trips. If these drift, dragging drifts with them.
for (const lat of [0, 12.5, -33.9, 51.5, -85, 85]) {
  close(yToLat(latToY(lat)), lat, 1e-6, `latitude ${lat} survives a round trip`);
}
for (const lng of [-180, -74, 0, 2.35, 139.7, 180]) {
  close(xToLng(lngToX(lng)), lng, 1e-6, `longitude ${lng} survives a round trip`);
}

// ---------------------------------------------------------------------------
// 2. The camera: what is centred is centred, and screen↔world agree.
// ---------------------------------------------------------------------------

const camera: Camera = { lat: 51.5, lng: -0.12, zoom: 11 };
{
  const p = project({ lat: camera.lat, lng: camera.lng }, camera, VIEW);
  close(p.x, VIEW.width / 2, 1e-6, "the camera centre lands at the viewport centre (x)");
  close(p.y, VIEW.height / 2, 1e-6, "…and (y)");
}
{
  const point = { lat: 51.52, lng: -0.08 };
  const p = project(point, camera, VIEW);
  const back = unproject(p, camera, VIEW);
  close(back.lat, point.lat, 1e-6, "project → unproject returns the same latitude");
  close(back.lng, point.lng, 1e-6, "…and longitude");
}

// East is right and north is up — sign errors here mirror the world.
{
  const centre = project({ lat: 51.5, lng: -0.12 }, camera, VIEW);
  const east = project({ lat: 51.5, lng: -0.02 }, camera, VIEW);
  const north = project({ lat: 51.6, lng: -0.12 }, camera, VIEW);
  ok(east.x > centre.x, "east is to the right");
  ok(north.y < centre.y, "north is up");
}

// Each zoom step doubles the scale. A map that does not is a map whose pins
// drift apart from its tiles as you zoom.
{
  const a: Camera = { lat: 0, lng: 0, zoom: 5 };
  const b: Camera = { lat: 0, lng: 0, zoom: 6 };
  const da = project({ lat: 0, lng: 10 }, a, VIEW).x - VIEW.width / 2;
  const db = project({ lat: 0, lng: 10 }, b, VIEW).x - VIEW.width / 2;
  close(db / da, 2, 1e-9, "one zoom step doubles the on-screen distance");
}

ok(clampZoom(0) === MIN_ZOOM, "zoom cannot go below the minimum");
ok(clampZoom(99) === MAX_ZOOM, "zoom cannot go above the maximum");
ok(clampZoom(Number.NaN) === MIN_ZOOM, "NaN zoom is not a zoom");

// ---------------------------------------------------------------------------
// 3. Panning tracks the finger EXACTLY. A map that slides at 0.9× or 1.1× the
//    drag feels broken in a way nobody can name, and it is pure arithmetic.
// ---------------------------------------------------------------------------

{
  const start: Camera = { lat: 40.7, lng: -74, zoom: 12 };
  const moved = panCamera(start, 100, 60);
  // A point pinned under the finger must appear 100px right and 60px down.
  const before = project({ lat: start.lat, lng: start.lng }, start, VIEW);
  const after = project({ lat: start.lat, lng: start.lng }, moved, VIEW);
  close(after.x - before.x, 100, 1e-6, "a horizontal drag moves the world exactly as far as the finger");
  close(after.y - before.y, 60, 1e-6, "…and vertically");
}

// You can circle the world sideways forever; there is nothing past the pole.
{
  let c: Camera = { lat: 0, lng: 179, zoom: 4 };
  for (let i = 0; i < 40; i++) c = panCamera(c, -400, 0);
  ok(c.lng >= -180 && c.lng <= 180, `longitude wraps rather than running off (${c.lng})`);
  ok(Number.isFinite(c.lng), "…and stays a number");
}
{
  let c: Camera = { lat: 80, lng: 0, zoom: 4 };
  for (let i = 0; i < 40; i++) c = panCamera(c, 0, -400);
  ok(c.lat <= 85.05114, `latitude clamps at the Mercator limit (${c.lat})`);
  ok(Number.isFinite(c.lat), "…and stays a number");
}

// ---------------------------------------------------------------------------
// 3b. Framing. A fixed opening zoom is wrong both ways, and on this map — whose
//     basemap is a coarse world outline — a fixed street zoom also shows no
//     land at all and the whole surface reads as broken.
// ---------------------------------------------------------------------------

{
  const fallback = { lat: 20, lng: 0, zoom: 2 };
  ok(fitCamera([], VIEW, fallback) === fallback, "nothing to frame returns the fallback untouched");
}
{
  // One person, or everyone in one cell: no extent to solve for, so the answer
  // is a useful neighbourhood view rather than a division by zero.
  const c = fitCamera([{ lat: 51.55, lng: -0.15 }], VIEW);
  close(c.lat, 51.55, 1e-6, "a single point is centred exactly");
  close(c.lng, -0.15, 1e-6, "…in both axes");
  ok(c.zoom >= 9 && c.zoom <= MAX_ZOOM, `one person gets a neighbourhood view (zoom ${c.zoom})`);
  const same = fitCamera([{ lat: 51.55, lng: -0.15 }, { lat: 51.55, lng: -0.15 }], VIEW);
  ok(same.zoom === c.zoom, "two people in one cell frame the same as one");
}
{
  // London and New York must BOTH be on screen — the whole point of framing.
  const points = [{ lat: 51.55, lng: -0.15 }, { lat: 40.75, lng: -73.95 }];
  const c = fitCamera(points, VIEW);
  for (const p of points) {
    const s2 = project(p, c, VIEW);
    ok(
      s2.x >= 0 && s2.x <= VIEW.width && s2.y >= 0 && s2.y <= VIEW.height,
      `a fitted camera puts (${p.lat}, ${p.lng}) on screen at (${Math.round(s2.x)}, ${Math.round(s2.y)})`,
    );
  }
}
{
  // A tall spread must be fitted by HEIGHT, not width — take the wrong axis
  // and the top and bottom of the set fall off the screen.
  const points = [{ lat: 60, lng: 0.01 }, { lat: -60, lng: -0.01 }];
  const c = fitCamera(points, VIEW);
  for (const p of points) {
    const s2 = project(p, c, VIEW);
    ok(s2.y >= 0 && s2.y <= VIEW.height, `a tall spread is fitted by height (y=${Math.round(s2.y)})`);
  }
}
{
  const c = fitCamera([{ lat: 89, lng: 0 }, { lat: -89, lng: 0 }], VIEW);
  ok(Number.isFinite(c.lat) && Number.isFinite(c.zoom), "framing pole-to-pole stays finite");
  ok(c.zoom >= MIN_ZOOM, "…and never below the minimum zoom");
}

// ---------------------------------------------------------------------------
// 4. The fan-out. Everyone in a cell reports the IDENTICAL point — that is the
//    privacy design — so without this, a populated cell shows one Meshi and
//    hides the rest.
// ---------------------------------------------------------------------------

{
  const solo = fanOut(0, 1);
  ok(solo.dx === 0 && solo.dy === 0, "one person in a cell is not pushed off their own point");
}
{
  const spread = [0, 1, 2, 3, 4].map((i) => fanOut(i, 5));
  const distinct = new Set(spread.map((p) => `${p.dx.toFixed(4)},${p.dy.toFixed(4)}`));
  ok(distinct.size === 5, `five people in one cell get five distinct spots (${distinct.size})`);
  const radii = spread.map((p) => Math.hypot(p.dx, p.dy));
  for (const r of radii) close(r, radii[0], 1e-6, "everyone in a cell sits on the SAME ring");
}
{
  // THE RING GROWS WITH THE CROWD. A fixed radius packs a bigger group into
  // the same circumference, and since every body carries a name label about as
  // tall as it is, they overlap — photographed at radius 22, one Meshi's label
  // lay across the next Meshi's face and swallowed the tap meant for it. What
  // has to stay roughly constant is the GAP between neighbours, not the radius.
  const gapAt = (total: number) => {
    const a = fanOut(0, total);
    const b = fanOut(1, total);
    return Math.hypot(a.dx - b.dx, a.dy - b.dy);
  };
  ok(gapAt(8) >= 20, `eight in a cell still leaves a usable gap (${gapAt(8).toFixed(1)}px)`);
  ok(gapAt(16) >= 20, `sixteen still does (${gapAt(16).toFixed(1)}px)`);
  const r3 = Math.hypot(fanOut(0, 3).dx, fanOut(0, 3).dy);
  const r16 = Math.hypot(fanOut(0, 16).dx, fanOut(0, 16).dy);
  ok(r16 > r3, `the ring widens as the crowd grows (${r3.toFixed(1)}px → ${r16.toFixed(1)}px)`);
}
{
  // Deterministic: the same index in the same group always lands identically,
  // so nobody jitters between renders and the offset carries no information.
  ok(fanOut(2, 5).dx === fanOut(2, 5).dx && fanOut(2, 5).dy === fanOut(2, 5).dy, "the fan-out is deterministic");
}

{
  const pins = [
    { userId: "c", at: { lat: 51.55, lng: -0.15 } },
    { userId: "a", at: { lat: 51.55, lng: -0.15 } },
    { userId: "b", at: { lat: 40.75, lng: -73.95 } },
    { userId: "d", at: { lat: 51.55, lng: -0.15 } },
  ];
  const cells = clusterByCell(pins);
  ok(cells.length === 2, `two distinct cells (${cells.length})`);
  const london = cells.find((c) => c.members.length === 3);
  ok(!!london, "three people share the London cell");
  ok(
    london!.members.map((m) => m.userId).join("") === "acd",
    "cell members sort by id, so every client fans them out identically",
  );
}

console.log(`meshimap projection contract OK — ${n} assertions (poles finite, pan is 1:1, cells fan out stably)`);
