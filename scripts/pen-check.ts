/**
 * A PEN IS NOT A FINGER.
 *
 * mesh.me classified a stylus as touch. `pointerType === "pen"` appeared nowhere
 * in the codebase; all six pointer gates asked `=== "mouse"` or `!== "mouse"`,
 * so an Apple Pencil and an S Pen fell through the else and got the fingertip
 * experience — 22px hit slop, 12px drag threshold, a cursor pinned to the screen
 * centre, and no hover at all, which is the one thing a pen is uniquely good at.
 *
 * THE SUBTLER HALF, and the reason this gate is about a SHAPE rather than a list
 * of `pointerType` comparisons: `rt.coarse` is set once from
 * `matchMedia("(pointer: coarse)")` — a statement about the DEVICE'S PRIMARY
 * pointer — and was read at every tolerance in the input layer. On a tablet the
 * primary pointer is touch, so `coarse` stayed true for the entire session
 * INCLUDING every pen event. Fixing the six type checks while leaving those
 * reads alone would have changed almost nothing on the exact devices this is
 * for. Precision is a property of the EVENT.
 *
 * WHAT THIS GATE DOES NOT AND CANNOT PROVE:
 *
 *   - That a real Apple Pencil or S Pen behaves as expected. It reads source.
 *     Pen hover, pressure and tilt need a device; no static check substitutes.
 *   - That the OS rejected a palm. `pointercancel` is the OS's verdict and the
 *     canvas already handles it; this only holds the arbitration BEFORE that
 *     verdict arrives.
 *   - Anything about Flow's raw TouchEvent handlers. On iOS a Pencil generates
 *     Touch Events with `Touch.touchType === "stylus"`; on Android Chromium does
 *     not implement `touchType` at all, so there is no cross-platform way to
 *     tell a stylus from a finger there. Those paths are deliberately untouched.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { isPen, isPenHover, isPrecisePointer, notePenDown, notePenUp, penIsDown, penPressure, penTilt, resetPenArbiterForTest, yieldsToPen } from "../src/lib/pen";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

function tsFiles(dir: string, out: string[] = []): string[] {
  if (dir === "src/generated") return out;
  for (const entry of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${entry}`;
    if (rel === "src/generated") continue;
    if (statSync(join(ROOT, rel)).isDirectory()) tsFiles(rel, out);
    else if (/\.tsx?$/.test(rel)) out.push(rel);
  }
  return out;
}

// ── 1. The predicates behave ─────────────────────────────────────────────────
{
  for (const t of ["mouse", "pen"]) {
    if (!isPrecisePointer(t)) fail("1 predicates", `${t} is not treated as a precise pointer`);
    else ok();
  }
  for (const t of ["touch", "", null, undefined]) {
    if (isPrecisePointer(t as string)) fail("1 predicates", `${JSON.stringify(t)} was treated as precise`);
    else ok();
  }
  if (!isPen("pen") || isPen("mouse") || isPen("touch")) fail("1 predicates", "isPen does not identify exactly a pen");
  else ok();

  // Hover is a pen with nothing pressed and no force — that is the shape both
  // platforms report for a tip held above the glass.
  if (!isPenHover({ pointerType: "pen", pressure: 0, buttons: 0 })) fail("1 predicates", "a hovering pen was not recognised");
  else ok();
  if (isPenHover({ pointerType: "pen", pressure: 0.4, buttons: 1 })) fail("1 predicates", "a pen in contact was reported as hovering");
  else ok();
  if (isPenHover({ pointerType: "mouse", pressure: 0, buttons: 0 })) fail("1 predicates", "a mouse was reported as a hovering pen");
  else ok();

  // Pressure: a non-pen is full; an unreported pen press is the spec default,
  // never silence — 0 would make a real stroke vanish on hardware without a
  // force sensor.
  if (penPressure({ pointerType: "touch", pressure: 0 }) !== 1) fail("1 predicates", "non-pen pressure should be full");
  else ok();
  if (penPressure({ pointerType: "pen", pressure: 0 }) !== 0.5) fail("1 predicates", "an unreported pen pressure must fall back, not read as zero");
  else ok();
  if (penPressure({ pointerType: "pen", pressure: 5 }) !== 1) fail("1 predicates", "pen pressure is not clamped to 1");
  else ok();

  if (penTilt({ pointerType: "pen", tiltX: 0, tiltY: 0 }) !== null) fail("1 predicates", "an upright pen should report no lean");
  else ok();
  const lean = penTilt({ pointerType: "pen", tiltX: 90, tiltY: 0 });
  if (lean !== 1) fail("1 predicates", `a fully leaned pen should read 1, got ${lean}`);
  else ok();
  if (penTilt({ pointerType: "mouse", tiltX: 30, tiltY: 30 }) !== null) fail("1 predicates", "a mouse reported a tilt");
  else ok();
}

// ── 2. The arbiter: one gesture, one pointer, pen outranks palm ──────────────
{
  resetPenArbiterForTest();
  if (penIsDown()) fail("2 arbiter", "a pen was down before anything happened");
  else ok();

  // A finger alone is never yielded to — two-finger pinch must still work.
  if (yieldsToPen({ pointerType: "touch" })) fail("2 arbiter", "touch yielded with no pen down; ordinary pinch would break");
  else ok();

  notePenDown({ pointerType: "pen", pointerId: 7 });
  if (!penIsDown()) fail("2 arbiter", "a pen down was not recorded");
  else ok();
  if (!yieldsToPen({ pointerType: "touch" })) fail("2 arbiter", "a palm did not yield while a pen was in contact — this is the pinch-instead-of-line bug");
  else ok();
  if (yieldsToPen({ pointerType: "pen" })) fail("2 arbiter", "a pen yielded to itself");
  else ok();

  // A touch pointer must not be able to clear the pen's claim.
  notePenUp({ pointerId: 99 });
  if (!penIsDown()) fail("2 arbiter", "an unrelated pointer release cleared the pen claim");
  else ok();

  notePenUp({ pointerId: 7 });
  if (penIsDown()) fail("2 arbiter", "the pen claim survived its own release");
  else ok();
  if (yieldsToPen({ pointerType: "touch" })) fail("2 arbiter", "touch still yields after the pen lifted — every gesture would be dead");
  else ok();

  // notePenDown must ignore non-pen pointers, or a finger would claim the pen slot.
  resetPenArbiterForTest();
  notePenDown({ pointerType: "touch", pointerId: 3 });
  if (penIsDown()) fail("2 arbiter", "a touch pointer was recorded as a pen");
  else ok();
  resetPenArbiterForTest();
}

// ── 3. No handler asks whether the DEVICE is coarse to decide precision ──────
//
// `rt.coarse` may still exist — it is a real fact about the device and the
// renderer legitimately uses it for quality. What must not happen is the input
// layer using it as a stand-in for "this event is imprecise".
{
  const input = strip(read("src/components/mesh/scene/use-mesh-input.ts"));
  // The ONE legitimate read is inside `imprecise` itself, where the device flag
  // narrows a per-event answer. Everything outside it is the old mistake.
  const definition = /const imprecise = useCallback\([\s\S]*?\n  \);/.exec(input)?.[0] ?? "";
  const rest = input.replace(definition, "");
  // Both spellings. A first draft matched only `rt.coarse`, and a mutation
  // reintroducing the flag as `rtRef.current.coarse` walked straight past it.
  const coarseReads = [...rest.matchAll(/\b(?:rt|rtRef\.current)\.coarse\b/g)].length;
  if (coarseReads > 0) {
    fail("3 per-event", `use-mesh-input.ts reads the device coarse flag ${coarseReads} time(s) outside the imprecise() predicate — that is a per-DEVICE flag deciding a per-EVENT question, and on a tablet it is true for every pen event too`);
  } else ok();
  if (!definition) {
    fail("3 per-event", "the imprecise() predicate could not be located, so this section proved nothing");
  } else ok();
  if (!/const imprecise = useCallback\(/.test(input)) {
    fail("3 per-event", "the per-event precision predicate is gone from use-mesh-input.ts");
  } else ok();
}

// ── 4. Nothing decides precision by excluding everything but a mouse ─────────
{
  const suspects = tsFiles("src").filter((f) => !f.endsWith("/pen.ts"));
  const offenders: string[] = [];
  for (const file of suspects) {
    const body = strip(read(file));
    for (const m of body.matchAll(/pointerType\s*(===|!==)\s*"mouse"/g)) {
      const line = body.slice(0, m.index).split("\n").length;
      offenders.push(`${file}:${line}`);
    }
  }
  if (offenders.length) {
    for (const o of offenders) {
      fail("4 mouse-only", `${o} compares pointerType against "mouse" directly; a pen falls through that branch. Use isPrecisePointer() so a stylus is not classified as touch`);
    }
  } else ok();
}

// ── 5. Hover reaches a pen, and a pen leaving clears it ─────────────────────
{
  const input = strip(read("src/components/mesh/scene/use-mesh-input.ts"));
  const hover = /if \(isPrecisePointer\(e\.pointerType\)\) \{\s*if \(!rt\.drag\.active\)/.test(input);
  if (!hover) fail("5 hover", "canvas hover hit-testing no longer admits a precise pointer — pen hover is the single largest thing a stylus adds and it was fenced off behind a mouse check");
  else ok();
  const leave = /onPointerLeave[\s\S]{0,400}?isPrecisePointer\(e\.pointerType\)/.test(input);
  if (!leave) fail("5 hover", "onPointerLeave no longer admits a precise pointer — a pen lifting away would leave the reticle stuck on whatever it was last over");
  else ok();
}

// ── 6. The palm-lift dismissal stays fixed ──────────────────────────────────
{
  for (const file of ["src/components/mesh/ui/pluck-ring.tsx", "src/components/mesh/ui/emote-wheel.tsx"]) {
    const body = strip(read(file));
    if (!/yieldsToPen\(/.test(body)) {
      fail("6 palm", `${file} listens for any window pointerup again; a palm lifting mid-stroke would dismiss it under the pen`);
    } else ok();
  }
}

// ── 7. Nothing is built on a signal no shipping stylus reports ──────────────
//
// twist and tangentialPressure are in the IDL on both engines and are always 0:
// no consumer stylus reports barrel rotation to the web (Apple Pencil Pro's roll
// is native-only) and neither has an airbrush wheel. An eraser is worse than
// unreliable — no Apple Pencil has one at all, and no shipping S Pen has an
// eraser tip. Code depending on any of these would be dead on every real device.
{
  const suspects = tsFiles("src").filter((f) => !f.endsWith("/pen.ts"));
  const PHANTOM = [
    [/\.twist\b/, "twist is always 0 — no consumer stylus exposes barrel rotation to the web"],
    [/\.tangentialPressure\b/, "tangentialPressure needs an airbrush wheel no consumer stylus has"],
    [/buttons\s*===\s*32|button\s*===\s*5/, "that is the eraser tip; no Apple Pencil has one and no shipping S Pen has an eraser end"],
  ] as const;
  // One assertion per phantom signal, not per file — a count inflated by the
  // number of files scanned tells a reader nothing about what was checked.
  for (const [pattern, why] of PHANTOM) {
    const hits: string[] = [];
    for (const file of suspects) {
      const body = strip(read(file));
      const m = pattern.exec(body);
      if (m) hits.push(`${file}:${body.slice(0, m.index).split("\n").length}`);
    }
    if (hits.length) fail("7 phantom signals", `${hits.join(", ")} — ${why}`);
    else ok();
  }
}

if (failures.length) {
  console.error(`\npen: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`pen: ${checks} assertions passed — a stylus is a precise pointer, per event, and outranks a palm.`);
