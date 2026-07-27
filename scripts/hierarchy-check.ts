/**
 * FILL MEANS "PRESS THIS". IT CANNOT ALSO MEAN "THIS WILL DESTROY YOUR ACCOUNT".
 *
 * Apple's button hierarchy is filled > tinted > gray > plain, and the filled
 * one is the single action the view wants pressed. Destructive actions are red
 * LABELS — iOS has never drawn Delete as a filled button in a settings list.
 *
 * This product drew it the other way round. Photographed on /settings at
 * 1440x900: "Delete account" rendered as a full-width crimson slab next to a
 * plain "Sign out", which made the most dangerous control the loudest thing on
 * the page — and it sat alongside a filled cobalt "Send verification email", so
 * the view had TWO filled primaries competing and one of them was a trap.
 *
 * Both facts are checkable from source, and both were stated in more than one
 * place, which is why they drifted:
 *
 *   ui/button.tsx      `danger` and `destructive` were byte-identical strings
 *                      under two names — one fact, twice, waiting to diverge.
 *   settings-*.tsx     its own KEY_CRIMSON constant repeating the same pairing.
 *   globals.css        .settings-action-danger pinning the plastic a third time.
 *
 * WHAT THIS CANNOT DO: judge whether a given view has too many filled controls
 * at RUNTIME — that depends on which branches render. It checks the vocabulary
 * (no destructive fills anywhere) and the one file where the violation was
 * photographed.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/^\s*\/\/.*$/gm, (m) => " ".repeat(m.length));

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => {
  checks += 1;
};

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

// ── 1. NOTHING DESTRUCTIVE IS FILLED ────────────────────────────────────────
//
// `key-lit` is the moulded, filled state. Paired with the crimson plastic it
// makes a red slab. The rule is about the PAIRING: crimson as an ink is right
// and is how a destructive label should read; crimson as a lit fill is the bug.
{
  const files = [...walk(join(ROOT, "src"))].filter((f) => /\.(tsx|css)$/.test(f));
  for (const file of files) {
    const rel = file.slice(ROOT.length + 1);
    const src = strip(readFileSync(file, "utf8"));

    // A LIKE is not a destruction. post-card's heart fills crimson when the
    // viewer has liked the post — an affirmative state, and the one place this
    // pairing carries a different meaning. Named, not tolerated by pattern.
    if (rel.endsWith("feed/post-card.tsx")) continue;

    if (/key-lit[^"'`\n]*--mould:\s*var\(--mould-crimson\)/.test(src)) {
      fail(
        "1 destructive fill",
        `${rel} pairs key-lit with the crimson plastic — a filled destructive control.\n` +
          "  Fill marks the one action a view wants pressed. Use --danger as the LABEL colour on a\n" +
          "  plain row; that pigment is measured on all four papers, which a fill never is.",
      );
    }
    // The same fact spelled through the CSS class.
    if (/settings-action-danger/.test(src) && /key-lit[^"'`\n]*settings-action-danger|settings-action-danger[^"'`\n]*key-lit/.test(src)) {
      fail("1 destructive fill", `${rel} pairs .settings-action-danger with key-lit — the same red slab, via the class`);
    }
  }
  ok();

  // And the class itself must not pin a plastic.
  const globals = strip(read("src/app/globals.css"));
  const danger = /\.settings-action-danger\s*\{([^{}]*)\}/.exec(globals)?.[1] ?? "";
  if (!danger) {
    fail("1 destructive fill", ".settings-action-danger is gone; this check has lost its subject");
  } else if (/--mould:/.test(danger)) {
    fail(
      "1 destructive fill",
      ".settings-action-danger pins a mould again, which makes every row wearing it a filled slab.\n" +
        "  It sets an ink now, and only an ink.",
    );
  } else ok();
}

// ── 2. ONE FACT, ONE DEFINITION ─────────────────────────────────────────────
//
// `danger` and `destructive` were byte-identical strings under two names. That
// is the shape this codebase has been bitten by repeatedly: two places state
// one fact, and only one of them is ever taught the next rule.
{
  const button = strip(read("src/components/ui/button.tsx"));
  const danger = /\bdanger:\s*"([^"]*)"/.exec(button)?.[1];
  const destructiveLiteral = /\bdestructive:\s*"([^"]*)"/.exec(button);

  if (!danger) {
    fail("2 one definition", "the `danger` button variant is gone; this check has lost its subject");
  } else ok();

  if (destructiveLiteral) {
    fail(
      "2 one definition",
      "`destructive` is a literal again rather than deriving from `danger`.\n" +
        "  They were byte-identical strings under two names. Two spellings of one fact drift the\n" +
        "  moment one of them is edited — which is precisely what this file exists to prevent.",
    );
  } else ok();

  if (danger && /key-lit/.test(danger)) {
    fail("2 one definition", "the `danger` variant is filled again; destructive is a label, not a slab");
  } else ok();
  if (danger && !/var\(--danger\)/.test(danger)) {
    fail(
      "2 one definition",
      "the `danger` variant no longer uses --danger as its ink.\n" +
        "  --mould-crimson is a FILL and is only ever measured against its own pinned ink; --danger\n" +
        "  is a pigment the contrast gate measures on all four papers, which is what a label needs.",
    );
  } else ok();
}

// ── 3. THE HEADER IS NOT A PLACE FOR A PRIMARY ──────────────────────────────
//
// WHAT THIS SECTION USED TO CLAIM, AND WHY IT WAS WRONG.
//
// It counted `key-lit` across settings-control-center.tsx and failed above one,
// on the theory that a view gets one filled primary. Two things were wrong with
// that. It counted the LITERAL, so the filled classes coming from module
// constants registered once no matter how many controls wore them — it reported
// 1 while the built page rendered 2, and only a runtime probe caught that. And
// once the counting was fixed it reported 6, which is not a violation: this file
// renders about ten different tab views, and the six are "Send verification
// email", "Sign out other devices", "Add email", "Add phone", "Apply custom
// theme" and one more — one per section, plus two independent forms each
// carrying its own submit. All legitimate.
//
// A file is not a view. Source cannot tell which controls render together, so
// counting per-file cannot express the rule and a gate that pretends otherwise
// either fails correct code or passes wrong code. Per-view counting is done in
// the browser, on a rendered page, and that is where the real violation was
// found: a filled "Sign out" in the settings header beside a filled "Send
// verification email" in the body.
//
// What IS locatable in source is the header itself. The quick-link row is a
// fixed piece of chrome with no branches, it is always on screen whichever tab
// is open, and nothing in it is ever the action the page wants pressed.
{
  const settings = strip(read("src/components/settings/settings-control-center.tsx"));
  const row = /<div className="flex items-center gap-2">([\s\S]*?)<\/div>/.exec(settings)?.[1];
  if (!row) {
    fail("3 header", "the settings quick-link row has moved; this check has lost its subject");
  } else if (/KEY_COBALT|key-lit/.test(row)) {
    fail(
      "3 header",
      "the settings header carries a FILLED control again.\n" +
        "  It is always on screen, whichever tab is open, so a fill there competes with whatever the\n" +
        "  open section is actually asking for — measured on the built page as two blue fills, one\n" +
        "  of them a mundane Sign out.",
    );
  } else ok();
}

if (failures.length) {
  console.error(`\nhierarchy: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(
  `hierarchy OK — ${checks} assertions. No destructive control is filled; destruction reads as a red\n` +
    "  LABEL in --danger, a pigment measured on all four papers. `destructive` derives from `danger`\n" +
    "  instead of repeating it. The settings header carries no fill of its own.\n" +
    "  Does NOT cover: how many filled controls a VIEW renders — a file is not a view, and source\n" +
    "  cannot tell which controls appear together. That count belongs to a browser drive on a\n" +
    "  rendered page, which is where the two competing fills were actually found.",
);
