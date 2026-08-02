// WHERE A THING SITS, AND WHY.
//
// The old mesh placed people by CLOSENESS: your best friend near the middle,
// acquaintances further out. It looked like information and was not, because
// closeness is not something you can act on. Knowing that Jordan sits nearer
// than Naomi gives you nothing to do, and a home surface whose geometry means
// nothing actionable is a diagram, not a dashboard.
//
// Here, DISTANCE FROM THE CENTRE IS HOW MUCH SOMETHING WANTS YOU. That is the
// whole model. Everything near the middle is something to do; everything far
// out is context. A person can steer by it without being taught what it means,
// because "closer = more urgent" is not a convention, it is an instinct.
//
// ── WHY THIS IS THE ONLY THING THE SURFACE CAN HONESTLY BE ──────────────────
//
// Instagram cannot tell you a Twitter DM is unanswered. YouTube cannot tell you
// a reply is waiting on Reddit. Cross-platform triage is the one question this
// surface can answer that none of the platforms it aggregates can answer for
// themselves — which makes it the only defensible reason for it to be the tab
// people land on.
//
// ── THE RULE THAT KILLS "0 NEW FOR YOU" ─────────────────────────────────────
//
// The surface this replaces led with a stat row reading "0 new for you". A
// dashboard whose headline number is nothing has told you it has nothing to say
// AND taken up the best real estate to say it.
//
// So rings are never padded to look busy, and emptiness is never reported as a
// count. `calm` is a first-class outcome with its own headline, and the type
// makes it impossible to render the rings without having decided what the
// centre says. Nothing needing you is a GOOD state and has to look like one.

/** Distance band. Order matters: this is the draw and priority order. */
export type Ring = "needsYou" | "happening" | "fresh" | "field";

export const RINGS: readonly Ring[] = Object.freeze(["needsYou", "happening", "fresh", "field"]);

type ItemKind = "message" | "mention" | "reply" | "person" | "post" | "community";

/** One thing on the field. */
export type FieldItem = {
  id: string;
  kind: ItemKind;
  /** Who or what it is. Never truncated by this module — that is the view's call. */
  title: string;
  /** The platform it came from, for hue. "mesh" for native. */
  platform: string;
  /** Face or media. Absent is allowed; the view generates a per-identity mark. */
  imageUrl?: string | null;
  /** Body text where there is any — a message preview, a caption. */
  body?: string;
  /** When it happened. Drives recency within a ring. */
  atMs: number;
  /** Someone is live/active right now. */
  live?: boolean;
  /** It is addressed to the viewer and has had no reply from them. */
  awaitingViewer?: boolean;
  /** Where acting on it goes. */
  href: string;
};

/** An item once it has been placed, with the reason and the verb it earned. */
type PlacedItem = FieldItem & {
  ring: Ring;
  /**
   * Why it sits where it sits, in words a person could read. Not a log line:
   * the view shows this, because a surface that arranges things by importance
   * owes you its reasoning.
   */
  reason: string;
  /** The action, visible at rest. "Reply", not "Open".  */
  verb: string;
  /** 0..1 within the ring. Drives size and how near the band's inner edge it sits. */
  weight: number;
};

export type Field = {
  items: PlacedItem[];
  byRing: Record<Ring, PlacedItem[]>;
  /**
   * Nothing wants the viewer. A designed state, not a failure — and the reason
   * this is a boolean rather than something a caller derives from a length is
   * that "no items" and "calm" must not be reachable independently.
   */
  calm: boolean;
  /**
   * What the centre says. Required, so the rings cannot be rendered without a
   * decision having been made about the headline — which is exactly how a
   * surface ends up leading with a zero.
   */
  headline: Headline;
};

type Headline = {
  /** One sentence. Never a bare count, never the number zero on its own. */
  text: string;
  /** The single most worthwhile thing to do, when there is one. */
  action?: { label: string; href: string };
};

/** Anything older than this is context, however unread it is. */
const FRESH_WINDOW_MS = 72 * 60 * 60 * 1000;

/**
 * How many items a ring may hold.
 *
 * Not a performance cap — a legibility one. The surface this replaces put
 * eleven unreadable cards on screen at once; the fix for "too much to read" is
 * fewer things, not smaller text. Overflow is reachable through search and the
 * list view rather than by shrinking what is already illegible.
 */
export const RING_CAPACITY: Readonly<Record<Ring, number>> = Object.freeze({
  needsYou: 8,
  happening: 10,
  fresh: 12,
  field: 40,
});

