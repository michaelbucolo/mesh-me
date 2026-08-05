// THE MESH WEB CONTRACT.
//
// The property that matters more than any other here: ADDING A NODE MUST NEVER
// MOVE A NODE THAT WAS ALREADY THERE. The old layout got this wrong in a way
// that read as correct — it computed a seat as `i / (count - 1)`, so every
// account slid sideways when you connected a new one, directly under a comment
// promising "fixed seats — same places every load, so it is somewhere you can
// learn". A room whose furniture rearranges itself is one nobody can learn,
// and no type or build error can see it.
//
// Run: npm run mesh-web:check

import assert from "node:assert/strict";
import { layoutWeb, seatFor, threadsFor, type WebNodeInput } from "../src/lib/mesh/web-layout";

let n = 0;
function ok(condition: boolean, label: string): void {
  n++;
  assert.ok(condition, label);
}

function node(over: Partial<WebNodeInput> & { id: string }): WebNodeInput {
  return { kind: "account", label: over.id, rank: 0, ...over };
}

// ---------------------------------------------------------------------------
// 1. THE LEARNABILITY PROPERTY. This is the whole file.
// ---------------------------------------------------------------------------

{
  const four = [0, 1, 2, 3].map((r) => node({ id: `acct-${r}`, rank: r }));
  const five = [...four, node({ id: "acct-4", rank: 4 })];

  const before = new Map(layoutWeb(four).map((x) => [x.id, `${x.vx},${x.vy}`]));
  const after = new Map(layoutWeb(five).map((x) => [x.id, `${x.vx},${x.vy}`]));

  for (const [id, seat] of before) {
    ok(after.get(id) === seat, `connecting a fifth account does NOT move ${id} (${seat} → ${after.get(id)})`);
  }
  ok(after.has("acct-4"), "…and the new one gets a seat of its own");
}

{
  // The same for removal: disconnecting an account must not shuffle the rest.
  const five = [0, 1, 2, 3, 4].map((r) => node({ id: `acct-${r}`, rank: r }));
  const withoutLast = five.slice(0, 4);
  const a = new Map(layoutWeb(five).map((x) => [x.id, `${x.vx},${x.vy}`]));
  const b = new Map(layoutWeb(withoutLast).map((x) => [x.id, `${x.vx},${x.vy}`]));
  for (const [id, seat] of b) {
    ok(a.get(id) === seat, `disconnecting the newest account does not move ${id}`);
  }
}

{
  // Seniority, not arrival order in the array. The read may return rows in any
  // order; the room must not depend on that.
  const forward = [node({ id: "a", rank: 1 }), node({ id: "b", rank: 2 }), node({ id: "c", rank: 3 })];
  const shuffled = [forward[2], forward[0], forward[1]];
  const x = new Map(layoutWeb(forward).map((v) => [v.id, `${v.vx},${v.vy}`]));
  const y = new Map(layoutWeb(shuffled).map((v) => [v.id, `${v.vx},${v.vy}`]));
  for (const id of ["a", "b", "c"]) ok(x.get(id) === y.get(id), `${id} sits in the same place whatever order the rows arrive in`);
}

{
  // Ties must break deterministically, or two things created in the same
  // millisecond swap places between renders and the room shimmers.
  const tied = [node({ id: "zzz", rank: 5 }), node({ id: "aaa", rank: 5 })];
  const once = layoutWeb(tied);
  const twice = layoutWeb([tied[1], tied[0]]);
  ok(
    once.find((v) => v.id === "aaa")!.vx === twice.find((v) => v.id === "aaa")!.vx,
    "equal ranks break on id, so a tie is stable across renders",
  );
}

// ---------------------------------------------------------------------------
// 2. It is a PLACE, not a chart. No centre node, nothing radiates, and the
//    lower half of the room stays walkable.
// ---------------------------------------------------------------------------

{
  const many: WebNodeInput[] = [];
  for (let i = 0; i < 5; i++) many.push(node({ id: `acct-${i}`, kind: "account", rank: i }));
  for (let i = 0; i < 10; i++) many.push(node({ id: `post-${i}`, kind: "post", rank: i, parentId: `acct-${i % 5}` }));
  for (let i = 0; i < 8; i++) many.push(node({ id: `friend-${i}`, kind: "friend", rank: i }));
  const laid = layoutWeb(many);

  ok(laid.length === many.length, "every node gets a seat");
  for (const v of laid) {
    ok(v.vx >= 0 && v.vx <= 1 && v.vy >= 0 && v.vy <= 1, `${v.id} is inside the room (${v.vx}, ${v.vy})`);
  }

  // Nothing sits dead centre — the failed design was a hub at the middle with
  // spokes, and the absence of a centre node is what makes this a room.
  ok(
    !laid.some((v) => Math.abs(v.vx - 0.5) < 0.02 && Math.abs(v.vy - 0.5) < 0.02),
    "nothing occupies the centre of the room — this is a place, not a hub-and-spoke chart",
  );

  // The floor. Bodies walk the lower part; furniture must not colonise it.
  // The web lives in the upper three quarters; the bottom quarter is FLOOR.
  // You spawn at vy 0.86, and furniture that reaches down there means you
  // materialise standing on top of somebody.
  ok(
    laid.every((v) => v.vy <= 0.78),
    "the bottom quarter of the room stays clear — it is where people stand",
  );
}

