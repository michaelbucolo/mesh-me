// THE MESH WEB CONTRACT.
//
// The mesh is a SPIDER WEB: your face at the centre, spokes running out to the
// platforms and people you are connected to, posts hanging further out along
// those same spokes, and rings woven between neighbouring spokes. Almost every
// claim in that sentence is invisible to the type checker, and two of them
// have already been silently false in this file's short life:
//
//   · the layout promised "fixed seats — same places every load" while
//     computing a seat as `i / (count - 1)`, so every account slid sideways
//     when you connected a new one;
//   · the replacement promised evenly spread angles and shipped a bit-reversal
//     that sent ranks 0, 1, 3 and 7 to the SAME angle, stacking your first
//     accounts on top of one another.
//
// Both passed tsc, lint and build. Both would have passed a test that only
// asked "does a node keep its position", because a node stacked on another one
// is perfectly stable. So this file asks the geometric questions instead.
//
// Run: npm run mesh-web:check

import assert from "node:assert/strict";
import {
  angleFor,
  layoutWeb,
  threadsFor,
  WEB_CAPS,
  WEB_CENTRE,
  WEB_CENTRE_ID,
  type WebNode,
  type WebNodeKind,
  type WebNodeInput,
  type WebThread,
} from "../src/lib/mesh/web-layout";

let n = 0;
function ok(condition: boolean, label: string): void {
  n++;
  assert.ok(condition, label);
}

function node(over: Partial<WebNodeInput> & { id: string }): WebNodeInput {
  return { kind: "account", label: over.id, rank: 0, ...over };
}

/** Spokes only — the things the stability promise actually covers. */
function spokes(count: number, prefix = "acct"): WebNodeInput[] {
  return Array.from({ length: count }, (_, i) => node({ id: `${prefix}-${i}`, kind: "account", rank: i }));
}

const TAU = Math.PI * 2;

/** An angle as a turn in [0, 1). */
function turn(angle: number): number {
  const t = (angle % TAU) / TAU;
  return t < 0 ? t + 1 : t;
}

/** The signed difference between two headings, in (-π, π]. Comparing raw
 * angles would call two spokes on either side of the wrap the furthest apart
 * things in the web when they are neighbours. */
function shortestTurn(delta: number): number {
  const t = ((delta % TAU) + TAU * 1.5) % TAU - Math.PI;
  return t;
}

function distanceFromCentre(v: { vx: number; vy: number }): number {
  return Math.hypot(v.vx - WEB_CENTRE.vx, v.vy - WEB_CENTRE.vy);
}

/**
 * THE ROOMS THIS HAS TO WORK IN — the floor's box, not the device's screen.
 * A phone's floor is the viewport minus a 72px header and a 56px tab bar, so
 * these are what the layout is really laid into.
 *
 * Geometry checks below are asked in pixels of these boxes rather than in
 * normalised units, because normalised distance silently mixes a wide axis
 * with a short one: 0.15 is 58px across a phone and 96px down it, and every
 * near-miss this file has caught was on the short axis.
 */
const ROOMS: Array<[name: string, width: number, height: number]> = [
  ["a 390×716 iPhone", 390, 716],
  ["a 390×539 iPhone SE", 390, 539],
  ["a 1280×648 laptop", 1280, 648],
  ["a 1024×900 iPad", 1024, 900],
];

/**
 * Tiles and the centre avatar shrink together, on a NARROW room as well as a
 * short one — mirroring mesh-room.tsx exactly, so this asks about the sizes
 * that will really be drawn rather than the desktop ones.
 *
 * The width half of that rule exists because of this file: with the height
 * query alone, a 390×716 iPhone drew 56px tiles with 42px between a friend and
 * their own post. Both branches are load-bearing — drop either and a real
 * device overlaps.
 */
const compact = (w: number, h: number) => h <= 700 || w <= 480;

/** Half-extent of what is actually drawn for each kind, in pixels. A friend is
 * a smaller round tile than a post; your face is bigger than both. */
function halfSize(kind: WebNodeKind | "centre", w: number, h: number): number {
  const small = compact(w, h);
  if (kind === "centre") return small ? 28 : 36;
  if (kind === "friend") return small ? 18 : 24;
  return small ? 20 : 28;
}

