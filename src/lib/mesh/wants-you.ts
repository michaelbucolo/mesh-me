// WHAT, ACROSS EVERYTHING, ACTUALLY WANTS YOU RIGHT NOW.
//
// This is the one question the mesh can answer that none of the platforms it
// aggregates can answer for themselves. Instagram cannot tell you a Twitter DM
// is unanswered. YouTube cannot tell you a reply is waiting on Reddit. That
// cross-platform triage is the only honest reason for this surface to be the
// home tab, and until now the data for it did not exist: `/api/mesh` returned
// closeness, freshness and weight, and contained no occurrence of the words
// unread, unanswered or mention. The whole rebuilt mesh is organised on a
// signal the API could not supply.
//
// So this decides what is an OBLIGATION, and it is deliberately strict, because
// the value of a "needs you" ring collapses the moment it contains one thing
// that does not need you. A ring you have learned to ignore is worse than no
// ring, since it costs the same attention and returns nothing.
//
// ── A LIKE IS NOT AN OBLIGATION ─────────────────────────────────────────────
//
// The temptation is to put everything unread in the urgent ring: it makes the
// number bigger and the surface look busy. But nothing is owed for a like, and
// nothing is owed for a follow. Treating them as obligations is precisely the
// manufactured-urgency pattern this product exists as an alternative to — a
// badge that demands attention for something that requires no action.
//
// Obligation means SOMEONE IS WAITING FOR YOU SPECIFICALLY:
//
//   • a thread where the last word is theirs and you have not read it
//   • a reply or comment addressed to you that you have not seen
//
// Everything else is news, and news belongs in the outer rings where the
// geometry already puts it.
//
// ── YOU ARE NOT WAITING ON YOURSELF ─────────────────────────────────────────
//
// If the last message in a thread is yours, nothing is owed BY you — you are
// owed a reply. That is a real state and it is not urgency. Getting this
// backwards turns every conversation you have ever started into a permanent
// obligation, which is how unread counts become meaningless.
//
// ── MUTED MEANS MUTED ───────────────────────────────────────────────────────
//
// `ThreadMember.notificationsMuted` is the user saying "do not bother me about
// this". A surface that puts a muted thread in the ring of things that want you
// has overridden an explicit instruction to make its own dashboard look busier.
// The thread still exists and is still reachable; it is simply not an alarm.

// ── WHY THE ITEM TYPE LIVES HERE NOW ────────────────────────────────────────
//
// `FieldItem` used to be imported from components/meshfield/model/rings.ts,
// where it was declared alongside `placeField` — the ring geometry that
// arranged these items into distance bands. That surface is gone: /mesh is the
// canvas scene again, the ring field and every module under meshfield/ has been
// removed, and rings.ts went with it.
//
// The type did not go with it, because the type was never about rings. It is
// the shape of ONE THING THAT MIGHT WANT YOU, which is what this module
// decides and what read-wants-you.ts and read-my-presence.ts consume. It lived
// in the view layer only because that is where the first consumer happened to
// be, and a shared shape owned by one of its readers is how a deletion takes
// out a rule that had nothing to do with it. It is declared where it is
// produced now, and nothing outside src/lib/mesh needs it.
//
// The shape is unchanged, field for field, so no consumer had to adapt —
// including `kind: "community"`, which no current reader emits but
// read-my-presence still folds into "post". Narrowing it here would have been
// a behaviour change smuggled in under a file move.

type ItemKind = "message" | "mention" | "reply" | "person" | "post" | "community";

/** One thing that may want the viewer, from any platform they are on. */
export type FieldItem = {
  id: string;
  kind: ItemKind;
  /** Who or what it is. Never truncated by this module — that is the view's call. */
  title: string;
  /** The platform it came from, for hue. "mesh" for native. */
  platform: string;
  /** Face or media. Absent is allowed; the view decides what to draw instead. */
  imageUrl?: string | null;
  /** Body text where there is any — a message preview, a caption. */
  body?: string;
  /** When it happened. Drives recency wherever it is shown. */
  atMs: number;
  /** Someone is live/active right now. */
  live?: boolean;
  /** It is addressed to the viewer and has had no reply from them. */
  awaitingViewer?: boolean;
  /** Where acting on it goes. */
  href: string;
};

/**
 * One thread the viewer belongs to, already read out of the database.
 *
 * Rows in, items out — no Prisma import. Partly because this repo's check chain
 * runs before the database is seeded, so a gate cannot reach one; and partly
 * because the interesting part here is the JUDGEMENT, and judgement should be
 * testable without a database in the room.
 */
export type ThreadRow = {
  threadId: string;
  /** Thread title, or the other person's name for a direct thread. */
  title: string | null;
  /** "mesh" for native, otherwise the platform the thread is mirrored from. */
  sourcePlatform: string;
  /** Newest message in the thread. Null when the thread has no messages yet. */
  lastMessageAtMs: number | null;
  /** True when the newest message was sent by the viewer. */
  lastMessageFromViewer: boolean;
  /** Preview of the newest message, if there is one. */
  lastMessagePreview: string | null;
  /** The viewer's own read watermark for this thread. */
  lastReadMs: number;
  /** The viewer asked not to be notified about this thread. */
  muted: boolean;
};

