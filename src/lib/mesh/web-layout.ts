// WHERE EVERYTHING IN YOUR MESH STANDS.
//
// The mesh is "a web of all my posts, friends, accounts" AND a public
// playground you walk around. Those are not in tension once you stop trying to
// draw a diagram: the web is the ROOM'S ARCHITECTURE, not a chart rendered
// inside it. Your accounts are stations you can walk to; your posts hang off
// the account they came from; your friends stand at their own places with
// their latest thing beside them; threads make those relationships visible the
// way cables and washing lines make a real space legible.
//
// ── WHAT THIS FILE REFUSES TO BE ───────────────────────────────────────────
//
// Not a starburst. mesh-room.tsx's own header records that three previous
// attempts at this surface were infographics, and the specific shape it names
// as failure #2 is a hub of platforms radiating from you at the centre. A
// "web" drawn as spokes from your avatar is that same chart in a fourth
// costume. So there is no centre node here and nothing radiates: the layout is
// BANDS across a room you move through, and the threads run between things
// that are actually related.
//
// ── THE BUG THIS FILE EXISTS TO FIX ────────────────────────────────────────
//
// The old layout computed `t = i / (arms.length - 1)`, so a seat was a
// function of HOW MANY accounts you had. Connect a fifth and the other four
// all slid sideways — while the comment directly above it promised "fixed
// seats — same places every load, so it is somewhere you can learn". That
// promise was false, and a place whose furniture rearranges itself is one you
// cannot learn.
//
// Position here is a function of RANK ONLY: your oldest account takes slot 0
// forever. Adding a node never moves a node that was already there, which is
// the one property that makes a room learnable, and it is what the gate pins.

/** A thing standing in the mesh. Kind drives what it looks like, not where. */
export type WebNodeKind = "account" | "post" | "friend" | "friendPost" | "door";

export type WebNodeInput = {
  id: string;
  kind: WebNodeKind;
  label: string;
  /** Stable ordering key — creation order, never interaction weight. A seat
   * that moves when something gets popular is a seat you cannot learn. */
  rank: number;
  href?: string;
  imageUrl?: string | null;
  /** The node this one hangs off: a post's account, a friend's post's friend.
   * The thread is drawn from here to the parent. */
  parentId?: string;
  /** Extra line under the label (a handle, a platform, "3 waiting"). */
  detail?: string | null;
};

export type WebNode = WebNodeInput & { vx: number; vy: number };

// ── THE BANDS ──────────────────────────────────────────────────────────────
//
// Four horizontal bands, top to bottom, with the lower half of the room left
// clear because that is the floor people actually walk on. Doors are highest
// (you leave through them), accounts below, then your posts hanging off their
// account, then friends across the middle.
//
// Deliberately NOT evenly spaced: the gap between an account and its posts is
// tighter than the gap between bands, so a post reads as belonging to the
// thing above it before you have traced a single thread.
const BAND = {
  door: 0.07,
  account: 0.22,
  post: 0.35,
  friend: 0.53,
  // A FRIEND'S POST HANGS DIRECTLY BELOW THEM, not in your post band.
  // Photographed with both kinds sharing one band: a friend sat at 0.62 and
  // their post at 0.42, so every friend-thread ran UPWARD across the whole
  // account layer and the room turned into a cat's cradle. A thread should be
  // the shortest honest line between two related things; when it is, the web
  // reads at a glance instead of needing to be traced.
  friendPost: 0.66,
} as const;

/** How many slots each band has before it wraps to a second row. Chosen for
 * the narrow case first: at 390px a row of 5 gives each node ~70px, which is
 * a 56px tile plus air. Desktop gets the same seats, just wider apart —
 * the SAME normalised position on every screen, which is what lets two people
 * on different devices talk about "the one on the left". */
const SLOTS_PER_ROW: Record<WebNodeKind, number> = {
  door: 2,
  account: 5,
  post: 5,
  friend: 5,
  // Same count as friends, so a friend's post lands under THEIR column rather
  // than under somebody else's.
  friendPost: 5,
};

/** Row spacing when a band wraps. Small: a wrapped row is the same band. */
const ROW_STEP = 0.10;

/** Horizontal inset. Nodes carry labels wider than themselves, so the first
 * and last slot need room or a long display name runs off the floor. */
const PAD_X = 0.12;

/**
 * Seat one node from its rank alone.
 *
 * Exported because the gate's central property — adding a node never moves an
 * existing one — is a statement about THIS function, and testing it through
 * the whole layout would be testing it through a lot of unrelated code.
 */
export function seatFor(kind: WebNodeKind, rank: number): { vx: number; vy: number } {
  const perRow = SLOTS_PER_ROW[kind];
  const safeRank = Number.isFinite(rank) && rank >= 0 ? Math.floor(rank) : 0;
  const row = Math.floor(safeRank / perRow);
  const col = safeRank % perRow;

  // The span is divided by SLOTS, not by how many nodes turned up. This is the
  // whole fix: `col / (count - 1)` re-seats everybody when count changes,
  // `(col + 0.5) / perRow` never does.
  const usable = 1 - PAD_X * 2;
  const vx = PAD_X + ((col + 0.5) / perRow) * usable;

  // Odd rows are nudged half a slot so a wrapped row interleaves with the one
  // above instead of stacking label-on-label.
  const stagger = row % 2 === 1 ? usable / (perRow * 2) : 0;
  return {
    vx: clamp01(vx + stagger),
    vy: clamp01(BAND[kind] + row * ROW_STEP),
  };
}

/**
 * Lay out the whole mesh.
 *
 * Pure and total: same input, same output, no clock, no randomness, no
 * viewport. The server and every client must agree about where your things
 * are, and the only way to guarantee that is for position to depend on
 * nothing but the node itself.
 */
export function layoutWeb(nodes: readonly WebNodeInput[]): WebNode[] {
  // Rank is re-derived per kind by sorting on the caller's rank, so a caller
  // that hands us database ids or timestamps as ranks still gets 0,1,2… seats.
  // Ties break on id so two things created in the same millisecond do not
  // swap places between renders.
  const byKind = new Map<WebNodeKind, WebNodeInput[]>();
  for (const node of nodes) {
    const bucket = byKind.get(node.kind);
    if (bucket) bucket.push(node);
    else byKind.set(node.kind, [node]);
  }

  const out: WebNode[] = [];
  for (const [kind, group] of byKind) {
    const ordered = group
      .slice()
      .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    ordered.forEach((node, index) => {
      out.push({ ...node, ...seatFor(kind, index) });
    });
  }
  return out;
}

/** A drawn thread. Resolved here rather than in the component so a thread to a
 * node that does not exist is impossible to render — an edge pointing at
 * nothing draws a line to the top-left corner, which reads as a glitch. */
export type WebThread = { fromId: string; toId: string; fromVx: number; fromVy: number; toVx: number; toVy: number };

export function threadsFor(nodes: readonly WebNode[]): WebThread[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const threads: WebThread[] = [];
  for (const node of nodes) {
    if (!node.parentId) continue;
    const parent = byId.get(node.parentId);
    // A parent that is not on screen is not an error — a post whose account
    // was filtered out still belongs somewhere. It just has no thread.
    if (!parent) continue;
    if (parent.id === node.id) continue;
    threads.push({
      fromId: node.id,
      toId: parent.id,
      fromVx: node.vx,
      fromVy: node.vy,
      toVx: parent.vx,
      toVy: parent.vy,
    });
  }
  return threads;
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}
