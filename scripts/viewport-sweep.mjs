// WHAT FALLS OFF THE SIDE OF A PHONE, AND WHY THE OBVIOUS CHECKS DON'T FIND IT.
//
// ── WHY THIS IS A SCRIPT AND NOT PART OF `npm run check` ────────────────────
//
// It drives a real browser against a running server. `npm run check` is almost
// entirely static analysis; its one live-server member (`diagnostics`) already
// carries the "server not reachable" skip path. Bolting a Playwright sweep onto
// that chain would make every local `check` depend on someone having started a
// server on the right port first.
//
// AND IT IS NOT WIRED INTO CI YET, WHICH IS A GAP, NOT A DESIGN. Two things
// have to be solved first and neither is solved by pretending:
//
//   - The GitHub runner has no /opt/pw-browsers, so the workflow would need
//     `npx playwright install chromium` — a couple of minutes and a new
//     failure surface on every run.
//   - Without a session the sweep can only reach public routes. The app shell
//     it exists to measure lives behind auth, and mesh.me's sign-in is a
//     two-step entry flow, so CI would need to drive that form. Sweeping /login
//     nine times and reporting success would be worse than not running.
//
// Until both are done, this runs by hand:
//
//     npm run viewport:sweep          # public routes, no session needed
//     VIEWPORT_SWEEP_AUTH=auth.json VIEWPORT_SWEEP_URL=http://localhost:3508 \
//       node scripts/viewport-sweep.mjs   # the app shell, with a saved session
//
// ── FOUR MEASUREMENTS THAT LOOK RIGHT AND ARE NOT ───────────────────────────
//
// Every one of these was written, run, and thrown away. They are recorded so
// nobody rebuilds one believing it works.
//
//   1. "does the document scroll sideways?"
//      MISSES THE BUG ENTIRELY. The app shell clips. With a header 34px wider
//      than its container, the document reported scrollWidth 370 of clientWidth
//      375 — no overflow, nothing to see — while the Refresh button sat off the
//      right edge of the screen. Measured, twice: this shape broke Settings,
//      then broke the connect page.
//
//   2. "flag every element whose right edge passes the viewport"
//      DROWNS IN CAROUSELS. A horizontal scroller is SUPPOSED to have children
//      past the edge. Explore alone produces 34 across nine viewports and every
//      single one is correct behaviour.
//
//   3. "...but exempt anything inside an overflow-x: auto ancestor"
//      EXEMPTS EVERYTHING. Per CSS Overflow §3, when overflow-y is `auto` and
//      overflow-x is `visible`, the used value of overflow-x becomes `auto`. So
//      the main scroll container reports `auto`, and a runaway element certifies
//      its own container as a carousel.
//
//   4. "...then require the ancestor to be genuinely scrollable
//       (scrollWidth > clientWidth), so a promoted-but-idle container can't
//       launder anything"
//      CIRCULAR, AND IT PASSED THE BUG. This one is subtle enough that it was
//      written, shipped into this file, and only caught by re-introducing the
//      known defect and watching the sweep report OK. The runaway element is
//      what MAKES the ancestor scrollable — .mesh-content measured scrollWidth
//      409 against clientWidth 370 precisely BECAUSE the 409px header was
//      inside it. The element manufactures its own alibi.
//
// ── THE MEASUREMENT THAT SURVIVES ───────────────────────────────────────────
//
// Stop asking about the element. Ask what a scroller is FOR.
//
//   A horizontal scroller ABSORBS overflow. That is its entire job: children
//   run past its edge and stop there, and the container's own box still fits
//   its parent. A layout bug does the opposite — it PROPAGATES outward, pushing
//   every ancestor wide until something clips it.
//
// So the question is not "is this element too wide" but "did horizontal
// overflow escape every scroller that was supposed to contain it and reach the
// app's scroll root?" Measured at 375px:
//
//     /explore    (6 carousels)  .mesh-content  scrollWidth 370 == clientWidth 370   contained
//     /feed                      .mesh-content  scrollWidth 370 == clientWidth 370   contained
//     /settings                  .mesh-content  scrollWidth 370 == clientWidth 370   contained
//     /connected-accounts (bug)  .mesh-content  scrollWidth 409 >  clientWidth 370   ESCAPED
//
// One number per page, no guessing about intent, and carousels need no
// exemption because they never trip it in the first place.
//
// The per-element listing below is DIAGNOSTIC ONLY — it names what caused the
// escape once an escape has been detected. It is never the pass/fail signal,
// which is what went wrong in attempts 2 through 4.

