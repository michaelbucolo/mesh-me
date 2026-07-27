/**
 * ARIA ROLES ARE PROMISES, AND THESE ONES WERE NOT KEPT.
 *
 * A role is not a label. `role="menu"` tells JAWS and NVDA to switch into
 * application mode and hand the arrow keys to the page; `role="tablist"` tells
 * them one Tab stop covers the set, arrows move within it, and there is a panel
 * to jump to. Announce either without implementing it and the assistive
 * technology teaches the user a navigation model that does nothing — which is
 * worse than plain buttons, because plain buttons at least behave as announced.
 *
 * Both shipped in this product:
 *
 *   dock.tsx          aria-haspopup="menu" + role="menu" + role="menuitem",
 *                     with no focus move on open, no roving tabindex, no
 *                     Arrow/Home/End handling, and Esc closing the layer without
 *                     returning focus. Plus a focusable role="button" span
 *                     nested inside a role="menuitem" button — invalid HTML,
 *                     invalid ARIA, and unreachable by keyboard in Safari.
 *
 *   explore           role="tablist" with four role="tab" children, no
 *                     role="tabpanel" anywhere, no aria-controls, no arrow keys,
 *                     and a non-tab button sitting inside the tablist.
 *
 * WHAT THIS FILE CHECKS, AND WHAT IT CANNOT
 *
 * It reads source. It cannot press a key or observe focus, so it cannot prove a
 * keyboard contract is implemented. What it CAN do is refuse the combination
 * that made the lie possible: a role may not be claimed unless the machinery it
 * promises is present in the same file. Where the machinery is hard to detect
 * honestly, the rule is the other direction — do not claim the role at all.
 *
 * That asymmetry is deliberate. "Prove you implemented a menu" is not something
 * a regex can judge. "You did not announce a menu" is.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
/** Comments blanked, not deleted, so offsets and this file's own prose survive. */
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

const DOCK = "src/components/mesh/ui/dock.tsx";
const EXPLORE = "src/app/(app)/explore/explore-discovery.tsx";

// ── 1. THE DOCK ANNOUNCES A DISCLOSURE, WHICH IS WHAT IT IS ─────────────────
//
// The choice between implementing the APG menu pattern and dropping the roles
// was decided by the New popover: its rows carry a per-row "mark seen" control,
// and a menu may not contain nested interactive content at all. Making the menu
// legal would have meant deleting a real feature. A disclosure — a button with
// aria-expanded showing a labelled group, where Tab moves through the contents —
// describes the component truthfully AND has room for the second control.
{
  const dock = strip(read(DOCK));

  for (const role of ['role="menu"', 'role="menuitem"', 'aria-haspopup="menu"']) {
    if (dock.includes(role)) {
      fail(
        "1 dock",
        `dock.tsx claims ${role}.\n` +
          "  A menu owes focus-on-open, a roving tabindex, Arrow/Home/End, and focus restored on\n" +
          "  close. None of that is here, and the New popover's per-row controls cannot legally live\n" +
          "  inside a menu anyway. This is a disclosure: aria-expanded + aria-controls on the trigger,\n" +
          "  a labelled group for the panel.",
      );
    } else ok();
  }

  // The disclosure's own contract, which IS detectable.
  for (const [needle, why] of [
    ["aria-expanded={expanded}", "the trigger must say whether its panel is open"],
    ["aria-controls={expanded === undefined ? undefined : popoverId}", "the trigger must point at the panel it opens"],
    ['role="group"', "the panel must be a labelled group, so it is announced as a unit"],
  ] as const) {
    if (!dock.includes(needle)) {
      fail("1 dock", `dock.tsx is missing \`${needle}\` — ${why}`);
    } else ok();
  }
}

