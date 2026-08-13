/**
 * PATRON — a recurring contribution that buys nothing, and the routing that
 * keeps it that way.
 *
 * A patron subscription is a Stripe SUBSCRIPTION, and this repo's MeshPro
 * sync writes `isMeshPro` absolutely from subscription status, resolving its
 * user by shared customer id as a last resort. That makes patron the one
 * product whose mere EXISTENCE can corrupt another product's standing in
 * BOTH directions:
 *
 *   (a) a patron checkout falling into the subscription arm buys Pro for $2;
 *   (b) a patron CANCELLATION reaching the MeshPro sync revokes a
 *       separately-purchased Pro — the headline bomb.
 *
 * So every subscription-shaped webhook case routes patron FIRST, the MeshPro
 * sync wears a refuse-foreign belt, and the patron module never touches a
 * MeshPro column or resolves a user by customer id. The marks (chip, pin)
 * render from `patronSince` — a set-once record — never from live standing,
 * so lapsing costs nothing visible and the marks can never become a
 * retention lever. This gate pins all of it.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isGiftableMeshiItem } from "../src/lib/meshi-wardrobe";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const webhook = strip(read("src/app/api/stripe/webhook/route.ts"));
const checkout = strip(read("src/app/api/stripe/checkout/route.ts"));
const patron = strip(read("src/lib/patron.ts"));
const billing = strip(read("src/lib/stripe-billing.ts"));
const actions = strip(read("src/lib/actions.ts"));

function caseBody(source: string, label: string) {
  const start = source.indexOf(label);
  if (start < 0) return "";
  const end = source.indexOf("case ", start + label.length);
  return end > start ? source.slice(start, end) : source.slice(start);
}

// ── 1. Webhook order: patron routed before the MeshPro machinery, all cases ──
{
  const completed = caseBody(webhook, 'case "checkout.session.completed":');
  const patronAt = /if \(session\.metadata\?\.product === "patron"\)/.exec(completed)?.index ?? -1;
  const subArmAt = completed.indexOf("stripeObjectId(session.subscription)");
  const grantAt = completed.indexOf("isMeshPro: true");
  if (patronAt < 0) {
    fail("1 order", "the completed case has no patron branch — a $2/mo donation session falls into the subscription arm and buys Pro");
  } else ok();
  if (patronAt >= 0 && ((subArmAt >= 0 && patronAt > subArmAt) || (grantAt >= 0 && patronAt > grantAt))) {
    fail("1 order", "the patron branch runs AFTER the subscription/lifetime-Pro machinery");
  } else ok();

  // created/updated share one case body (the created label falls through to
  // updated, so the BODY is delimited from the updated label); deleted has
  // its own. BOTH must route patron before calling the MeshPro sync — the
  // deleted case is where canceling patronage would revoke a
  // separately-purchased Pro.
  const churn = caseBody(webhook, 'case "customer.subscription.updated":');
  const churnPatron = /if \(subscription\.metadata\?\.product === "patron"\)/.exec(churn)?.index ?? -1;
  const churnSync = churn.indexOf("syncMeshProSubscription(");
  if (churnPatron < 0 || churnSync < 0 || churnPatron > churnSync) {
    fail("1 order", "created/updated no longer route patron before the MeshPro sync — every renewal resolves via the shared customer id and rewrites isMeshPro");
  } else ok();
  const deleted = caseBody(webhook, 'case "customer.subscription.deleted":');
  const delPatron = /if \(subscription\.metadata\?\.product === "patron"\)/.exec(deleted)?.index ?? -1;
  const delSync = deleted.indexOf("syncMeshProSubscription(");
  if (delPatron < 0 || delSync < 0 || delPatron > delSync) {
    fail("1 order", "the deleted case no longer routes patron first — CANCELING patronage would revoke a separately-purchased Pro");
  } else ok();
  if (!/applyPatronRefund\(charge\)/.test(caseBody(webhook, 'case "charge.refunded":'))) {
    fail("1 order", "charge.refunded no longer runs the patron refund — money back, record kept");
  } else ok();
}

// ── 2. The belt: refuse-foreign, never strict ────────────────────────────────
{
  const syncBody = billing.slice(billing.indexOf("export async function syncMeshProSubscription"));
  const belt = /const product = subscription\.metadata\?\.product;\s*if \(product && product !== "meshpro"\) return null;/.exec(syncBody);
  if (!belt) {
    fail("2 belt", "syncMeshProSubscription lost its refuse-foreign belt — any webhook mis-route or refactor re-arms both landmines with no second wall");
  } else ok();
  // Truthiness FIRST: a strict `product !== "meshpro"` alone would orphan
  // every payment-link Pro subscriber, which is legally metadata-less.
  if (/if \(subscription\.metadata\?\.product !== "meshpro"\) return null/.test(syncBody)) {
    fail("2 belt", "the belt tightened to strict equality — every payment-link Pro subscriber (metadata-less) is silently orphaned: paid, never granted");
  } else ok();
}

// ── 3. The patron module writes nothing that is not its own ──────────────────
{
  // The MeshPro column NAMES must not appear at all; the User writes must
  // additionally never carry the patron sub id into User.stripeSubscriptionId
  // (which the render-time re-sync would then feed back through the MeshPro
  // machinery on every /billing page load). `stripeSubscriptionId:` on the
  // STINT is the stint's own column and is fine.
  // (isMeshProSubscriptionStatus is the REUSED status vocabulary — one
  // definition of "active" for both products — and is not a column.)
  if (/isMeshPro(?!SubscriptionStatus)|meshProSince|meshProGiftUntil/.test(patron)) {
    fail("3 isolation", "patron.ts names a MeshPro entitlement column — cross-grant territory");
  } else ok();
  const userWrites = patron.match(/user\.update\(\{[\s\S]*?\}\)/g) ?? [];
  if (userWrites.some((w) => /stripeSubscriptionId/.test(w))) {
    fail("3 isolation", "a patron User write touches stripeSubscriptionId — the patron sub id would feed the render-time re-sync and clobber Pro billing state on every page load");
  } else ok();
  // Never resolve a user by customer id: one Stripe customer legitimately
  // holds both products' subscriptions.
  const wheres = patron.match(/where:\s*\{[^}]*\}/g) ?? [];
  if (wheres.some((w) => /stripeCustomerId/.test(w))) {
    fail("3 isolation", "a patron lookup resolves by stripeCustomerId — one shared customer cross-writes both products' standing");
  } else ok();
  if (!/if \(subscription\.metadata\?\.product !== "patron"\) return null;/.test(patron)) {
    fail("3 isolation", "syncPatronSubscription lost its strict product guard (strict is right HERE — there is no legacy metadata-less patron)");
  } else ok();
  if (/notification\.create|sendPushForNotification/.test(patron)) {
    fail("3 isolation", "patron.ts sends notifications — a recurring self-purchase that would nag on every renewal");
  } else ok();
  if (/ownedMeshiItem|charterSeat|meshProGift/i.test(patron)) {
    fail("3 isolation", "patron.ts touches another product's tables");
  } else ok();
}

// ── 4. Session hygiene: nothing the MeshPro reconciler could claim ───────────
{
  const branch = /payload\?\.patron !== undefined[\s\S]*?const plan = parseMeshProPlan/.exec(checkout)?.[0] ?? "";
  if (!branch) fail("4 session", "the patron branch is gone from the checkout route");
  else {
    ok();
    if (!/mode:\s*"subscription"/.test(branch)) {
      fail("4 session", 'the patron checkout is not mode: "subscription"');
    } else ok();
    if (!/recurring:\s*\{ interval: "month" \}/.test(branch) || !/unit_amount:\s*PATRON_TIERS\[tier\]/.test(branch)) {
      fail("4 session", "the inline recurring price no longer reads PATRON_TIERS — tiers and Stripe can now disagree");
    } else ok();
    // The single most load-bearing line: subscription_data.metadata is what
    // customer.subscription.* events see. Session metadata alone routes only
    // the completed case; the subscription would be born unroutable.
    if (!/metadata:\s*patronMetadata/.test(branch) || !/subscription_data:\s*\{ metadata: patronMetadata \}/.test(branch) ||
        !/product:\s*"patron"/.test(branch) || !/patronUserId:\s*user\.id/.test(branch)) {
      fail("4 session", "patron metadata is no longer stamped on BOTH the session and subscription_data — churn events reach the customer-id fallback forever");
    } else ok();
    if (/client_reference_id/.test(branch) || /\buserId:\s*user\.id/.test(branch)) {
      fail("4 session", "the patron session carries an ownership signal the MeshPro reconciler reads — a patron could claim Pro from their own success URL");
    } else ok();
    if (/allow_promotion_codes/.test(branch)) {
      fail("4 session", "promotion codes on a donation — a discount on nothing");
    } else ok();
    if (!/getActivePatronStint\(user\.id\)/.test(branch) || !/alreadyActive:\s*true/.test(branch)) {
      fail("4 session", "the duplicate-patron 409 wall is gone");
    } else ok();
  }
}

// ── 5. Five reconcilers, mutually refusing ───────────────────────────────────
{
  if (!/if \(session\.metadata\?\.product !== "patron"\)/.test(patron) ||
      !/if \(session\.metadata\?\.patronUserId !== userId\)/.test(patron) ||
      !/if \(session\.payment_status !== "paid"\)/.test(patron)) {
    fail("5 syncs", "syncPatronCheckoutSessionForUser lost a narrow guard (product/owner/paid)");
  } else ok();
  if (!/if \(session\.metadata\?\.product !== "meshpro"\)/.test(billing)) {
    fail("5 syncs", "the MeshPro reconciler lost its product guard");
  } else ok();
  if (!/if \(session\.metadata\?\.product !== "charter-seat"\)/.test(strip(read("src/lib/charter.ts")))) {
    fail("5 syncs", "the charter reconciler lost its product guard");
  } else ok();
  if (!/if \(session\.metadata\?\.product !== "meshi-item"\)/.test(strip(read("src/lib/meshi-item.ts")))) {
    fail("5 syncs", "the meshi-item reconciler lost its product guard");
  } else ok();
}

// ── 6. The record is permanent; the marks render from it, never standing ─────
{
  // Set once (?? guard), and cleared by exactly ONE writer repo-wide: the
  // full-refund erasure. Anything else makes the chip cancellation's visible
  // price — a retention lever, the banned mechanic.
  if (!/patronSince:\s*user\.patronSince \?\? new Date\(\)/.test(patron)) {
    fail("6 record", "patronSince is overwritten instead of set-once — the record drifts with churn");
  } else ok();
  const srcFiles = [patron, billing, actions, strip(read("src/lib/queries.ts")), checkout, webhook];
  const clearers = srcFiles.reduce((n, f) => n + (f.match(/patronSince:\s*null/g)?.length ?? 0), 0);
  if (clearers !== 1) {
    fail("6 record", `patronSince is nulled from ${clearers} sites — refund erasure must be the only one`);
  } else ok();
  // The stint upsert is keyed on the subscription id (ordering + idempotency:
  // a stale `deleted` can only end its OWN stint).
  if (!/patronStint\.upsert\(\{\s*where:\s*\{ stripeSubscriptionId: subscription\.id \}/.test(patron)) {
    fail("6 record", "the stint upsert lost its subscription-id key — a stale deleted event clears live standing");
  } else ok();
  // Renderers: profile chip and billing row read the record, never stints.
  const profile = strip(read("src/app/(app)/profile/profile-view.tsx"));
  if (!/profile\.patronSince != null && profile\.showPatronChip/.test(profile)) {
    fail("6 record", "the profile chip no longer renders from patronSince && showPatronChip");
  } else ok();
  if (/patronStint|getActivePatronStint/i.test(profile)) {
    fail("6 record", "the profile reads patron STANDING — lapse becomes visible, the rented-badge break");
  } else ok();
}

// ── 7. Status only, forever ──────────────────────────────────────────────────
{
  // Same law as charter: "patron" in a feature-deciding module means the
  // status good grew a capability. Plain substring, comment-stripped.
  for (const gateFile of [
    "src/lib/mesh-pro.ts",
    "src/lib/flow-ranking.ts",
    "src/lib/analytics-dashboard.ts",
    "src/lib/stripe-billing.ts",
    "src/lib/auth.ts",
  ]) {
    if (/patron/i.test(strip(read(gateFile)))) {
      fail("7 status-only", `"patron" appears in ${gateFile} — a feature-deciding module. A contribution buys a record, never a capability.`);
    } else ok();
  }
  if (/patron/i.test(strip(read("src/lib/notifications.ts")))) {
    fail("7 status-only", '"patron" appears in notifications plumbing — patronage never notifies');
  } else ok();
  // The pin: gated on the record, never on the subscription.
  const pinCondition = /if \(next\.badgeStyle === "patron"[^)]*\)/.exec(actions)?.[0] ?? "";
  if (!pinCondition || /hasMeshPro/.test(pinCondition) || !/patronSince/.test(pinCondition)) {
    fail("7 status-only", "the patron pin's adjudicating condition no longer tests patronSince alone");
  } else ok();
  // Picker: record-holders only, stacked on a baseBadges const that preserves
  // charter-check §9's literal ternary.
  const settings = strip(read("src/components/settings/settings-control-center.tsx"));
  if (!/const baseBadges = charterHolder \? \[\.\.\.badges, "charter"\] : badges;/.test(settings) ||
      !/patronRecord \? \[\.\.\.baseBadges, "patron"\] : baseBadges/.test(settings)) {
    fail("7 status-only", "the picker no longer renders the patron pin record-holders-only on baseBadges — a locked tease, or charter-check's literal broke");
  } else ok();
  // A fact about who funded Mesh.me must never be purchasable for someone else.
  if (isGiftableMeshiItem("badges", "patron")) {
    fail("7 status-only", 'the patron pin is giftable — a $1.99 lie about who funded the platform');
  } else ok();
}

// ── 8. Refund closure ────────────────────────────────────────────────────────
{
  if (!/if \(charge\.amount_refunded !== charge\.amount\) \{/.test(patron)) {
    fail("8 refund", "partial refunds are no longer ignored");
  } else ok();
  if (!/if \(!invoiceId\) return;/.test(patron)) {
    fail("8 refund", "the invoice guard is gone — one-time products' charges would be probed as patron refunds");
  } else ok();
  if (!/refundedAt:\s*new Date\(\)/.test(patron)) {
    fail("8 refund", "the refund no longer marks the stint");
  } else ok();
  // Erasure only when NO un-refunded stint survives; and it resets the pin.
  if (!/refundedAt:\s*null/.test(patron) || !/if \(surviving\) return;/.test(patron)) {
    fail("8 refund", "erasure fires while an un-refunded stint survives — refund taken on one, record erased for all");
  } else ok();
  if (!/badgeStyle:\s*"patron"/.test(patron) || !/badgeStyle:\s*"none"/.test(patron)) {
    fail("8 refund", "the refund no longer resets an equipped patron pin — money back, mark kept");
  } else ok();
}

// ── 9. Claims and stale truth ────────────────────────────────────────────────
{
  const meshpro = read("src/app/(app)/meshpro/page.tsx");
  const cardMatch = /const patronCard = \{[\s\S]*?enforcedIn: \{ file: "([^"]+)", symbol: "([^"]+)" \}[\s\S]*?\};/.exec(meshpro);
  if (!cardMatch) fail("9 claims", "patronCard lost its enforcedIn contract");
  else {
    ok();
    const enforcedSource = read(cardMatch[1]);
    if (!enforcedSource.includes(cardMatch[2])) {
      fail("9 claims", `patronCard's enforcedIn symbol ${cardMatch[2]} no longer exists in ${cardMatch[1]}`);
    } else ok();
    if (!/patronCard\.href/.test(meshpro) || !/patronCard\.title/.test(meshpro)) {
      fail("9 claims", "the patron card is no longer rendered from its const");
    } else ok();
  }
  const terms = read("src/app/terms/page.tsx");
  if (!/Patron, a recurring monthly contribution/.test(terms) || !/only a full refund erases the record/i.test(terms)) {
    fail("9 claims", "the terms no longer describe Patron honestly (recurring, buys nothing, refund erases)");
  } else ok();
  if (!/recurring Patron contributions are the platform/.test(terms.replace(/&apos;|’/g, ""))
      && !/recurring Patron contributions/.test(terms)) {
    fail("9 claims", "the terms' only-revenue-sources sentence dropped Patron — the money story ships stale");
  } else ok();
  if (!/patron\s+contributions, and one\s+hundred charter seats are the only ways/.test(meshpro.replace(/\n\s*/g, " "))) {
    fail("9 claims", "the /meshpro header's only-ways sentence dropped patron contributions");
  } else ok();
  if (!/CREATE TABLE IF NOT EXISTS "PatronStint"/.test(read("prisma/ensure-schema.sql"))) {
    fail("9 claims", "PatronStint is missing from ensure-schema.sql — production never gets the table");
  } else ok();
}

if (failures.length) {
  console.error(`\npatron: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`patron: all ${checks} assertions passed — routed first in every case, belted twice, and the record outlives the money.`);
