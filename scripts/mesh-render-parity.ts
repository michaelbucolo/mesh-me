// The renderer's structural contract (`npm run mesh:render-parity`).
//
// This gate began life proving the new paint engine emitted the same draw-call
// stream as the legacy immediate-mode painter. That painter is gone — the
// paint/ engine is now the only renderer — so the dual-core comparison retired
// with it and what remains is the renderer's own standing contract, asserted
// in plain Node against a recording 2D-context stub (no canvas dependency):
//
//   1. DETERMINISM — one model + one frame → one op stream, every time, across
//      four scenarios (selection/hover/pulse/birth, the self panel, a
//      zoomed-out branch focus, Pro visuals). Catches order-dependence,
//      time-seeding, and state leaking across engine mounts.
//   2. CACHED MODE  — sprite/blit counts, a repeat frame re-rasterizing
//      nothing, hover re-rastering only what changed, dispose emptying caches.
//   3. TIER SEMANTICS — T1 drops shadows, T2 drops fx and freezes the sky,
//      and every tier still draws the same node population (fidelity changes,
//      never content).
//   4. MEMORY CEILINGS — the image/sprite LRUs evict by both count and bytes.
//   5. GOVERNOR — the ladder demotes and promotes, and never sinks below the
//      device probe's floor.
//   6. SPATIAL GRID — strand routing is equivalent to the brute-force scan it
//      replaced.
//
// Pixel-level fidelity is verified in a real browser (parity screenshots);
// this gate covers everything a rasterizer-free environment honestly can.

import assert from "node:assert/strict";
import { createQualityGovernor, TIER_PARAMS, type QualityTier } from "../src/components/mesh/core/motion";
import type { MeshFrameStats } from "../src/components/mesh/core/scheduler";
import type { ScenePaintOptions } from "../src/components/mesh/paint/types";
import type { BranchKey, SceneModel, SceneNode, SceneNodeKind } from "../src/components/mesh/scene/scene-model";
import { createPaintEngine } from "../src/components/mesh/paint";
import { LruCache } from "../src/components/mesh/paint/caches";
import { SpatialGrid } from "../src/components/mesh/sim/spatial-grid";

// ---------------------------------------------------------------------------
// Recording 2D context stub
// ---------------------------------------------------------------------------

type Op = string;

const surfaceIds = new WeakMap<object, string>();
let surfaceSeq = 0;

function nameOf(source: unknown): string {
  if (source && typeof source === "object") {
    const img = source as { naturalWidth?: number; naturalHeight?: number };
    if (typeof img.naturalWidth === "number" && !surfaceIds.has(source)) {
      return `img(${img.naturalWidth}x${img.naturalHeight})`;
    }
    let id = surfaceIds.get(source);
    if (!id) {
      id = `surface#${surfaceSeq++}`;
      surfaceIds.set(source, id);
    }
    return id;
  }
  return String(source);
}