/**
 * THE GAP BETWEEN TWO TILES — negative means they overlap.
 *
 * AXIS-SEPARATED, NOT EUCLIDEAN, and that distinction is the whole reason this
 * function exists. The first version of the density check asked whether centres
 * were at least a tile apart as the crow flies, which is the right question for
 * circles and the wrong one for boxes: two 40px squares whose centres are 43px
 * apart on a diagonal are 43px apart and also overlapping. The contract passed;
 * a real browser then drew four overlapping pairs on an iPhone. Two boxes clear
 * each other only if they are separated along SOME axis, so that is what is
 * asked.
 */
function tileGapPx(
  a: { vx: number; vy: number; kind: WebNodeKind | "centre" },
  b: { vx: number; vy: number; kind: WebNodeKind | "centre" },
  w: number,
  h: number,
): number {
  const dx = Math.abs(a.vx - b.vx) * w - (halfSize(a.kind, w, h) + halfSize(b.kind, w, h));
  const dy = Math.abs(a.vy - b.vy) * h - (halfSize(a.kind, w, h) + halfSize(b.kind, w, h));
  return Math.max(dx, dy);
}

/** A few pixels of air, not merely "not touching" — tiles that share an edge
 * read as one wide object rather than two things. */
const AIR = 6;

// ---------------------------------------------------------------------------
// 1. THE ANGLES. Every spoke claim lives here, so every one of them is asked.
// ---------------------------------------------------------------------------

{
  // The four cardinals, named in the module header. If these drift, the header
  // is lying about the one position anybody will remember.
  ok(Math.abs(turn(angleFor(0)) - 0.75) < 1e-9, "rank 0 points straight up");
  ok(Math.abs(turn(angleFor(1)) - 0.25) < 1e-9, "rank 1 points straight down");
  ok(Math.abs(turn(angleFor(2)) - 0.0) < 1e-9, "rank 2 points right");
  ok(Math.abs(turn(angleFor(3)) - 0.5) < 1e-9, "rank 3 points left");
}

{
  // NO TWO SPOKES SHARE AN ANGLE. This is the assertion the shipped bug fell
  // to — it stacked ranks 0, 1, 3, 7 and 15 on the identical heading.
  const seen = new Set<string>();
  for (let rank = 0; rank < 64; rank++) seen.add(turn(angleFor(rank)).toFixed(12));
  ok(seen.size === 64, `sixty-four ranks take sixty-four distinct headings (${seen.size})`);
}

{
  // EVERY PREFIX IS SPREAD. The reason for bit-reversal rather than
  // `rank × step` is that the first three accounts must not cluster into one
  // wedge, so the claim is checked at every size rather than at one.
  for (let k = 2; k <= 24; k++) {
    const turns = Array.from({ length: k }, (_, i) => turn(angleFor(i))).sort((a, b) => a - b);
    let widest = 1 - turns[turns.length - 1] + turns[0];
    for (let i = 1; i < k; i++) widest = Math.max(widest, turns[i] - turns[i - 1]);
    // No wedge more than twice its fair share of the circle. A sequential
    // `rank × step` fails this badly at every k that is not the full circle.
    ok(widest <= 2 / k + 1e-9, `with ${k} spokes, no gap is more than twice fair share (${widest.toFixed(4)} vs ${(2 / k).toFixed(4)})`);
  }
}

{
  // Junk in, an angle out. This runs during a server render; a throw is a 500.
  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -7, 1e9, 0.5]) {
    ok(Number.isFinite(angleFor(bad)), `rank ${bad} still produces a finite angle`);
  }
}

// ---------------------------------------------------------------------------
// 2. LEARNABILITY. Connecting something must never move what was already
//    there — see the module header for why this stops at the spokes.
// ---------------------------------------------------------------------------

{
  const before = new Map(layoutWeb(spokes(4)).map((x) => [x.id, `${x.vx},${x.vy}`]));
  const after = new Map(layoutWeb(spokes(5)).map((x) => [x.id, `${x.vx},${x.vy}`]));
  for (const [id, seat] of before) {
    ok(after.get(id) === seat, `connecting a fifth account does NOT move ${id}`);
  }
  ok(after.has("acct-4"), "…and the new one gets a spoke of its own");
}

{
  // Disconnecting must not shuffle the rest either.
  const a = new Map(layoutWeb(spokes(5)).map((x) => [x.id, `${x.vx},${x.vy}`]));
  const b = new Map(layoutWeb(spokes(4)).map((x) => [x.id, `${x.vx},${x.vy}`]));
  for (const [id, seat] of b) ok(a.get(id) === seat, `disconnecting the newest account does not move ${id}`);
}

