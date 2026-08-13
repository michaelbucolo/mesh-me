/**
 * MESHI WARDROBE ITEMS — $1.99, one piece, owned forever.
 *
 * The OwnedMeshiItem row is an entitlement bought with real money, which makes
 * this the fourth product sharing one Stripe pipe — and every failure shape
 * here is one the repo has already paid to learn elsewhere:
 *
 *   1. THE WRONG-BENEFICIARY ARM. The webhook's completed-checkout handler
 *      still ends in `else if (userId) → isMeshPro: true`. A wardrobe piece is
 *      a one-time payment; unbranched, the purchaser buys lifetime Pro for
 *      $1.99. The meshi-item branch must run first, and carry no ownership
 *      signal the MeshPro reconciler could claim.
 *   2. THE HELD-VALUE CHARGEBACK LOOP. The wardrobe gate forgives values an
 *      account already wears (the hostage-bug fix). Without the refund path's
 *      equipped-axis reset, accomplice-gift → equip → chargeback keeps the
 *      piece forever. The reset is load-bearing, not cosmetic.
 *   3. THE CATALOG AS CAPABILITY. Status badges (charter/founder/verified/
 *      creator) assert facts; the day one is purchasable the fact is fake.
 *      The giftable catalog must exclude them — and everything free.
 *
 * WHAT THIS CANNOT PROVE: that Stripe delivers webhooks, or refunds settle.
 * It pins the code's shape: branch order, fences, idempotency, isolation.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FREE_MESHI_OPTIONS } from "../src/lib/mesh-pro";
import {
  buildOwnedMeshiSets,
  GIFTABLE_MESHI_ITEMS,
  isGiftableMeshiItem,
  isOwnedMeshiOption,
  MESHI_ITEM_PRICE_CENTS,
} from "../src/lib/meshi-wardrobe";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const webhook = strip(read("src/app/api/stripe/webhook/route.ts"));
const checkout = strip(read("src/app/api/stripe/checkout/route.ts"));
const meshiItem = strip(read("src/lib/meshi-item.ts"));
const actions = strip(read("src/lib/actions.ts"));

// The meshi-item checkout branch, delimited by the charter branch that follows.
const itemBranch = /payload\?\.meshiItem !== undefined[\s\S]*?payload\?\.charter === true/.exec(checkout)?.[0] ?? "";

// ── 1. Webhook order: meshi-item before the lifetime-Pro fallthrough ─────────
{
  const caseStart = webhook.indexOf('case "checkout.session.completed":');
  const caseEnd = webhook.indexOf("case ", caseStart + 1);
  const completedCase = caseStart >= 0 && caseEnd > caseStart ? webhook.slice(caseStart, caseEnd) : "";
  // The exact live guard, not a substring — a renamed product ("meshi-itemx")
  // must read as "no branch", because that is what the webhook would see.
  const itemAt = /if \(session\.metadata\?\.product === "meshi-item"\)/.exec(completedCase)?.index ?? -1;
  const grantAt = completedCase.indexOf("isMeshPro: true");
  if (itemAt < 0) {
    fail("1 order", "the completed-checkout case has no meshi-item branch — a $1.99 hat would fall into the permanent-Pro arm");
  } else ok();
  if (itemAt >= 0 && grantAt >= 0 && itemAt > grantAt) {
    fail("1 order", "the meshi-item branch runs AFTER the permanent isMeshPro grant");
  } else ok();
  if (!/applyMeshiItemSession\(session/.test(completedCase)) {
    fail("1 order", "the meshi-item branch no longer applies the session");
  } else ok();
}

// ── 2. Four narrow syncs, mutually refusing ──────────────────────────────────
{
  // The new reconciler refuses wrong product, wrong purchaser, unpaid — as
  // LIVE if-guards, not commentary.
  if (!/if \(session\.metadata\?\.product !== "meshi-item"\)/.test(meshiItem)) {
    fail("2 syncs", "syncMeshiItemSessionForUser lost its product guard — any paid session could mint a wardrobe piece");
  } else ok();
  if (!/if \(session\.metadata\?\.purchaserUserId !== userId\)/.test(meshiItem)) {
    fail("2 syncs", "syncMeshiItemSessionForUser lost its purchaser guard — anyone with a session id could reconcile it");
  } else ok();
  if (!/if \(session\.payment_status !== "paid"\)/.test(meshiItem)) {
    fail("2 syncs", "syncMeshiItemSessionForUser lost its paid guard — an unpaid session would grant");
  } else ok();
  // The three older reconcilers each still refuse everything that is not
  // their own product — which is what refuses meshi-item by construction.
  if (!/if \(session\.metadata\?\.product !== "meshpro"\)/.test(strip(read("src/lib/stripe-billing.ts")))) {
    fail("2 syncs", "the MeshPro reconciler lost its product guard — a meshi-item session could grant lifetime Pro");
  } else ok();
  if (!/if \(session\.metadata\?\.product !== "charter-seat"\)/.test(strip(read("src/lib/charter.ts")))) {
    fail("2 syncs", "the charter reconciler lost its product guard");
  } else ok();
}

// ── 3. Session hygiene: no ownership signal the MeshPro path could claim ─────
{
  if (!itemBranch) fail("3 session", "the meshi-item branch is gone from the checkout route");
  else {
    ok();
    if (!/product:\s*"meshi-item"/.test(itemBranch)) {
      fail("3 session", 'meshi-item session metadata lost product: "meshi-item" — the webhook cannot route it');
    } else ok();
    if (!/purchaserUserId:\s*user\.id/.test(itemBranch)) {
      fail("3 session", "meshi-item session metadata lost purchaserUserId — the reconciler has no owner to verify");
    } else ok();
    if (!/recipientUserId:\s*recipient\.id/.test(itemBranch)) {
      fail("3 session", "meshi-item session metadata lost recipientUserId — the grant has no beneficiary");
    } else ok();
    if (/client_reference_id/.test(itemBranch)) {
      fail("3 session", "the meshi-item branch sets client_reference_id — the MeshPro reconciler's fallback ownership signal");
    } else ok();
    if (/\buserId:\s*user\.id/.test(itemBranch)) {
      fail("3 session", "the meshi-item branch sets a userId metadata key — the MeshPro reconciler's primary ownership signal");
    } else ok();
    if (!/mode:\s*"payment"/.test(itemBranch)) {
      fail("3 session", 'the meshi-item checkout is not mode: "payment"');
    } else ok();
    if (!/unit_amount:\s*MESHI_ITEM_PRICE_CENTS/.test(itemBranch)) {
      fail("3 session", "the meshi-item price is no longer the single flat constant");
    } else ok();
  }
}

// ── 4. Idempotency + the race loser's money goes back ────────────────────────
{
  const schema = read("prisma/schema.prisma");
  const model = /model OwnedMeshiItem \{[\s\S]*?\n\}/.exec(schema)?.[0] ?? "";
  if (!/stripeSessionId String\s+@unique/.test(model)) {
    fail("4 idempotent", "OwnedMeshiItem.stripeSessionId is no longer @unique — webhook redelivery double-grants");
  } else ok();
  if (/@@unique/.test(model)) {
    fail("4 idempotent", "OwnedMeshiItem grew a composite unique — a revoked receipt would block honest re-purchase forever (P2002 on a legitimate gift)");
  } else ok();
  if (!/"code" in error && \(error as \{ code: string \}\)\.code === "P2002"/.test(meshiItem)) {
    fail("4 idempotent", "the P2002 redelivery swallow is gone from applyMeshiItemSession");
  } else ok();
  // Two honest checkouts racing past the pre-payment refusal: the later
  // session's money is returned, never kept.
  if (!/"race-lost"/.test(meshiItem) || !/stripe\.refunds\.create\(\{ payment_intent: paymentIntentId \}\)/.test(meshiItem)) {
    fail("4 idempotent", "the crossed-purchase auto-refund path is gone — money kept for nothing delivered");
  } else ok();
}

// ── 5. Entitlement isolation: $1.99 buys a hat, never the gold rim ───────────
{
  // No data-write in the grant/refund module may touch the Pro columns.
  const dataBlocks = meshiItem.match(/data:\s*\{[^}]*\}/g) ?? [];
  if (dataBlocks.length === 0) fail("5 isolation", "no prisma writes found in meshi-item.ts — the module is hollow");
  else ok();
  for (const block of dataBlocks) {
    if (/isMeshPro|meshProGiftUntil|meshProSince/.test(block)) {
      fail("5 isolation", `a meshi-item write touches a Pro entitlement column: ${block.slice(0, 80)}`);
    }
  }
  ok();
  // Ownership must never be patched into the session chokepoint or presence.
  if (/ownedMeshi/i.test(strip(read("src/lib/auth.ts")))) {
    fail("5 isolation", "auth.ts consults wardrobe ownership — per-item ownership must never patch the session chokepoint");
  } else ok();
  if (/ownedMeshi/i.test(strip(read("src/app/api/mesh/presence/route.ts")))) {
    fail("5 isolation", "the presence route consults wardrobe ownership — the rim is hasMeshPro() only");
  } else ok();
  // And the grant path never equips: exactly ONE meshiPreference write exists
  // in this module, and it is the refund reset.
  const prefWrites = meshiItem.match(/meshiPreference\.\w+/g) ?? [];
  if (prefWrites.length !== 1 || prefWrites[0] !== "meshiPreference.updateMany") {
    fail("5 isolation", `expected exactly one meshiPreference write (the refund reset), found: ${prefWrites.join(", ") || "none"} — a grant that equips is a webhook rewriting self-presentation`);
  } else ok();
}

// ── 6. The gate join: owned unlocks, revoked does not, held stays forgiven ───
{
  const sets = buildOwnedMeshiSets([{ category: "hats", value: "tophat" }, { category: "badges", value: "spark" }]);
  if (!isOwnedMeshiOption(sets, "hats", "tophat") || !isOwnedMeshiOption(sets, "hats", "  TopHat  ")) {
    fail("6 gate", "an owned piece does not resolve as owned (or normalization broke)");
  } else ok();
  if (isOwnedMeshiOption(sets, "hats", "crown") || isOwnedMeshiOption(sets, "badges", "heart")) {
    fail("6 gate", "an unowned piece resolves as owned");
  } else ok();
  if (isOwnedMeshiOption(buildOwnedMeshiSets([]), "hats", "tophat")) {
    fail("6 gate", "an empty wardrobe resolves as owning things");
  } else ok();

  // The join sits in the free-user gate: owned check present, BEFORE the held
  // check, and the held forgiveness itself survives (the hostage bug stays
  // fixed for premium values the server itself wrote).
  const gateFn = /function findLockedMeshiOptionForFreeUser\([\s\S]*?\n\}/.exec(actions)?.[0] ?? "";
  const ownedAt = gateFn.indexOf("isOwnedMeshiOption(owned, group, value)");
  const heldAt = gateFn.indexOf("const held = current[field]");
  if (ownedAt < 0) {
    fail("6 gate", "findLockedMeshiOptionForFreeUser no longer consults ownership — every owned piece is re-locked");
  } else ok();
  if (heldAt < 0 || !/!held \|\| held\.trim\(\)\.toLowerCase\(\) !== value\.trim\(\)\.toLowerCase\(\)/.test(gateFn)) {
    fail("6 gate", "the held-value forgiveness is gone — the hostage bug is back");
  } else ok();
  if (ownedAt >= 0 && heldAt >= 0 && ownedAt > heldAt) {
    fail("6 gate", "ownership is consulted after the held check — taking an owned piece off would forbid putting it back on");
  } else ok();
  // Only LIVE receipts feed the gate: the fetch filters revoked rows out.
  if (!/ownedMeshiItem\.findMany\(\{\s*where:\s*\{ ownerId: user\.id, revokedAt: null \}/.test(actions)) {
    fail("6 gate", "the gate's ownership fetch no longer filters revokedAt: null — refunded pieces stay wearable");
  } else ok();
}

// ── 7. Catalog fences: nothing free, nothing that asserts a fact ─────────────
{
  for (const [axis, values] of Object.entries(GIFTABLE_MESHI_ITEMS)) {
    const free = FREE_MESHI_OPTIONS[axis as keyof typeof FREE_MESHI_OPTIONS];
    const overlap = values.filter((v) => free.has(v));
    if (overlap.length > 0) {
      fail("7 catalog", `${axis} sells free values for $1.99: ${overlap.join(", ")}`);
    }
    if (values.length === 0) {
      fail("7 catalog", `${axis} is in the catalog with zero giftable values — a dead department`);
    }
  }
  ok();
  for (const status of ["charter", "founder", "verified", "creator"]) {
    if (isGiftableMeshiItem("badges", status)) {
      fail("7 catalog", `the ${status} badge is purchasable — a status record became merchandise`);
    }
  }
  ok();
  if (isGiftableMeshiItem("eyes", "none")) {
    fail("7 catalog", 'lash "none" is sellable — $1.99 for what free "regular" already means');
  } else ok();
  if (isGiftableMeshiItem("colors", "gold") || isGiftableMeshiItem("colors", "rainbow") || "colors" in GIFTABLE_MESHI_ITEMS) {
    fail("7 catalog", "the body-colors axis is giftable — gold/rainbow trade on the Pro rim (v1 exclusion)");
  } else ok();
  if ("accessories" in GIFTABLE_MESHI_ITEMS || isGiftableMeshiItem("accessories", "sunglasses")) {
    fail("7 catalog", "the accessories axis is giftable — a multi-token slot string is not one ownable value");
  } else ok();
  if (MESHI_ITEM_PRICE_CENTS !== 199) {
    fail("7 catalog", `MESHI_ITEM_PRICE_CENTS is ${MESHI_ITEM_PRICE_CENTS}, not 199 — one flat price is the no-storefront rule`);
  } else ok();
}

// ── 8. Self-purchase: allowed for pieces, still refused for months ───────────
{
  if (!/validateGiftRecipient\(user, recipientUsername, \{ allowSelf: true \}\)/.test(itemBranch)) {
    fail("8 self", "the wardrobe branch no longer allows self-purchase (or stopped using the shared fence)");
  } else ok();
  // The months branch calls the fence WITHOUT allowSelf — its self-block stands.
  const monthsBranch = /payload\?\.giftPlan !== undefined[\s\S]*?payload\?\.meshiItem !== undefined/.exec(checkout)?.[0] ?? "";
  if (!/validateGiftRecipient\(user, recipientUsername\)/.test(monthsBranch)) {
    fail("8 self", "the months branch no longer uses the recipient fence, or gained allowSelf");
  } else ok();
  if (!/if \(!allowSelf && recipient\.id === purchaser\.id\)/.test(checkout)) {
    fail("8 self", "the self-refusal in validateGiftRecipient is gone or unconditional — months self-gifts slipped in, or wardrobe self-purchase broke");
  } else ok();
  // Founder + block fences live in the SHARED validator, so both modes keep them.
  if (!/isFounderUsername\(recipient\.username\)/.test(checkout)) {
    fail("8 self", "the founder-recipient refusal is gone — $1.99 delivers nothing to a lifetime-Pro founder");
  } else ok();
  if (!/blockerId: purchaser\.id, blockedId: recipient\.id/.test(checkout)) {
    fail("8 self", "the block fence is gone from the recipient validator");
  } else ok();
}

// ── 9. Refund closure: the chargeback keeps nothing ──────────────────────────
{
  // The LIVE if-guard — `if (false && charge.amount_refunded ...)` must fail.
  if (!/if \(charge\.amount_refunded !== charge\.amount\) \{/.test(meshiItem)) {
    fail("9 refund", "partial refunds are no longer ignored — a $0.01 refund would revoke the piece");
  } else ok();
  if (!/data: \{ revokedAt: new Date\(\) \}/.test(meshiItem)) {
    fail("9 refund", "the refund no longer revokes the receipt");
  } else ok();
  // The load-bearing reset: a non-Pro owner with no surviving receipt loses
  // the equipped value, closing the held-forgiveness chargeback loop.
  if (!/meshiPreference\.updateMany\(\{\s*where: \{ userId: item\.ownerId, \[field\]: item\.value \},\s*data: \{ \[field\]: DEFAULT_MESHI_PREFERENCE\[field\] \},/.test(meshiItem)) {
    fail("9 refund", "the equipped-axis reset is gone — accomplice-gift → equip → chargeback keeps the piece forever");
  } else ok();
  if (!/if \(stillOwned\) return;/.test(meshiItem) || !/hasMeshPro\(owner\)/.test(meshiItem)) {
    fail("9 refund", "the reset lost its surviving-receipt / Pro-owner short-circuits — it would strip pieces people still own");
  } else ok();
  // Nothing but the refund path ever writes revokedAt.
  const revokers = (strip(read("src/lib/meshi-item.ts")) + actions + strip(read("src/lib/queries.ts")) + strip(read("src/lib/stripe-billing.ts")) + checkout + webhook)
    .match(/revokedAt: new Date\(\)/g) ?? [];
  if (revokers.length !== 1) {
    fail("9 refund", `revokedAt is written from ${revokers.length} sites — the refund path must be the only writer`);
  } else ok();
}

// ── 10. Churn independence ───────────────────────────────────────────────────
{
  if (/ownedMeshiItem/i.test(strip(read("src/lib/stripe-billing.ts")))) {
    fail("10 churn", "stripe-billing touches ownedMeshiItem — subscription churn could revoke owned pieces");
  } else ok();
  // The MeshCosmetic wipe-and-rewrite save must not sweep wardrobe receipts.
  const cosmeticsAt = actions.indexOf("meshCosmetic.deleteMany");
  const cosmeticsFn = cosmeticsAt >= 0
    ? actions.slice(actions.lastIndexOf("export async function", cosmeticsAt), actions.indexOf("export async function", cosmeticsAt))
    : "";
  if (!cosmeticsFn) fail("10 churn", "could not locate the MeshCosmetic save path to audit");
  else if (/ownedMeshiItem/i.test(cosmeticsFn)) {
    fail("10 churn", "the MeshCosmetic save path touches ownedMeshiItem — a cosmetics save could wipe wardrobe receipts");
  } else ok();
}

// ── 11. Commerce containment: no storefront outside the gift page ────────────
{
  // No shell: a $ in the pattern must stay a literal dollar sign, not expand.
  const grep = (flag: string, pattern: string) => {
    try {
      return execFileSync(
        "grep",
        [`-rl${flag}`, "--include=*.ts", "--include=*.tsx", "--exclude-dir=generated", "-e", pattern, "src/"],
        { cwd: ROOT },
      ).toString().trim().split("\n").filter(Boolean).sort();
    } catch {
      return [] as string[]; // grep exits 1 on zero matches
    }
  };
  // The $1.99 price is said in exactly one PRODUCT surface: the gift form.
  // Comments may explain it anywhere, and the terms page may DISCLOSE it —
  // a legal document stating prices is disclosure, not a storefront.
  const priceSites = grep("F", "$1.99").filter((f) => strip(read(f)).includes("$1.99"));
  const allowedPrice = ["src/app/terms/page.tsx", "src/components/meshpro/gift-meshi-item-form.tsx"];
  if (
    priceSites.some((f) => !allowedPrice.includes(f)) ||
    !priceSites.includes("src/components/meshpro/gift-meshi-item-form.tsx")
  ) {
    fail("11 containment", `"$1.99" appears in live code in: ${priceSites.join(", ") || "nowhere"} — the price is said once on the gift page (terms may disclose it), or the form lost it`);
  } else ok();
  // The purchase payload key exists only at its two legitimate ends.
  const payloadSites = grep("F", "meshiItem:");
  const allowedPayload = ["src/app/api/stripe/checkout/route.ts", "src/components/meshpro/gift-meshi-item-form.tsx"];
  if (payloadSites.some((f) => !allowedPayload.includes(f))) {
    fail("11 containment", `the meshiItem checkout payload is built outside the gift form: ${payloadSites.join(", ")}`);
  } else ok();
  // Entry points to the gift page stay total: profile verb + /meshpro surfaces.
  // (The lookahead keeps component paths like meshpro/gift-modes out of scope —
  // this scans for the URL, not for files that live in the meshpro folder.)
  const linkSites = grep("P", "/meshpro/gift(?![a-z-])");
  const allowedLinks = new Set([
    "src/app/(app)/profile/profile-view.tsx",
    "src/app/(app)/meshpro/page.tsx",
    "src/app/(app)/meshpro/gift/page.tsx",
    "src/app/api/stripe/checkout/route.ts",
  ]);
  const strayLinks = linkSites.filter((f) => !allowedLinks.has(f));
  if (strayLinks.length > 0) {
    fail("11 containment", `commerce links leaked into: ${strayLinks.join(", ")} — no picker, feed, message, or mesh entry points`);
  } else ok();
  // And never a buy button in settings.
  if (/meshpro\/gift|\$1\.99|meshiItemLabel/.test(strip(read("src/components/settings/settings-control-center.tsx")))) {
    fail("11 containment", "the settings picker grew wardrobe commerce — locked chips keep their mute Pro tag and nothing else");
  } else ok();
}

// ── 12. Grant-time catalog re-check + recipient notification fence ───────────
{
  if (!/isGiftableMeshiItem\(category, value\)/.test(meshiItem)) {
    fail("12 grant", "applyMeshiItemSession no longer re-validates catalog membership — stale metadata could mint a non-giftable value");
  } else ok();
  if (!/outcome === "created" && purchaserId && purchaserId !== owner\.id/.test(meshiItem)) {
    fail("12 grant", "the notification fires for self-purchases or redeliveries — it is for fresh gifts between two people only");
  } else ok();
  const notifications = strip(read("src/lib/notifications.ts"));
  if (!/meshi_gift:\s*"messages"/.test(notifications)) {
    fail("12 grant", 'meshi_gift lost its "messages" category — the fallback misroutes it to privacy');
  } else ok();
  if (!/if \(notification\.type === "meshi_gift"\) return "\/settings\?tab=meshi";/.test(notifications)) {
    fail("12 grant", "the meshi_gift notification no longer opens the wardrobe");
  } else ok();
  // Schema parity belt (prod-schema-parity-check diffs the full shape).
  if (!/CREATE TABLE IF NOT EXISTS "OwnedMeshiItem"/.test(read("prisma/ensure-schema.sql"))) {
    fail("12 grant", "OwnedMeshiItem is missing from ensure-schema.sql — production never gets the table");
  } else ok();
}

if (failures.length) {
  console.error(`\nmeshi-item: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`meshi-item: all ${checks} assertions passed — the $1.99 piece is owned, isolated, refundable, and sold in exactly one quiet place.`);
