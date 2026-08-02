// WHEN THE WORDS DO NOT ALL FIT, WHICH ONES SURVIVE.
//
// `legible.ts` answers "what can this label say in this much room". It cannot
// answer the other half of rule one, which is the half the old surface got
// wrong: eleven captions were on screen and there was only room for about four.
// Nothing decided which four, so all eleven were rendered small and overlapping
// and none of them was readable.
//
// "If a caption does not fit at a legible size, SHOW FEWER CARDS." This is that
// sentence as code. It is a budget, and like every budget the only interesting
// question is what gets cut first.
//
// ── THE ANSWER IS THE SAME ANSWER AS EVERYWHERE ELSE IN THIS REBUILD ────────
//
// Context gives way before obligation. The geometry drops outer nodes before
// inner ones when a phone runs out of room; this drops outer LABELS first, for
// the same reason. A mesh that spends its last readable caption on a nine-day-
// old post while an unanswered message sits unlabelled has inverted itself.
//
// ── AND ORDERING THE HANDOUT DOES NOT ACHIEVE THAT, WHICH COST TWO GO-ROUNDS ─
//
// The first version handed captions out inner-ring-first and called it done.
// The gate agreed, because the gate asserted the granted list was in ring
// order — which is a fact about the ORDER OF PROCESSING and says nothing about
// the OUTCOME. Measured, the outcome on a 390x844 phone was:
//
//     needsYou 0/8    happening 0/10    fresh 3/10    field 7/26
//
// Zero captions on the ring of things that want you, seven on nine-day-old
// context. Precisely the inversion described two paragraphs above, shipped
// underneath a check that was watching the wrong thing.
//
// The cause is structural rather than accidental. Inner nodes are crowded BY
// CONSTRUCTION — that is what a small radius and a full ring means — so they
// always refuse, while the outer band, which has the entire outside of the
// canvas to itself, always fits. First refusal is worthless when the thing
// being refused is space the inner ring could never have used.
//
// Two fixes, and both are needed:
//
//   1. GIVE THE INNER RINGS SOMEWHERE TO PUT IT. A caption does not have to
//      touch its node. It searches OUTWARD along the ray from the core, so an
//      inner node's caption can live past the bands, joined by a leader. Inner
//      rings go first, so they claim the near space rather than being boxed in.
//
//   2. CAP EACH RING BY THE ONE INSIDE IT. A ring may not carry more captions
//      than the ring within it could have carried. If four obligations got
//      words, forty background items do not get thirty-four. This is what makes
//      the promise an OUTCOME rather than an intention, and it is what the gate
//      checks now.
//
// The cap counts what the inner ring COULD have had, not what it did: a ring
// whose items simply have no captions to show should not silence the ring
// outside it. Scarcity of room is the thing being rationed, not silence.
//
// A node that gets no caption keeps its mark, its colour and its verb — still
// three things more than the old surface's grey smear communicated.
//
// ── A LABEL IS PART OF THE NODE, FOR COLLISION PURPOSES ────────────────────
//
// The old surface treated text as decoration that could be painted anywhere,
// which is why captions ran under each other and under the cards. Here a label
// occupies real space: it is checked against every node and every other label
// before it is granted, and refused if it would collide. Two overlapping
// captions are not two captions, they are zero.

import type { Geometry } from "./geometry";
import { labelFor, MIN_SIZE, type Label, type Measure } from "./legible";
import { RINGS } from "./rings";

/**
 * A granted label and the box it occupies, in viewport pixels.
 *
 * Not exported by name — it is reachable through `LabelPlan`, which is what
 * callers actually hold. Exporting it separately would be an export with no
 * importer, and inventing one to satisfy the dead-code gate is how a codebase
 * accumulates consumers that exist only to be counted.
 */
type PlacedLabel = {
  id: string;
  label: Extract<Label, { kind: "text" }>;
  box: { x: number; y: number; width: number; height: number };
};