{
  // A POST MUST NOT MOVE AN ACCOUNT. Posts are the volatile half of the web —
  // they arrive hourly — so if they could shift the spokes, nothing would ever
  // stay put and the stability above would be worthless in practice.
  const accounts = spokes(4);
  const withPosts = [
    ...accounts,
    ...accounts.flatMap((a, i) => [
      node({ id: `${a.id}-p0`, kind: "post", rank: i * 2, parentId: a.id }),
      node({ id: `${a.id}-p1`, kind: "post", rank: i * 2 + 1, parentId: a.id }),
    ]),
  ];
  const bare = new Map(layoutWeb(accounts).map((x) => [x.id, `${x.vx},${x.vy}`]));
  const loaded = new Map(layoutWeb(withPosts).map((x) => [x.id, `${x.vx},${x.vy}`]));
  for (const [id, seat] of bare) ok(loaded.get(id) === seat, `posts arriving does not move the account ${id}`);
}

{
  // Seniority, not arrival order in the array. The read may return rows in any
  // order; the web must not depend on that.
  const forward = [node({ id: "a", rank: 1 }), node({ id: "b", rank: 2 }), node({ id: "c", rank: 3 })];
  const x = new Map(layoutWeb(forward).map((v) => [v.id, `${v.vx},${v.vy}`]));
  const y = new Map(layoutWeb([forward[2], forward[0], forward[1]]).map((v) => [v.id, `${v.vx},${v.vy}`]));
  for (const id of ["a", "b", "c"]) ok(x.get(id) === y.get(id), `${id} keeps its spoke whatever order the rows arrive in`);
}

{
  // Ties must break deterministically, or two things created in the same
  // millisecond swap places between renders and the web shimmers.
  const tied = [node({ id: "zzz", rank: 5 }), node({ id: "aaa", rank: 5 })];
  const once = layoutWeb(tied);
  const twice = layoutWeb([tied[1], tied[0]]);
  ok(
    once.find((v) => v.id === "aaa")!.vx === twice.find((v) => v.id === "aaa")!.vx,
    "equal ranks break on id, so a tie is stable across renders",
  );
}

// ---------------------------------------------------------------------------
// 3. IT IS A WEB. There is a centre, things radiate from it, and the middle
//    stays clear for the face that belongs there.
// ---------------------------------------------------------------------------

// THE LARGEST WEB THE PRODUCT CAN BUILD, derived from the caps rather than
// guessed at — two doors, then every slot `WEB_CAPS` permits, filled.
//
// Built this way on purpose. The first version of this fixture was a
// hand-picked "realistic" web, and it passed while the page could actually
// produce half again as many tiles: the read hands back ten friends, and two
// posts per account on top of that came to thirty-two tiles fifteen pixels
// apart. A budget checked against a smaller web than the code can emit is not
// a budget. Raise a cap and this fixture grows with it, so the pixels are
// re-asked automatically.
const busy: WebNodeInput[] = [
  node({ id: "door-inbox", kind: "door", rank: 0, label: "Inbox" }),
  node({ id: "door-map", kind: "door", rank: 1, label: "MeshiMap" }),
  ...Array.from({ length: WEB_CAPS.accounts }, (_, i) => node({ id: `acct-${i}`, kind: "account", rank: i })),
  ...Array.from({ length: WEB_CAPS.accounts }, (_, i) =>
    Array.from({ length: WEB_CAPS.postsPerAccount }, (_, j) =>
      node({ id: `post-${i}-${j}`, kind: "post", rank: i * 8 + j, parentId: `acct-${i}` }),
    ),
  ).flat(),
  ...Array.from({ length: WEB_CAPS.friends }, (_, i) => node({ id: `friend-${i}`, kind: "friend", rank: i })),
];
const laidBusy = layoutWeb(busy);
const threadsBusy = threadsFor(laidBusy);

