// THE MESH IS A SPIDER WEB. YOU ARE THE CENTRE.
//
// Your face sits at the middle. Threads radiate out from it to the things your
// presence is made of — the platforms you are on, the people you know — and
// continue outward to the posts hanging off each of them. Adjacent threads are
// tied together by rings, and that is the part that makes it read as a WEB
// rather than a starburst: a spider web is radials AND spirals. Without the
// rings you have a sunburst diagram.
//
// ── A NOTE ON HOW I GOT THIS WRONG ─────────────────────────────────────────
//
// The previous version laid everything out in horizontal BANDS with no centre,
// because a design review argued that a hub with spokes was "an infographic"
// and cited this surface's own history for support. That reasoning was
// backwards, and following it produced something that was not a web at all.
// A web HAS a centre by definition. What makes a surface a chart is not having
// a middle — it is being a picture of data you cannot enter. This is a place
// you walk around inside, whose SHAPE is a web.
//
// ── THE PROPERTY THAT SURVIVED, AND WHY IT STILL LOOKS EVEN ────────────────
//
// Position still comes from RANK ONLY, so connecting a new account never moves
// the ones already there — a room whose furniture rearranges itself cannot be
// learned. The naive way to do that on a circle is angle = rank × step, which
// clusters your first three accounts into one wedge and leaves the rest of the
// web bare.
//
// So angles are assigned by BIT REVERSAL (a van der Corput sequence): rank 0
// goes to the top, rank 1 to the bottom, rank 2 to the right, rank 3 to the
// left, and so on. EVERY PREFIX of that sequence is spread around the whole
// circle — a web with three nodes looks balanced and a web with eleven looks
// balanced — and the eleventh arriving never moves the first ten.
//
// ── AND A NOTE ON GETTING *THAT* WRONG TOO ─────────────────────────────────
//
// The first version of `angleFor` reversed the bits of `rank + 1` BELOW its
// highest set bit, which is a real construction — it is how you enumerate the
// sequence level by level — but it is not φ₂(rank). It sent ranks 0, 1, 3, 7
// and 15 to the identical angle, so your first two accounts were drawn one on
// top of the other and the fourth landed on them as well. Nothing could see
// that: the types are fine, the layout is pure, and the seat-stability tests
// passed happily because a node that never moves is still stable when it is
// stacked on another one. It is caught below by asking whether k nodes occupy
// k distinct angles, which is the question the comment above was claiming to
// have answered all along.
//
// ── WHERE THE STABILITY PROMISE STOPS, AND WHY IT STOPS THERE ──────────────
//
// It covers the SPOKES — accounts, friends, doors. It deliberately does not
// cover posts. Posts fan around their parent's spoke and stay centred on it,
// so a second post nudges the first sideways. That is the right trade: a post
// is not a place, it is this week's thing, and nobody learns where one lives.
// What they learn is where INSTAGRAM is, and a group that stays centred on its
// spoke is what keeps that legible. The alternative — a fixed sub-angle per
// post — buys stability nobody wants by letting a lone post sit off to one
// side of the account it came from.

/** A thing in the web. Kind drives which ring it sits on, never its angle. */
export type WebNodeKind = "account" | "post" | "friend" | "door";

export type WebNodeInput = {
  id: string;
  kind: WebNodeKind;
  label: string;
  /** Stable ordering key — creation order, never interaction weight. A thread
   * that moves when something gets popular is a web you cannot learn. */
  rank: number;
  href?: string;
  imageUrl?: string | null;
  /** The node this one hangs off. Children inherit their parent's ANGLE, so a
   * post sits directly outward along the same thread as its account. */
  parentId?: string;
  detail?: string | null;
};

export type WebNode = WebNodeInput & {
  vx: number;
  vy: number;
  /** Kept so threads run along real radials rather than being guessed back. */
  angle: number;
  ring: number;
};

/** THE CENTRE — your face. Slightly above the middle, so the widest part of
 * the web sits in the upper two thirds and there is floor left to stand on. */
export const WEB_CENTRE = { vx: 0.5, vy: 0.44 };

/** The id the centre is drawn with, so a radial can name where it starts. */
export const WEB_CENTRE_ID = "__you__";

