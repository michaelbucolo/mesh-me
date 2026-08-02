// "conten…" IS THE BUG, AND IT IS ASSERTABLE.
//
// The surface this replaces had eleven content cards on screen, none readable:
// roughly 10px muted grey on near-black, cut mid-word.
//
//     "The future of social media isn't about more conten…"
//
// Two separate faults are in that one string, and only one of them is about
// size. A dropped WORD is a teaser; a torn word is unreadable, because the eye
// tries to complete it and cannot. So the rules being checked here are:
//
//   1. never below a size a person can read
//   2. never cut anywhere a reader would not cut
//
// The second is the one with an edge case that matters more than it looks:
// "cut only at word boundaries" silently means "cut only at spaces", and a
// Chinese or Japanese title has none. A space-only rule refuses every CJK label
// outright — the same shape of bug as every other one found in this rebuild, a
// rule that looks total while quietly excluding the case nobody tested.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMFORT_SIZE, labelFor, MAX_LINES, MIN_SIZE, type Box, type Measure } from "../src/components/meshfield/model/legible";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

function prose(source: string): string {
  return source
    .split("\n")
    .map((line) => line.replace(/^\s*(\/\/|\*)\s?/, ""))
    .join(" ")
    .replace(/\s+/g, " ");
}

// ── MEASURERS ───────────────────────────────────────────────────────────────
//
// Two of them, deliberately. A layout that is correct only under the width
// model it was written against is not correct, it is tuned — so everything
// below runs under a proportional model AND a monospace one.

const NARROW = new Set("iljtfIr.,;:'!|".split(""));
const WIDE = new Set("mwMW@%".split(""));
const CJK = /[぀-ヿ㐀-䶿一-鿿]/;

const proportional: Measure = (text, size) => {
  let units = 0;
  for (const ch of Array.from(text)) {
    if (CJK.test(ch)) units += 1;
    else if (NARROW.has(ch)) units += 0.3;
    else if (WIDE.has(ch)) units += 0.87;
    else if (ch === "…") units += 0.6;
    else units += 0.54;
  }
  return units * size;
};

const monospace: Measure = (text, size) => Array.from(text).length * size * 0.6;

const MEASURERS: Array<[string, Measure]> = [
  ["proportional", proportional],
  ["monospace", monospace],
];

/** The exact string photographed on the old surface. */
const PHOTOGRAPHED = "The future of social media isn't about more content";

const SAMPLES = [
  PHOTOGRAPHED,
  "Reply to Jordan",
  "Naomi went live",
  "a",
  "Supercalifragilisticexpialidocious",
  "New video: how we rebuilt the entire thing from scratch in one weekend",
  "Maya  spaced   oddly    here",
  "Ünïcödé áccents everywhere",
  "🎉 party time 🎈 with emoji 🥳",
  "今天天气很好我们去公园吧",
  "こんにちは世界これはテストです",
  "混合 mixed 语言 content 测试",
];

const BOXES: Array<[string, Box]> = [
  ["roomy", { width: 260, height: 60 }],
  ["narrow", { width: 96, height: 48 }],
  ["one line", { width: 200, height: 20 }],
  ["tiny", { width: 34, height: 18 }],
  ["hairline", { width: 8, height: 40 }],
  ["no height", { width: 300, height: 4 }],
];

/**
 * An INDEPENDENT tokeniser.
 *
 * Deliberately a second implementation rather than an import of the module's
 * own. If the gate reused the module's idea of where a word ends, then a module
 * that had the wrong idea would agree with itself and the check would pass on a
 * broken build. This is the one place duplication is the point.
 */
function tokensOf(text: string): string[] {
  const out: string[] = [];
  for (const word of text.trim().split(/\s+/)) {
    if (!word) continue;
    if (!CJK.test(word)) out.push(word);
    else for (const ch of Array.from(word)) out.push(ch);
  }
  return out;
}

