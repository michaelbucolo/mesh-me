/**
 * PIGMENT DISCIPLINE — raw Tailwind palette colors must not paint UI chrome.
 *
 * contrast-check proves the TOKEN palette; component-glass-check resolves
 * TRANSLUCENT (alpha) surfaces. Neither reads an OPAQUE Tailwind pigment
 * utility like `text-emerald-400` or `bg-slate-800` in component markup — and
 * that is exactly where a design audit found a class of status icons painted in
 * raw bright pigment (emerald/rose/amber) that fail the WCAG 3:1 graphical
 * floor on the light theme, plus one white-on-white monogram tile.
 *
 * A raw pigment on chrome is a value that bypasses theming: it does not track
 * the light/dark override the way `var(--success)` does, so it is the same
 * "two places state one fact, only one is taught the rule" failure this
 * codebase already fights everywhere else.
 *
 * This gate has two teeth:
 *   1. The files a design pass cleaned must STAY clean — zero pigment utilities.
 *   2. The rest of the app may not grow MORE pigment than it has today: the
 *      count is frozen at a budget and may only ratchet down, the same shape
 *      component-glass-check uses for its own budget.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

// Tailwind palette families that are pigment, not brand. `accent`/`paper`/`ink`
// are not Tailwind palettes here (they are token names), so they never match.
const PALETTE =
  "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|grey|zinc|neutral|stone";
// Solid-color prefixes only. Gradient stops (`from-`/`via-`/`to-`) and shadows
// are decorative fills where a fixed hue is often deliberate — a gold "#1" medal
// is gold in both themes — and they are not the invisible-in-light-mode chrome
// this gate exists to catch. Keeping the scope to text/bg/border/ring/fill/
// stroke/placeholder is what makes a hit unambiguously a theming bug.
const PIGMENT = new RegExp(`\\b(?:text|bg|border|fill|stroke|ring|placeholder)-(?:${PALETTE})-(?:50|[1-9]00|950)\\b`, "g");

/** Files a design pass cleaned; these must never regain a pigment utility. */
const MUST_BE_CLEAN = [
  "src/components/ui/toast.tsx",
  "src/app/verify-email/page.tsx",
  "src/components/analytics/pro-insights.tsx",
  "src/components/analytics/analytics-dashboard.tsx",
  "src/components/platform/platform-logo.tsx",
  "src/components/messages/mechat-info-rail.tsx",
];

/** Frozen ceiling for the rest of the app. Ratchet DOWN only. Set from a real
 *  count at introduction time; lowering it as pigment is migrated is expected. */
const BUDGET = 121; // frozen at today's count after the Tier-1 migration; ratchet DOWN only as more chrome moves to tokens.

/** Walk src/ for .ts/.tsx and count pigment matches per file. Pure Node — no
 *  spawned binary, so this gate has no external dependency to declare or miss. */
function pigmentFiles(): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "generated") continue;
        walk(full);
      } else if (/\.tsx?$/.test(entry.name)) {
        const hits = readFileSync(full, "utf8").match(new RegExp(PIGMENT.source, "g"));
        if (hits) counts.set(full.replace(`${ROOT}/`, ""), hits.length);
      }
    }
  };
  walk(join(ROOT, "src"));
  return counts;
}

const counts = pigmentFiles();
const failures: string[] = [];

for (const file of MUST_BE_CLEAN) {
  let src = "";
  try {
    src = readFileSync(`${ROOT}/${file}`, "utf8");
  } catch {
    failures.push(`${file}: cleaned file is missing — scanner is stale`);
    continue;
  }
  const hits = src.match(PIGMENT);
  if (hits) failures.push(`${file}: regained ${hits.length} raw pigment utilit(y/ies): ${[...new Set(hits)].slice(0, 6).join(", ")}`);
}

const total = [...counts.values()].reduce((a, b) => a + b, 0);
if (total > BUDGET) {
  const worst = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  failures.push(
    `pigment budget exceeded: ${total} raw palette utilities across src (ceiling ${BUDGET}). ` +
      `New chrome must use tokens (var(--success)/var(--danger)/var(--warning)/var(--accent)). Worst files:\n` +
      worst.map(([f, n]) => `    ${n}  ${f}`).join("\n"),
  );
}

if (failures.length) {
  console.error(`pigment-check FAILED\n`);
  for (const f of failures) console.error(`  ✗ ${f}\n`);
  process.exit(1);
}
console.log(`pigment OK — ${MUST_BE_CLEAN.length} cleaned files stay clean; ${total}/${BUDGET} palette utilities app-wide (ratchet-down only).`);