/** The base ellipse, as fractions of the room. Separate x and y on purpose: a
 * room is wider than it is tall, so a true circle in normalised space arrives
 * on screen as a stretched ellipse and the nodes bunch at top and bottom. */
const WEB_RX = 0.2;
const WEB_RY = 0.16;

/** Ring radii as MULTIPLES of that one ellipse, never as independent pairs.
 * Because every ring is the same shape scaled, a post at its account's angle
 * is exactly collinear with your face and that account — you follow one
 * straight line outward. Two hand-tuned rx/ry pairs put a nearly-imperceptible
 * bend in every spoke, which is the sort of thing that reads as sloppy without
 * anybody being able to say why. */
const RING_SCALE = [0, 1, 1.85];

/**
 * Which ring each kind lives on — DISTANCE IS HOW FAR IT IS FROM BEING YOU.
 *
 * The first attempt put friends on the inner ring beside your own accounts,
 * which put twenty-four tiles on two rings and, at 390px, left seventeen
 * pixels between a friend's post and your own. That is not a density problem
 * to be tuned away — it was the wrong reading. Your accounts ARE you; your
 * friends are one hop out, and their posts one further. Sorting by hop count
 * both fixes the crowding and says something true.
 */
const RING_OF: Record<WebNodeKind, number> = {
  door: 1,
  account: 1,
  post: 2,
  friend: 2,
};

/** The kinds that own a spoke of their own, running all the way back to your
 * face. Everything else hangs off a parent's spoke further out. */
const OWNS_SPOKE: Record<WebNodeKind, boolean> = {
  door: true,
  account: true,
  friend: true,
  post: false,
};

/** How far apart siblings fan on the outer ring — wide enough that two posts
 * on one account clear each other, tight enough that they still read as
 * belonging to the same thread. */
const FAN = 0.32;

/**
 * HOW MUCH WEB THERE IS ROOM FOR.
 *
 * These live here rather than in the page because they are geometry, not
 * editorial: they are the answer to "how many tiles fit on three rings without
 * overlapping on a 390px phone", and the contract next door checks them by
 * building the largest web they permit and measuring it in pixels.
 *
 * The read hands back up to ten friends and every connected platform, and the
 * unbounded version of this put thirty-two tiles on three rings — fifteen
 * pixels apart. A web you cannot read is not showing you more, it is showing
 * you nothing. One post per account is the honest budget: the mesh says where
 * you are and what came out of there last, and the account itself has the rest.
 *
 * Every one of these is AT its ceiling, not under it — raising any by one puts
 * two tiles within a tile's width of each other on a 390px phone, and the
 * contract says which pair. They are not round numbers picked for comfort.
 */
export const WEB_CAPS = {
  accounts: 6,
  postsPerAccount: 1,
  friends: 8,
} as const;

// There WAS a second cap here — a flat ceiling on how far a group of siblings
// could span in total. It was removed: mutation testing showed the layout is
// bit-identical without it in every reachable case, because the spoke-room cap
// below is strictly tighter wherever there is more than one spoke, and `FAN`
// itself is tighter wherever there are few enough siblings to matter. Its
// comment claimed to stop posts "running through the next account's spoke",
// which is the spoke-room cap's job and is gated as such. A rule that cannot
// change an outcome is not defence, it is a second answer to a question that
// already has one.

/**
 * Rank → angle, φ₂ (the van der Corput sequence in base 2).
 *
 * Exported because "adding a node never moves an existing one", "a small web
 * still looks balanced" and "no two nodes share an angle" are all statements
 * about THIS function, and all three are the kind of property that quietly
 * stops being true.
 */
export function angleFor(rank: number): number {
  const safe = Number.isFinite(rank) && rank >= 0 ? Math.floor(rank) : 0;
  // Reflect the rank about the binary point: 1 → 0.1 → ½, 2 → 0.01 → ¼,
  // 3 → 0.11 → ¾, 4 → 0.001 → ⅛. Depends on nothing but the rank, so it is
  // the same on the server and in the browser.
  let turn = 0;
  let denominator = 1;
  let n = safe;
  while (n > 0) {
    denominator *= 2;
    turn += (n % 2) / denominator;
    n = Math.floor(n / 2);
  }
  // Start at the top and go clockwise — the first thing you connected sits
  // straight up, which is the one position anybody will remember.
  return -Math.PI / 2 + turn * Math.PI * 2;
}

