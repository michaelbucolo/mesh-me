// PROVING THE REPAIR DOES NOT BECOME THE DAMAGE.
//
// decode-text.ts fixes Meta's UTF-8-as-Latin-1 mangling. Testing that it repairs
// a mangled "café" is the easy half and proves almost nothing — a function that
// ran the transformation unconditionally would pass it.
//
// The half that matters is CLEAN_CORPUS below: real captions in Turkish,
// Portuguese, Nordic, Greek, Cyrillic, Arabic, Japanese and Korean, none of
// which were ever broken, every one of which must come back byte-identical. An
// eager decoder passes every repair test in this file and fails that corpus, and
// that is the failure a user could never diagnose — they would just find their
// own words quietly wrong.
//
// ── EVERY MANGLED FIXTURE IS WRITTEN AS BYTES, NOT AS TEXT ──────────────────
//
// This is not stylistic. Mojibake for an emoji contains bytes 0x80-0x9F, which
// are C1 control characters with no glyph: pasted into a source file they are
// invisible, and any editor, formatter or tool that normalises them breaks the
// fixture without leaving a trace. Writing the FAMILIAR rendering instead is
// worse — the "â€™" everyone recognises is Windows-1252, and typing it puts
// U+20AC and U+2122 in the file, code points above 0xFF that the module
// correctly refuses to touch. The test would then assert the exact opposite of
// what it means and still go green.
//
// So the fixtures are hex byte sequences, exactly as they appear in the export,
// turned into a string by the same rule the exporter used: one byte, one code
// unit. Nothing invisible, nothing to normalise, and the observed bytes are
// legible on the page.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { decodeExportText } from "../src/lib/portability/decode-text";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
let checks = 0;

/**
 * Comments are not code. This file names encodings and failure modes constantly
 * and must not certify the module by matching its own prose — a mistake three
 * gates in this repo have already made.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

/** Bytes as Latin-1 characters — precisely what Meta's exporter writes out. */
function latin1(...bytes: number[]): string {
  return String.fromCharCode(...bytes);
}

/** Do to a string exactly what Meta's exporter does: UTF-8 bytes read as Latin-1. */
function mangle(text: string): string {
  return latin1(...new TextEncoder().encode(text));
}

/**
 * Correct text that was never broken. Reused by the corpus assertion and the
 * summary line so the number printed cannot drift from the number tested.
 */
const CLEAN_CORPUS = [
  "café",
  "Señor",
  "Görüşürüz",
  "Ação",
  "Blåbær",
  "naïve",
  "Ñoño",
  "Zoë",
  "façade",
  "jalapeño",
  "Köln",
  "smörgåsbord",
  "Þórr",
  "ÆØÅ",
  "Ünïcödé mïx",
  "© 2026 mesh.me",
  "£100 ± 5°",
  "½ + ¼",
  "日本語のテキスト",
  "مرحبا بالعالم",
  "Привет, мир",
  "안녕하세요",
  "Ελληνικά",
  "don’t",
  "€50",
  "\u{1f600}",
  "❤️",
  "emoji \u{1f389} in text",
  "hello world",
  "",
  "   ",
  "1234",
  "a\nb\tc",
];