{
  ok(laidBusy.length === busy.length, "every node gets a place in the web");

  for (const v of laidBusy) {
    ok(v.vx >= 0 && v.vx <= 1 && v.vy >= 0 && v.vy <= 1, `${v.id} is inside the room (${v.vx.toFixed(3)}, ${v.vy.toFixed(3)})`);
  }

  // NOTHING SITS ON YOUR FACE. Asked in PIXELS on real rooms rather than as a
  // normalised radius: the room is much wider than it is tall, so one number
  // in 0..1 space means two very different distances depending on which way
  // the node happens to lie, and the vertical one is the one that fails.
  const face = { ...WEB_CENTRE, kind: "centre" as const };
  for (const [name, w, h] of ROOMS) {
    for (const v of laidBusy) {
      const gap = tileGapPx(v, face, w, h);
      ok(gap >= AIR, `${v.id} clears the centre avatar on ${name} (${gap.toFixed(1)}px of air)`);
    }
  }

  // The floor. Bodies walk the lower part and you spawn at vy 0.86; furniture
  // reaching down there means you materialise standing on somebody.
  ok(laidBusy.every((v) => v.vy <= 0.78), "the bottom of the room stays clear — it is where people stand");
}

{
  // EVERY SPOKE STARTS AT YOUR FACE. Not near it, at it — a spoke that begins
  // a few pixels off the avatar reads as a rendering bug.
  // Doors, accounts and friends own spokes; posts hang off one. A spoke owner
  // on a further ring (a friend) still gets its thread from the CENTRE, not
  // from whatever it happens to sit beyond.
  const owners = laidBusy.filter((v) => v.kind === "door" || v.kind === "account" || v.kind === "friend");
  const fromCentre = threadsBusy.filter((t) => t.fromId === WEB_CENTRE_ID);
  ok(fromCentre.length === owners.length, `every spoke node has a thread from the centre (${fromCentre.length}/${owners.length})`);
  ok(
    fromCentre.every((t) => t.fromVx === WEB_CENTRE.vx && t.fromVy === WEB_CENTRE.vy),
    "…and each one starts exactly on the centre",
  );
  ok(fromCentre.every((t) => t.kind === "radial"), "…and is drawn as a radial, not a ring");
}

{
  // A POST IS COLLINEAR WITH ITS ACCOUNT AND YOUR FACE. This is what "follow
  // one line outward" means, and it only holds because the rings are one
  // ellipse scaled rather than two hand-tuned radius pairs.
  //
  // ASKED AT EVERY ANGLE, not at one. The first version of this check used a
  // single account, which lands at rank 0 — straight up, where x is zero and
  // therefore where squashing a ring vertically moves nothing off the line. It
  // passed a deliberate 3% squash on ring 2. The bend a mismatched pair puts
  // in a spoke is largest at the diagonals, so the diagonals have to be asked.
  const accounts = spokes(6);
  const laid = layoutWeb([
    ...accounts,
    ...accounts.map((a) => node({ id: `${a.id}-post`, kind: "post", rank: 0, parentId: a.id })),
  ]);
  for (const a of accounts) {
    const parent = laid.find((v) => v.id === a.id)!;
    const child = laid.find((v) => v.id === `${a.id}-post`)!;
    const cross =
      (parent.vx - WEB_CENTRE.vx) * (child.vy - WEB_CENTRE.vy) -
      (parent.vy - WEB_CENTRE.vy) * (child.vx - WEB_CENTRE.vx);
    ok(Math.abs(cross) < 1e-12, `${a.id}'s lone post is exactly in line with it and the centre (${cross.toExponential(2)})`);
    ok(
      distanceFromCentre(child) > distanceFromCentre(parent),
      `…and further out, so ${a.id}'s thread runs away from you rather than back across the web`,
    );
  }
}

{
  // A POST STAYS IN ITS OWN ACCOUNT'S WEDGE. This is what the fan tightening
  // is FOR: without it siblings fan by a fixed angle, which is fine on a small
  // web and, once you have a dozen spokes, sprays your Instagram posts past
  // your YouTube spoke. At that point you cannot tell by looking which account
  // a post came from, which is the one thing the shape is supposed to say.
  //
  // Swept up to twenty spokes because the failure only appears once the
  // spokes are closer together than the fan is wide.
  for (const spokeCount of [3, 5, 8, 13, 20]) {
    const accounts = spokes(spokeCount);
    const laid = layoutWeb([
      ...accounts,
      ...accounts.flatMap((a, i) => [
        node({ id: `${a.id}-p0`, kind: "post", rank: i * 3, parentId: a.id }),
        node({ id: `${a.id}-p1`, kind: "post", rank: i * 3 + 1, parentId: a.id }),
        node({ id: `${a.id}-p2`, kind: "post", rank: i * 3 + 2, parentId: a.id }),
      ]),
    ]);
    const parents = laid.filter((v) => v.kind === "account");
    for (const child of laid.filter((v) => v.kind === "post")) {
      const own = parents.find((p) => p.id === child.parentId)!;
      const toOwn = Math.abs(shortestTurn(child.angle - own.angle));
      const toNearest = Math.min(
        ...parents.filter((p) => p.id !== own.id).map((p) => Math.abs(shortestTurn(child.angle - p.angle))),
      );
      ok(
        toOwn < toNearest,
        `with ${spokeCount} spokes, ${child.id} stays nearer its own account than any other (${toOwn.toFixed(3)} vs ${toNearest.toFixed(3)})`,
      );
    }
  }
}

