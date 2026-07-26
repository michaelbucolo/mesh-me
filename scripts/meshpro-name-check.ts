/**
 * MESHPRO IS ONE WORD.
 *
 * Never "Mesh Pro". The product is written MeshPro everywhere a person can read
 * it, and everywhere a contributor can copy it from — comments and docs
 * included, because prose is where the two-word form kept coming back.
 *
 * WHAT THIS DELIBERATELY ALLOWS, and why an allowance exists at all:
 *
 *   src/lib/stripe.ts carries `label: "Mesh Pro Monthly"` / `"Mesh Pro Yearly"`.
 *   Those two strings mirror the product names configured in the STRIPE
 *   DASHBOARD, which is outside this repo. They are never rendered — the object
 *   is read for .envKey and .paymentLinkEnvKey, never .label — so respelling
 *   them changes nothing a user sees while silently desyncing the code from what
 *   Stripe prints on the invoice. The rename that matters there is in the Stripe
 *   Dashboard and, for native iOS, App Store Connect. The allowance is narrow on
 *   purpose: those exact two lines in that one file, nothing else.
 *
 * WHAT IT MUST NOT BREAK — checked_here so a future normalising sweep cannot:
 *
 *   `product: "meshpro"` (api/stripe/checkout/route.ts) is already one word and
 *   LOWERCASE, and is written onto live Stripe Checkout Sessions and
 *   Subscriptions. Case-correcting it to "MeshPro" would break reconciliation
 *   against sessions already created. This file asserts it stays lowercase.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

/** The one file+line pair allowed to keep the two-word form. See the docblock. */
const SELF = "scripts/meshpro-name-check.ts";
/** Explicit opt-out for prose explaining the defect. Capped, and greppable. */
const ALLOW_MARKER = "MESHPRO-NAME-ALLOW";
const MAX_ALLOWANCES = 8;
const STRIPE_DASHBOARD_MIRROR = "src/lib/stripe.ts";
const ALLOWED_MIRROR_LINES = new Set(['label: "Mesh Pro Monthly",', 'label: "Mesh Pro Yearly",']);

const SEARCH_ROOTS = ["src", "scripts", "prisma", "docs"];
const SEARCH_FILES = [".env.example", "README.md", "STORE_READINESS.md"];
const SKIP_DIRS = new Set(["src/generated", "node_modules", ".next"]);
const EXT = /\.(tsx?|jsx?|mjs|cjs|css|md|prisma|example)$|(^|\/)\.env\.example$/;

function walk(dir: string, out: string[] = []): string[] {
  if (SKIP_DIRS.has(dir)) return out;
  let entries: string[];
  try { entries = readdirSync(join(ROOT, dir)); } catch { return out; }
  for (const entry of entries) {
    const rel = `${dir}/${entry}`;
    if (SKIP_DIRS.has(rel)) continue;
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (EXT.test(rel)) out.push(rel);
  }
  return out;
}

const files = [...SEARCH_ROOTS.flatMap((d) => walk(d)), ...SEARCH_FILES];

// ── 1. No two-word form anywhere, in any case ────────────────────────────────
//
// Case-insensitive and whitespace-tolerant: "Mesh  Pro", "mesh pro" and a
// newline between the words are all the same defect. The JSX-split forms
// (Mesh{" "}Pro, Mesh&nbsp;Pro) are how this comes back after a naive sweep, so
// they are named explicitly rather than left to the general pattern.
{
  // The \b on both sides is load-bearing. Without the trailing one this matched
  // "Mesh protects you" (trust/page.tsx:163) and "a mesh profile"
  // (feed-data.ts:109) — two false positives on the gate's first run, which is
  // exactly how a gate teaches people to ignore it. The character class keeps a
  // literal NBSP alongside \s so "Mesh\u00a0Pro" is caught as the same defect.
  const TWO_WORD = /\bmesh[\s ]+pro\b/gi;
  const JSX_SPLIT = /Mesh\{["'`]\s["'`]\}Pro|Mesh&nbsp;Pro/g;
  let offenders = 0;
  let allowances = 0;
  for (const file of files) {
    // A gate cannot describe the defect without writing it down.
    if (file === SELF) continue;
    const src = read(file);
    const lines = src.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (file === STRIPE_DASHBOARD_MIRROR && ALLOWED_MIRROR_LINES.has(trimmed)) continue;
      // An explicit, greppable opt-out for prose that has to SAY "Mesh Pro" in
      // order to explain why it is wrong. Counted below so it cannot spread.
      if (line.includes(ALLOW_MARKER)) { allowances += 1; continue; }
      if (TWO_WORD.test(line)) {
        offenders += 1;
        fail("1 one word", `${file}:${i + 1} — ${trimmed.slice(0, 92)}`);
      }
      TWO_WORD.lastIndex = 0;
      if (JSX_SPLIT.test(line)) {
        offenders += 1;
        fail("1 one word", `${file}:${i + 1} — the words are split across JSX; a screen reader and a copy-paste both see two words`);
      }
      JSX_SPLIT.lastIndex = 0;
    }
  }
  if (!offenders) ok();

  // The scanner must be able to SEE. If it read nothing, a clean run is a lie.
  if (files.length < 50) {
    fail("1 one word", `only ${files.length} files were scanned — the walker is broken, not the codebase`);
  } else ok();

  // An opt-out that spreads is an opt-out that has replaced the rule.
  if (allowances > MAX_ALLOWANCES) {
    fail("1 one word", `${allowances} lines carry ${ALLOW_MARKER}, over the cap of ${MAX_ALLOWANCES} — the exception is becoming the convention`);
  } else ok();
}

// ── 2. The allowance is exactly as narrow as it claims ───────────────────────
{
  const stripe = read(STRIPE_DASHBOARD_MIRROR);
  const mirrorHits = stripe.split("\n").filter((l) => ALLOWED_MIRROR_LINES.has(l.trim())).length;
  if (mirrorHits !== ALLOWED_MIRROR_LINES.size) {
    fail("2 allowance", `expected exactly ${ALLOWED_MIRROR_LINES.size} Stripe Dashboard mirror lines in ${STRIPE_DASHBOARD_MIRROR}, found ${mirrorHits} — the allowance and the code have drifted apart`);
  } else ok();
  // The allowance is only defensible while those labels stay unrendered.
  const stripeCode = stripe.replace(/^\s*(\*|\/\/).*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  if (/\.label\b/.test(stripeCode)) {
    fail("2 allowance", "something now reads MESH_PRO_PLANS[...].label — the two-word Stripe mirror would become user-visible, so it must be renamed in the Stripe Dashboard and here together");
  } else ok();
}

// ── 3. The lowercase Stripe metadata value must NOT be normalised ────────────
{
  const checkout = read("src/app/api/stripe/checkout/route.ts");
  if (!/product:\s*"meshpro"/.test(checkout)) {
    fail("3 stripe metadata", 'product: "meshpro" changed case or spelling in the Stripe checkout metadata; it is persisted on Sessions and Subscriptions already created, and reconciliation compares against it');
  } else ok();
}

if (failures.length) {
  console.error(`\nmeshpro-name: ${failures.length} failure(s)\n`);
  for (const f of failures) console.error("  " + f);
  console.error("\n  MeshPro is one word. The only allowed exception is the Stripe Dashboard mirror in src/lib/stripe.ts.\n");
  process.exit(1);
}
console.log(`meshpro-name: ${checks} assertions passed across ${files.length} files — MeshPro is one word everywhere a person can read it.`);