// ── 1. NEVER UNREADABLE, NEVER OVERFLOWING ──────────────────────────────────
{
  for (const [mname, measure] of MEASURERS) {
    for (const [bname, box] of BOXES) {
      for (const text of SAMPLES) {
        const label = labelFor(text, box, measure);
        if (label.kind === "none") continue;
        const where = `${mname}/${bname}/"${text.slice(0, 24)}"`;

        assert.ok(label.size >= MIN_SIZE, `${where}: rendered at ${label.size}px, below the ${MIN_SIZE}px floor. That is the 10px grey smear returning.`);
        assert.ok(label.lines.length >= 1 && label.lines.length <= MAX_LINES, `${where}: ${label.lines.length} lines.`);
        assert.ok(label.lines.every((l) => l.length > 0), `${where}: emitted an empty line.`);

        for (const line of label.lines) {
          assert.ok(
            measure(line, label.size) <= box.width + 1e-9,
            `${where}: line "${line}" is ${measure(line, label.size).toFixed(1)}px wide in a ${box.width}px box — it overflows its node.`,
          );
        }
        assert.ok(
          label.lines.length * label.size * 1.28 <= box.height + 1e-9,
          `${where}: ${label.lines.length} lines at ${label.size}px do not fit ${box.height}px of height.`,
        );
      }
      checks += 1;
    }
  }
}

// ── 2. THE LOAD-BEARING ONE: NO WORD IS EVER TORN ───────────────────────────
//
// Every piece of text that comes out must be a WHOLE token from the input, in
// order, forming a prefix. "conten" is a prefix of the input's characters but
// not of its tokens, which is exactly the distinction being enforced.
{
  for (const [mname, measure] of MEASURERS) {
    for (const [bname, box] of BOXES) {
      for (const text of SAMPLES) {
        const label = labelFor(text, box, measure);
        if (label.kind === "none") continue;
        const where = `${mname}/${bname}/"${text.slice(0, 24)}"`;

        const emitted = label.lines.join(" ").replace(/…$/, "");
        const got = tokensOf(emitted);
        const want = tokensOf(text);

        assert.ok(got.length <= want.length, `${where}: produced more tokens than the source had.`);
        got.forEach((token, i) => {
          assert.equal(
            token,
            want[i],
            `${where}: emitted "${token}" where the source has "${want[i]}". A word was torn — this is the "conten…" bug.`,
          );
        });

        if (!label.truncated) {
          assert.equal(got.length, want.length, `${where}: reported untruncated but dropped ${want.length - got.length} tokens.`);
          assert.ok(!label.lines.join("").includes("…"), `${where}: reported untruncated but wrote an ellipsis.`);
        } else {
          assert.ok(label.lines[label.lines.length - 1].endsWith("…"), `${where}: reported truncated but wrote no ellipsis.`);
          assert.ok(got.length >= 1, `${where}: truncated down to nothing but still returned text.`);
        }
      }
      checks += 1;
    }
  }
}

// ── 3. THE CHECK THAT PROVES CHECK 2 IS NOT VACUOUS ─────────────────────────
//
// Section 2 only means something if the failure it forbids is a failure a real
// implementation actually produces. The naive version — slice the string to
// length and add a mark — is what the old surface did, and on the photographed
// string in the photographed box it produces exactly the photographed output.
{
  const naive = (text: string, box: Box, size: number, measure: Measure) => {
    let cut = text.length;
    while (cut > 0 && measure(text.slice(0, cut) + "…", size) > box.width) cut -= 1;
    return text.slice(0, cut) + "…";
  };

  const box = { width: 200, height: 20 };
  const naiveOut = naive(PHOTOGRAPHED, box, 13, proportional);
  const naiveTokens = tokensOf(naiveOut.replace(/…$/, ""));
  const realTokens = tokensOf(PHOTOGRAPHED);

  assert.ok(
    naiveTokens.some((t, i) => t !== realTokens[i]),
    "character truncation did NOT tear a word on the photographed string, so section 2 is forbidding something nothing does. " +
      "Re-derive the failure before trusting the check.",
  );
  checks += 1;

  // And the real thing, on the same string in the same box, does not.
  const good = labelFor(PHOTOGRAPHED, box, proportional);
  assert.equal(good.kind, "text", "the photographed caption produced no label at all in a 200x20 box.");
  if (good.kind === "text") {
    const got = tokensOf(good.lines.join(" ").replace(/…$/, ""));
    got.forEach((t, i) => assert.equal(t, realTokens[i], `labelFor tore "${t}" out of the photographed caption.`));
    assert.ok(good.truncated, "the photographed caption fitted a 200x20 box whole; this comparison is not exercising truncation.");
    checks += 2;
  }
}

