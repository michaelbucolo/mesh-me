// TEXT WITH THE TEXTURE OF TEXT.
//
// The surface this replaces had eleven content cards on screen and not one of
// them was readable. Roughly 10px muted grey on near-black, cut mid-word:
//
//     "The future of social media isn't about more conten…"
//
// That is not a small caption. It is grey noise shaped like writing — it costs
// the same pixels as real information and carries none, and every one of those
// eleven cards was asking the eye to try and then fail.
//
// So rule one of the rebuild is: NO UNREADABLE TEXT, EVER. This module is where
// that stops being a good intention. It answers one question — given this much
// room, what can this label honestly say? — and it is allowed to answer
// "nothing", which is the answer the old surface would never give.
//
// ── THE TWO FAILURES ARE DIFFERENT, AND ONLY ONE IS FORBIDDEN ───────────────
//
// Truncation is fine. "The future of social…" is a teaser, and teasers are how
// every feed on earth works. What was photographed is not that: `conten…` is a
// word torn in half, and a torn word is unreadable in a way a dropped word is
// not — the eye tries to complete it and cannot.
//
// So the rule is not "never truncate". It is: TRUNCATE ONLY AT A BOUNDARY
// WHERE A READER WOULD, and never below a size a reader can actually see.
//
// ── WHY TRUNCATION HAPPENS AT THE LARGEST SIZE, NOT THE SMALLEST ────────────
//
// Given a label that does not fit, there are two ways to cope: shrink the type
// until more of it fits, or keep the type large and say less. The old surface
// chose the first and ended up at 10px.
//
// This chooses the second, because a truncated label is a TEASER and not the
// content. You are going to open the thing to read it. Six words you can
// actually read beat eleven words you cannot, so the type stays big and the
// sentence gets shorter.
//
// ── LANGUAGES WITHOUT SPACES ────────────────────────────────────────────────
//
// "Break only at word boundaries" quietly means "break only at spaces", and a
// Chinese or Japanese title has none. Under a space-only rule every CJK label
// is one enormous unbreakable word, so every one of them is refused and a
// quarter of the planet gets a mesh with no writing on it at all.
//
// That is the same class of bug as the rest of this rebuild — a rule that looks
// total but silently excludes the case it was never tested against. CJK
// ideographs and kana break BETWEEN CHARACTERS, because that is where a reader
// of those scripts breaks them.

/**
 * Measures a string's width in pixels at a given size.
 *
 * Injected rather than imported. The browser has canvas and knows the real
 * font; this repo's gates run before anything is rendered and must not depend
 * on one. Injection also means the gate can measure with a model it fully
 * controls, so a failure is a failure of the LOGIC rather than of a font that
 * happened to load.
 */
export type Measure = (text: string, sizePx: number) => number;

export type Box = { width: number; height: number };

export type Label =
  | {
      kind: "text";
      lines: string[];
      /** Rendered size in px. Never below `MIN_SIZE`. */
      size: number;
      /** True when whole words were dropped. Never means a word was cut. */
      truncated: boolean;
    }
  | {
      kind: "none";
      /**
       * Why there is no label. Reported rather than silent, because "this node
       * has no room for words" is a layout fact the caller may want to act on
       * by showing fewer nodes.
       */
      why: "empty" | "no-room";
    };

/**
 * The smallest size this will ever render.
 *
 * 13px, not 10. Below about 12 a label stops being read and starts being
 * recognised by shape, which is exactly the failure mode being fixed — and 13
 * leaves a margin over that boundary rather than sitting on it.
 */
export const MIN_SIZE = 13;

/**
 * The largest a node label gets. Past this it competes with the headline.
 *
 * Deliberately not exported: it is where the search starts, not a promise to
 * anyone outside. `MIN_SIZE` and `COMFORT_SIZE` are exported because they are
 * claims about what will never be rendered, which the gate has to be able to
 * check; a ceiling that only bounds an internal loop is not that.
 */
const MAX_SIZE = 19;

/**
 * The size below which completeness stops being worth paying for.
 *
 * There is a real trade here and the first version of this module got it
 * inconsistent. It preferred fitting the WHOLE label at any size down to the
 * floor, while preferring SIZE over completeness once truncation was
 * unavoidable — so widening a box from 120px to 200px made the type shrink from
 * 19px to 15px, because at 200px the whole sentence finally fitted if you made
 * it small enough. More room, worse reading. The gate caught it.
 *
 * That is the old surface's instinct exactly: shrink until it fits. Dropping to
 * 17px to avoid an ellipsis is a good trade; dropping to 13px is not, because
 * 13 is the floor reserved for when there is no other option at all, not a
 * place to arrive at voluntarily.
 *
 * So completeness wins above this line and size wins below it.
 */
export const COMFORT_SIZE = 16;

/** Two lines. Three is a paragraph, and a node is not a place to read one. */
export const MAX_LINES = 2;

/** Multiplied by size to get a line's height. */
const LINE_HEIGHT = 1.28;

const ELLIPSIS = "…";

