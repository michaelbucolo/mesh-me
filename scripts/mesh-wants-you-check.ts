// THE RING IS WORTH NOTHING IF IT CONTAINS ONE THING THAT DOES NOT NEED YOU.
//
// The rebuilt mesh is organised on a single claim — that it can tell you what,
// across every platform you use, is actually waiting on you. That claim is only
// as good as this module's judgement about the word "waiting", and judgement is
// exactly the kind of thing that drifts toward whatever makes the number
// bigger.
//
// So the assertions here are mostly about what must NOT be in the urgent ring.
// A ring you have learned to ignore costs the same attention as a useful one
// and returns nothing, and every wrong item in it is a step toward that.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
// TRIMMED TO WHAT IS STILL LIVE.
//
// This gate covered three things: `wantsYou`, `wantsYouSummary`, and a
// cross-check that the summary's count agreed with the ring field's needs-you
// band via `placeField`. Only the first of those still exists in the product.
// /mesh is the canvas scene again; the ring field, its centre headline and
// components/meshfield/model/rings.ts have been removed.
//
// The two dead sections are gone rather than kept passing against code nothing
// renders. A gate that cannot fail for any reason a user would notice is worse
// than no gate — it reads as coverage of a claim nobody is making any more.
//
// `wantsYou` is emphatically NOT in that category. It is read by
// read-wants-you.ts → read-my-presence.ts → /compose, and by read-inbox.ts,
// so every assertion below is still a statement about what ships. The
// judgement it encodes — a like is not an obligation, you are not waiting on
// yourself, muted means muted — is the whole reason this file is long.
import { wantsYou, type NotificationRow, type ThreadRow } from "../src/lib/mesh/wants-you";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

function prose(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/^\s*(\/\/|\*)\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ");
}