// ── 1. THE MANGLING, AS IT ACTUALLY ARRIVES ─────────────────────────────────
{
  const cases: Array<[string, string, string]> = [
    // "café" — é is C3 A9
    [latin1(0x63, 0x61, 0x66, 0xc3, 0xa9), "café", "an accented letter"],
    // "Señor" — ñ is C3 B1
    [latin1(0x53, 0x65, 0xc3, 0xb1, 0x6f, 0x72), "Señor", "a tilde"],
    // "don’t" — U+2019 is E2 80 99, two of whose bytes are invisible controls
    [latin1(0x64, 0x6f, 0x6e, 0xe2, 0x80, 0x99, 0x74), "don’t", "a curly apostrophe"],
    // "€50" — U+20AC is E2 82 AC
    [latin1(0xe2, 0x82, 0xac, 0x35, 0x30), "€50", "a currency sign"],
    // U+1F600 is F0 9F 98 80 — four bytes, three of them invisible
    [latin1(0xf0, 0x9f, 0x98, 0x80), "\u{1f600}", "an emoji"],
    // U+2764 U+FE0F is E2 9D A4 EF B8 8F
    [latin1(0xe2, 0x9d, 0xa4, 0xef, 0xb8, 0x8f), "❤️", "an emoji with a variation selector"],
  ];

  for (const [broken, expected, what] of cases) {
    const result = decodeExportText(broken);
    assert.equal(
      result.text,
      expected,
      `${what} was not repaired: ${JSON.stringify(broken)} stayed ${JSON.stringify(result.text)}`,
    );
    assert.equal(result.repairs, 1, `${what} should take exactly one pass, took ${result.repairs}`);
    checks += 2;
  }

  // The generated helper must agree with the hand-written bytes, or every
  // generated case below is testing something other than the real bug.
  assert.equal(
    mangle("café"),
    latin1(0x63, 0x61, 0x66, 0xc3, 0xa9),
    "the mangle helper does not reproduce the observed export bytes.",
  );
  checks += 1;
}

// ── 2. THE CORPUS THAT MUST COME BACK UNTOUCHED ─────────────────────────────
//
// The assertion this whole module exists to satisfy.
{
  for (const clean of CLEAN_CORPUS) {
    const result = decodeExportText(clean);
    assert.equal(
      result.text,
      clean,
      `CLEAN TEXT WAS REWRITTEN: ${JSON.stringify(clean)} became ${JSON.stringify(result.text)}.\n` +
        "  This is the failure a user cannot diagnose — they would just find their own words wrong.",
    );
    assert.equal(result.repairs, 0, `${JSON.stringify(clean)} reported ${result.repairs} repairs but needed none.`);
    checks += 2;
  }
}

// ── 3. MALFORMED BYTES ARE NOT "NEARLY UTF-8" ───────────────────────────────
//
// Strict decoding is the load-bearing condition, so the forms a lenient decoder
// would accept-with-damage are checked by name. Each of these becomes U+FFFD
// under a non-fatal TextDecoder, which is exactly how "did not decode" turns
// into "decoded, with damage".
{
  const malformed: Array<[string, string]> = [
    [latin1(0xc0, 0x80), "an overlong encoding of NUL"],
    [latin1(0xed, 0xa0, 0x80), "a CESU-8 lone surrogate"],
    [latin1(0x63, 0x61, 0x66, 0xc3), "a truncated two-byte sequence"],
    [latin1(0xf5, 0x80, 0x80, 0x80), "a lead byte past the U+10FFFF ceiling"],
    [latin1(0x80, 0x81), "continuation bytes with no lead"],
  ];

  for (const [input, what] of malformed) {
    const result = decodeExportText(input);
    assert.equal(result.text, input, `${what} was transformed instead of left alone: ${JSON.stringify(result.text)}`);
    assert.equal(result.repairs, 0, `${what} reported a repair.`);
    assert.ok(
      !result.text.includes("�"),
      `${what} produced a replacement character — the decoder is not in fatal mode.`,
    );
    checks += 3;
  }
}

// ── 4. DOUBLE ENCODING, AND THE CAP THAT BOUNDS IT ──────────────────────────
{
  const twice = mangle(mangle("café"));
  const result = decodeExportText(twice);
  assert.equal(result.text, "café", `doubly-mangled text did not fully recover: ${JSON.stringify(result.text)}`);
  assert.equal(result.repairs, 2, `doubly-mangled text took ${result.repairs} passes, expected 2.`);
  checks += 2;

  // Pathological input must terminate rather than unwind forever. Truncating at
  // the cap leaves the text visibly wrong, which is the intended outcome: a
  // five-times-mangled string is a new bug worth seeing, not one to paper over.
  let deep = "café";
  for (let i = 0; i < 5; i += 1) deep = mangle(deep);
  const capped = decodeExportText(deep);
  assert.ok(capped.repairs <= 3, `the pass cap did not hold: ${capped.repairs} passes ran.`);
  assert.notEqual(
    capped.text,
    "café",
    "a five-times-mangled string fully recovered, so the cap is not being enforced at all.",
  );
  checks += 2;
}