import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.env.VIEWPORT_SWEEP_URL || "http://localhost:3000";
const AUTH = process.env.VIEWPORT_SWEEP_AUTH || "";
const ONLY = (process.env.VIEWPORT_SWEEP_ROUTES || "").split(",").map((r) => r.trim()).filter(Boolean);

// Browser resolution, in order: an explicit override, this container's
// pre-installed Chromium, then Playwright's own download. Hardcoding the
// container path would make the script work only on the machine it was
// written on — which is most of the way to not existing.
function resolveChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM) return process.env.PLAYWRIGHT_CHROMIUM;
  if (existsSync("/opt/pw-browsers/chromium")) return "/opt/pw-browsers/chromium";
  return undefined; // let Playwright find the browser it installed
}

// Sub-pixel layout routinely lands a fraction over. 1.5px is below anything a
// person can see and well under the 16px+ escapes real bugs produce.
const SLACK = 1.5;

// The chain of containers between the viewport and the route's content. An
// overflow reaching ANY of these escaped every scroller meant to hold it.
// Anything below them — a carousel, a code block, a wide table in its own
// scroller — is free to be as wide as it likes.
const SCROLL_ROOTS = [".mesh-content", ".mesh-main", "main"];

// The narrowest thing anyone holds, and the shapes it unfolds into. The fold
// cover screen is first deliberately: 344px is the width that breaks things.
const VIEWPORTS = [
  { name: "Fold cover", w: 344, h: 882 },
  { name: "iPhone SE", w: 375, h: 667 },
  { name: "iPhone 15 Pro", w: 393, h: 852 },
  { name: "iPhone 15 Pro Max", w: 430, h: 932 },
  { name: "iPad mini", w: 744, h: 1133 },
  { name: "Fold open", w: 768, h: 1076 },
  { name: "iPad Pro 11", w: 834, h: 1194 },
  { name: "iPad landscape", w: 1366, h: 1024 },
  { name: "Desktop", w: 1440, h: 900 },
];

// Without a session every app route redirects to /login, and sweeping the
// login page nine times would report a confident, meaningless pass. So the
// default route set follows what this run can actually reach.
const PUBLIC_ROUTES = ["/", "/login", "/about", "/features", "/privacy", "/terms", "/trust"];
const APP_ROUTES = [
  "/connected-accounts",
  "/settings",
  "/analytics",
  "/explore",
  "/feed",
  "/profile",
  "/notifications",
  "/privacy-controls",
  "/meshpro",
];
const ROUTES = ONLY.length > 0 ? ONLY : AUTH ? APP_ROUTES : PUBLIC_ROUTES;

/** Runs inside the page. */
function probe({ slack, roots }) {
  const de = document.documentElement;
  const viewportW = de.clientWidth;

  // ── The verdict: did overflow escape to a scroll root? ────────────────────
  const escapes = [];
  let rootsFound = 0;
  for (const sel of roots) {
    const el = document.querySelector(sel);
    if (!el) continue;
    rootsFound += 1;
    const escaped = el.scrollWidth - el.clientWidth;
    if (escaped > slack) {
      escapes.push({ selector: sel, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, by: Math.round(escaped) });
    }
  }
  const docEscape = de.scrollWidth - de.clientWidth;
  if (docEscape > slack) {
    escapes.push({ selector: ":root", scrollWidth: de.scrollWidth, clientWidth: de.clientWidth, by: Math.round(docEscape) });
  }

  // ── Diagnosis: only computed once something escaped. ──────────────────────
  const describe = (el) => {
    const id = el.id ? `#${el.id}` : "";
    const cls = typeof el.className === "string" && el.className
      ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
      : "";
    return `${el.tagName.toLowerCase()}${id}${cls}`.slice(0, 88);
  };

  const causes = [];
  if (escapes.length > 0) {
    const recorded = [];
    for (const el of document.body.querySelectorAll("*")) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") continue;
      // Viewport-pinned decoration (the custom cursor, glow layers) legitimately
      // sits against the edge and cannot be interacted with.
      if (style.position === "fixed" && style.pointerEvents === "none") continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.right - viewportW <= slack) continue;
      // Document order means an ancestor already recorded comes first. A clipped
      // header drags every descendant with it; listing them buries the cause.
      if (recorded.some((prev) => prev.contains(el))) continue;
      recorded.push(el);
      causes.push({
        el: describe(el),
        width: Math.round(rect.width),
        over: Math.round(rect.right - viewportW),
        tooWideToFit: rect.width > viewportW + slack,
        text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 44),
      });
    }
  }

  return { viewportW, rootsFound, escapes, causes };
}