function verbFor(item: FieldItem): string {
  switch (item.kind) {
    case "message":
      return "Reply";
    case "mention":
    case "reply":
      return "Respond";
    case "person":
      return item.live ? "Say hi" : "Open";
    case "community":
      return "Join in";
    case "post":
      return "Read";
  }
}

/**
 * Which band, and why.
 *
 * Ordered most-urgent-first and returns on the first match, so an unanswered
 * message from someone who is also live lands in `needsYou` — the stronger
 * claim on the viewer wins, rather than the more recent one.
 */
function bandFor(item: FieldItem, nowMs: number): { ring: Ring; reason: string } {
  if (item.awaitingViewer) {
    return {
      ring: "needsYou",
      reason: item.kind === "message" ? "Waiting on your reply" : "You were mentioned and have not answered",
    };
  }
  if (item.live) {
    return { ring: "happening", reason: "Active right now" };
  }
  if (nowMs - item.atMs <= FRESH_WINDOW_MS) {
    return { ring: "fresh", reason: "New since you last looked" };
  }
  return { ring: "field", reason: "Part of your world" };
}

/**
 * Rank within a band.
 *
 * Recency, but bounded: a two-hour-old unanswered message and a two-day-old one
 * are both simply waiting, and letting raw age dominate would push a real
 * obligation to the rim because something newer arrived.
 */
function weightFor(item: FieldItem, nowMs: number): number {
  const ageMs = Math.max(0, nowMs - item.atMs);
  const decayed = 1 / (1 + ageMs / (12 * 60 * 60 * 1000));
  return Math.min(1, Math.max(0, decayed));
}

function headlineFor(byRing: Record<Ring, PlacedItem[]>): Headline {
  const needs = byRing.needsYou;
  if (needs.length > 0) {
    const first = needs[0];
    const others = needs.length - 1;
    return {
      text:
        others > 0
          ? `${first.title} is waiting on you, and ${others} other${others === 1 ? "" : "s"}.`
          : `${first.title} is waiting on you.`,
      action: { label: first.verb, href: first.href },
    };
  }

  const live = byRing.happening;
  if (live.length > 0) {
    const first = live[0];
    return {
      text: live.length === 1 ? `${first.title} is around right now.` : `${live.length} people are around right now.`,
      action: { label: first.verb, href: first.href },
    };
  }

  const fresh = byRing.fresh;
  if (fresh.length > 0) {
    const first = fresh[0];
    return {
      text: `Nothing needs you. ${fresh.length} new thing${fresh.length === 1 ? "" : "s"} since you looked.`,
      action: { label: first.verb, href: first.href },
    };
  }

  // THE STATE THE OLD SURFACE REPORTED AS "0 new for you".
  //
  // It is not a failure and it is not nothing: it means the person is caught
  // up, which is the outcome every one of these surfaces claims to want for
  // them. So it says so, and offers somewhere to go rather than a zero.
  return {
    text: "You are all caught up.",
    action: { label: "Wander the Flow", href: "/flow" },
  };
}

/**
 * Place everything.
 *
 * `nowMs` is a parameter rather than a clock read, so the same input always
 * produces the same field — which is what makes this testable at all, and what
 * stops a render from disagreeing with the render before it for no reason the
 * viewer caused.
 */
export function placeField(items: readonly FieldItem[], nowMs: number): Field {
  const byRing: Record<Ring, PlacedItem[]> = {
    needsYou: [],
    happening: [],
    fresh: [],
    field: [],
  };

  for (const item of items) {
    const { ring, reason } = bandFor(item, nowMs);
    byRing[ring].push({
      ...item,
      ring,
      reason,
      verb: verbFor(item),
      weight: weightFor(item, nowMs),
    });
  }

  for (const ring of RINGS) {
    byRing[ring].sort((a, b) => b.weight - a.weight || a.id.localeCompare(b.id));
    // Trimmed, not shrunk. See RING_CAPACITY.
    byRing[ring] = byRing[ring].slice(0, RING_CAPACITY[ring]);
  }

  // `calm` is about the three bands that make a claim on the viewer. A full
  // outer field is not a reason to withhold "you are caught up" — having a world
  // is not the same as being wanted by it.
  const calm = byRing.needsYou.length === 0 && byRing.happening.length === 0 && byRing.fresh.length === 0;

  return {
    items: RINGS.flatMap((ring) => byRing[ring]),
    byRing,
    calm,
    headline: headlineFor(byRing),
  };
}
