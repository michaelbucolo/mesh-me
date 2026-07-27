/**
 * A GROUPED LIST IS ONE CONTAINER, NOT A CARD INSIDE A CARD.
 *
 * Apple's inset grouped list — what Settings.app is built from — has three
 * properties, and this page had none of them. Photographed at 1440x900 in both
 * themes:
 *
 *   1. ONE container per section. `section.settings-panel.plate` (white, 1px
 *      --rule, 20px radius, contact shadow) held `section.settings-card.plate`
 *      (white, 1px --rule, 20px radius, contact shadow) inset 17px on every
 *      side. Two identical cards, one inside the other, for one section. A
 *      sweep of eleven authenticated routes found this nesting on /settings and
 *      nowhere else, so it is a local defect rather than a house style.
 *
 *   2. A HAIRLINE between neighbouring rows, inset to the label. `.settings-row`
 *      measured `border-bottom-width: 0px`; the four rows of Account details
 *      floated with a 0.7rem radius each and nothing joining them.
 *
 *   3. The section header on the BACKGROUND, above the container — not inside
 *      it. Inside, it makes the container a titled box; outside, it makes the
 *      container a section of the page. That distinction is why (1) happened.
 *
 * AND ONE THING THIS FILE EXISTS TO STOP HAPPENING TWICE. The destructive icon
 * tile was a crimson face with a pinned white glyph — a measured pair. Making
 * the destructive ROW a red label (which was right) added a rule that repainted
 * the tile's glyph --danger while leaving its face crimson: 1.16:1 in daylight,
 * 2.53:1 in worklight, photographed as a blank crimson square. A pinned pair is
 * only safe while nothing outside repaints half of it. The tile must therefore
 * not own a face the contrast gate has never measured it against.
 *
 * WHAT THIS CANNOT DO: see the rendered page. Nesting, separators and header
 * placement are all checked from the source that produces them; the photographs
 * that motivated each rule were taken by hand against a built server.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length))
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, (m) => " ".repeat(m.length));

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => {
  checks += 1;
};

const css = strip(read("src/app/globals.css"));
const settings = strip(read("src/components/settings/settings-control-center.tsx"));

/** Body of a top-level rule whose selector list matches exactly, ignoring any
 *  copy of it that lives inside an `@media`. Nesting an override is legitimate;
 *  what these rules assert is what the element gets by default. */
function ruleBody(selector: string): string | null {
  const needle = selector + " {";
  let from = 0;
  for (;;) {
    const at = css.indexOf(needle, from);
    if (at === -1) return null;
    // Count unbalanced `{` before this point: a top-level rule has zero.
    const before = css.slice(0, at);
    const depth = (before.match(/\{/g) ?? []).length - (before.match(/\}/g) ?? []).length;
    if (depth === 0) {
      const close = css.indexOf("}", at);
      return close === -1 ? null : css.slice(at + needle.length, close);
    }
    from = at + needle.length;
  }
}

/** `padding: var(--sp-3)` / `margin-inline: calc(var(--sp-3) * -1)` → "sp-3". */
function spacingToken(decl: string): string | null {
  return /var\(--(sp-\d+)\)/.exec(decl)?.[1] ?? null;
}