export type LabelPlan = {
  granted: PlacedLabel[];
  /**
   * Nodes that get no words, and why. Reported rather than silent: "there was
   * no room" is a fact the surface may want to act on, and a plan that quietly
   * drops half its labels looks identical to one that had nothing to say.
   */
  withheld: Array<{ id: string; why: "no-text" | "would-not-fit" | "would-collide" | "out-spoken" }>;
};

/** Gap between a node's edge and the nearest edge of its label. */
const LEAD = 6;

/** How wide a label may be, as a multiple of its node's diameter. */
const WIDTH_FACTOR = 2.6;

/**
 * A narrower fallback, tried when the preferred width will not fit anywhere.
 *
 * Two words in a slot that exists beats five words in a slot that does not.
 */
const NARROW_FACTOR = 1.5;

/** Room allowed for the label itself. Two lines at the comfortable size. */
const LABEL_HEIGHT = 42;

/** Breathing room required between a label and anything else. */
const CLEARANCE = 4;

/** How many steps outward a caption may travel looking for room. */
const RADIAL_STEPS = 7;

/** How far each of those steps moves it, in pixels. */
const RADIAL_STEP = 30;

type Rect = { x: number; y: number; width: number; height: number };

function overlaps(a: Rect, b: Rect, pad: number): boolean {
  return (
    a.x < b.x + b.width + pad &&
    b.x < a.x + a.width + pad &&
    a.y < b.y + b.height + pad &&
    b.y < a.y + a.height + pad
  );
}

/** The box a node itself occupies, treated as a square around its circle. */
function nodeRect(x: number, y: number, radius: number): Rect {
  return { x: x - radius, y: y - radius, width: radius * 2, height: radius * 2 };
}

/**
 * Where a caption may sit, best first.
 *
 * ONE position is not enough, and assuming it was is a bug this module shipped
 * for exactly one gate run: the first version slung every caption directly
 * below its node, and on a ring of eight nodes spaced ten pixels apart a box
 * two and a half diameters wide overlaps its neighbours every single time. The
 * budget granted ZERO captions on a 1440x900 desktop and was, as written,
 * useless — it enforced "no overlap" by showing nothing.
 *
 * Real label placement tries candidates. The first is RADIALLY OUTWARD, away
 * from the core: on a radial surface that is the direction with room in it,
 * because it points into the gap between bands rather than along the crowded
 * arc where the node's own neighbours live.
 *
 * And it keeps going outward. A caption does not have to touch its node — an
 * inner node's words can sit past the outer bands, joined by a leader. Without
 * that, the inner rings are permanently boxed in by their own neighbours and
 * the captions all end up on the outermost ring, which is the inversion this
 * module exists to prevent.
 */
function candidates(x: number, y: number, radius: number, core: { x: number; y: number }, width: number, height: number): Rect[] {
  const dx = x - core.x;
  const dy = y - core.y;
  const length = Math.hypot(dx, dy) || 1;
  const outward = { x: dx / length, y: dy / length };
  const reach = radius + LEAD + Math.max(width, height) / 2;

  const at = (cx: number, cy: number): Rect => ({ x: cx - width / 2, y: cy - height / 2, width, height });

  const out: Rect[] = [];
  for (let step = 0; step <= RADIAL_STEPS; step += 1) {
    const d = reach + step * RADIAL_STEP;
    out.push(at(x + outward.x * d, y + outward.y * d));
  }
  out.push(
    at(x, y + radius + LEAD + height / 2),
    at(x, y - radius - LEAD - height / 2),
    at(x + radius + LEAD + width / 2, y),
    at(x - radius - LEAD - width / 2, y),
  );
  return out;
}

/**
 * Hand out labels until the room runs out.
 *
 * Pure, and deterministic given the same geometry and measurer — a resize that
 * changes nothing must not reshuffle which captions are visible, because text
 * appearing and disappearing as you breathe on the window is its own kind of
 * unreadable.
 */