function fmt(value: unknown): string {
  if (typeof value === "number") {
    const r = Math.round(value * 1000) / 1000;
    return Object.is(r, -0) ? "0" : String(r);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (value instanceof RecordingGradient) return value.id;
  if (Array.isArray(value)) return `[${value.map(fmt).join(",")}]`;
  if (value && typeof value === "object") return nameOf(value);
  return String(value);
}

class RecordingGradient {
  constructor(
    private readonly ops: Op[],
    readonly id: string,
  ) {}

  addColorStop(offset: number, color: string): void {
    this.ops.push(`${this.id}.addColorStop(${fmt(offset)},${fmt(color)})`);
  }
}

class RecordingContext {
  readonly ops: Op[] = [];
  private gradSeq = 0;
  private fontState = "10px sans-serif";

  constructor(readonly label: string) {}

  private record(name: string, args: unknown[]): void {
    this.ops.push(`${name}(${args.map(fmt).join(",")})`);
  }

  private setProp(name: string, value: unknown): void {
    this.ops.push(`set ${name}=${fmt(value)}`);
  }

  // Recorded style properties.
  set fillStyle(v: unknown) { this.setProp("fillStyle", v); }
  set strokeStyle(v: unknown) { this.setProp("strokeStyle", v); }
  set lineWidth(v: number) { this.setProp("lineWidth", v); }
  set globalAlpha(v: number) { this.setProp("globalAlpha", v); }
  set textAlign(v: string) { this.setProp("textAlign", v); }
  set textBaseline(v: string) { this.setProp("textBaseline", v); }
  set shadowColor(v: string) { this.setProp("shadowColor", v); }
  set shadowBlur(v: number) { this.setProp("shadowBlur", v); }
  set shadowOffsetY(v: number) { this.setProp("shadowOffsetY", v); }
  set lineCap(v: string) { this.setProp("lineCap", v); }
  set lineJoin(v: string) { this.setProp("lineJoin", v); }
  set globalCompositeOperation(v: string) { this.setProp("globalCompositeOperation", v); }
  set font(v: string) {
    this.fontState = v;
    this.setProp("font", v);
  }
  get font(): string {
    return this.fontState;
  }

  // Deterministic text metrics — same stub class serves both renderers, so
  // both see identical widths (which is all parity needs).
  measureText(text: string): { width: number } {
    const m = /(\d+(?:\.\d+)?)px/.exec(this.fontState);
    const size = m ? parseFloat(m[1]) : 10;
    let w = 0;
    for (const ch of text) w += ch === " " ? 0.32 : ch === "…" ? 0.82 : 0.58;
    return { width: Math.round(w * size * 100) / 100 };
  }

  createRadialGradient(...args: number[]): RecordingGradient {
    const g = new RecordingGradient(this.ops, `radial#${this.gradSeq++}`);
    this.record("createRadialGradient", args);
    return g;
  }

  createLinearGradient(...args: number[]): RecordingGradient {
    const g = new RecordingGradient(this.ops, `linear#${this.gradSeq++}`);
    this.record("createLinearGradient", args);
    return g;
  }

  clearRect(...a: number[]): void { this.record("clearRect", a); }
  fillRect(...a: number[]): void { this.record("fillRect", a); }
  beginPath(): void { this.record("beginPath", []); }
  closePath(): void { this.record("closePath", []); }
  arc(...a: number[]): void { this.record("arc", a); }
  arcTo(...a: number[]): void { this.record("arcTo", a); }
  moveTo(...a: number[]): void { this.record("moveTo", a); }
  lineTo(...a: number[]): void { this.record("lineTo", a); }
  bezierCurveTo(...a: number[]): void { this.record("bezierCurveTo", a); }
  quadraticCurveTo(...a: number[]): void { this.record("quadraticCurveTo", a); }
  fill(): void { this.record("fill", []); }
  stroke(): void { this.record("stroke", []); }
  clip(): void { this.record("clip", []); }
  save(): void { this.record("save", []); }
  restore(): void { this.record("restore", []); }
  translate(...a: number[]): void { this.record("translate", a); }
  rotate(...a: number[]): void { this.record("rotate", a); }
  setTransform(...a: number[]): void { this.record("setTransform", a); }
  setLineDash(a: number[]): void { this.record("setLineDash", [a]); }
  fillText(...a: unknown[]): void { this.record("fillText", a); }
  drawImage(...a: unknown[]): void { this.record("drawImage", a); }
}

function asCtx(rec: RecordingContext): CanvasRenderingContext2D {
  return rec as unknown as CanvasRenderingContext2D;
}

/** A recording offscreen surface (for the atlas / background layer). */
class RecordingSurface {
  width: number;
  height: number;
  readonly ctx: RecordingContext;

  constructor(w: number, h: number, label: string) {
    this.width = w;
    this.height = h;
    this.ctx = new RecordingContext(label);
  }

  getContext(kind: "2d"): CanvasRenderingContext2D | null {
    return kind === "2d" ? asCtx(this.ctx) : null;
  }
}

// ---------------------------------------------------------------------------
// Deterministic scene model
// ---------------------------------------------------------------------------

const T0 = 123456; // the fixed frame timestamp

function fakeImage(w: number, h: number): HTMLImageElement {
  return { complete: true, naturalWidth: w, naturalHeight: h, width: w, height: h } as unknown as HTMLImageElement;
}

interface NodeSeed extends Partial<SceneNode> {
  id: string;
  kind: SceneNodeKind;
  label: string;
  color: string;
}

function makeNode(seed: NodeSeed): SceneNode {
  return {
    sublabel: undefined,
    parentId: null,
    childIds: [],
    branch: null as BranchKey | null,
    weight: 0.5,
    x: 0,
    y: 0,
    angle: 0,
    depth: 1,
    dx: 0,
    dy: 0,
    vx: 0,
    vy: 0,
    ...seed,
  } as SceneNode;
}

function buildModel(): { model: SceneModel; images: Map<string, HTMLImageElement> } {
  const nodes = new Map<string, SceneNode>();
  const add = (n: SceneNode) => nodes.set(n.id, n);

  add(makeNode({
    id: "self", kind: "self", label: "Robin Mesh", sublabel: "@robin", color: "#6e8bff",
    description: "Weaving a small corner of the web together, one strand at a time.",
    isVerified: true, avatarUrl: "https://cdn.example/self.jpg",
    depth: 0, x: 0, y: 0, dx: 0, dy: 0,
  }));
  add(makeNode({
    id: "branch:posts", kind: "branch", label: "Posts", color: "#22d3ee", branch: "posts",
    parentId: "self", count: 3, x: 0, y: -180, dx: 2, dy: -178, depth: 1, angle: -Math.PI / 2,
  }));
  add(makeNode({
    id: "branch:platforms", kind: "branch", label: "Platforms", color: "#f59e0b", branch: "platforms",
    parentId: "self", count: 1, x: 0, y: 190, dx: -3, dy: 188, depth: 1, angle: Math.PI / 2,
  }));
  add(makeNode({
    id: "platform:youtube", kind: "platform", label: "YouTube", sublabel: "youtube", color: "#ff0000",
    parentId: "branch:platforms", branch: "platforms", weight: 0.7,
    x: -60, y: 250, dx: -58, dy: 248, depth: 2,
  }));
  add(makeNode({
    id: "person:u1", kind: "person", label: "Ana", sublabel: "@ana", color: "#818cf8",
    parentId: "self", branch: "people", weight: 0.8, closeness: 0.9, status: "online",
    x: -220, y: -40, dx: -218, dy: -42, depth: 1,
  }));
  add(makeNode({
    id: "person:u2", kind: "person", label: "Bela", sublabel: "@bela", color: "#f472b6",
    parentId: "self", branch: "people", weight: 0.4, closeness: 0.5,
    avatarUrl: "https://cdn.example/bela.jpg",
    x: 230, y: 30, dx: 228, dy: 32, depth: 1,
  }));
  add(makeNode({
    id: "post:1", kind: "post", label: "Trail dawn", sublabel: "Mesh.me", color: "#22d3ee",
    parentId: "branch:posts", branch: "posts", weight: 0.6, freshness: 0.9, isNew: true,
    content: "Caught the sunrise over the ridge — the whole valley glowed like a strand pulse.",
    meta: [
      { label: "Likes", value: "12" },
      { label: "Comments", value: "3" },
      { label: "Time", value: "2h" },
    ],
    x: -90, y: -260, dx: -88, dy: -258, depth: 2,
  }));
  add(makeNode({
    id: "post:2", kind: "post", label: "Studio notes", sublabel: "Mesh.me", color: "#22d3ee",
    parentId: "branch:posts", branch: "posts", weight: 0.5, freshness: 0.4,
    content: "Long-form thing about the rebuild.",
    imageUrl: "https://cdn.example/p2.jpg",
    meta: [
      { label: "Likes", value: "4" },
      { label: "Comments", value: "1" },
      { label: "Ago", value: "3d" },
    ],
    x: 110, y: -250, dx: 108, dy: -252, depth: 2,
  }));
  add(makeNode({
    id: "post:3", kind: "post", label: "Mid-birth", sublabel: "Mesh.me", color: "#22d3ee",
    parentId: "branch:posts", branch: "posts", weight: 0.5, freshness: 1,
    content: "Arriving right now.",
    bornAt: T0 - 500,
    x: 10, y: -320, dx: 8, dy: -318, depth: 2,
  }));
  add(makeNode({
    id: "post:unborn", kind: "post", label: "Not yet", sublabel: "Mesh.me", color: "#22d3ee",
    parentId: "branch:posts", branch: "posts", weight: 0.5, freshness: 1,
    content: "Still waiting in the wings.",
    bornAt: T0 + 400,
    x: 60, y: -330, dx: 58, dy: -328, depth: 2,
  }));
  add(makeNode({
    id: "community:c1", kind: "community", label: "Weavers", color: "#c084fc",
    parentId: "self", branch: "communities", weight: 0.6,
    x: 200, y: 170, dx: 198, dy: 168, depth: 1,
  }));

  const images = new Map<string, HTMLImageElement>();
  images.set("self", fakeImage(96, 96));
  images.set("person:u2", fakeImage(80, 80));
  images.set("post:2", fakeImage(320, 180));

  return { model: { selfId: "self", nodes }, images };
}

function frameOptions(
  ctx: CanvasRenderingContext2D,
  model: SceneModel,
  images: Map<string, HTMLImageElement>,
  overrides: Partial<ScenePaintOptions> = {},
): ScenePaintOptions {
  return {
    ctx,
    model,
    width: 900,
    height: 700,
    camera: { panX: 14, panY: -6, zoom: 0.92 },
    time: T0,
    activeBranch: null,
    selectedId: "person:u1",
    focusId: "post:1",
    hoverId: "post:1",
    images,
    visuals: { connectionColor: "#8b5cf6", nodeStyle: null, atmosphere: "midnight" },
    avoidCenter: true,
    isOwnMesh: true,
    strands: new Map([
      ["self>person:u1", { mx: -112, my: -8 }],
      ["branch:posts>post:1", { mx: -44, my: -212 }],
    ]),
    strandPulses: new Map([["branch:posts>post:1", T0 - 300]]),
    livePresence: new Map([["u1", { where: null, route: "/flow" }]]),
    ...overrides,
  };
}

function firstDivergence(a: Op[], b: Op[]): number {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) if (a[i] !== b[i]) return i;
  return a.length === b.length ? -1 : n;
}