async function main() {
  if (AUTH && !existsSync(AUTH)) {
    console.error(`viewport-sweep: auth state ${AUTH} does not exist`);
    process.exit(2);
  }

  const executablePath = resolveChromium();
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext(AUTH ? { storageState: JSON.parse(readFileSync(AUTH, "utf8")) } : {});
  const page = await context.newPage();

  const failures = [];
  let checked = 0;
  let rootsSeen = 0;

  for (const route of ROUTES) {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      try {
        // `domcontentloaded`, never `networkidle`: this app holds a presence
        // stream open, so networkidle never fires and every route times out.
        await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForTimeout(1200);
      } catch {
        console.log(`  ??   ${route} @ ${vp.name} — did not load`);
        continue;
      }
      checked += 1;

      const r = await page.evaluate(probe, { slack: SLACK, roots: SCROLL_ROOTS });
      rootsSeen += r.rootsFound;

      if (r.escapes.length === 0) {
        console.log(`  ok   ${route} @ ${vp.name} (${vp.w}px)`);
        continue;
      }

      failures.push({ route, vp: vp.name, ...r });
      const worst = r.escapes[0];
      console.log(
        `  FAIL ${route} @ ${vp.name} (${vp.w}px) — overflow escaped to ${worst.selector} ` +
          `by ${worst.by}px (scrollWidth ${worst.scrollWidth} vs clientWidth ${worst.clientWidth})`,
      );
      for (const c of r.causes.slice(0, 3)) {
        console.log(`         ${c.el}  width ${c.width}px, ${c.over}px past the edge${c.tooWideToFit ? " — cannot fit at all" : ""}`);
        if (c.text) console.log(`           "${c.text}"`);
      }
    }
  }

  await browser.close();
  console.log("");

  // A check that reads an empty set passes everything. If the shell is renamed,
  // every page silently has "no scroll root" and every page silently passes.
  if (checked > 0 && rootsSeen === 0) {
    console.error(
      `viewport-sweep: none of ${SCROLL_ROOTS.join(", ")} matched on any page.\n` +
        "  The app shell has been renamed, so this sweep measured nothing and would have\n" +
        "  reported success for a completely broken layout. Update SCROLL_ROOTS.",
    );
    process.exit(1);
  }

  if (failures.length > 0) {
    console.error(`viewport-sweep: ${failures.length} of ${checked} route×viewport combinations leak horizontally.\n`);
    for (const f of failures) {
      console.error(`  ${f.route} @ ${f.vp} — escaped to ${f.escapes.map((e) => `${e.selector} +${e.by}px`).join(", ")}`);
      for (const c of f.causes.slice(0, 2)) console.error(`      ${c.el} (${c.width}px wide)`);
    }
    console.error(
      "\n  This is not cosmetic. Overflow that escapes the scrollers is clipped by the shell,\n" +
        "  so the document reports NO overflow, nothing scrolls, nothing warns — the control is\n" +
        "  simply off the screen. The usual cause is a grid whose single implicit column is\n" +
        "  sized `auto`, which never shrinks below its widest child's min-content width.\n" +
        "  `grid-cols-[minmax(0,1fr)]` caps it. On a flex row, `min-w-0` on the shrinking item.",
    );
    process.exit(1);
  }

  console.log(
    `viewport-sweep: ${checked} route×viewport combinations, ${ROUTES.length} routes × ${VIEWPORTS.length} widths\n` +
      "  from a 344px fold cover to 1440px. Horizontal overflow is contained by its scrollers\n" +
      "  on every one — carousels scroll, and nothing escapes to the app shell to be clipped.",
  );
}

main().catch((error) => {
  console.error("viewport-sweep failed to run:", error?.message || error);
  process.exit(2);
});