/**
 * The source with every comment removed.
 *
 * Needed because a check for a forbidden CALL must not match the sentence
 * explaining why the call is absent, and this one did on its first run: the
 * module says "`nowMs` is a parameter rather than a `Date.now()`", and a plain
 * substring search read that as the very thing it forbids. A module is
 * punished for documenting itself, and the fix is not to stop documenting.
 *
 * This is the FOURTH gate in this repo to trip over its own prose. Matching
 * source text is only ever a check on the code when the comments are gone
 * first, and `prose()` above is the other half of the same split.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    // Not preceded by a colon, so a "https://" inside a string survives.
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, "$1"))
    .join("\n");
}

const NOW = 1_700_000_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

function thread(over: Partial<ThreadRow> & { threadId: string }): ThreadRow {
  return {
    title: "Jordan",
    sourcePlatform: "mesh",
    lastMessageAtMs: NOW - 2 * HOUR,
    lastMessageFromViewer: false,
    lastMessagePreview: "are you around later?",
    lastReadMs: NOW - 3 * HOUR,
    muted: false,
    ...over,
  };
}

function notification(over: Partial<NotificationRow> & { id: string }): NotificationRow {
  return {
    type: "comment",
    actorName: "Maya",
    message: "Maya replied to your post",
    read: false,
    createdAtMs: NOW - HOUR,
    postId: "p1",
    ...over,
  };
}

const waitingIds = (items: ReturnType<typeof wantsYou>) => items.filter((i) => i.awaitingViewer).map((i) => i.id);

// ── 1. A LIKE IS NOT AN OBLIGATION. NOR IS A FOLLOW ─────────────────────────
//
// The two that would most inflate the count, and the two that ask nothing of
// you. Putting them here is the manufactured-urgency pattern this product is
// supposed to be an alternative to.
{
  const items = wantsYou({
    threads: [],
    notifications: [
      notification({ id: "n-like", type: "like", message: "Sam liked your post" }),
      notification({ id: "n-follow", type: "follow", message: "Riley followed you" }),
      notification({ id: "n-meshi", type: "meshi_delivery", message: "Meshi brought something" }),
      notification({ id: "n-comment", type: "comment", message: "Maya replied to your post" }),
    ],
    nowMs: NOW,
  });

  assert.deepEqual(
    waitingIds(items),
    ["notification:n-comment"],
    "something that asks nothing of you was put in the ring of things that want you.",
  );
  // But they are still PRESENT — they are news, not nothing.
  assert.equal(items.length, 4, "a notification vanished entirely instead of being demoted to news.");
  checks += 2;
}

// ── 2. YOU ARE NOT WAITING ON YOURSELF ──────────────────────────────────────
//
// If the last word in a thread is yours, nothing is owed BY you. Getting this
// backwards turns every conversation you have ever started into a permanent
// obligation, which is how unread counts become meaningless.
{
  const items = wantsYou({
    threads: [
      thread({ threadId: "t-theirs", lastMessageFromViewer: false }),
      thread({ threadId: "t-mine", lastMessageFromViewer: true }),
    ],
    notifications: [],
    nowMs: NOW,
  });
  assert.deepEqual(waitingIds(items), ["thread:t-theirs"], "a thread whose last message is the viewer's own was marked as awaiting them.");
  assert.equal(items.length, 2, "the viewer's own thread disappeared instead of being shown as context.");
  checks += 2;
}

// ── 3. READ MEANS READ ──────────────────────────────────────────────────────
{
  const items = wantsYou({
    threads: [
      thread({ threadId: "t-unread", lastMessageAtMs: NOW - HOUR, lastReadMs: NOW - 2 * HOUR }),
      thread({ threadId: "t-read", lastMessageAtMs: NOW - 2 * HOUR, lastReadMs: NOW - HOUR }),
      // Read at exactly the message time counts as read: you were there.
      thread({ threadId: "t-exact", lastMessageAtMs: NOW - HOUR, lastReadMs: NOW - HOUR }),
    ],
    notifications: [],
    nowMs: NOW,
  });
  assert.deepEqual(waitingIds(items), ["thread:t-unread"], "the read watermark is not being respected.");
  checks += 1;

  // And a read notification is never an obligation, whatever its type.
  const seen = wantsYou({
    threads: [],
    notifications: [notification({ id: "n-seen", type: "comment", read: true })],
    nowMs: NOW,
  });
  assert.deepEqual(waitingIds(seen), [], "a notification the viewer has already read was still treated as owed.");
  checks += 1;
}

// ── 4. MUTED MEANS MUTED ────────────────────────────────────────────────────
//
// An explicit instruction not to be bothered. A surface that overrides it to
// make its own dashboard busier has stopped working for the person using it.
{
  const items = wantsYou({
    threads: [thread({ threadId: "t-muted", muted: true, lastMessageAtMs: NOW - MINUTE, lastReadMs: NOW - HOUR })],
    notifications: [],
    nowMs: NOW,
  });
  assert.deepEqual(waitingIds(items), [], "a muted thread was put in the ring of things that want you.");
  assert.equal(items.length, 1, "a muted thread vanished entirely; muted means quiet, not deleted.");
  checks += 2;
}

// ── 5. AN EMPTY THREAD IS NOT AN EVENT ──────────────────────────────────────
{
  const items = wantsYou({
    threads: [thread({ threadId: "t-empty", lastMessageAtMs: null, lastMessagePreview: null })],
    notifications: [],
    nowMs: NOW,
  });
  assert.equal(items.length, 0, "a thread with no messages produced an item with no time.");
  checks += 1;
}

// ── 6. THE WHOLE POINT: MORE THAN ONE PLATFORM AT ONCE ──────────────────────
//
// This is the claim the surface is built on. If platform were dropped or
// collapsed, the mesh would be a worse version of each app's own inbox.
{
  const items = wantsYou({
    threads: [
      thread({ threadId: "t-ig", sourcePlatform: "instagram", title: "Maya" }),
      thread({ threadId: "t-tw", sourcePlatform: "twitter", title: "Sam" }),
      thread({ threadId: "t-native", sourcePlatform: "mesh", title: "Jordan" }),
      thread({ threadId: "t-rd", sourcePlatform: "reddit", title: "r/thread" }),
    ],
    notifications: [],
    nowMs: NOW,
  });

  // Asserted off the items directly. This used to go through
  // `wantsYouSummary`, which counted the same `awaitingViewer` flag and
  // returned the sorted platform set for the ring field's centre headline.
  // The headline is gone with the field, and the summary with it — but the
  // PROPERTY was never the summary's: it is that `wantsYou` marks every
  // unanswered thread as owed and carries each one's platform through intact.
  // So the property stays and the assertion reads it from the source instead
  // of from a wrapper that no longer exists.
  const waiting = items.filter((i) => i.awaitingViewer);
  assert.equal(waiting.length, 4, "not every unanswered thread counted as waiting.");
  assert.deepEqual(
    [...new Set(waiting.map((i) => i.platform))].sort(),
    ["instagram", "mesh", "reddit", "twitter"],
    "platforms were dropped or merged — the one thing this surface can do that the platforms cannot.",
  );
  checks += 2;

  // Platform survives onto the item itself, which is what drives its hue.
  assert.deepEqual(
    items.map((i) => i.platform).sort(),
    ["instagram", "mesh", "reddit", "twitter"],
    "an item lost the platform it came from.",
  );
  checks += 1;
}

// ── 7. RETIRED: THE SUMMARY CANNOT DISAGREE WITH THE RINGS ──────────────────
//
// This section cross-checked `wantsYouSummary(items).waiting` against
// `placeField(items, NOW).byRing.needsYou.length` — the ring field's centre
// headline against its innermost band. It was a real check on a real risk:
// two computations of one fact drift, and a headline that disagrees with the
// surface under it is worse than no headline.
//
// Both computations are gone. The canvas has no ring geometry and no centre
// headline; components/meshfield/model/rings.ts and `wantsYouSummary` were
// removed with the field. There is now exactly ONE place that decides what is
// owed — the `awaitingViewer` flag set by `wantsYou` above — which read-my-
// presence.ts reads directly for both its per-arm counts and its total. Two
// things cannot drift when there is one of them, so the property this section
// protected is held by construction rather than by assertion.
//
// Kept as a note rather than deleted silently: someone will eventually want a
// headline again, and the first thing they should know is that the last one
// needed a gate to stop it lying.

// ── 8. NOTHING IS INVENTED ──────────────────────────────────────────────────
//
// A module that writes a summary it is in no position to write is lying, and
// the whole rebuild depends on the surface being trustworthy about what it is
// showing you.
{
  const items = wantsYou({
    threads: [thread({ threadId: "t-bare", title: null, lastMessagePreview: null })],
    notifications: [notification({ id: "n-bare", message: null, actorName: null })],
    nowMs: NOW,
  });

  const t = items.find((i) => i.id === "thread:t-bare");
  assert.ok(t, "a titleless thread vanished.");
  assert.equal(t.title, "Direct message", "a titleless thread got an invented title.");
  assert.equal(t.body, undefined, "a thread with no preview got an invented body.");

  const n = items.find((i) => i.id === "notification:n-bare");
  assert.ok(n, "a messageless notification vanished.");
  assert.equal(n.title, "Activity", "a messageless notification got an invented description.");
  checks += 4;

  // Whitespace-only is the same as absent, not a title made of spaces.
  const blank = wantsYou({
    threads: [thread({ threadId: "t-blank", title: "   ", lastMessagePreview: "  " })],
    notifications: [],
    nowMs: NOW,
  });
  assert.equal(blank[0].title, "Direct message", "a whitespace title was treated as a real one.");
  assert.equal(blank[0].body, undefined, "a whitespace preview was treated as a real one.");
  checks += 2;
}

// ── 9. NO DUPLICATES, AND EVERY ITEM IS REACHABLE ───────────────────────────
{
  const items = wantsYou({
    threads: [thread({ threadId: "dup" }), thread({ threadId: "dup" })],
    notifications: [notification({ id: "ndup" }), notification({ id: "ndup" })],
    nowMs: NOW,
  });
  assert.equal(new Set(items.map((i) => i.id)).size, items.length, "the same thing was emitted twice.");
  assert.equal(items.length, 2, "duplicate rows were not collapsed.");
  for (const i of items) {
    assert.ok(i.href && i.href.startsWith("/"), `${i.id} has no in-app destination — a node you cannot act on is decoration.`);
  }
  checks += 3;
}

// ── 10. PURE, AND HONEST ABOUT ITS REASONING ────────────────────────────────
{
  const threads = [thread({ threadId: "x" }), thread({ threadId: "y", sourcePlatform: "twitch" })];
  const notifications = [notification({ id: "z" })];
  const first = JSON.stringify(wantsYou({ threads, notifications, nowMs: NOW }));
  for (let i = 0; i < 4; i += 1) {
    assert.equal(JSON.stringify(wantsYou({ threads, notifications, nowMs: NOW })), first, "wantsYou is not deterministic.");
  }
  checks += 1;

  const source = readFileSync(join(ROOT, "src/lib/mesh/wants-you.ts"), "utf8");
  const body = code(source);
  assert.ok(
    !/Math\.random\(\)|Date\.now\(\)/.test(body),
    "the mesh reads its own clock, so two devices on one account would disagree about what wants you.",
  );
  assert.ok(!/from "@prisma|PrismaClient/.test(body), "the judgement reached for a database; it takes rows so it can be checked without one.");
  checks += 2;

  // The stripper has to actually strip, or the two checks above are vacuous.
  assert.ok(/Date\.now\(\)/.test(source), "the module no longer explains why it takes a clock reading instead of taking one.");
  assert.ok(!/A LIKE IS NOT AN OBLIGATION/.test(body), "code() left comments behind, so the checks above are searching prose.");
  checks += 2;

  const words = prose(source);
  for (const [phrase, why] of [
    [/A LIKE IS NOT AN OBLIGATION/i, "why the two things that would most inflate the count are excluded"],
    [/not waiting on yourself|YOU ARE NOT WAITING ON YOURSELF/i, "why a thread whose last word is yours is not urgent"],
    [/MUTED MEANS MUTED/i, "that an explicit instruction not to be bothered outranks a busier-looking dashboard"],
    [/Instagram cannot tell you|cross-platform/i, "why this surface exists at all rather than being each app's inbox again"],
  ] as const) {
    assert.ok(phrase.test(words), `the module no longer explains ${why}.`);
    checks += 1;
  }
}

console.log(
  `mesh "what wants you" OK — ${checks} assertions.\n` +
    "  The urgent ring is defined by exclusion, because a ring you have learned to ignore costs the\n" +
    "  same attention as a useful one and returns nothing. A like is not an obligation and neither is\n" +
    "  a follow — they stay visible as news, and only a reply or an unread message from someone else\n" +
    "  counts as owed. You are never waiting on yourself, read means read, and muted means muted:\n" +
    "  overriding that to make the dashboard busier is the pattern this product is an alternative to.\n" +
    "  Four platforms come through at once with their identity intact, which is the single thing this\n" +
    "  surface can do that none of the platforms it aggregates can do for themselves.\n" +
    "  There is exactly ONE computation of what is owed — the awaitingViewer flag set here, which\n" +
    "  read-my-presence reads directly — so the headline-vs-rings drift this used to cross-check is\n" +
    "  now impossible rather than merely asserted.\n" +
    "  Nothing is invented: a thread with no title is called what it is rather than given a summary\n" +
    "  this module is in no position to write.\n" +
    "  Does NOT cover: the database query that produces these rows, or whether a mirrored platform\n" +
    "  thread is up to date. Judgement is checked here; freshness is the sync's problem.",
);