{
  // Siblings stay centred on their parent's spoke rather than drifting off it.
  const laid = layoutWeb([
    node({ id: "acct", kind: "account", rank: 0 }),
    node({ id: "p0", kind: "post", rank: 0, parentId: "acct" }),
    node({ id: "p1", kind: "post", rank: 1, parentId: "acct" }),
  ]);
  const parent = laid.find((v) => v.id === "acct")!;
  const kids = laid.filter((v) => v.ring === 2);
  const mean = kids.reduce((s, k) => s + k.angle, 0) / kids.length;
  ok(Math.abs(mean - parent.angle) < 1e-9, "two posts straddle their account's spoke evenly");
  ok(kids.every((k) => Math.abs(k.angle - parent.angle) < 0.5), "…and neither wanders off it");
}

{
  // THE RINGS NEVER CROSS. Distance from the centre is how far something is
  // from being you — your accounts, then your posts and your friends, then
  // their posts. If ring 3 ever reached inside ring 2, a friend's post would
  // sit between you and the friend it came from, which says the opposite of
  // what the layout is for.
  for (const ring of [1]) {
    const inner = laidBusy.filter((v) => v.ring === ring);
    const outer = laidBusy.filter((v) => v.ring === ring + 1);
    const innerMax = Math.max(...inner.map(distanceFromCentre));
    const outerMin = Math.min(...outer.map(distanceFromCentre));
    ok(outerMin > innerMax, `ring ${ring + 1} clears ring ${ring} entirely (${outerMin.toFixed(3)} > ${innerMax.toFixed(3)})`);
  }

  // A friend is FURTHER OUT than an account — one hop, not nought.
  const account = laidBusy.find((v) => v.kind === "account")!;
  const friend = laidBusy.find((v) => v.kind === "friend")!;
  ok(
    distanceFromCentre(friend) > distanceFromCentre(account),
    "a friend sits further out than your own accounts — distance is hop count",
  );
  // …and their spoke still runs all the way back to your face rather than
  // starting at whichever account it happens to pass.
  const friendSpoke = threadsBusy.find((t) => t.toId === friend.id && t.fromId === WEB_CENTRE_ID);
  ok(!!friendSpoke, "…and their spoke still starts at you, passing between the accounts on its way out");
}

// ---------------------------------------------------------------------------
// 4. THE RINGS. Without these it is a starburst, and a starburst is the
//    infographic this surface has already been three times.
// ---------------------------------------------------------------------------

{
  const rings = threadsBusy.filter((t) => t.kind === "ring");
  ok(rings.length > 0, "a populated web has rings woven between its spokes — not just radials");

  const ringOf = new Map(laidBusy.map((v) => [v.id, v.ring]));
  ok(
    rings.every((t) => ringOf.get(t.fromId) === ringOf.get(t.toId)),
    "a ring joins two nodes on the SAME ring — it never cuts between rings",
  );

  // Every ring holding three or more things is woven, and at most one sector
  // of it is left open. NOT "always closed": ring 3 holds only your friends'
  // posts, so it inherits their angles rather than a full sequence, and one
  // gap up there is genuinely wide. Leaving that sector open is the right
  // answer — a spider web has open sectors — and closing it would mean a
  // chord back across the middle, which is the thing rings must never do.
  for (const ring of [1, 2]) {
    const onRing = laidBusy.filter((v) => v.ring === ring);
    const woven = rings.filter((t) => ringOf.get(t.fromId) === ring);
    ok(woven.length >= onRing.length - 1, `ring ${ring} is woven with at most one open sector (${woven.length}/${onRing.length})`);

    // Each node is tied on to at most one neighbour going round. Two would
    // mean the weave doubled back and skipped somebody.
    const outgoing = new Map<string, number>();
    for (const t of woven) outgoing.set(t.fromId, (outgoing.get(t.fromId) ?? 0) + 1);
    ok([...outgoing.values()].every((c) => c === 1), `…with each node on ring ${ring} tied to at most one neighbour`);
  }

  // YOUR OWN RING IS CLOSED, ALWAYS. Doors and accounts take a whole prefix of
  // the angle sequence, whose widest gap is a quarter turn from four spokes
  // up — comfortably inside what a chord may span. This is the ring people
  // actually look at, so it is the one that gets the unconditional promise.
  for (let k = 4; k <= 16; k++) {
    const laid = layoutWeb(spokes(k));
    const woven = threadsFor(laid).filter((t) => t.kind === "ring");
    ok(woven.length === k, `${k} accounts weave a fully closed ring (${woven.length}/${k})`);
  }
}

