// THE WIRE FORMAT FOR A DRAWING — and the reason it is this small.
//
// ── SAFETY BY BANDWIDTH, NOT BY CLASSIFIER ─────────────────────────────────
//
// A drawing broadcast to strangers near you is one of the highest-abuse
// surfaces a social product can ship. The usual answer is a classifier on the
// way in, which is expensive, wrong at the margins, and always a step behind.
//
// The answer here is the same doctrine `report-location.ts` applies to
// coordinates: DO NOT ACCEPT THE INFORMATION IN THE FIRST PLACE. A doodle is
// at most a few hundred points on a 128×64 integer grid in four ink colours,
// with no text tool, no image upload, and no bitmap. You can draw a rude word
// and people will; you cannot transmit a photograph, and the difference in
// what that enables is enormous. The medium is the moderation.
//
// ── AND WHY IT IS PARSED, NOT TRUSTED ──────────────────────────────────────
//
// Every value is bounds-checked on decode and the result is REJECTED rather
// than clamped or truncated. Clamping turns a malformed payload into a valid
// one that nobody wrote, which is how a hostile client gets to store something
// the format says is impossible. A drawing that does not decode exactly is not
// a drawing.
//
// ── DECODE IS THE CANONICAL GUARANTEE ──────────────────────────────────────
//
// There was briefly a second function here — `canonicalInk` — that decoded and
// then checked the result re-encoded to the input, so that two identical
// drawings could not be stored under different spellings. It was deleted
// because it can never fire: the strict integer parse below refuses leading
// zeros, `+3`, whitespace, hex and scientific notation, and the separator
// handling refuses trailing and empty chunks, so ANYTHING that decodes is
// already canonical. Mutation-testing caught it — removing the check left the
// suite green, which is the definition of a rule that is not doing any work.
//
// The property is now asserted directly against the decoder instead: for every
// payload that decodes, `encodeInk(decodeInk(x)) === x`.

/** The canvas a doodle is drawn on. Small enough that a stroke is a couple of
 * bytes and a whole drawing fits in a heartbeat-sized payload; big enough to
 * write a legible word by hand. */
export const INK_WIDTH = 128;
export const INK_HEIGHT = 64;

/** Four inks. A closed palette rather than free colour: it keeps the format
 * tiny, it keeps drawings looking like they belong to the same app, and it
 * removes "pick a colour" from a interaction that should take two seconds. */
export const INK_COLOURS = 4;

/** Hard ceilings. A drawing past these is refused outright — the point of a
 * budget is that it cannot be exceeded, not that it gets trimmed. */
export const MAX_STROKES = 24;
export const MAX_POINTS = 320;
/** A stroke needs two points to be a line. One point is a dot, which is
 * legitimate, so the floor is 1. */
const MIN_POINTS_PER_STROKE = 1;

type Stroke = { colour: number; points: Array<{ x: number; y: number }> };

/** The whole drawing. Deliberately has no field for a position, a caption, a
 * URL, or a timestamp — a format that cannot express those things cannot be
 * used to smuggle them. */
export type Ink = { strokes: Stroke[] };

const VERSION = "v1";

/**
 * Encode to the wire.
 *
 * Fixed-radix integers joined by separators rather than JSON: a 300-point
 * drawing is ~1.5KB as JSON and ~600 bytes here, and the size is what keeps
 * this inside the existing request budgets instead of needing new ones.
 */
export function encodeInk(ink: Ink): string {
  const parts: string[] = [];
  for (const stroke of ink.strokes) {
    const coords: string[] = [];
    for (const p of stroke.points) coords.push(`${p.x},${p.y}`);
    parts.push(`${stroke.colour}:${coords.join(",")}`);
  }
  return `${VERSION}|${parts.join(";")}`;
}

export type DecodeResult = { ok: true; ink: Ink } | { ok: false; reason: string };

/**
 * Decode from the wire, refusing anything that is not exactly a drawing.
 *
 * Total: every path returns a result rather than throwing, because this runs
 * on a request handler and on a render, and an exception in either is a 500
 * for a payload a stranger controls.
 */
export function decodeInk(raw: unknown): DecodeResult {
  if (typeof raw !== "string") return { ok: false, reason: "not a string" };
  // An ALLOCATION guard, not a correctness one — and worth being precise
  // about which. The stroke and point caps below already reject an oversized
  // drawing; this only stops a megabyte of coordinates being split into a
  // 400,000-element array first, on a handler a stranger can call. Mutating it
  // away leaves the gate green, because the caps still catch the payload — the
  // difference is the memory spent discovering that.
  if (raw.length > MAX_POINTS * 8 + 64) return { ok: false, reason: "too long" };

  const sep = raw.indexOf("|");
  if (sep === -1) return { ok: false, reason: "no version" };
  if (raw.slice(0, sep) !== VERSION) return { ok: false, reason: "unknown version" };

  const body = raw.slice(sep + 1);
  if (body.length === 0) return { ok: false, reason: "empty" };

  const chunks = body.split(";");
  if (chunks.length > MAX_STROKES) return { ok: false, reason: "too many strokes" };

  const strokes: Stroke[] = [];
  let totalPoints = 0;

  for (const chunk of chunks) {
    const colonAt = chunk.indexOf(":");
    if (colonAt === -1) return { ok: false, reason: "stroke has no colour" };

    const colour = toInt(chunk.slice(0, colonAt));
    if (colour === null || colour < 0 || colour >= INK_COLOURS) {
      return { ok: false, reason: "colour out of range" };
    }

    const nums = chunk.slice(colonAt + 1).split(",");
    // Coordinates come in pairs. An odd count is a truncated or hand-made
    // payload, and guessing at the missing half would be inventing a stroke.
    if (nums.length === 0 || nums.length % 2 !== 0) return { ok: false, reason: "odd coordinate count" };

    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < nums.length; i += 2) {
      const x = toInt(nums[i]);
      const y = toInt(nums[i + 1]);
      if (x === null || y === null) return { ok: false, reason: "coordinate is not an integer" };
      // REJECTED, not clamped. A clamped point is a point nobody drew, and
      // accepting it means the stored drawing is not the one that was sent.
      if (x < 0 || x >= INK_WIDTH || y < 0 || y >= INK_HEIGHT) {
        return { ok: false, reason: "coordinate off canvas" };
      }
      points.push({ x, y });
    }

    if (points.length < MIN_POINTS_PER_STROKE) return { ok: false, reason: "empty stroke" };
    totalPoints += points.length;
    if (totalPoints > MAX_POINTS) return { ok: false, reason: "too many points" };
    strokes.push({ colour, points });
  }

  if (strokes.length === 0) return { ok: false, reason: "no strokes" };
  return { ok: true, ink: { strokes } };
}

/** Strict integer parse. `Number()` accepts "", " 1", "1e2", "0x10", "+3" and
 * "1.0" — every one of which would round-trip to a different string and defeat
 * the canonical check above. */
function toInt(text: string): number | null {
  if (!/^(0|[1-9][0-9]*)$/.test(text)) return null;
  const value = Number(text);
  return Number.isSafeInteger(value) ? value : null;
}