export function planLabels(
  geometry: Geometry,
  viewport: { width: number; height: number },
  texts: Readonly<Record<string, string>>,
  measure: Measure,
): LabelPlan {
  const granted: PlacedLabel[] = [];
  const withheld: LabelPlan["withheld"] = [];

  // Inner rings first. Within a ring, keep the order geometry produced, which
  // is already twelve-o'clock-outward by rank — so the most pressing item in
  // the most pressing band is the first to be given words.
  const ordered = [...geometry.placements].sort(
    (a, b) => RINGS.indexOf(a.ring) - RINGS.indexOf(b.ring),
  );

  const nodeRects = geometry.placements.map((p) => nodeRect(p.x, p.y, p.radius));
  const coreRect = nodeRect(geometry.core.x, geometry.core.y, geometry.core.radius);

  // ── THE CAP: NO RING OUT-SPEAKS THE ONE INSIDE IT ─────────────────────────
  //
  // Counting what the inner ring COULD have carried, not what it did. A ring
  // whose items simply have nothing to say must not silence the ring outside
  // it — room is what is being rationed here, not silence.
  const grantedPerRing = new Map<string, number>();
  const eligiblePerRing = new Map<string, number>();
  for (const p of geometry.placements) {
    if (texts[p.id]?.trim()) eligiblePerRing.set(p.ring, (eligiblePerRing.get(p.ring) ?? 0) + 1);
  }
  const capFor = (ring: string): number => {
    const index = RINGS.indexOf(ring as (typeof RINGS)[number]);
    if (index <= 0) return Number.POSITIVE_INFINITY;
    let allowed = Number.POSITIVE_INFINITY;
    for (let i = 0; i < index; i += 1) {
      const inner = RINGS[i];
      const eligible = eligiblePerRing.get(inner) ?? 0;
      if (eligible === 0) continue;
      allowed = Math.min(allowed, grantedPerRing.get(inner) ?? 0);
    }
    return allowed;
  };

  for (const placement of ordered) {
    const text = texts[placement.id];
    if (!text || !text.trim()) {
      withheld.push({ id: placement.id, why: "no-text" });
      continue;
    }

    if ((grantedPerRing.get(placement.ring) ?? 0) >= capFor(placement.ring)) {
      withheld.push({ id: placement.id, why: "out-spoken" });
      continue;
    }

    const onFrame = (r: Rect) =>
      r.x >= 0 && r.y >= 0 && r.x + r.width <= viewport.width && r.y + r.height <= viewport.height;

    const free = (r: Rect) =>
      !nodeRects.some((n) => overlaps(r, n, CLEARANCE)) &&
      !overlaps(r, coreRect, CLEARANCE) &&
      !granted.some((g) => overlaps(r, g.box, CLEARANCE));

    // Preferred width first, then the narrower slot. Within each, the compass
    // of candidate positions, best first.
    let chosen: Rect | undefined;
    let sawRoomOffFrame = false;
    for (const factor of [WIDTH_FACTOR, NARROW_FACTOR]) {
      const width = placement.radius * 2 * factor;
      for (const box of candidates(placement.x, placement.y, placement.radius, geometry.core, width, LABEL_HEIGHT)) {
        // Off the frame is an immediate no. A caption half outside the window
        // is the "cards cut off at both edges" failure in different clothes.
        if (!onFrame(box)) continue;
        if (!free(box)) {
          sawRoomOffFrame = true;
          continue;
        }
        chosen = box;
        break;
      }
      if (chosen) break;
    }

    if (!chosen) {
      withheld.push({ id: placement.id, why: sawRoomOffFrame ? "would-collide" : "would-not-fit" });
      continue;
    }

    const label = labelFor(text, { width: chosen.width, height: chosen.height }, measure);
    if (label.kind !== "text") {
      withheld.push({ id: placement.id, why: "would-not-fit" });
      continue;
    }

    // Shrink the recorded box to what the text actually uses, so the next
    // label is judged against reality rather than against a reservation. A
    // budget that hoards space it is not using shows fewer captions than it
    // could, which is the same failure as showing too many, just quieter.
    const used = Math.max(MIN_SIZE, label.lines.length * label.size * 1.28);
    granted.push({ id: placement.id, label, box: { ...chosen, height: used } });
    grantedPerRing.set(placement.ring, (grantedPerRing.get(placement.ring) ?? 0) + 1);
  }

  return { granted, withheld };
}