{
  // NO RING CUTS ACROSS YOUR FACE. Three spokes sit at 12, 3 and 6 o'clock, so
  // closing that ring would draw a chord from 6 back up to 12 — straight
  // through the avatar. A real web just has an open sector there.
  //
  for (let k = 2; k <= 12; k++) {
    const laid = layoutWeb(spokes(k));
    for (const t of threadsFor(laid).filter((x) => x.kind === "ring")) {
      for (const [name, w, h] of ROOMS) {
        const gap = segmentClearancePx(t, w, h);
        // Touching the avatar's edge is already wrong; a few pixels of air is
        // the difference between a web and a scribble over somebody's face.
        const need = halfSize("centre", w, h) + AIR;
        ok(gap >= need, `with ${k} spokes, the ring ${t.fromId}→${t.toId} clears your face on ${name} (${gap.toFixed(1)}px)`);
      }
    }
  }
}

{
  // …and the sector really is left OPEN rather than the whole ring dropped.
  // Three spokes should still be woven where the web is dense.
  const three = threadsFor(layoutWeb(spokes(3))).filter((t) => t.kind === "ring");
  ok(three.length === 2, `three spokes weave two ring segments and leave one sector open (${three.length})`);

  // Two spokes are 180° apart in both directions, so there is no ring to spin
  // at all — and in particular NOT one drawn twice, once each way.
  ok(threadsFor(layoutWeb(spokes(2))).filter((t) => t.kind === "ring").length === 0, "two spokes weave no ring");
  ok(threadsFor(layoutWeb(spokes(1))).filter((t) => t.kind === "ring").length === 0, "one spoke weaves no ring with itself");
}

// ---------------------------------------------------------------------------
// 5. NOTHING OVERLAPS. Two tiles on the same pixels is the specific failure
//    the angle bug produced, and it looked like a missing account.
// ---------------------------------------------------------------------------

{
  const seats = new Set(laidBusy.map((v) => `${v.vx.toFixed(5)},${v.vy.toFixed(5)}`));
  ok(seats.size === laidBusy.length, `a busy web puts every node in its own place (${seats.size}/${laidBusy.length})`);
}

{
  // THE DENSITY BUDGET, in pixels rather than as a comment. This is the check
  // that caught the real mistake: with friends sitting on the inner ring
  // beside your own accounts, a full web put two tiles 17px apart on a phone
  // — overlapping, since a tile is 40px there. No amount of tuning fixes 24
  // tiles on two rings; the answer was a third ring and hop count deciding
  // which one you are on.
  for (const [name, w, h] of ROOMS) {
    let closest = Infinity;
    let pair = "";
    for (let i = 0; i < laidBusy.length; i++) {
      for (let j = i + 1; j < laidBusy.length; j++) {
        const gap = tileGapPx(laidBusy[i], laidBusy[j], w, h);
        if (gap < closest) {
          closest = gap;
          pair = `${laidBusy[i].id}/${laidBusy[j].id}`;
        }
      }
    }
    ok(closest >= AIR, `a full web keeps its tiles apart on ${name} (${pair}, ${closest.toFixed(1)}px of air)`);
  }
}

// ---------------------------------------------------------------------------
// 6. THREADS POINT AT REAL THINGS.
// ---------------------------------------------------------------------------

{
  const nodes = layoutWeb([
    node({ id: "acct", kind: "account", rank: 0 }),
    node({ id: "p1", kind: "post", rank: 0, parentId: "acct" }),
  ]);
  const acct = nodes.find((v) => v.id === "acct")!;
  const p1 = nodes.find((v) => v.id === "p1")!;
  const t = threadsFor(nodes).find((x) => x.fromId === "acct" && x.toId === "p1")!;
  ok(!!t, "a post is threaded to the account it came from");
  ok(t.fromVx === acct.vx && t.fromVy === acct.vy, "…starting exactly on the account");
  ok(t.toVx === p1.vx && t.toVy === p1.vy, "…and ending exactly on the post");
}