/** One notification addressed to the viewer, already read out of the database. */
export type NotificationRow = {
  id: string;
  /** `comment`, `message`, `like`, `follow`, `meshi_delivery`, … */
  type: string;
  actorName: string | null;
  /** The actor's face. Carried, never invented: a surface that shows a person
   * without showing WHO is a chart of dots, which is what the ring field was. */
  actorAvatarUrl?: string | null;
  message: string | null;
  read: boolean;
  createdAtMs: number;
  postId: string | null;
};

/**
 * Notification types that mean someone is waiting on the viewer.
 *
 * A short list on purpose, and everything absent from it is news rather than a
 * debt. `like` and `follow` are the load-bearing exclusions: they are the two
 * that would most inflate the count and the two that ask nothing of you.
 */
const OBLIGATION_TYPES: ReadonlySet<string> = new Set(["comment", "message", "mention", "reply"]);

/** How long a thread stays "warm" enough to count as active rather than old. */
const ACTIVE_WINDOW_MS = 45 * 60 * 1000;

function threadHref(row: ThreadRow): string {
  return `/mechat/${encodeURIComponent(row.threadId)}`;
}

/**
 * Does this thread need the viewer?
 *
 * Three conditions, all required, and each one corresponds to a way the naive
 * version gets it wrong: it has to have a message at all, the last word has to
 * be someone else's, and the viewer must not already have read it.
 */
function threadAwaitsViewer(row: ThreadRow): boolean {
  if (row.lastMessageAtMs === null) return false;
  if (row.lastMessageFromViewer) return false;
  if (row.muted) return false;
  return row.lastMessageAtMs > row.lastReadMs;
}

/**
 * Turn what the database knows into what the mesh shows.
 *
 * Pure and deterministic: same rows and same clock reading give the same items,
 * so two devices looking at one account see one mesh. `nowMs` is a parameter
 * rather than a `Date.now()` for exactly that reason.
 */
export function wantsYou(input: {
  threads: readonly ThreadRow[];
  notifications: readonly NotificationRow[];
  nowMs: number;
}): FieldItem[] {
  const items: FieldItem[] = [];
  const seen = new Set<string>();

  for (const row of input.threads) {
    if (row.lastMessageAtMs === null) continue;
    const id = `thread:${row.threadId}`;
    if (seen.has(id)) continue;
    seen.add(id);

    items.push({
      id,
      kind: "message",
      // Never invented. A thread with no title is described by what it is,
      // rather than given a summary this module is in no position to write.
      title: row.title?.trim() || "Direct message",
      platform: row.sourcePlatform || "mesh",
      body: row.lastMessagePreview?.trim() || undefined,
      atMs: row.lastMessageAtMs,
      awaitingViewer: threadAwaitsViewer(row),
      // A thread that moved in the last three quarters of an hour is a
      // conversation in motion, which is a different thing from one that wants
      // an answer — a thread can be both, or either.
      live: input.nowMs - row.lastMessageAtMs < ACTIVE_WINDOW_MS,
      href: threadHref(row),
    });
  }

  for (const row of input.notifications) {
    const id = `notification:${row.id}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const isObligation = !row.read && OBLIGATION_TYPES.has(row.type);
    items.push({
      id,
      kind: row.type === "follow" ? "person" : "post",
      imageUrl: row.actorAvatarUrl ?? null,
      title: row.message?.trim() || (row.actorName ? `${row.actorName} ${row.type === "follow" ? "followed you" : "replied"}` : "Activity"),
      platform: "mesh",
      atMs: row.createdAtMs,
      awaitingViewer: isObligation,
      // `/feed/<id>` is the single-post route; there is no `/post/` route and
      // no redirect aliasing one, so the previous href 404'd. An item on a
      // surface whose entire purpose is "act on this" must land somewhere.
      href: row.postId ? `/feed/${encodeURIComponent(row.postId)}` : "/notifications",
    });
  }

  return items;
}

// ── WHAT USED TO BE HERE, AND WHY IT IS NOT ────────────────────────────────
//
// `wantsYouSummary(items)` returned { waiting, platforms } for the ring field's
// CENTRE — the headline that sat inside the innermost ring saying how many
// things wanted you and from where. It existed so that the core and the rings
// could not disagree: both counted the same `awaitingViewer` flag rather than
// deriving the rule twice.
//
// The ring field is gone and the canvas has no such headline. Nothing in the
// app called this, and the only thing keeping it alive was the gate that
// tested it — a rule with no reader, held up by a test with no subject, which
// is precisely the shape of dead code that reads as coverage. It has been
// removed rather than left exported "in case", because the property it
// protected (one computation of what is owed) is now enforced by there being
// exactly one computation: `awaitingViewer`, set above, read directly by
// read-my-presence.ts for its per-arm and total counts.
//
// It is in git history if a headline ever comes back. What must not come back
// is a second place that decides what "waiting" means.