{
  // A THREAD MUST BE SHORT. Photographed with friends' posts in the same band
  // as your own, every friend-thread ran diagonally across the entire account
  // layer and the room read as a cat's cradle rather than a web.
  const laid = layoutWeb([
    node({ id: "f0", kind: "friend", rank: 0 }),
    node({ id: "f0-post", kind: "friendPost", rank: 0, parentId: "f0" }),
    node({ id: "f4", kind: "friend", rank: 4 }),
    node({ id: "f4-post", kind: "friendPost", rank: 4, parentId: "f4" }),
    node({ id: "acct", kind: "account", rank: 0 }),
    node({ id: "mine", kind: "post", rank: 0, parentId: "acct" }),
  ]);
  for (const t of threadsFor(laid)) {
    const len = Math.hypot(t.toVx - t.fromVx, t.toVy - t.fromVy);
    ok(len < 0.25, `the thread ${t.fromId}→${t.toId} is short and local (${len.toFixed(3)})`);
  }
  const f0 = laid.find((v) => v.id === "f0")!;
  const f0p = laid.find((v) => v.id === "f0-post")!;
  ok(Math.abs(f0.vx - f0p.vx) < 0.01, "a friend's post sits in their own column, not somebody else's");
  ok(f0p.vy > f0.vy, "…and directly below them");
}

// ---------------------------------------------------------------------------
// 3. No two things share a seat — including across a wrap.
// ---------------------------------------------------------------------------

{
  const twelve = Array.from({ length: 12 }, (_, i) => node({ id: `a${i}`, kind: "account", rank: i }));
  const laid = layoutWeb(twelve);
  const seats = new Set(laid.map((v) => `${v.vx.toFixed(4)},${v.vy.toFixed(4)}`));
  ok(seats.size === laid.length, `twelve accounts occupy twelve distinct seats (${seats.size})`);

  // A wrapped row must be a different row, or row 2 lands exactly on row 1.
  const rows = new Set(laid.map((v) => v.vy.toFixed(4)));
  ok(rows.size >= 3, `twelve accounts wrap onto multiple rows (${rows.size})`);
}

{
  // Phone budget. Five slots across the padded span at 390px must leave a
  // usable gap — this is the constraint that decides SLOTS_PER_ROW, so it is
  // checked in pixels rather than left as a comment.
  const five = Array.from({ length: 5 }, (_, i) => node({ id: `a${i}`, kind: "account", rank: i }));
  const laid = layoutWeb(five).sort((a, b) => a.vx - b.vx);
  const gapPx = (laid[1].vx - laid[0].vx) * 390;
  ok(gapPx >= 56, `on a 390px phone, neighbouring nodes are at least a tile apart (${gapPx.toFixed(1)}px)`);
}

// ---------------------------------------------------------------------------
// 4. Threads: they are the point of calling it a web.
// ---------------------------------------------------------------------------

{
  const nodes = layoutWeb([
    node({ id: "acct", kind: "account", rank: 0 }),
    node({ id: "p1", kind: "post", rank: 0, parentId: "acct" }),
    node({ id: "p2", kind: "post", rank: 1, parentId: "acct" }),
    node({ id: "loner", kind: "post", rank: 2 }),
  ]);
  const threads = threadsFor(nodes);
  ok(threads.length === 2, `two posts hanging off an account draw two threads (${threads.length})`);
  ok(
    threads.every((t) => t.toId === "acct"),
    "…and both run to the account they came from",
  );
  ok(!threads.some((t) => t.fromId === "loner"), "a post with no parent draws no thread");

  // Endpoints must be the real seats, not recomputed — a thread that lands
  // near a node instead of on it reads as a rendering bug.
  const acct = nodes.find((v) => v.id === "acct")!;
  const p1 = nodes.find((v) => v.id === "p1")!;
  const t = threads.find((x) => x.fromId === "p1")!;
  ok(t.toVx === acct.vx && t.toVy === acct.vy, "a thread ends exactly on its parent");
  ok(t.fromVx === p1.vx && t.fromVy === p1.vy, "…and starts exactly on its child");
}

{
  // A dangling parent must not draw a line to (0,0). That is the specific
  // glitch that makes a graph look broken: threads converging on a corner.
  const nodes = layoutWeb([node({ id: "orphan", kind: "post", rank: 0, parentId: "an-account-that-was-filtered-out" })]);
  ok(threadsFor(nodes).length === 0, "a thread to a node that is not on screen is not drawn");
}

{
  const nodes = layoutWeb([node({ id: "self", kind: "post", rank: 0, parentId: "self" })]);
  ok(threadsFor(nodes).length === 0, "a node cannot be threaded to itself");
}

// ---------------------------------------------------------------------------
// 5. Junk in, a room out. This runs on a server render — a throw is a 500.
// ---------------------------------------------------------------------------

ok(layoutWeb([]).length === 0, "an empty mesh lays out to an empty room, not a crash");
{
  const weird = layoutWeb([
    node({ id: "nan", rank: Number.NaN }),
    node({ id: "neg", rank: -5 }),
    node({ id: "huge", rank: 1e9 }),
  ]);
  for (const v of weird) {
    ok(Number.isFinite(v.vx) && Number.isFinite(v.vy), `${v.id} still gets a finite seat`);
    ok(v.vx >= 0 && v.vx <= 1 && v.vy >= 0 && v.vy <= 1, `${v.id} still lands inside the room`);
  }
}
{
  const s = seatFor("account", Number.NaN);
  ok(Number.isFinite(s.vx) && Number.isFinite(s.vy), "a NaN rank does not produce a NaN seat");
}

console.log(`mesh web contract OK — ${n} assertions (adding a node never moves one that was already there)`);