// ── 1. ONE CONTAINER PER SECTION ────────────────────────────────────────────
//
// `.plate` is fill + rule + radius + contact shadow. A `.plate` whose ancestor
// is also a `.plate` of the same fill draws the same box twice. The panel is
// the background the sections sit ON, so it is the one that gives up the card.
{
  const panel = /className=\{`settings-panel([^`]*)`/.exec(settings)?.[1];
  if (panel === undefined) {
    fail("1 one container", "the `.settings-panel` element has moved; this check has lost its subject");
  } else if (/\bplate\b/.test(panel)) {
    fail(
      "1 one container",
      "`.settings-panel` carries `plate` again, so every section inside it is a card inside a card.\n" +
        "  Both were measured on the built page at the identical fill, 1px --rule, 20px radius and\n" +
        "  contact shadow, 17px apart. The detail side of a split view is the BACKGROUND that grouped\n" +
        "  sections sit on; it is not itself one of them.",
    );
  } else ok();

  // And the section must still be a card — dropping both leaves nothing to group.
  //
  // `(?![-\w])` is load-bearing and this file did not have it on the first run:
  // `settings-card` is a PREFIX of `settings-card-heading`, which appears first
  // in the component, so the bare spelling matched the heading and both rules
  // below reported a defect in correct code. The same prefix mistake is why
  // section 2's `indexOf` needed the quote-anchored spelling.
  const card = /<div className="settings-card(?![-\w])([^"]*)">/.exec(settings)?.[1];
  if (card === undefined) {
    fail("1 one container", "the `.settings-card` container is gone; a grouped list needs a container");
  } else if (!/\bplate\b/.test(card)) {
    fail(
      "1 one container",
      "`.settings-card` no longer carries `plate`, so the rows have no container at all.\n" +
        "  The fix for a card inside a card is to remove the OUTER one, not both.",
    );
  } else ok();
}

// ── 2. THE HEADER IS THE CONTAINER'S SIBLING ────────────────────────────────
//
// Inside the container, the header makes it a titled box, and a titled box
// inside a panel is what produced section 1's nesting. Outside, on the
// background, the container becomes a section of the page.
{
  const group = /<section className="settings-group">([\s\S]*?)<\/section>/.exec(settings)?.[1];
  if (!group) {
    fail("2 header outside", "`SettingsCard` no longer renders a `.settings-group`; this check has lost its subject");
  } else {
    const headingAt = group.indexOf("settings-card-heading");
    const cardAt = /"settings-card(?![-\w])/.exec(group)?.index ?? -1;
    if (headingAt === -1 || cardAt === -1) {
      fail("2 header outside", "`.settings-group` no longer holds both a heading and a `.settings-card`");
    } else if (headingAt > cardAt) {
      fail("2 header outside", "the section header now follows its container; a grouped list's header sits above it");
    } else {
      // The heading must not be INSIDE the container — i.e. the container must
      // open after the heading's element has closed.
      const headingClose = group.indexOf("</div>", headingAt);
      if (headingClose === -1 || headingClose > cardAt) {
        fail(
          "2 header outside",
          "the section header is nested inside `.settings-card` again.\n" +
            "  A header inside its container makes the container a titled BOX, and a titled box on a\n" +
            "  panel is a card inside a card — which is exactly how this page got there.",
        );
      } else ok();
    }
  }
}

// ── 3. FULL BLEED IS TWO NUMBERS THAT MUST AGREE ────────────────────────────
//
// The card takes a padding; the list gives exactly that padding back as a
// negative margin; the row pads by exactly that much again so its label lands
// where the card's own padding would have put it. Three spellings of one
// measurement — the shape this codebase is bitten by — kept only because this
// section reads all three and fails the moment they diverge.
{
  const cardPad = spacingToken(ruleBody(".settings-card") ?? "");
  const listMargin = ruleBody(".settings-list") ?? "";
  const rowPad = ruleBody(".settings-row") ?? "";

  if (!cardPad) {
    fail("3 full bleed", "`.settings-card` no longer pads with an `--sp-*` token; the three numbers cannot be compared");
  } else ok();

  const negative = /margin-inline:\s*calc\(\s*var\(--(sp-\d+)\)\s*\*\s*-1\s*\)/.exec(listMargin)?.[1];
  if (!negative) {
    fail(
      "3 full bleed",
      "`.settings-list` no longer negates the card's padding, so its rows stop short of the container\n" +
        "  edge and the separators float in from both sides. That is the stack of outlined boxes this\n" +
        "  replaced, drawn with hairlines instead of borders.",
    );
  } else if (cardPad && negative !== cardPad) {
    fail(
      "3 full bleed",
      `\`.settings-card\` pads by --${cardPad} but \`.settings-list\` gives back --${negative}.\n` +
        "  Full bleed means the row hands back exactly what the card took; these no longer agree.",
    );
  } else ok();

  const rowInline = /padding:\s*[^;]*?\bvar\(--(sp-\d+)\)/.exec(rowPad)?.[1];
  if (!rowInline) {
    fail("3 full bleed", "`.settings-row` no longer pads its inline axis with an `--sp-*` token");
  } else if (cardPad && rowInline !== cardPad) {
    fail(
      "3 full bleed",
      `\`.settings-card\` pads by --${cardPad} but \`.settings-row\` re-pads by --${rowInline}.\n` +
        "  The row's label then sits somewhere the section header above it does not.",
    );
  } else ok();

  // A row inside a group has no corners of its own; the group's are the group's.
  if (/border-radius:/.test(rowPad)) {
    fail(
      "3 full bleed",
      "`.settings-row` has a border-radius again. A full-bleed row cannot be rounded — it would round\n" +
        "  against the container's own edge, and it is what made these four labels read as four boxes.",
    );
  } else ok();
}