// ── 4. LANGUAGES WITHOUT SPACES GET WRITING TOO ─────────────────────────────
//
// The bug a space-only rule hides: every CJK title is one unbreakable word, so
// every one is refused, so a quarter of the planet sees a mesh with no writing.
{
  for (const [mname, measure] of MEASURERS) {
    for (const text of ["今天天气很好我们去公园吧", "こんにちは世界これはテストです"]) {
      // A box far too narrow to hold the whole string on one line.
      const label = labelFor(text, { width: 90, height: 44 }, measure);
      assert.equal(
        label.kind,
        "text",
        `${mname}: "${text}" produced no label at all. A rule that only breaks at spaces refuses every language that has none.`,
      );
      if (label.kind === "text") {
        assert.ok(label.lines.length >= 1, `${mname}: empty CJK label.`);
        // It must have actually WRAPPED or truncated, not overflowed.
        assert.ok(
          label.lines.every((l) => measure(l, label.size) <= 90 + 1e-9),
          `${mname}: CJK line overflows its box — the characters were not treated as break points.`,
        );
      }
      checks += 1;
    }
  }
}

// ── 5. ASTRAL CHARACTERS ARE NOT CUT IN HALF ────────────────────────────────
//
// `split("")` on an emoji yields two broken surrogate halves, which render as
// the replacement glyph. That is its own kind of unreadable.
{
  for (const [, measure] of MEASURERS) {
    for (const box of [{ width: 60, height: 40 }, { width: 200, height: 44 }]) {
      const label = labelFor("🎉 party time 🎈 with emoji 🥳", box, measure);
      if (label.kind !== "text") continue;
      const joined = label.lines.join("");
      assert.ok(!/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(joined), `an emoji was cut into a broken surrogate half: ${JSON.stringify(joined)}`);
      checks += 1;
    }
  }
}

// ── 6. REFUSAL IS AN ANSWER, AND IT IS HONEST ───────────────────────────────
{
  for (const [, measure] of MEASURERS) {
    for (const empty of ["", "   ", "\n\t "]) {
      const label = labelFor(empty, { width: 300, height: 60 }, measure);
      assert.equal(label.kind, "none", "empty text produced a label.");
      if (label.kind === "none") assert.equal(label.why, "empty", "empty text was refused for the wrong reason.");
      checks += 1;
    }

    // A box with no usable height cannot hold a legible line, and says so
    // rather than shrinking type until something technically fits.
    const flat = labelFor("Reply to Jordan", { width: 300, height: 4 }, measure);
    assert.equal(flat.kind, "none", "a 4px-tall box produced a label; something was rendered below the legibility floor.");

    // One word too long for the box at any legible size: refused whole rather
    // than broken into a fragment.
    const long = labelFor("Supercalifragilisticexpialidocious", { width: 20, height: 60 }, measure);
    assert.equal(long.kind, "none", "an unbreakable word in a 20px box was rendered anyway — it can only have been torn.");
    checks += 2;
  }
}