function assertSameOps(a: Op[], b: Op[], label: string): void {
  const at = firstDivergence(a, b);
  if (at !== -1) {
    const ctxLines = (ops: Op[]) => ops.slice(Math.max(0, at - 3), at + 4).join("\n    ");
    assert.fail(
      `${label}: draw-call streams diverge at op ${at} ` +
        `(run A ${a.length} ops, run B ${b.length} ops)\n` +
        `  A:\n    ${ctxLines(a)}\n  B:\n    ${ctxLines(b)}`,
    );
  }
}

let passed = 0;
function ok(label: string): void {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

// ---------------------------------------------------------------------------
// 1. T0 draw determinism: one model, one frame → one op stream, every time
// ---------------------------------------------------------------------------

console.log("mesh-render-contract");

{
  const scenarios: { label: string; overrides: Partial<ScenePaintOptions> }[] = [
    { label: "resting frame (selection + hover + pulse + birth)", overrides: {} },
    { label: "self panel open", overrides: { selectedId: "self", hoverId: "self", focusId: null } },
    { label: "branch focus, zoomed out (cards collapse to orbs)", overrides: { activeBranch: "posts", hoverId: null, selectedId: null, camera: { panX: 0, panY: 0, zoom: 0.38 } } },
    { label: "pro visuals (atmosphere + node style + thread color)", overrides: { visuals: { connectionColor: "#f43f5e", nodeStyle: "glass", atmosphere: "ember" } } },
  ];
  for (const { label, overrides } of scenarios) {
    // Two independent engines, same inputs, direct (un-cached) mode: the op
    // stream must be byte-identical. Anything order-dependent, time-seeded,
    // or leaking state across mounts breaks this.
    const runOnce = () => {
      const { model, images } = buildModel();
      const rec = new RecordingContext("direct");
      const engine = createPaintEngine({ cached: false, createSurface: () => null });
      engine.draw(frameOptions(asCtx(rec), model, images, overrides), 0);
      engine.dispose();
      return rec.ops;
    };
    const first = runOnce();
    const second = runOnce();
    assertSameOps(first, second, label);
    assert.ok(first.length > 200, `${label}: scene should be non-trivial (got ${first.length} ops)`);
    ok(`T0 determinism — ${label} (${first.length} identical ops)`);
  }
}

// ---------------------------------------------------------------------------
// 2. Atlas + background cached mode: structural coverage
// ---------------------------------------------------------------------------

{
  const { model, images } = buildModel();
  const surfaces: RecordingSurface[] = [];
  const engine = createPaintEngine({
    cached: true,
    createSurface: (w, h) => {
      const s = new RecordingSurface(w, h, `offscreen#${surfaces.length}`);
      surfaces.push(s);
      return s;
    },
  });
  engine.setDpr(1);

  // Like the live scene, per-frame options share stable identities (stars,
  // maps) — only the ctx differs per recorded frame.
  const baseFrame = frameOptions(asCtx(new RecordingContext("unused")), model, images);
  const rec1 = new RecordingContext("next-cached-1");
  engine.draw({ ...baseFrame, ctx: asCtx(rec1) }, 0);

  // Every drawn non-self node blits exactly one sprite; the sky blits once.
  const drawnNodes = Array.from(model.nodes.values()).filter(
    (n) => n.kind !== "self" && !(n.bornAt != null && n.bornAt > T0),
  ).length;
  const blits1 = rec1.ops.filter((op) => op.startsWith("drawImage(surface#")).length;
  assert.equal(
    blits1,
    drawnNodes + 1,
    `cached mode: expected ${drawnNodes} sprite blits + 1 background blit, saw ${blits1}`,
  );
  const stats1 = engine.stats();
  assert.equal(stats1.rasters, drawnNodes, "one rasterization per drawn node on the cold frame");
  assert.equal(stats1.backgroundRepaints, 1, "one background repaint on the cold frame");

  // A second identical frame is all cache hits: no new rasterizations, no
  // background repaint, same blit count.
  const rec2 = new RecordingContext("next-cached-2");
  engine.draw({ ...baseFrame, ctx: asCtx(rec2) }, 0);
  const stats2 = engine.stats();
  assert.equal(stats2.rasters, stats1.rasters, "repeat frame rasterizes nothing new");
  assert.equal(stats2.backgroundRepaints, 1, "repeat frame reuses the cached sky");
  const blits2 = rec2.ops.filter((op) => op.startsWith("drawImage(surface#")).length;
  assert.equal(blits2, blits1, "repeat frame issues the same blits");

  // Changing a visual input (hover moves) re-keys ONLY the affected sprites.
  const rec3 = new RecordingContext("next-cached-3");
  engine.draw({ ...baseFrame, ctx: asCtx(rec3), hoverId: "post:2" }, 0);
  const stats3 = engine.stats();
  assert.ok(
    stats3.rasters > stats2.rasters && stats3.rasters <= stats2.rasters + 3,
    `hover change re-rasterizes only the touched sprites (was ${stats2.rasters}, now ${stats3.rasters})`,
  );

  assert.ok(stats3.spriteBytes > 0 && stats3.sprites > 0, "atlas reports live entries");
  engine.dispose();
  assert.equal(engine.stats().sprites, 0, "dispose drops every sprite");
  ok(`cached mode — ${drawnNodes} sprites + cached sky, hit/miss behavior as designed`);
}

// ---------------------------------------------------------------------------
// 3. Tier semantics: T1 kills shadows, T2 kills fx + shadows, sky goes static
// ---------------------------------------------------------------------------

{
  const shadowSets = (ops: Op[]) =>
    ops.filter((op) => op.startsWith("set shadowBlur=") && op !== "set shadowBlur=0").length;
  const runTier = (tier: QualityTier) => {
    const { model, images } = buildModel();
    const surfaces: RecordingSurface[] = [];
    const engine = createPaintEngine({
      cached: true,
      createSurface: (w, h) => {
        const s = new RecordingSurface(w, h, `t${tier}-off#${surfaces.length}`);
        surfaces.push(s);
        return s;
      },
    });
    const rec = new RecordingContext(`tier${tier}`);
    engine.draw(frameOptions(asCtx(rec), model, images), tier);
    engine.dispose();
    const all = rec.ops.concat(...surfaces.map((s) => s.ctx.ops));
    return { rec, all };
  };

  const PULSE_HUE = "#fda4af"; // the strand-pulse glow's signature color
  const t0 = runTier(0);
  assert.ok(shadowSets(t0.all) > 0, "T0 draws shadows");
  assert.ok(t0.all.some((op) => op.includes(PULSE_HUE)), "T0 draws the strand pulse");

  const t1 = runTier(1);
  assert.equal(shadowSets(t1.all), 0, "T1 draws no shadows");
  assert.ok(t1.all.some((op) => op.includes(PULSE_HUE)), "T1 keeps fx (pulses)");

  const t2 = runTier(2);
  assert.equal(shadowSets(t2.all), 0, "T2 draws no shadows");
  assert.ok(!t2.all.some((op) => op.includes(PULSE_HUE)), "T2 fx layer off");
  // Same node population at every tier — identical semantics, only garnish.
  const blitCount = (ops: Op[]) => ops.filter((op) => op.startsWith("drawImage(")).length;
  assert.equal(blitCount(t2.rec.ops), blitCount(t0.rec.ops), "T2 draws every node T0 draws");
  ok("tier ladder — identical semantics, garnish drops (shadows/fx per tier)");
}

// ---------------------------------------------------------------------------
// 4. LRU ceilings (count + bytes)
// ---------------------------------------------------------------------------

{
  const evicted: string[] = [];
  const lru = new LruCache<string>(3, 1000, (k) => evicted.push(k));
  lru.set("a", "A", 100);
  lru.set("b", "B", 100);
  lru.set("c", "C", 100);
  lru.set("d", "D", 100);
  assert.deepEqual(evicted, ["a"], "count ceiling evicts the least-recent entry");
  assert.equal(lru.count, 3);
  lru.get("b"); // refresh b
  lru.set("e", "E", 850); // bytes: b(100)+c(100)+d(100)+e(850)=1150 > 1000
  assert.ok(!lru.has("c") && lru.has("b"), "byte ceiling evicts LRU order, refreshed entries survive");
  assert.ok(lru.byteSize <= 1000, `byte ceiling honored (${lru.byteSize})`);
  lru.clear();
  assert.equal(lru.count, 0);
  assert.equal(lru.byteSize, 0);
  ok("LRU cache — count + byte ceilings, recency, clear");
}

// ---------------------------------------------------------------------------
// 5. Governor: two-way ladder + probe floor
// ---------------------------------------------------------------------------

{
  let stats: MeshFrameStats | null = null;
  const mkStats = (p95: number): MeshFrameStats => ({
    sampleCount: 120,
    frame: { avgMs: 16, p95Ms: 20, maxMs: 40 },
    simAvgMs: 2,
    paintAvgMs: 3,
    domSyncAvgMs: 1,
    simPlusPaint: { avgMs: p95 * 0.8, p95Ms: p95 },
  });
  const gov = createQualityGovernor({ startTier: 0, minTier: 0, getStats: () => stats });
  const feed = (dt: number, frames: number) => {
    for (let i = 0; i < frames; i += 1) gov.onFrame(dt);
  };

  // Sustained slow frames demote T0 → T1 → T2.
  stats = mkStats(20);
  feed(30, 130);
  assert.equal(gov.tier(), 1, "sustained slowness demotes to T1");
  feed(30, 130);
  assert.equal(gov.tier(), 2, "still slow ⇒ T2 (the floor)");
  assert.equal(gov.params().frameCapMs, TIER_PARAMS[2].frameCapMs, "T2 hands the 30fps cap to the scheduler");

  // Sustained headroom promotes back — after the post-demotion lock. Feed
  // until the transition (bounded), so the test asserts the behavior, not a
  // hand-counted frame total.
  stats = mkStats(3);
  let guard = 0;
  while (gov.tier() === 2 && guard++ < 5000) gov.onFrame(31); // capped cadence, tiny work
  assert.equal(gov.tier(), 1, "sustained headroom under the cap promotes T2 → T1");
  guard = 0;
  while (gov.tier() === 1 && guard++ < 5000) gov.onFrame(8); // fast frames, tiny work
  assert.equal(gov.tier(), 0, "full recovery to T0");

  // A demotion right after recovery still works (ladder stays live).
  stats = mkStats(20);
  feed(30, 130);
  assert.equal(gov.tier(), 1, "ladder still demotes after recovery");

  // 60Hz vsync'd display: dt is pinned at ~16.7ms and NEVER goes lower, no
  // matter how idle the device is. Promotion must gate on work-time headroom
  // relative to the observed base cadence, not an absolute dt threshold —
  // otherwise the ladder is silently one-way on the most common display
  // class (a demoted device could never recover until reload).
  {
    const VSYNC_60HZ = 16.7;
    let stats60: MeshFrameStats | null = mkStats(20);
    const gov60 = createQualityGovernor({ startTier: 0, minTier: 0, getStats: () => stats60 });
    for (let i = 0; i < 130; i += 1) gov60.onFrame(VSYNC_60HZ);
    assert.equal(gov60.tier(), 1, "over-budget work demotes T0 → T1 at 60Hz cadence");
    stats60 = mkStats(3); // tiny work, but dt stays vsync-pinned at ~16.7ms
    let guard60 = 0;
    while (gov60.tier() === 1 && guard60++ < 5000) gov60.onFrame(VSYNC_60HZ);
    assert.equal(gov60.tier(), 0, "work headroom at vsync-pinned 60Hz cadence promotes T1 → T0");
  }

  // Probe floor: a device pinned at T1 never promotes past it.
  const pinned = createQualityGovernor({ startTier: 1, getStats: () => mkStats(1) });
  for (let i = 0; i < 3000; i += 1) pinned.onFrame(8);
  assert.equal(pinned.tier(), 1, "probe floor is permanent (never promotes past the pin)");
  ok("governor — demote on sustained over-budget, promote on sustained headroom, probe floor pinned");
}

// ---------------------------------------------------------------------------
// 6. Spatial grid ≡ brute force for radius-bounded neighbour queries
// ---------------------------------------------------------------------------

{
  const R = 56;
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const points = Array.from({ length: 220 }, (_, i) => ({
    id: `n${i}`,
    dx: (rand() - 0.5) * 2400,
    dy: (rand() - 0.5) * 2400,
  }));
  const grid = new SpatialGrid<(typeof points)[number]>(R);
  grid.rebuild(points);
  for (let q = 0; q < 200; q += 1) {
    const qx = (rand() - 0.5) * 2600;
    const qy = (rand() - 0.5) * 2600;
    const brute = points
      .filter((p) => Math.hypot(p.dx - qx, p.dy - qy) < R)
      .map((p) => p.id)
      .sort();
    const viaGrid = grid
      .near(qx, qy)
      .filter((p) => Math.hypot(p.dx - qx, p.dy - qy) < R)
      .map((p) => p.id)
      .sort();
    assert.deepEqual(viaGrid, brute, `grid query ${q} must equal brute force`);
  }
  ok("spatial grid — grid-filtered neighbours ≡ brute-force scan (200 random queries)");
}

console.log(`\nmesh-render-parity: ${passed} checks passed.`);
