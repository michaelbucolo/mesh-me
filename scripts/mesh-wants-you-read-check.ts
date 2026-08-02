// THE QUERY IS PART OF THE CLAIM, SO THE QUERY GETS A GATE.
//
// `mesh-wants-you-check.ts` proves the JUDGEMENT — given rows, what counts as
// owed. Its own closing note says what it does not cover: "the database query
// that produces these rows". This is that gate.
//
// The gap mattered, because the whole redesign rests on one sentence — that the
// mesh can tell you what, across everything, is actually waiting on you — and
// every signal in that sentence is produced HERE, by query arguments:
//
//   • "unanswered"  is `senderId !== viewer` against the NEWEST message, which
//                   is `orderBy createdAt desc, take 1`. Flip that ordering to
//                   `asc` and the test reads the FIRST message instead, so
//                   every long settled thread reports as owed and the ring
//                   fills with things nobody is waiting on. Nothing about the
//                   types would change and no judgement test would notice.
//   • "unread"      is the `lastRead` watermark surviving into `lastReadMs`.
//                   Drop that select and everything is unread forever.
//   • "muted"       is `notificationsMuted` surviving into `muted`. Drop it and
//                   a thread you silenced shouts.
//   • mentions and  arrive as notification `type`, which must be passed through
//     replies       UNFILTERED — the set of types that count is the judgement's
//                   to know, and a `where type in (...)` here would be a second
//                   copy of it.
//
// So this runs the real `readWantsYou` against a fake client that RECORDS the
// arguments it is called with. No database, no fixtures to drift, and the
// assertions are about behaviour rather than about the source text — a rename
// cannot satisfy them and a reordering cannot slip past them.

import { readWantsYou, type WantsYouDb } from "../src/lib/mesh/read-wants-you";

let checks = 0;
const failures: string[] = [];
function ok() {
  checks += 1;
}
function fail(section: string, message: string) {
  failures.push(`[${section}] ${message}`);
}

const VIEWER = "viewer-1";
const OTHER = "other-1";
const HOUR = 60 * 60 * 1000;

type Recorded = { threadArgs?: Record<string, unknown>; notificationArgs?: Record<string, unknown> };

/** A client that answers with the rows it is given and remembers the query. */
function fakeDb(
  memberships: unknown[],
  notifications: unknown[],
  recorded: Recorded = {},
): WantsYouDb {
  return {
    threadMember: {
      findMany: async (args) => {
        recorded.threadArgs = args;
        return memberships as never[];
      },
    },
    notification: {
      findMany: async (args) => {
        recorded.notificationArgs = args;
        return notifications as never[];
      },
    },
  };
}

/** A thread membership row shaped exactly as the resolver's select asks for. */
function membership(options: {
  id: string;
  senderId: string;
  ageMs?: number;
  lastReadAgoMs?: number;
  muted?: boolean;
  title?: string | null;
  platform?: string | null;
  content?: string | null;
}) {
  const now = Date.now();
  const at = new Date(now - (options.ageMs ?? HOUR));
  return {
    lastRead: new Date(now - (options.lastReadAgoMs ?? 48 * HOUR)),
    notificationsMuted: options.muted ?? false,
    thread: {
      id: options.id,
      title: options.title ?? "A thread",
      sourcePlatform: options.platform ?? null,
      messages: [{ createdAt: at, senderId: options.senderId, content: options.content ?? "hello" }],
    },
  };
}

function notification(options: { id: string; type: string; ageMs?: number; read?: boolean }) {
  return {
    id: options.id,
    type: options.type,
    message: `${options.type} happened`,
    read: options.read ?? false,
    createdAt: new Date(Date.now() - (options.ageMs ?? HOUR)),
    postId: "post-1",
    actor: { displayName: "Someone", username: "someone" },
  };
}

