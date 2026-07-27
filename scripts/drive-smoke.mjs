/**
 * "DOES IT ACTUALLY RENDER" — the cheapest useful question about a build.
 *
 * Every gate in `npm run check` reads source. None of them can see a page that
 * renders empty, a column that collapses, or a surface that never leaves its
 * loading state. This drives a built server and asserts each primary tab
 * reaches real content in both themes.
 *
 * It is deliberately NOT part of `npm run check`: those gates are static and
 * run without a server. Run this against a server you have already started.
 *
 *   npm run build && npx next start -p 3500 &
 *   npm run drive:smoke                       # or PORT=3500 npm run drive:smoke
 *
 * Readiness is "≥20 leaf elements carry real text", not a sleep. A fixed wait
 * is how you end up measuring a loading state and reporting it as a defect —
 * which has happened on this codebase more than once.
 */
import { drive } from "./drive.mjs";

const PORT = process.env.PORT || "3500";
const ROUTES = [
  ["Mesh", "/mesh"],
  ["Flow", "/flow"],
  ["MeChat", "/messages"],
  ["Explore", "/explore"],
  ["Profile", "/profile/alexcreates"],
];

const failures = [];
let checks = 0;

for (const theme of ["light", "dark"]) {
  let d;
  try {
    d = await drive({ theme, width: 1440, height: 900, port: PORT });
  } catch (error) {
    failures.push(`could not sign in (${theme}): ${error.message.split("\n")[0]}`);
    continue;
  }

  for (const [name, route] of ROUTES) {
    const ready = await d.go(route);
    if (!ready) {
      failures.push(`${name} (${route}, ${theme}) never rendered readable content`);
      continue;
    }

    // A tab that renders text but paints nothing you can act on is still broken.
    const controls = await d.page.evaluate(() => {
      let n = 0;
      for (const el of document.querySelectorAll("a[href], button, input, [role=button]")) {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        if (r.width > 8 && r.height > 8 && s.visibility !== "hidden" && s.display !== "none") n++;
      }
      return n;
    });
    if (controls < 5) {
      failures.push(`${name} (${route}, ${theme}) rendered text but only ${controls} usable controls`);
    } else checks += 1;
  }

  await d.browser.close();
}

if (failures.length) {
  console.error(`\ndrive-smoke: ${failures.length} failure(s) across ${checks + failures.length} tab renders\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(
  `drive-smoke OK — ${checks} tab renders. Every primary tab reaches real content and usable\n` +
    "  controls in both themes on a built server.\n" +
    "  Does NOT cover: whether what rendered is CORRECT. It answers only 'did anything arrive'.",
);