// ── 5. IDEMPOTENT WHERE IT CLAIMS TO BE ─────────────────────────────────────
//
// Running the repair on already-repaired text must be a no-op, or every caller
// has to track whether decoding already happened. This holds for everything
// inside the pass cap; section 4 covers the deliberate exception.
{
  for (const input of [mangle("café"), "café", mangle(mangle("Señor")), "hello", "\u{1f600}"]) {
    const once = decodeExportText(input);
    const twice = decodeExportText(once.text);
    assert.equal(twice.text, once.text, `decoding twice changed ${JSON.stringify(input)} again.`);
    assert.equal(twice.repairs, 0, `already-decoded text still reported ${twice.repairs} repairs.`);
    checks += 2;
  }
}

// ── 6. THE COUNT IS HONEST, AND THE FUNCTION IS PURE ────────────────────────
{
  // repairs === 0 must mean genuinely untouched, so a caller can trust the count
  // to decide whether to tell the user anything happened.
  for (const input of ["hello", "café", "日本語", ""]) {
    const r = decodeExportText(input);
    assert.equal(
      r.repairs === 0 && r.text === input,
      true,
      `${JSON.stringify(input)} reported 0 repairs but the text changed.`,
    );
    checks += 1;
  }

  const sample = latin1(0x63, 0x61, 0x66, 0xc3, 0xa9);
  const first = JSON.stringify(decodeExportText(sample));
  for (let i = 0; i < 5; i += 1) {
    assert.equal(JSON.stringify(decodeExportText(sample)), first, "decodeExportText is not deterministic.");
    checks += 1;
  }
}

// ── 7. THE MODULE MUST KEEP ITS PROMISES IN WRITING ─────────────────────────
//
// Read past the comments where the check is about code, and read the raw source
// where the check is deliberately about the prose.
{
  const source = readFileSync(join(ROOT, "src/lib/portability/decode-text.ts"), "utf8");
  const code = stripComments(source);

  assert.ok(
    /fatal:\s*true/.test(code),
    "the decoder is not in fatal mode. Without it invalid bytes become U+FFFD and every malformed input reads as a successful decode — the single condition this module's safety rests on.",
  );
  checks += 1;

  assert.ok(
    !/new TextDecoder\((?![^)]*fatal)/.test(code),
    "a TextDecoder is constructed without fatal mode somewhere in this module.",
  );
  checks += 1;

  // Loose prose matching is how a gate certifies nothing. An earlier version of
  // this assertion accepted any file containing the word "cannot" — which the
  // module says in passing about a byte, in a sentence with no bearing on its
  // limits — so deleting the entire limits section left it green. Each phrase
  // below is one that only the limits section has a reason to contain, and all
  // three are required together.
  for (const [phrase, why] of [
    [/mixed strings/i, "that a caption which is only partly mangled is left alone rather than half-repaired"],
    [/out of scope/i, "which of these cases it declines to handle at all"],
    [/indistinguishable/i, "that genuine text shaped exactly like mojibake will be repaired anyway"],
  ] as const) {
    assert.ok(
      phrase.test(source),
      `the module no longer states ${why}. A reader who does not know that limit will trust this decoder further than it can be trusted.`,
    );
    checks += 1;
  }
}

console.log(
  `decode-text OK — ${checks} assertions.\n` +
    "  Meta's UTF-8-as-Latin-1 mangling is repaired for accents, tildes, curly quotes, currency signs\n" +
    "  and emoji (including a variation selector), and doubly-mangled text recovers in two passes.\n" +
    `  ${CLEAN_CORPUS.length} clean strings across Turkish, Portuguese, Nordic, Greek, Cyrillic, Arabic, Japanese and\n` +
    "  Korean come back byte-identical — the assertion that actually matters, because an eager decoder\n" +
    "  passes every repair test above and silently rewrites real people's captions.\n" +
    "  Overlong forms, CESU-8 surrogates, truncated sequences and stray continuation bytes are left\n" +
    "  alone rather than replaced with U+FFFD, and the pass cap is proven to bound pathological input.\n" +
    "  Does NOT cover: strings where part is mangled and part is not — those are left untouched by\n" +
    "  design, and no test here can tell that apart from a repair that should have happened.",
);
