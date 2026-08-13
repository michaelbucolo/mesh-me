/**
 * CHARTER SEATS — a cap that is a fact, a number that is never resold,
 * and a purchase that buys no capability at all.
 *
 * The charter feature is one hundred seeded rows and a strict state machine
 * (open → held → claimed → retired) where every transition is a guarded
 * updateMany and the row itself is the lock. Each assertion below pins a
 * property whose quiet regression would be money- or trust-shaped:
 *
 *   1. The cap is the seeded universe: both schema files seed exactly 100,
 *      and no application code can mint a seat row.
 *   2. The webhook routes charter sessions before the lifetime-Pro fallthrough.
 *   3. Charter sessions carry no ownership signal the MeshPro reconciler
 *      accepts (no userId key, no client_reference_id) — a $79 seat must
 *      never cross-grant a subscription.
 *   4. The number is reserved BEFORE Stripe is called.
 *   5. The hold strictly outlives the checkout session, so a live session's
 *      seat is never sweepable.
 *   6. A held seat with a session releases only on Stripe-attested expiry,
 *      and the sweep CLAIMS a paid session instead of releasing it.
 *   7. A full refund retires the number forever and clears the holder.
 *   8. The MeshPro reconciler refuses non-meshpro products (shared wall with
 *      meshpro-gift-check §8; asserted here too because charter is the
 *      second product that dies without it).
 *   9. Status only, forever: the charter pin is gated on the seat — not on
 *      hasMeshPro — the picker entry renders exclusively for holders, and
 *      "charter" appears in NO feature-gating module.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const charter = strip(read("src/lib/charter.ts"));
const checkout = strip(read("src/app/api/stripe/checkout/route.ts"));
const webhook = strip(read("src/app/api/stripe/webhook/route.ts"));

// ── 1. The cap is a seeded fact ──────────────────────────────────────────────
{
  const countSeedRows = (src: string) => (src.match(/\(\s*\d+\s*,\s*'2026-08-13 00:00:00'\s*\)/g) ?? []).length;
  const migration = read("prisma/migrations/20260813130000_charter_seats/migration.sql");
  const ensure = read("prisma/ensure-schema.sql");
  if (countSeedRows(migration) !== 100) {
    fail("1 cap", `the charter migration seeds ${countSeedRows(migration)} seats, not 100`);
  } else ok();
  if (countSeedRows(ensure) !== 100) {
    fail("1 cap", `ensure-schema.sql (the file production applies) seeds ${countSeedRows(ensure)} seats, not 100`);
  } else ok();
  if (!/INSERT OR IGNORE INTO "CharterSeat"/.test(ensure)) {
    fail("1 cap", "the ensure-schema seed is not INSERT OR IGNORE — replaying a deploy would error or duplicate");
  } else ok();
  // No mint path: application code may transition seats, never create them.
  const files = [charter, checkout, webhook, strip(read("src/lib/actions.ts"))];
  if (files.some((f) => /charterSeat\.create\(/.test(f)) || /charterSeat\.create\(/.test(charter)) {
    fail("1 cap", "application code creates CharterSeat rows — the cap is no longer the seeded universe");
  } else ok();
  const capMatch = /CHARTER_SEAT_CAP\s*=\s*(\d+)/.exec(charter);
  if (!capMatch || capMatch[1] !== "100") {
    fail("1 cap", `CHARTER_SEAT_CAP is ${capMatch?.[1] ?? "missing"}, not 100 — the constant and the seeded rows must agree`);
  } else ok();
}

// ── 2. Webhook order: charter before the lifetime-Pro fallthrough ────────────
{
  // The whole case body, delimited by the NEXT case label — a lazy match to
  // the first `break;` would stop inside the gift branch and read as "no
  // charter branch" forever.
  const caseStart = webhook.indexOf('case "checkout.session.completed":');
  const caseEnd = webhook.indexOf("case ", caseStart + 1);
  const completedCase = caseStart >= 0 && caseEnd > caseStart ? webhook.slice(caseStart, caseEnd) : "";
  const charterAt = completedCase.indexOf("charter-seat");
  const grantAt = completedCase.indexOf("isMeshPro: true");
  if (charterAt < 0) {
    fail("2 order", "the completed-checkout case has no charter-seat branch — a charter payment would fall into the permanent-Pro arm");
  } else ok();
  if (charterAt >= 0 && grantAt >= 0 && charterAt > grantAt) {
    fail("2 order", "the charter-seat branch runs AFTER the permanent isMeshPro grant");
  } else ok();
  if (!/case "checkout\.session\.expired":/.test(webhook)) {
    fail("2 order", "the checkout.session.expired case is gone — abandoned charter holds are never released by the webhook");
  } else ok();
  if (!/case "charge\.refunded":/.test(webhook)) {
    fail("2 order", "the charge.refunded case is gone — a refunded seat would stay claimed");
  } else ok();
}

// ── 3. Charter sessions carry no MeshPro-claimable ownership signal ──────────
{
  const branch = /payload\?\.charter === true[\s\S]*?const plan = parseMeshProPlan/.exec(checkout)?.[0] ?? "";
  if (!branch) fail("3 session", "the charter branch is gone from the checkout route");
  else {
    ok();
    if (!/product:\s*"charter-seat"/.test(branch)) {
      fail("3 session", 'charter session metadata lost product: "charter-seat" — the webhook cannot route it');
    } else ok();
    if (!/charterUserId:\s*user\.id/.test(branch)) {
      fail("3 session", "charter session metadata lost charterUserId — the claim has no beneficiary");
    } else ok();
    if (/client_reference_id/.test(branch)) {
      fail("3 session", "the charter branch sets client_reference_id — the MeshPro reconciler's fallback ownership signal");
    } else ok();
    if (/\buserId:\s*user\.id/.test(branch)) {
      fail("3 session", "the charter branch sets a userId metadata key — the MeshPro reconciler's primary ownership signal");
    } else ok();
    if (!/mode:\s*"payment"/.test(branch)) {
      fail("3 session", 'the charter checkout is not mode: "payment"');
    } else ok();
  }
}

// ── 4. Reserve BEFORE Stripe ─────────────────────────────────────────────────
{
  const branch = /payload\?\.charter === true[\s\S]*?const plan = parseMeshProPlan/.exec(checkout)?.[0] ?? "";
  const reserveAt = branch.indexOf("reserveCharterSeat(");
  const createAt = branch.indexOf("sessions.create(");
  if (reserveAt < 0 || createAt < 0 || reserveAt > createAt) {
    fail("4 reserve-first", "the seat is no longer reserved before the Stripe session is created — an abandoned checkout can orphan or double-assign a number");
  } else ok();
  if (!/releaseCharterHold\(/.test(branch)) {
    fail("4 reserve-first", "the sessions.create failure path no longer releases the hold — a Stripe error strands the seat for 45 minutes");
  } else ok();
}

// ── 5. The hold strictly outlives the session ────────────────────────────────
{
  const holdMs = Number(/CHARTER_HOLD_MS\s*=\s*(\d+)\s*\*\s*60_?000/.exec(charter)?.[1]) * 60_000;
  const ttlS = Number(/CHARTER_SESSION_TTL_S\s*=\s*(\d+)\s*\*\s*60/.exec(charter)?.[1]) * 60;
  if (!Number.isFinite(holdMs) || !Number.isFinite(ttlS)) {
    fail("5 ttl", "could not read CHARTER_HOLD_MS / CHARTER_SESSION_TTL_S from charter.ts");
  } else if (holdMs <= ttlS * 1000) {
    fail("5 ttl", `CHARTER_HOLD_MS (${holdMs}ms) does not strictly outlive the session (${ttlS * 1000}ms) — a live session's seat becomes sweepable`);
  } else ok();
}

// ── 6. Release only on attested expiry; the sweep claims paid sessions ───────
{
  const releaseNoSession = /releaseCharterHold[\s\S]*?stripeSessionId:\s*null[\s\S]*?status:\s*"open"/.exec(charter);
  if (!releaseNoSession) {
    fail("6 release", "releaseCharterHold no longer requires stripeSessionId: null — a hold with a live session could be released");
  } else ok();
  const sweep = /async function sweepCharterHolds[\s\S]*?\n}/.exec(charter)?.[0] ?? "";
  if (!sweep) fail("6 release", "sweepCharterHolds is gone");
  else {
    ok();
    if (!/status === "expired"/.test(sweep)) {
      fail("6 release", "the sweep no longer requires Stripe-attested expiry before releasing a session-bearing hold");
    } else ok();
    if (!/payment_status === "paid"[\s\S]*?applyCharterSession/.test(sweep)) {
      fail("6 release", "the sweep no longer CLAIMS paid sessions — a missed webhook would burn a paid seat instead of self-healing");
    } else ok();
  }
}

// ── 7. Refund retires forever ────────────────────────────────────────────────
{
  const refund = /export async function applyCharterRefund[\s\S]*?\n}/.exec(charter)?.[0] ?? "";
  if (!refund) fail("7 retire", "applyCharterRefund is gone — a refunded seat stays claimed");
  else {
    ok();
    if (!/status:\s*"retired"/.test(refund)) {
      fail("7 retire", "the refund path no longer retires the seat");
    } else ok();
    if (!/charterNumber:\s*null/.test(refund)) {
      fail("7 retire", "the refund path no longer clears User.charterNumber — a refunded buyer keeps the chip");
    } else ok();
    if (!/amount_refunded !== charge\.amount/.test(refund)) {
      fail("7 retire", "partial refunds are no longer ignored — a $1 partial would retire a $79 seat");
    } else ok();
  }
  // A retired number is never resold: nothing may transition retired → open.
  const opensFrom = charter.match(/status:\s*"open"[\s\S]{0,220}?updateMany|updateMany\([\s\S]{0,300}?status:\s*"open"/g) ?? [];
  const reopensRetired = opensFrom.some((block) => /"retired"/.test(block));
  if (reopensRetired) {
    fail("7 retire", "a code path transitions a retired seat back to open — retired numbers must never be resold");
  } else ok();
}

// ── 8. The MeshPro reconciler stays product-narrow ───────────────────────────
{
  const billing = strip(read("src/lib/stripe-billing.ts"));
  if (!/if\s*\(\s*session\.metadata\?\.product\s*!==\s*"meshpro"\s*\)/.test(billing)) {
    fail("8 reconciler", 'syncMeshProCheckoutSessionForUser no longer refuses metadata.product !== "meshpro" — a charter or gift session becomes claimable as lifetime Pro');
  } else ok();
  if (!/metadata\?\.product\s*!==\s*"charter-seat"/.test(charter)) {
    fail("8 reconciler", "syncCharterCheckoutSessionForUser no longer refuses non-charter sessions — exactly as narrow as the webhook, or not at all");
  } else ok();
}

// ── 9. Status only, forever ──────────────────────────────────────────────────
{
  const actions = strip(read("src/lib/actions.ts"));
  if (!/badgeStyle === "charter" && user\.charterNumber == null/.test(actions)) {
    fail("9 status-only", "the charter pin is no longer gated on holding a seat — check updateMeshiPreference");
  } else ok();
  // Gated on the SEAT, not the subscription: the adjudicating if-condition
  // itself must test charterNumber and never hasMeshPro. (The separate Pro
  // wardrobe gate that FOLLOWS it legitimately consults hasMeshPro — only the
  // condition is scanned, not the neighborhood.)
  const gateCondition = /if \(next\.badgeStyle === "charter"[^)]*\)/.exec(actions)?.[0] ?? "";
  if (!gateCondition || /hasMeshPro/.test(gateCondition) || !/charterNumber/.test(gateCondition)) {
    fail("9 status-only", "the charter pin's adjudicating condition no longer tests charterNumber alone — the pin belongs to holders, free or Pro alike");
  } else ok();
  const settings = strip(read("src/components/settings/settings-control-center.tsx"));
  if (!/charterHolder \? \[\.\.\.badges, "charter"\] : badges/.test(settings)) {
    fail("9 status-only", "the picker no longer renders the charter pin holder-only — a locked tease (or an open acquire path) is banned");
  } else ok();
  // "charter" appears in no feature gate. These are the modules that decide
  // what an account CAN DO; a charter mention inside any of them means the
  // status good grew a capability, which the terms promise it never will.
  for (const gateFile of [
    "src/lib/mesh-pro.ts",
    "src/lib/flow-ranking.ts",
    "src/lib/analytics-dashboard.ts",
    "src/lib/stripe-billing.ts",
    "src/lib/auth.ts",
  ]) {
    // Plain substring, not \b-delimited: identifiers like CHARTER_PERK have
    // no word boundary before the underscore and would slip a \b match.
    if (/charter/i.test(strip(read(gateFile)))) {
      fail("9 status-only", `"charter" appears in ${gateFile} — a feature-deciding module. A seat buys a number, never a capability.`);
    } else ok();
  }
}

if (failures.length) {
  console.error(`\ncharter: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`charter: ${checks} assertions passed — 100 seats, reserved before Stripe, never resold, never a feature.`);
