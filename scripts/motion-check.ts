/**
 * THE HOUSE MOTION VOCABULARY — import, never re-tune.
 *
 * Slice 2 of the motion program consolidated ~20 drifted spring tunings onto
 * four house springs and made every EASE_OUT an import. This gate is the
 * ratchet: the retired tunings stay retired, the dead tokens stay dead, the
 * CSS twins stay in lockstep with the TS constants, and the deliberate holds
 * (Meshi anatomy, the two underdamped indicators) stay exactly as the owner
 * left them until the owner says otherwise.
 *
 * WHAT THIS CANNOT PROVE: that motion FEELS right — only that the vocabulary
 * stays consolidated and drift has to announce itself in a diff here.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const motionLib = read("src/lib/motion.ts");
const globals = read("src/app/globals.css");

function grepSrc(pattern: string, extra: string[] = []): string[] {
  try {
    return execFileSync(
      "grep",
      ["-rnE", pattern, "src", "--include=*.ts", "--include=*.tsx", ...extra],
      { encoding: "utf8" },
    ).split("\n").filter(Boolean);
  } catch {
    return []; // grep exits 1 on zero matches
  }
}

// ── 1. The vocabulary, exact ─────────────────────────────────────────────────
{
  for (const line of [
    "export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];",
    'export const SPRING_PANEL = { type: "spring" as const, stiffness: 360, damping: 30, mass: 0.8 };',
    'export const SPRING_HERO = { type: "spring" as const, stiffness: 220, damping: 26, mass: 0.7 };',
    'export const SPRING_SNAP = { type: "spring" as const, stiffness: 500, damping: 30 };',
    'export const SPRING_POP = { type: "spring" as const, stiffness: 460, damping: 38, mass: 0.7 };',
  ]) {
    if (!motionLib.includes(line)) {
      fail("1 vocabulary", `motion.ts lost or re-tuned a house constant: ${line.slice(13, 45)}...`);
    } else ok();
  }
}

// ── 2. CSS twins in lockstep ─────────────────────────────────────────────────
{
  for (const [token, value] of [
    ["--mesh-ease-out", "cubic-bezier(0.16, 1, 0.3, 1)"],
    ["--mesh-ease-press", "cubic-bezier(0.2, 0.8, 0.2, 1)"],
    ["--mesh-spring", "cubic-bezier(0.34, 1.56, 0.64, 1)"],
    ["--mesh-spring-lush", "cubic-bezier(0.22, 1.61, 0.36, 1)"],
  ] as const) {
    if (!globals.includes(`${token}: ${value}`)) {
      fail("2 twins", `${token} drifted from ${value} — the CSS and TS sides move together or not at all`);
    } else ok();
  }
}

// ── 3. EASE_OUT is an import, never an inline array ──────────────────────────
{
  const inline = grepSrc("\\[0\\.16, ?1, ?0\\.3, ?1\\]")
    .filter((l) => !l.startsWith("src/lib/motion.ts"));
  if (inline.length > 0) {
    fail("3 imports", `inline [0.16,1,0.3,1] arrays reappeared — import EASE_OUT instead:\n    ${inline.join("\n    ")}`);
  } else ok();
  // The near-miss twin: one framer transition at a time drifted onto
  // [0.22,1,0.36,1] because it LOOKS like the house ease. CSS keyframe
  // strings are a separate, deliberate family; the ban is on framer arrays.
  const nearMiss = grepSrc("ease: \\[0\\.22, ?1, ?0\\.36, ?1\\]");
  if (nearMiss.length > 0) {
    fail("3 imports", `the near-miss bezier is back in a framer transition:\n    ${nearMiss.join("\n    ")}`);
  } else ok();
}

// ── 4. Retired tunings stay retired ──────────────────────────────────────────
{
  // Every pair here had all of its call sites remapped onto a house spring.
  // A new use of one is drift by muscle memory — import the house spring, or
  // if a genuinely new feel is wanted, name it in motion.ts and gate it here.
  const retired = [
    "stiffness: 380, damping: 30", "stiffness: 420, damping: 30",
    "stiffness: 400, damping: 30", "stiffness: 380, damping: 32",
    "stiffness: 420, damping: 32", "stiffness: 360, damping: 34",
    "stiffness: 320, damping: 28", "stiffness: 320, damping: 30",
    "stiffness: 320, damping: 26", "stiffness: 360, damping: 30",
    "stiffness: 460, damping: 38", "stiffness: 520, damping: 40",
    "stiffness: 500, damping: 30",
  ];
  for (const pair of retired) {
    const hits = grepSrc(pair.replace(/([().])/g, "\\$1"))
      .filter((l) => !l.startsWith("src/lib/motion.ts"));
    if (hits.length > 0) {
      fail("4 retired", `${pair} re-tuned by hand:\n    ${hits.join("\n    ")}`);
    } else ok();
  }
}

// ── 5. The holds stay held ───────────────────────────────────────────────────
{
  // Owner taste calls, deliberately NOT consolidated. If one of these lines
  // changes, that is a decision for the owner to make in the open — update
  // this gate in the same diff, or the flattening is silent.
  if (!/stiffness: 520, damping: 18/.test(read("src/components/layout/mobile-nav.tsx"))) {
    fail("5 holds", "the mobile-nav underdamped pill (520/18) was consolidated or re-tuned — that is an owner taste call");
  } else ok();
  if (!/stiffness: 500, damping: 18, mass: 0\.6/.test(read("src/components/messages/mechat-thread.tsx"))) {
    fail("5 holds", "the MeChat reply swing (500/18/0.6) was consolidated or re-tuned — that is an owner taste call");
  } else ok();
  // Anatomy tuning is free to evolve with the character; what it must never
  // do is borrow the UI-chrome vocabulary. The ratchet is the import.
  if (/@\/lib\/motion/.test(read("src/components/meshi/meshi-mascot.tsx"))) {
    fail("5 holds", "meshi-mascot.tsx imports the house motion vocabulary — character physics are anatomy, not UI chrome");
  } else ok();
}

// ── 6. The press ─────────────────────────────────────────────────────────────
{
  if (!/\.mesh-ctl:active\s*\{[^}]*transform: scale\(0\.97\)/.test(globals)) {
    fail("6 press", ".mesh-ctl lost its :active press");
  } else ok();
  if (!/\.mesh-ctl\s*\{[^}]*transform 0\.14s var\(--mesh-ease-press\)/.test(globals)) {
    fail("6 press", "the .mesh-ctl transition no longer eases transform with --mesh-ease-press");
  } else ok();
}

// ── 7. Dead tokens stay dead ─────────────────────────────────────────────────
{
  for (const token of ["--mesh-ease-spring", "--mesh-spring-soft", "--mesh-ease-swift", "--mesh-ease-glide"]) {
    const defined = globals.includes(`${token}:`);
    const used = grepSrc(`var\\(${token.replace(/-/g, "\\-")}\\)`, ["--include=*.css"]).length > 0
      || globals.includes(`var(${token})`);
    if (defined || used) {
      fail("7 dead", `${token} was resurrected — it retired with zero call sites; use the living vocabulary`);
    } else ok();
  }
}

if (failures.length) {
  console.error(`\nmotion: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`motion: all ${checks} assertions passed — one vocabulary, imported everywhere, drift must announce itself.`);