/** Ideographs and kana, which break between characters rather than at spaces. */
const CHARACTER_BREAKING = /[぀-ヿ㐀-䶿一-鿿豈-﫿]/;

type Token = { text: string; spaceBefore: boolean };

/**
 * Split into the smallest pieces a reader would accept a break between.
 *
 * Whitespace-delimited words, except that a run containing ideographs or kana
 * is further split per character — see the note at the top about what a
 * space-only rule does to a language that has no spaces.
 */
function tokenise(text: string): Token[] {
  const out: Token[] = [];
  for (const word of text.trim().split(/\s+/)) {
    if (!word) continue;
    if (!CHARACTER_BREAKING.test(word)) {
      out.push({ text: word, spaceBefore: out.length > 0 });
      continue;
    }
    // Array.from, not split(""), so an astral character is one token rather
    // than two broken halves of a surrogate pair.
    let first = true;
    for (const ch of Array.from(word)) {
      out.push({ text: ch, spaceBefore: first && out.length > 0 });
      first = false;
    }
  }
  return out;
}

/**
 * Greedily fill lines. Returns the lines used and how many tokens were placed.
 *
 * A token that cannot fit on a line OF ITS OWN is not placeable at this size —
 * it is reported as such rather than being broken, which is the whole point.
 */
function fill(tokens: Token[], width: number, size: number, measure: Measure, maxLines: number) {
  const lines: string[] = [];
  let current = "";
  let placed = 0;

  for (const token of tokens) {
    const candidate = current === "" ? token.text : `${current}${token.spaceBefore ? " " : ""}${token.text}`;
    if (measure(candidate, size) <= width) {
      current = candidate;
      placed += 1;
      continue;
    }
    // Does not fit here. Move to a new line if there is one left.
    if (current !== "") lines.push(current);
    if (lines.length >= maxLines) return { lines, placed, exhausted: true };
    if (measure(token.text, size) > width) {
      // Will not fit on an empty line either. Stop rather than break it.
      current = "";
      return { lines, placed, exhausted: true };
    }
    current = token.text;
    placed += 1;
  }
  if (current !== "") lines.push(current);
  return { lines, placed, exhausted: false };
}

/**
 * What this label can honestly say in this much room.
 *
 * Pure, and total: every input produces either legible text or an explicit
 * refusal. There is no path that returns something unreadable.
 */
export function labelFor(text: string, box: Box, measure: Measure): Label {
  const tokens = tokenise(text ?? "");
  if (tokens.length === 0) return { kind: "none", why: "empty" };

  const linesAvailable = Math.max(0, Math.min(MAX_LINES, Math.floor(box.height / (MIN_SIZE * LINE_HEIGHT))));
  if (linesAvailable === 0 || box.width <= 0) return { kind: "none", why: "no-room" };

  // Largest size at which the WHOLE label fits, but only down to COMFORT_SIZE.
  // Below that line, shrinking to avoid an ellipsis is the old surface's
  // instinct and is refused — see the note on COMFORT_SIZE.
  for (let size = MAX_SIZE; size >= COMFORT_SIZE; size -= 1) {
    const maxLines = Math.min(MAX_LINES, Math.floor(box.height / (size * LINE_HEIGHT)));
    if (maxLines < 1) continue;
    const laid = fill(tokens, box.width, size, measure, maxLines);
    if (!laid.exhausted && laid.placed === tokens.length) {
      return { kind: "text", lines: laid.lines, size, truncated: false };
    }
  }

  // It does not fit whole. Keep the type large and say less — a truncated
  // label is a teaser, and a teaser you cannot read is worth nothing.
  for (let size = MAX_SIZE; size >= MIN_SIZE; size -= 1) {
    const maxLines = Math.min(MAX_LINES, Math.floor(box.height / (size * LINE_HEIGHT)));
    if (maxLines < 1) continue;

    // Fit as many whole tokens as possible, leaving room for the ellipsis on
    // the final line. Walk back a token at a time until the mark fits too.
    const laid = fill(tokens, box.width, size, measure, maxLines);
    for (let take = laid.placed; take >= 1; take -= 1) {
      const attempt = fill(tokens.slice(0, take), box.width, size, measure, maxLines);
      if (attempt.exhausted || attempt.placed < take || attempt.lines.length === 0) continue;

      // Everything fitted after all — no words were dropped, so no mark. This
      // is reachable only below COMFORT_SIZE, where the loop above declined to
      // look, and it is still legible, so it is a better answer than refusing.
      if (take === tokens.length) {
        return { kind: "text", lines: attempt.lines, size, truncated: false };
      }

      const last = attempt.lines[attempt.lines.length - 1];
      const withMark = last + ELLIPSIS;
      if (measure(withMark, size) > box.width) continue;
      return {
        kind: "text",
        lines: [...attempt.lines.slice(0, -1), withMark],
        size,
        truncated: true,
      };
    }
  }

  // Not even one word survives at the smallest legible size. The node shows its
  // mark and its verb and no writing at all, which is honest — the alternative
  // is the grey smear this module exists to prevent.
  return { kind: "none", why: "no-room" };
}