/**
 * Weave the web.
 *
 * Pure and total: same input, same output, no clock, no randomness, no
 * viewport. Server and client have to agree about where your things are, and
 * the only way to guarantee that is for position to depend on nothing else.
 */
export function layoutWeb(nodes: readonly WebNodeInput[]): WebNode[] {
  const ordered = (group: readonly WebNodeInput[]) =>
    group
      .slice()
      .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  // THE SPOKES, IN ONE SEQUENCE. Doors and accounts first, then friends, all
  // drawing from the same angle sequence — so a friend can never land on the
  // same heading as a platform even though they sit on different rings.
  //
  // Doors and accounts come first because they are the two things that must
  // never move: everything after them shifts when something is inserted, and
  // "my Instagram is at three o'clock" is the whole reason for fixed angles.
  const spokeOwners = [
    ...ordered(nodes.filter((n) => OWNS_SPOKE[n.kind] && RING_OF[n.kind] === 1)),
    ...ordered(nodes.filter((n) => OWNS_SPOKE[n.kind] && RING_OF[n.kind] !== 1)),
  ];
  const hangers = ordered(nodes.filter((n) => !OWNS_SPOKE[n.kind]));

  const out: WebNode[] = [];
  const angleById = new Map<string, number>();

  spokeOwners.forEach((node, index) => {
    const angle = angleFor(index);
    angleById.set(node.id, angle);
    out.push({ ...node, ...pointAt(angle, RING_OF[node.kind]), angle, ring: RING_OF[node.kind] });
  });

  // Children hang OUTWARD ALONG THEIR PARENT'S THREAD. That is what makes the
  // web readable: you follow one line from your face, through the platform, to
  // the thing you posted there.
  const byParent = new Map<string, WebNodeInput[]>();
  for (const node of hangers) {
    const key = node.parentId ?? "";
    const bucket = byParent.get(key);
    if (bucket) bucket.push(node);
    else byParent.set(key, [node]);
  }

  // How much angular room ONE spoke owns. The van der Corput prefix of length
  // k always sits on a 2^ceil(log2 k) grid, so its tightest gap is exactly
  // that — which means the fan can be sized to fit rather than guessed at.
  const spokes = Math.max(1, spokeOwners.length);
  const spokeGap = (Math.PI * 2) / 2 ** Math.ceil(Math.log2(spokes));
  // Seven tenths of it, so two neighbouring accounts' posts always leave a
  // visible gutter between them instead of interleaving into one arc.
  const fanRoom = spokeGap * 0.7;

  let orphanIndex = 0;
  for (const [parentId, group] of byParent) {
    const parentAngle = angleById.get(parentId);
    // Siblings share a spoke and fan off it; the step tightens as the group
    // grows, and again as the web gets busier, so a popular account never
    // sprays its posts across the account next door.
    const step = group.length < 2 ? 0 : Math.min(FAN, fanRoom / (group.length - 1));
    group.forEach((node, index) => {
      // A child whose parent is NOT on screen has no spoke to hang off, so it
      // gets one of its own rather than every orphan piling onto one angle.
      // It takes no fan either — fanning around a spoke that is not drawn
      // just spreads unrelated things into a fake cluster.
      const angle =
        parentAngle === undefined
          ? angleFor(spokeOwners.length + orphanIndex++)
          : parentAngle + (index - (group.length - 1) / 2) * step;
      const ring = RING_OF[node.kind];
      out.push({ ...node, ...pointAt(angle, ring), angle, ring });
    });
  }

  return out;
}

export type WebThread = {
  fromId: string;
  toId: string;
  fromVx: number;
  fromVy: number;
  toVx: number;
  toVy: number;
  /** "radial" runs outward from the centre; "ring" ties neighbours together.
   * The renderer draws them differently — a web's rings are finer than its
   * spokes, and drawing both at one weight makes a net rather than a web. */
  kind: "radial" | "ring";
};

/**
 * Every thread in the web.
 *
 * Three families, and the third is the one that matters most: without rings
 * tying adjacent spokes together, this is a sunburst and not a web.
 */