{
  // A dangling parent must not draw a line to (0,0). That is the specific
  // glitch that makes a graph look broken: threads converging on a corner.
  const nodes = layoutWeb([node({ id: "orphan", kind: "post", rank: 0, parentId: "an-account-that-was-filtered-out" })]);
  ok(
    threadsFor(nodes).every((t) => t.toId !== "orphan" || t.fromId === WEB_CENTRE_ID),
    "a thread to a node that is not on screen is not drawn",
  );
  // …but the orphan still lands somewhere real rather than at NaN.
  const orphan = nodes[0];
  ok(Number.isFinite(orphan.vx) && Number.isFinite(orphan.vy), "…and the orphan still gets a finite place of its own");
}

{
  const nodes = layoutWeb([node({ id: "self", kind: "post", rank: 0, parentId: "self" })]);
  ok(threadsFor(nodes).every((t) => t.fromId !== t.toId), "a node cannot be threaded to itself");
}

{
  // Every endpoint the renderer draws must be a node's real position — a
  // thread that lands NEAR a node instead of ON it reads as a bug.
  const byId = new Map(laidBusy.map((v) => [v.id, v]));
  for (const t of threadsBusy) {
    const from = t.fromId === WEB_CENTRE_ID ? WEB_CENTRE : byId.get(t.fromId);
    const to = byId.get(t.toId);
    ok(!!from && !!to, `the thread ${t.fromId}→${t.toId} joins two things that are in the room`);
    ok(from!.vx === t.fromVx && from!.vy === t.fromVy, `…and starts exactly on ${t.fromId}`);
    ok(to!.vx === t.toVx && to!.vy === t.toVy, `…and ends exactly on ${t.toId}`);
  }
}

// ---------------------------------------------------------------------------
// 7. Junk in, a web out. This runs on a server render — a throw is a 500.
// ---------------------------------------------------------------------------

ok(layoutWeb([]).length === 0, "an empty mesh lays out to an empty room, not a crash");
ok(threadsFor([]).length === 0, "…and weaves no threads");

{
  const weird = layoutWeb([
    node({ id: "nan", rank: Number.NaN }),
    node({ id: "neg", rank: -5 }),
    node({ id: "huge", rank: 1e9 }),
    node({ id: "frac", rank: 2.5 }),
    node({ id: "kid", kind: "post", rank: Number.NaN, parentId: "nan" }),
  ]);
  ok(weird.length === 5, "every malformed node still gets somewhere to be");
  for (const v of weird) {
    ok(Number.isFinite(v.vx) && Number.isFinite(v.vy), `${v.id} still gets a finite place`);
    ok(v.vx >= 0 && v.vx <= 1 && v.vy >= 0 && v.vy <= 1, `${v.id} still lands inside the room`);
  }
  for (const t of threadsFor(weird)) {
    ok(
      [t.fromVx, t.fromVy, t.toVx, t.toVy].every(Number.isFinite),
      `a thread from malformed input has finite ends (${t.fromId}→${t.toId})`,
    );
  }
}

/** How close a thread passes to the centre of the web, in pixels of a given
 * room. Point-to-SEGMENT, not point-to-line: a chord that would pass through
 * the middle if extended is fine as long as the drawn part does not. */
function segmentClearancePx(t: WebThread, w: number, h: number): number {
  const ax = t.fromVx * w;
  const ay = t.fromVy * h;
  const bx = t.toVx * w;
  const by = t.toVy * h;
  const cx = WEB_CENTRE.vx * w;
  const cy = WEB_CENTRE.vy * h;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const along = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / lengthSquared));
  return Math.hypot(ax + along * dx - cx, ay + along * dy - cy);
}

// Referenced so the exported node type stays part of this file's contract:
// a WebNode that lost its `ring` or `angle` would break the questions above.
const _shape: (v: WebNode) => number = (v) => v.ring + v.angle;
ok(Number.isFinite(_shape(laidBusy[0])), "a laid-out node carries both its ring and its angle");

console.log(`mesh web contract OK — ${n} assertions (a centre, spokes that never move, and rings that clear your face)`);