// ── 4. ONE SEPARATOR, DRAWN ONE WAY, BY A CLASS SOMETHING ACTUALLY WEARS ────
//
// `.leaf` is this design system's word for a row in a group, and it was applied
// to NOTHING — nine comments in globals.css described markup as "a .tray of
// .leaf rows", shape-check asserted the dead rule had no side wall, and not one
// element in src/ carried the class. So each surface invented its own line: the
// settings list a `+ ::before`, analytics a Tailwind `divide-y` in a different
// pigment, and the analytics security checklist nothing at all.
//
// A documented idiom that nothing uses is worse than no idiom: the comments go
// on asserting a shape the product does not have, and the next surface invents
// a fourth spelling. So this section checks BOTH that the mechanism is single
// and that it is worn.
{
  const sep = ruleBody(".leaf + .leaf::before");
  if (!sep) {
    fail(
      "4 one separator",
      "`.leaf + .leaf::before` is gone — the one hairline. Before it existed, `.settings-row` measured\n" +
        "  `border-bottom-width: 0px` on the built page and its group read as four labels adrift in a\n" +
        "  white box, while analytics drew two different lines in two different pigments.",
    );
  } else {
    if (!/border-top:[^;]*var\(--rule\)/.test(sep)) {
      fail("4 one separator", "the row separator no longer draws in `--rule`, the one hairline pigment");
    } else ok();
    if (!/inset-inline:\s*var\(--leaf-inset,\s*0\)\s+0/.test(sep)) {
      fail(
        "4 one separator",
        "the separator no longer runs from `--leaf-inset` to the trailing edge.\n" +
          "  A hairline inset on BOTH sides reads as an underline under each row, not as a join; and the\n" +
          "  inset has to be a property so a surface can align it to a label without a second rule.",
      );
    } else ok();
  }

  // Written `+` so the last row needs no special case and a trailing paragraph
  // or button closes the list cleanly.
  if (/\.leaf:last-child|\.settings-row:last-child/.test(css)) {
    fail(
      "4 one separator",
      "a `:last-child` special case is back. The separator belongs to the row BELOW it (`+`), which is\n" +
        "  what lets a list end in a paragraph, a button or an empty state without the rule knowing.",
    );
  } else ok();

  // No second implementation of the same line, in CSS or in a utility class.
  if (/\.settings-row\s*\+\s*\.settings-row/.test(css)) {
    fail("4 one separator", "`.settings-row` draws its own hairline again alongside `.leaf`'s — two spellings, one line");
  } else ok();

  const divideUsers: string[] = [];
  for (const file of [...walk(join(ROOT, "src"))].filter((f) => f.endsWith(".tsx"))) {
    if (/\bdivide-y\b/.test(strip(readFileSync(file, "utf8")))) divideUsers.push(file.slice(ROOT.length + 1));
  }
  if (divideUsers.length) {
    fail(
      "4 one separator",
      `Tailwind \`divide-y\` draws row separators again in: ${divideUsers.join(", ")}.\n` +
        "  It last did so as `divide-[var(--border-primary)]/60` — a pigment neither `--rule` nor\n" +
        "  anything the contrast gate measures, on a list sitting beside another list drawn in --rule.",
    );
  } else ok();

  // AND IT MUST BE WORN. This is the assertion whose absence let the idiom die.
  const wearers: string[] = [];
  for (const file of [...walk(join(ROOT, "src"))].filter((f) => f.endsWith(".tsx"))) {
    const body = strip(readFileSync(file, "utf8"));
    if (/className=[^>]*["'`\s]leaf[\s"'`]/.test(body)) wearers.push(file.slice(ROOT.length + 1));
  }
  if (wearers.length < 2) {
    fail(
      "4 one separator",
      `\`.leaf\` is worn by ${wearers.length} file(s). It was worn by ZERO for long enough that three\n` +
        "  surfaces each invented their own separator while nine comments went on calling it the idiom.\n" +
        "  A class nothing uses does not document a shape — it misdescribes one.",
    );
  } else ok();
}

// ── 5. THE DESTRUCTIVE TILE OWNS NO FACE ────────────────────────────────────
//
// This is the one that shipped broken. The tile pinned crimson + white — a
// measured pair — and a rule elsewhere repainted the ink alone. The pair is
// only safe while nothing outside touches half of it, so the tile stops owning
// a face and takes a pigment the contrast gate already measures on papers.
{
  const tile = ruleBody(".settings-icon-tile-danger");
  if (tile === null) {
    fail("5 destructive tile", "`.settings-icon-tile-danger` is gone; this check has lost its subject");
  } else {
    if (/background/.test(tile)) {
      fail(
        "5 destructive tile",
        "`.settings-icon-tile-danger` owns a face again.\n" +
          "  It last did so as --mould-crimson with a pinned white glyph, and the row's red LABEL colour\n" +
          "  then cascaded onto the glyph and left it at 1.16:1 — the trash icon photographed as a blank\n" +
          "  crimson square. A mould's ink is only ever measured against its own face; a --paper is\n" +
          "  measured against every pigment the contrast gate knows.",
      );
    } else ok();
    if (!/color:\s*var\(--danger\)/.test(tile)) {
      fail(
        "5 destructive tile",
        "the destructive tile no longer takes --danger.\n" +
          "  It must wear the same pigment as the label beside it: one fact, one definition, and that\n" +
          "  pigment is measured on all four papers.",
      );
    } else ok();
  }

  // And nothing may repaint the tile from outside — that restatement at (0,2,0)
  // is precisely what outranked the tile's own (0,1,0) pinning.
  if (/\.settings-action-danger\s+\.settings-icon-tile/.test(css)) {
    fail(
      "5 destructive tile",
      "`.settings-action-danger` reaches in and repaints `.settings-icon-tile` again.\n" +
        "  That descendant rule sits at (0,2,0) and outranks the tile's own (0,1,0), so the tile gets an\n" +
        "  ink chosen for the ROW and a face chosen for the TILE — a pair nobody measured together.\n" +
        "  The row already sets `color: var(--danger)`; currentColor carries it to every glyph that does\n" +
        "  not pin its own.",
    );
  } else ok();
}

if (failures.length) {
  console.error(`\ngrouped-list: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(
  `grouped-list OK — ${checks} assertions. One container per section, not a card inside a card. The\n` +
    "  section header sits on the background above its container. Full bleed is three spellings of one\n" +
    "  measurement and all three are read here. Neighbouring rows are joined by a hairline that starts\n" +
    "  at the label, so the icons read as a column. The destructive tile owns no face of its own —\n" +
    "  which is what let something outside repaint half of a measured pair down to 1.16:1.\n" +
    "  Does NOT cover: the rendered page. Every rule here was motivated by a photograph taken by hand.",
);