export function threadsFor(nodes: readonly WebNode[]): WebThread[] {
  const threads: WebThread[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // 1. Centre → every spoke owner. A friend's spoke is longer than an
  // account's and passes between two of them on its way out, which is exactly
  // what a spider web looks like — the radials are not all the same length.
  for (const node of nodes) {
    if (!OWNS_SPOKE[node.kind]) continue;
    threads.push({
      fromId: WEB_CENTRE_ID,
      toId: node.id,
      fromVx: WEB_CENTRE.vx,
      fromVy: WEB_CENTRE.vy,
      toVx: node.vx,
      toVy: node.vy,
      kind: "radial",
    });
  }

  // 2. Parent → its own children, continuing that same spoke outward.
  for (const node of nodes) {
    if (OWNS_SPOKE[node.kind] || !node.parentId) continue;
    const parent = byId.get(node.parentId);
    if (!parent || parent.id === node.id) continue;
    threads.push({
      fromId: parent.id,
      toId: node.id,
      fromVx: parent.vx,
      fromVy: parent.vy,
      toVx: node.vx,
      toVy: node.vy,
      kind: "radial",
    });
  }

  // 3. THE RINGS — neighbours on the same ring joined in angular order and
  // closed back around to the first. This is the thread a spider actually
  // spins between its radials, and it is the whole difference between a web
  // and a starburst.
  //
  // WITH ONE RULE: a ring segment is a straight chord, and a chord across a
  // WIDE gap cuts through the middle of the web. Three accounts sit at 12, 3
  // and 6 o'clock, so closing that ring draws a line from 6 back up to 12 —
  // straight through your face. A real web just has an open sector where the
  // spider has not spun yet, and that is the honest picture of a mesh with
  // three things in it, so the wide segment is left out.
  for (const ring of new Set(nodes.map((n) => n.ring))) {
    const onRing = nodes
      .filter((n) => n.ring === ring)
      .sort((a, b) => turnOf(a.angle) - turnOf(b.angle));
    if (onRing.length < 2) continue;
    for (let i = 0; i < onRing.length; i++) {
      const a = onRing[i];
      const b = onRing[(i + 1) % onRing.length];
      // Normalised, so the wrap from the last node back to the first is a
      // real gap rather than a negative one.
      const gap = turnOf(b.angle - a.angle);
      // `> 0` also drops the degenerate self-pair when a ring holds exactly
      // one node, and any two nodes that landed on the same angle.
      if (gap <= 0 || gap > MAX_RING_ARC) continue;
      threads.push({
        fromId: a.id,
        toId: b.id,
        fromVx: a.vx,
        fromVy: a.vy,
        toVx: b.vx,
        toVy: b.vy,
        kind: "ring",
      });
    }
  }

  return threads;
}

/**
 * The widest arc a ring segment may span.
 *
 * A chord across angle Δ on a circle of radius r passes within r·cos(Δ/2) of
 * the centre. The tighter ring has ry = 0.16 and your face is a 72px avatar —
 * roughly 0.06 of a room's height — so keeping the chord clear of it needs
 * cos(Δ/2) comfortably above 0.5. A hair over 108° leaves that margin while
 * still closing the ring for any web with four or more things on it.
 */
const MAX_RING_ARC = Math.PI * 0.6;

/** An angle as a turn in [0, 2π). Fan spread pushes children slightly past the
 * ends of the base range, and sorting raw angles would then put a node that is
 * visually first at the very end of the list and wrap the ring the long way. */
function turnOf(angle: number): number {
  const t = angle % (Math.PI * 2);
  return t < 0 ? t + Math.PI * 2 : t;
}

function pointAt(angle: number, ring: number): { vx: number; vy: number } {
  const scale = RING_SCALE[ring] ?? RING_SCALE[RING_SCALE.length - 1];
  // NOT clamped. A clamp here would quietly flatten the web against the wall
  // the moment a radius grew, turning a layout mistake into a picture nobody
  // could diagnose; the contract asserts the bounds instead, so growing a
  // radius past the room fails loudly at the gate.
  return {
    vx: WEB_CENTRE.vx + Math.cos(angle) * WEB_RX * scale,
    vy: WEB_CENTRE.vy + Math.sin(angle) * WEB_RY * scale,
  };
}