// tsx compiles these gates to CJS, where top-level await is unavailable, so the
// whole run lives in one async main.
async function main() {
  // ---------------------------------------------------------------------------
  // 1. THE NEWEST MESSAGE, NOT THE OLDEST — asserted on the query itself.
  // ---------------------------------------------------------------------------
  //
  // This is the assertion the whole gate exists for. `asc` here is a one-word
  // change that inverts the product's central signal while leaving every type,
  // every field name and every judgement test intact.
  {
    const recorded: Recorded = {};
    await readWantsYou(VIEWER, fakeDb([], [], recorded));

    const threadArgs = recorded.threadArgs as
      | { take?: unknown; select?: { thread?: { select?: { messages?: { orderBy?: { createdAt?: string }; take?: number } } } } }
      | undefined;

    if (!threadArgs) {
      fail("1 newest", "readWantsYou did not query threadMember at all");
    } else {
      const messages = threadArgs.select?.thread?.select?.messages;
      if (messages?.orderBy?.createdAt !== "desc") {
        fail(
          "1 newest",
          `the thread's messages are ordered ${JSON.stringify(messages?.orderBy)} — "is the last word theirs" reads the NEWEST message, so this must be createdAt desc or every settled thread reports as owed`,
        );
      } else ok();

      if (messages?.take !== 1) {
        fail("1 newest", `the thread's messages take ${String(messages?.take)}; exactly one row is read, and the rest would be discarded work`);
      } else ok();

      if (typeof threadArgs.take !== "number") {
        fail("1 newest", "the thread read is unbounded — a home tab cannot be a full table scan");
      } else ok();
    }

    const notificationArgs = recorded.notificationArgs as
      | { take?: unknown; orderBy?: { createdAt?: string }; where?: Record<string, unknown> }
      | undefined;
    if (typeof notificationArgs?.take !== "number") {
      fail("1 newest", "the notification read is unbounded");
    } else ok();
    if (notificationArgs?.orderBy?.createdAt !== "desc") {
      fail("1 newest", "notifications must be read newest-first, or the cap keeps the wrong slice");
    } else ok();
  }

  // ---------------------------------------------------------------------------
  // 2. UNANSWERED MEANS THE LAST WORD IS THEIRS.
  // ---------------------------------------------------------------------------
  {
    const theirs = await readWantsYou(VIEWER, fakeDb([membership({ id: "t1", senderId: OTHER })], []));
    const mine = await readWantsYou(VIEWER, fakeDb([membership({ id: "t2", senderId: VIEWER })], []));

    const theirItem = theirs.items.find((i) => i.id.includes("t1"));
    const myItem = mine.items.find((i) => i.id.includes("t2"));

    if (!theirItem?.awaitingViewer) {
      fail("2 unanswered", "an unread thread whose last message is from someone else is not marked as awaiting the viewer — this is the signal the surface is built on");
    } else ok();

    if (myItem?.awaitingViewer) {
      fail("2 unanswered", "a thread whose last message is the VIEWER'S own is marked as awaiting them — you are never waiting on yourself");
    } else ok();
  }

  // ---------------------------------------------------------------------------
  // 3. THE READ WATERMARK AND THE MUTE BOTH SURVIVE THE READ.
  // ---------------------------------------------------------------------------
  //
  // Both are single fields that go quiet rather than loud when dropped: nothing
  // crashes, the ring just fills with things you have already dealt with.
  {
    // Read AFTER the message arrived: seen, so not owed.
    const seen = await readWantsYou(
      VIEWER,
      fakeDb([membership({ id: "t3", senderId: OTHER, ageMs: 5 * HOUR, lastReadAgoMs: 1 * HOUR })], []),
    );
    if (seen.items.find((i) => i.id.includes("t3"))?.awaitingViewer) {
      fail("3 watermark", "a thread read AFTER its last message still counts as owed — the lastRead watermark is not reaching the judgement");
    } else ok();

    const muted = await readWantsYou(
      VIEWER,
      fakeDb([membership({ id: "t4", senderId: OTHER, muted: true })], []),
    );
    if (muted.items.find((i) => i.id.includes("t4"))?.awaitingViewer) {
      fail("3 watermark", "a MUTED thread counts as owed — muting is the user telling you not to, and the flag is not reaching the judgement");
    } else ok();
  }

  // ---------------------------------------------------------------------------
  // 4. MENTIONS AND REPLIES ARRIVE, AND THE TYPE IS NOT FILTERED HERE.
  // ---------------------------------------------------------------------------
  //
  // Which types count as an obligation is the judgement's to know. If this file
  // ever narrowed them in SQL there would be two copies of that list, and the
  // gates would only be watching one.
  {
    const recorded: Recorded = {};
    const result = await readWantsYou(
      VIEWER,
      fakeDb(
        [],
        [
          notification({ id: "n1", type: "mention" }),
          notification({ id: "n2", type: "reply" }),
          notification({ id: "n3", type: "follow" }),
        ],
        recorded,
      ),
    );

    // Ids are namespaced by the judgement (`notification:<id>`) so a thread and
    // a notification can never collide on the field. Pinned by using the real
    // form rather than a suffix match.
    for (const id of ["notification:n1", "notification:n2"]) {
      if (!result.items.some((i) => i.id === id && i.awaitingViewer)) {
        fail("4 types", `an unread ${id.endsWith("n1") ? "mention" : "reply"} did not arrive as something awaiting the viewer (looked for id ${id})`);
      } else ok();
    }

    // A follow is news, not an obligation — pinned here too, because the read is
    // where a well-meaning "surface more" change would be made.
    if (result.items.find((i) => i.id === "notification:n3")?.awaitingViewer) {
      fail("4 types", "a follow is marked as awaiting the viewer — being followed asks nothing of you");
    } else ok();

    const where = (recorded.notificationArgs as { where?: Record<string, unknown> } | undefined)?.where ?? {};
    if ("type" in where) {
      fail(
        "4 types",
        "the notification read filters by `type` — the set of types that count as an obligation belongs to wants-you.ts, and a copy here would drift from it",
      );
    } else ok();
  }

  // ---------------------------------------------------------------------------
  // 5. THE CLOCK IS STAMPED ONCE, HERE, AND HANDED BACK.
  // ---------------------------------------------------------------------------
  //
  // The field's placement is pure in (items, nowMs). Server and client only agree
  // if both are given the same instant, so the read must return the one it used.
  {
    const before = Date.now();
    const { nowMs } = await readWantsYou(VIEWER, fakeDb([], []));
    const after = Date.now();
    if (!(nowMs >= before && nowMs <= after)) {
      fail("5 clock", `readWantsYou returned nowMs=${nowMs}, outside the window it ran in — the rows and the clock must describe the same instant`);
    } else ok();
  }

  if (failures.length) {
    console.error(`\nmesh-wants-you-read: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
    for (const f of failures) console.error("  " + f);
    console.error("");
    process.exit(1);
  }

  console.log(
    `mesh-wants-you-read OK — ${checks} assertions. The query that produces "what wants you" is checked against a\n` +
      "  recording fake, so the arguments themselves are pinned: the newest message is read newest-first and one\n" +
      "  row deep, both reads are bounded, and notifications come back newest-first. Unanswered means the last word\n" +
      "  is THEIRS; a thread read after its last message is settled; a muted thread stays quiet; mentions and replies\n" +
      "  arrive while a follow does not. The set of types that counts is never re-stated here. The clock is stamped\n" +
      "  once and returned with the rows it was applied to.\n" +
      "  Does NOT cover: the judgement itself (mesh-wants-you:check owns that), or whether a mirrored platform\n" +
      "  thread is up to date — freshness is the sync's problem.",
  );
}

main();