// ── 7. MORE ROOM NEVER READS WORSE ──────────────────────────────────────────
//
// This check was wrong on its first run, and the way it was wrong is worth
// keeping. It asserted that widening a box never SHRINKS the type — and caught
// a genuine inconsistency in the module, which shrank 19px to 15px when the box
// widened, because at the wider size the whole sentence finally fitted if you
// made it small enough.
//
// But the assertion was also too strong, and fixing the module did not make it
// true. Trading 19px-truncated for 17px-complete is an IMPROVEMENT — the reader
// gets the whole sentence and 17px is perfectly legible. "Bigger type is always
// better" is simply not the principle; if it were, nothing would ever be
// allowed to fit.
//
// The thing that must never go backwards is INFORMATION. So the assertion is
// now about how many words survive, and the size rule it originally meant is
// stated separately and exactly: type is never shrunk below COMFORT_SIZE merely
// to avoid an ellipsis.
{
  for (const [mname, measure] of MEASURERS) {
    for (const text of ["Reply to Jordan", PHOTOGRAPHED, "New video: how we rebuilt the entire thing from scratch in one weekend"]) {
      let previousTokens = 0;
      for (const width of [80, 120, 200, 320, 520, 800]) {
        const label = labelFor(text, { width, height: 60 }, measure);
        if (label.kind !== "text") continue;
        const shown = tokensOf(label.lines.join(" ").replace(/…$/, "")).length;
        assert.ok(
          shown >= previousTokens,
          `${mname}/"${text.slice(0, 20)}": widening the box to ${width}px showed FEWER words (${previousTokens} -> ${shown}). More room must never read worse.`,
        );
        previousTokens = shown;

        assert.ok(
          label.truncated || label.size >= COMFORT_SIZE,
          `${mname}/"${text.slice(0, 20)}" at ${width}px: rendered whole at ${label.size}px, below the ${COMFORT_SIZE}px comfort line. ` +
            "Shrinking type to avoid an ellipsis is the instinct that produced the 10px smear.",
        );
      }
      checks += 2;
    }
  }
}

// ── 8. DETERMINISTIC, AND HONEST ABOUT ITS OWN REASONING ────────────────────
{
  for (const [, measure] of MEASURERS) {
    const box = { width: 160, height: 50 };
    const first = JSON.stringify(labelFor(PHOTOGRAPHED, box, measure));
    for (let i = 0; i < 5; i += 1) {
      assert.equal(JSON.stringify(labelFor(PHOTOGRAPHED, box, measure)), first, "labelFor is not deterministic.");
    }
    checks += 1;
  }

  const source = readFileSync(join(ROOT, "src/components/meshfield/model/legible.ts"), "utf8");
  assert.ok(!/Math\.random\(\)|Date\.now\(\)/.test(source), "the label depends on randomness or the clock.");
  checks += 1;

  const words = prose(source);
  for (const [phrase, why] of [
    [/TRUNCATE ONLY AT A BOUNDARY WHERE A READER WOULD/i, "that dropping a word and tearing one are different failures, and only one is forbidden"],
    [/teaser/i, "why truncation happens at the largest size rather than the smallest"],
    [/no spaces|has none/i, "that a space-only break rule silently refuses every language without spaces"],
  ] as const) {
    assert.ok(phrase.test(words), `the module no longer explains ${why}.`);
    checks += 1;
  }
}

console.log(
  `mesh legibility OK — ${checks} assertions.\n` +
    "  Across twelve captions, six boxes and two independent width models: nothing renders below 13px,\n" +
    "  no line overflows its node, no label exceeds two lines, and — the one that matters — no word is\n" +
    "  ever torn. Output is checked against a SECOND, independent tokeniser, because a module that\n" +
    "  marked its own homework would agree with itself while shipping the bug.\n" +
    "  The photographed caption is used by name. Character truncation is shown to produce exactly the\n" +
    "  mid-word cut that was photographed, and `labelFor` is shown not to, on the same string in the\n" +
    "  same box — so the no-tearing rule forbids something that really happens.\n" +
    "  CJK is covered on purpose: a break-only-at-spaces rule refuses every Chinese and Japanese title\n" +
    "  outright, and that would have shipped silently. Emoji survive as whole characters rather than\n" +
    "  broken surrogate halves.\n" +
    "  Widening a box never shows FEWER words — deliberately not 'never shrinks the type', which is\n" +
    "  what this asserted first. It caught a real bug that way (19px going to 15px on a wider box) but\n" +
    "  was itself too strong: 17px-complete beats 19px-truncated. What must not go backwards is\n" +
    "  information. The size rule it originally meant is stated exactly instead — type is never shrunk\n" +
    "  below the 16px comfort line merely to avoid an ellipsis.\n" +
    "  Does NOT cover: which nodes get a label when there is not room for all of them, or what the\n" +
    "  label is drawn ON — contrast belongs to the material gate, and both must hold at once.",
);