// ── 2. THE DOCK MOVES FOCUS, IN BOTH DIRECTIONS ─────────────────────────────
//
// Opening moved no focus, so Enter on the trigger left the user on the trigger
// with a panel they could not reach. Closing moved none either: every row
// unmounts the button it lives on, so focus fell to <body> and the next Tab
// restarted from the top of the document.
//
// The worst case has no trigger to return to at all — marking the last unseen
// branch seen drives unseenTotal to 0, which unmounts the popover AND the key
// that opened it. So a fallback is not optional here, it is the common case.
{
  const dock = strip(read(DOCK));
  const popover = /function DockPopover\(\{[\s\S]*?\n\}\n/.exec(dock)?.[0] ?? "";
  if (!popover) {
    fail("2 dock focus", "DockPopover has moved; this check has lost its subject and would pass vacuously");
  } else {
    for (const [needle, why] of [
      [/querySelector<HTMLElement>\("button"\)\?\.focus\(\)/, "focus must move INTO the panel when it opens"],
      [/opener\?\.isConnected/, "focus must return to whatever opened the panel"],
      [/mesh-action-bar/, "and fall back to the dock when the trigger unmounted with the panel"],
    ] as const) {
      if (!needle.test(popover)) {
        fail("2 dock focus", `DockPopover has no focus contract: ${why}`);
      } else ok();
    }
  }
}

// ── 3. NO INTERACTIVE CONTENT INSIDE A BUTTON ───────────────────────────────
//
// `trailing` rendered inside PopRow's own <button>. A button may not contain
// interactive content; the row's accessible name, computed from contents, swept
// up the trailing control's aria-label and announced "Your posts · 3 new, Mark
// Your posts seen"; and Safari does not reliably focus a tabbable descendant of
// a button, so the action was unreachable by keyboard there.
{
  const dock = strip(read(DOCK));

  // A hand-rolled button is the tell: you write Enter/Space handling only when
  // the element cannot legally be a <button>, which is the bug itself.
  if (/role="button"[\s\S]{0,200}tabIndex=\{0\}/.test(dock)) {
    fail(
      "3 nesting",
      "dock.tsx has a focusable role=\"button\" element that is not a <button>.\n" +
        "  That shape exists to smuggle a control somewhere a real button is illegal — inside\n" +
        "  another button. Two actions are two sibling buttons.",
    );
  } else ok();

  const popRow = /function PopRow\(\{[\s\S]*?\n\}\n/.exec(dock)?.[0] ?? "";
  if (!popRow) {
    fail("3 nesting", "PopRow has moved; this check has lost its subject");
  } else {
    // The row's own <button> must close before `trailing` renders.
    const buttonClose = popRow.indexOf("</button>");
    const trailingAt = popRow.indexOf("{trailing}");
    if (trailingAt < 0) {
      fail("3 nesting", "PopRow no longer renders `trailing`; the mark-seen control has been dropped");
    } else if (buttonClose < 0 || trailingAt < buttonClose) {
      fail(
        "3 nesting",
        "PopRow renders `trailing` INSIDE its own <button> again.\n" +
          "  Invalid HTML and invalid ARIA, and it pollutes the row's accessible name with the\n" +
          "  trailing control's. The row is a container; the two actions are siblings.",
      );
    } else ok();
  }
}

// ── 4. EXPLORE'S TABS OWE PANELS, OR THEY ARE NOT TABS ──────────────────────
//
// role="tab" and role="tablist" promise a widget: one Tab stop for the set,
// arrows to move within it, and a panel each tab controls. Explore had the roles
// and none of the machinery — four separate Tab stops, arrows doing nothing, and
// no role="tabpanel" in the file for a screen reader's "go to panel" to target.
//
// Either the widget is real or the roles come off. This checks that whichever
// answer is chosen is CONSISTENT, because a half-built tab set is the only
// outcome that actively misleads.
{
  const explore = strip(read(EXPLORE));
  const claimsTabs = /role="tab"/.test(explore) || /role="tablist"/.test(explore);

  if (!claimsTabs) {
    // Roles dropped: nothing is promised, so nothing is owed.
    ok();
  } else {
    for (const [needle, why] of [
      [/role="tabpanel"/, "a tab with no panel leaves \"move to tab panel\" with nothing to find"],
      [/aria-controls=/, "each tab must name the panel it controls"],
      [/aria-labelledby=/, "each panel must point back at its tab"],
      [/ArrowRight|ArrowLeft/, "a tablist owes arrow-key movement; without it the roles describe a widget that is not there"],
      [/tabIndex=\{/, "a tab set is ONE tab stop — that needs a roving tabindex, not four focusable tabs"],
    ] as const) {
      if (!needle.test(explore)) {
        fail(
          "4 explore tabs",
          `explore-discovery.tsx claims tab roles but has no ${needle.source}: ${why}.\n` +
            "  Implement the pattern, or drop the roles — a half-built tab widget misleads worse than\n" +
            "  plain buttons, which at least behave the way they are announced.",
        );
      } else ok();
    }

    // EVERY PANEL, NOT JUST ONE. The rules above ask whether each attribute
    // appears at ALL, which a single correct panel satisfies for the whole file
    // — proved by mutation: stripping the role from one of the three sections
    // left the others matching and the gate green.
    //
    // The three parts of a panel are counted against each other instead. They
    // are written together or the count breaks, so a fourth section cannot be
    // added with two of the three.
    const roles = (explore.match(/role="tabpanel"/g) ?? []).length;
    const ids = (explore.match(/id="explore-tabpanel"/g) ?? []).length;
    const labels = (explore.match(/aria-labelledby=\{`explore-tab-/g) ?? []).length;
    if (roles < 3) {
      fail("4 explore tabs", `only ${roles} tabpanel(s); the tabs swap three distinct sections`);
    } else if (roles !== ids || roles !== labels) {
      fail(
        "4 explore tabs",
        `a panel is missing part of its wiring: ${roles} role="tabpanel", ${ids} id, ${labels} aria-labelledby.\n` +
          "  All three belong to every panel — a section with the role but no name, or a name with no\n" +
          "  role, is the half-built state this section exists to refuse.",
      );
    } else ok();
  }
}

// ── 5. A TILE'S NAME COMES FROM ITS CONTENTS ────────────────────────────────
//
// aria-label on a button OVERRIDES name-from-contents, and content inside a
// button is not separately navigable in NVDA/JAWS browse mode. The Explore tile
// carried `aria-label={\`Open post by ${authorName} in the Flow\`}`, which made
// the media alt AND the entire body of every text-only post unreachable: the
// whole grid announced the same sentence with a different name in it.
{
  const explore = strip(read(EXPLORE));
  // Read to the END OF THE OPENING TAG, not to a character budget. A bounded
  // look-ahead here found nothing once the comment above the tag grew past 400
  // characters, and reported "the subject has moved" for a subject that had not
  // — the same half-coverage failure the contrast gate hit with a bounded
  // look-ahead over --accent declarations.
  const tileAt = explore.indexOf('className="glass-card group relative block w-full');
  const tile = tileAt < 0 ? "" : explore.slice(tileAt, explore.indexOf(">", tileAt) + 1);
  if (!tile) {
    fail("5 tile name", "the Explore tile button has moved; this check has lost its subject");
  } else if (/aria-label=/.test(tile)) {
    fail(
      "5 tile name",
      "the Explore tile sets aria-label, which replaces everything inside it.\n" +
        "  The media alt and the post body stop being reachable, and every tile in the grid\n" +
        "  announces the same sentence. Prefix with a visually-hidden span instead, so the\n" +
        "  contents still contribute to the name.",
    );
  } else ok();

  if (!/<span className="sr-only">\{`Open post by/.test(explore)) {
    fail(
      "5 tile name",
      "the Explore tile no longer states its purpose at all. Without aria-label the name is the\n" +
        "  post, which is right, but a user still needs to know the tile OPENS it.",
    );
  } else ok();
}

if (failures.length) {
  console.error(`\naria: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(
  `aria OK — ${checks} assertions. The dock announces a disclosure and implements one: focus moves\n` +
    "  into the panel on open, back to the trigger on close, and to the dock when the trigger\n" +
    "  unmounted with it. No interactive content nests inside a button. Explore's tab roles are\n" +
    "  consistent with what it actually implements.\n" +
    "  Does NOT cover: whether the keyboard contract WORKS. This reads source; only a browser\n" +
    "  driving real keys can prove behaviour, which is what the PR's sweep is for.",
);
