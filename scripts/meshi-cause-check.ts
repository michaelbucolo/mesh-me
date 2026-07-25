/**
 * MESHI GATE — every reaction has a cause with a name.
 *
 * Meshi is supposed to represent the user: where they are, what they are doing,
 * how it went. For a long time nothing in the product could tell Meshi
 * anything — `meshi-events.ts` was eight lines and one event, and there were
 * four `dispatchEvent` calls in the whole tree. So Meshi guessed: it inferred
 * the world from raw `mousemove`/`keydown`/`scroll`, and cycled a per-route
 * list of moods on an eight-second `setInterval`.
 *
 * A character pulling faces on a timer while the user sits still is the exact
 * thing that reads as decoration rather than as representing anyone, and it is
 * the design system's DO-NOT #9 with a face on it.
 *
 * The rule: if you cannot answer "whose hand caused this?" in one sentence,
 * Meshi does not react. The legitimate answers are the user did something,
 * another person did something, or a fact changed. A timer is not an answer.
 *
 * WHAT THIS CANNOT PROVE
 *   That Meshi looks right, or that the causes fire at the correct moment. The
 *   browser acceptance test covers the behaviour: sit still for 44 seconds and
 *   Meshi must never return to a mood it has left. That test was itself
 *   mutation-checked — the old cycler restored makes it fail.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const BUS = "src/lib/meshi-bus.ts";
const FLOAT = "src/components/meshi/meshi-float.tsx";
const MASCOT = "src/components/meshi/meshi-mascot.tsx";

assert.ok(existsSync(join(ROOT, BUS)), `${BUS} must exist — it is how the product tells Meshi what happened.`);
const bus = read(BUS);
const float = read(FLOAT);

/** Blank comments while preserving offsets and newlines. */
function stripComments(text: string): string {
  const blank = (m: string) => m.replace(/[^\n]/g, " ");
  return text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^\s*\/\/[^\n]*/gm, blank);
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

// ── 1. No REPEATING timer drives Meshi's face ────────────────────────────────
//
// The violation is a timer that fires again and again — that is what produces
// expression changes with no cause behind them. A one-shot `setTimeout` that
// returns Meshi to rest AFTER a real cause is not a violation and is how the
// reaction is supposed to end; both the cause handler and the chat reply do
// exactly that. So this looks for `setInterval` specifically.
const floatCode = stripComments(float);
const timerMoods: string[] = [];
// Capture everything between `setInterval(` and its delay argument. An earlier
// version anchored on `)` before the delay, which silently missed every
// `setInterval(() => { … }, 8000)` — an arrow-function body ends in `}`, and
// that is the exact shape of the cycler this gate exists to catch. It passed
// the mutation test only because the mutation was invisible to it.
for (const m of floatCode.matchAll(/\bsetInterval\s*\(([\s\S]{0,600}?),\s*\d+\s*\)/g)) {
  if (/setMood\s*\(/.test(m[1])) timerMoods.push(`${FLOAT}:${lineOf(floatCode, m.index)}`);
}
assert.deepEqual(
  timerMoods,
  [],
  "A timer sets Meshi's mood:\n" +
    timerMoods.map((t) => `    ${t}`).join("\n") +
    "\n  Meshi reacts to causes, not to the clock. An expression that changes on a\n" +
    "  timer while the user sits still is decoration, and it is what made Meshi read\n" +
    "  as furniture rather than as representing anyone.\n" +
    "  Publish a cause instead: publishMeshiCause({ kind: ... }) from " + BUS + ".\n" +
    "  (Returning to rest AFTER a cause is fine — that timeout follows a real event.)",
);

// The old per-route ambient mood table, by name, so a revert is caught even if
// it is wired up differently.
assert.ok(
  !/PAGE_AMBIENT_MOODS/.test(floatCode),
  `${FLOAT} still references PAGE_AMBIENT_MOODS.\n` +
    "  That table existed only to feed the eight-second mood cycler. Moods now come\n" +
    "  from causes the product publishes, not from which route you happen to be on.",
);

// ── 2. The bus exists, is closed, and is actually subscribed ─────────────────
assert.match(
  bus,
  /export function publishMeshiCause\b/,
  `${BUS} must export publishMeshiCause — the one way to tell Meshi something happened.`,
);
assert.match(
  bus,
  /export function subscribeMeshiCause\b/,
  `${BUS} must export subscribeMeshiCause.`,
);
assert.match(
  bus,
  /export type MeshiCauseKind\s*=/,
  `${BUS} must declare MeshiCauseKind as a closed union.\n` +
    "  Adding a cause should be a decision someone makes on purpose, not a string\n" +
    "  typed at a call site.",
);
assert.match(
  float,
  /subscribeMeshiCause\s*\(/,
  `${FLOAT} must subscribe to the cause bus — otherwise nothing the product\n` +
    "  publishes reaches Meshi, and the bus is decoration of a different kind.",
);

// ── 3. Real call sites, not just a bus nobody uses ───────────────────────────
//
// A bus with zero publishers is worse than no bus: it looks like the problem is
// solved. This requires the product to actually be talking to Meshi.
const files = execFileSync("git", ["ls-files", "src"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter((f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.startsWith("src/generated/"))
  .filter((f) => existsSync(join(ROOT, f)));

const publishers: string[] = [];
for (const file of files) {
  if (file === BUS) continue;
  if (/\bpublishMeshiCause\s*\(/.test(stripComments(read(file)))) publishers.push(file);
}
assert.ok(
  publishers.length >= 3,
  `Only ${publishers.length} file(s) publish a cause; expected at least 3.\n` +
    "  A cause bus nobody publishes to looks like the problem is solved while Meshi\n" +
    "  still knows nothing. Wire the real moments: a post published, a follow added,\n" +
    "  a search started, an action that failed.\n" +
    `  Publishers found: ${publishers.join(", ") || "(none)"}`,
);

// ── 4. The mood is observable from outside ───────────────────────────────────
//
// Without this, the acceptance test cannot tell a real reaction from a blink:
// blinking rewrites the eye paths every few seconds, so diffing the rendered
// SVG proves nothing. That distinction is the whole rule.
assert.match(
  read(MASCOT),
  /data-meshi-mood=\{/,
  `${MASCOT} must expose data-meshi-mood (the intended mood, blink excluded).\n` +
    "  It is the only way to observe whether Meshi's expression changed. Meshi blinks\n" +
    "  on a jittered 2–6s timer — which the design system keeps — so comparing the\n" +
    "  rendered SVG cannot distinguish a reaction from a blink.",
);

console.log(
  `meshi cause contract OK — no timer sets a mood, the ambient mood table is gone, the bus is a\n` +
    `  closed union that ${FLOAT.split("/").pop()} subscribes to, ${publishers.length} files publish real causes, and the\n` +
    "  intended mood is observable via data-meshi-mood.\n" +
    "  Does NOT cover: whether causes fire at the right moment — that is the browser pass.",
);
