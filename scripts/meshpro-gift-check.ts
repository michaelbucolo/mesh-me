/**
 * GIFTED MESHPRO — a prepaid window nobody else's churn can close.
 *
 * A gift is the one entitlement that arrives on an account through somebody
 * ELSE's payment, which makes it uniquely exposed to two failure shapes this
 * repo has already lived through in other clothes:
 *
 *   1. THE COLUMN CLOBBER. `syncMeshProSubscription` writes
 *      `isMeshPro: isActive` on every Stripe subscription event. A gift stored
 *      in that column would be silently revoked the moment any subscription
 *      lapses — the founder grant had exactly this hole before it was derived.
 *      So the gift lives in its own column (`meshProGiftUntil`) and
 *      `hasMeshPro()` unions it, and this gate pins both halves.
 *
 *   2. THE WRONG-BENEFICIARY BRANCH. The webhook's completed-checkout handler
 *      ends in `else if (userId) → isMeshPro: true` — a permanent grant to the
 *      metadata user. A gift is a one-time payment with no subscription, so an
 *      unbranched gift would fall into exactly that arm and hand the PURCHASER
 *      lifetime MeshPro for buying someone else a month. The gift branch must
 *      therefore come FIRST, and this gate pins the order.
 *
 * Assertions:
 *   1. Behaviour: an open gift window IS MeshPro; a lapsed one is not; the
 *      boundary is honoured; no gift plus no payment is free.
 *   2. Churn independence: syncMeshProSubscription cannot touch the gift
 *      column, and the gift handler cannot touch billing's columns.
 *   3. Webhook order: the meshpro-gift branch runs before any subscription
 *      sync or fallback grant in the completed-checkout case.
 *   4. Payment mode: the gift checkout is `mode: "payment"` (recipient
 *      inherits days, never a billing relationship) with the gift price
 *      env-keyed, and its safety fence (self / founder / block both ways /
 *      message cap) is present at the checkout edge.
 *   5. The session chokepoint resolves gifts, so every session-user raw read
 *      that founder-pro-check §6 exempts stays correct for gifted members.
 *   6. Presence and the mesh payloads emit hasMeshPro(), not the raw column —
 *      the rim other people see cannot disagree with /meshpro.
 *   7. Idempotency: the receipt row is keyed on the Stripe session id and the
 *      P2002 retry is swallowed, so webhook redelivery grants exactly once.
 *
 * WHAT THIS CANNOT PROVE: that Stripe delivers the webhook, or that the
 * dashboard's gift Prices are truly one-time (payment mode rejects recurring
 * prices at runtime, loudly). It pins the code's shape, not Stripe's config.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasMeshPro, isMeshProGiftActive } from "../src/lib/mesh-pro";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const HOUR = 60 * 60 * 1000;

// ── 1. Behaviour: the window is the entitlement ──────────────────────────────
{
  const openGift = { username: "someone", isMeshPro: false, meshProGiftUntil: new Date(Date.now() + 24 * HOUR) };
  if (!hasMeshPro(openGift)) fail("1 window", "an open gifted window does not resolve to MeshPro");
  else ok();

  const lapsed = { username: "someone", isMeshPro: false, meshProGiftUntil: new Date(Date.now() - HOUR) };
  if (hasMeshPro(lapsed)) fail("1 window", "a lapsed gift still resolves to MeshPro — expiry is not honoured");
  else ok();

  if (isMeshProGiftActive(new Date(Date.now() - 1))) fail("1 window", "isMeshProGiftActive treats the past as open");
  else ok();
  if (!isMeshProGiftActive(new Date(Date.now() + 1000))) fail("1 window", "isMeshProGiftActive treats the near future as closed");
  else ok();
  if (isMeshProGiftActive(null) || isMeshProGiftActive(undefined)) {
    fail("1 window", "isMeshProGiftActive(null/undefined) returned true");
  } else ok();

  if (hasMeshPro({ username: "someone", isMeshPro: false, meshProGiftUntil: null })) {
    fail("1 window", "no payment and no gift resolved to MeshPro");
  } else ok();
  // A gift must never DOWNGRADE the other legs.
  if (!hasMeshPro({ username: "someone", isMeshPro: true, meshProGiftUntil: new Date(Date.now() - HOUR) })) {
    fail("1 window", "a paid member with an old lapsed gift lost MeshPro");
  } else ok();
  if (!hasMeshPro({ username: "michaelbucolo", isMeshPro: false, meshProGiftUntil: new Date(Date.now() - HOUR) })) {
    fail("1 window", "a founder with an old lapsed gift lost MeshPro");
  } else ok();
}

// ── 2. Churn independence, both directions ───────────────────────────────────
{
  const billing = strip(read("src/lib/stripe-billing.ts"));
  const syncFn = /export async function syncMeshProSubscription[\s\S]*?\n}/.exec(billing)?.[0] ?? "";
  if (!syncFn) fail("2 churn", "syncMeshProSubscription not found in stripe-billing.ts");
  else if (/meshProGiftUntil/.test(syncFn)) {
    fail("2 churn", "syncMeshProSubscription touches meshProGiftUntil — subscription churn can now revoke gifts");
  } else ok();

  const giftFn = /export async function applyMeshProGiftSession[\s\S]*?\n}\n\nexport/.exec(billing + "\n\nexport")?.[0] ?? "";
  if (!giftFn) fail("2 churn", "applyMeshProGiftSession not found in stripe-billing.ts — the webhook has nothing to grant with");
  else {
    ok();
    for (const forbidden of ["isMeshPro:", "meshProSince:", "stripeSubscriptionId:"]) {
      if (giftFn.includes(forbidden)) {
        fail("2 churn", `applyMeshProGiftSession writes ${forbidden.replace(":", "")} — a gift must never touch billing's columns`);
      } else ok();
    }
    if (!/meshProGiftUntil/.test(giftFn)) {
      fail("2 churn", "applyMeshProGiftSession no longer writes meshProGiftUntil — the gift grants nothing");
    } else ok();
  }
}

// ── 3. The webhook branches gift-first ───────────────────────────────────────
{
  const webhook = strip(read("src/app/api/stripe/webhook/route.ts"));
  const completedCase = /case "checkout\.session\.completed":[\s\S]*?break;\s*\n\s*}/.exec(webhook)?.[0] ?? "";
  if (!completedCase) fail("3 order", "checkout.session.completed case not found in the webhook");
  else {
    const giftAt = completedCase.indexOf("meshpro-gift");
    const syncAt = completedCase.indexOf("syncMeshProSubscription");
    const grantAt = completedCase.indexOf("isMeshPro: true");
    if (giftAt < 0) {
      fail("3 order", "the webhook's completed-checkout case has no meshpro-gift branch — a gift payment would grant the purchaser via the userId fallback");
    } else ok();
    if (giftAt >= 0 && syncAt >= 0 && giftAt > syncAt) {
      fail("3 order", "the meshpro-gift branch runs AFTER the subscription sync — branch order regressed");
    } else ok();
    if (giftAt >= 0 && grantAt >= 0 && giftAt > grantAt) {
      fail("3 order", "the meshpro-gift branch runs AFTER the permanent isMeshPro grant — a gift would mark the purchaser Pro");
    } else ok();
  }
}

// ── 4. Payment mode + the safety fence at the checkout edge ──────────────────
{
  const checkout = strip(read("src/app/api/stripe/checkout/route.ts"));
  const giftBranch = /giftPlan !== undefined[\s\S]*?const plan = parseMeshProPlan/.exec(checkout)?.[0] ?? "";
  if (!giftBranch) fail("4 checkout", "the gift branch is gone from the checkout route");
  else {
    ok();
    if (!/mode:\s*"payment"/.test(giftBranch)) {
      fail("4 checkout", 'the gift checkout is not mode: "payment" — a subscription would bind the recipient to billing');
    } else ok();
    if (!/getMeshProGiftPriceId\(/.test(giftBranch)) {
      fail("4 checkout", "the gift checkout no longer resolves the env-keyed one-time gift price");
    } else ok();
    if (/getMeshProPriceId\(/.test(giftBranch)) {
      fail("4 checkout", "the gift checkout resolves a RECURRING plan price — payment mode will reject it at runtime");
    } else ok();
    if (!/product:\s*"meshpro-gift"/.test(giftBranch)) {
      fail("4 checkout", 'gift checkout metadata lost product: "meshpro-gift" — the webhook cannot route the grant');
    } else ok();
  }
  const fence = /async function validateGiftRecipient[\s\S]*?\n}/.exec(checkout)?.[0] ?? "";
  if (!fence) fail("4 checkout", "validateGiftRecipient is gone — the gift safety fence no longer exists");
  else {
    ok();
    if (!/recipient\.id === purchaser\.id/.test(fence)) {
      fail("4 checkout", "self-gifting is no longer refused");
    } else ok();
    if (!/isFounderUsername\(/.test(fence)) {
      fail("4 checkout", "founders can be gift recipients — money taken for an entitlement they already hold for life");
    } else ok();
    const blockDirections = (fence.match(/blockerId:\s*(purchaser\.id|recipient\.id)/g) ?? []).length;
    if (blockDirections < 2) {
      fail("4 checkout", "the block check no longer covers both directions — a gift is a contact vector across a block");
    } else ok();
  }
  if (!/MESH_PRO_GIFT_MESSAGE_MAX/.test(checkout)) {
    fail("4 checkout", "the gift message length cap is gone from the checkout edge");
  } else ok();
}

// ── 5. The session chokepoint resolves gifts ─────────────────────────────────
{
  const auth = strip(read("src/lib/auth.ts"));
  if (!/isMeshProGiftActive\(/.test(auth)) {
    fail("5 session", "getCurrentUser no longer resolves gifted windows — every session-user raw isMeshPro read (the ones founder-pro-check §6 exempts) is stale for gifted members");
  } else ok();
}

// ── 6. Payloads other people see emit the derived mark ───────────────────────
{
  const presence = strip(read("src/app/api/mesh/presence/route.ts"));
  if (!/isPro:\s*hasMeshPro\(/.test(presence) || /isPro:\s*Boolean\(user\.isMeshPro\)/.test(presence)) {
    fail("6 broadcast", "the presence heartbeat no longer derives isPro via hasMeshPro() — the rim the room sees can disagree with /meshpro");
  } else ok();
  const meshRoute = strip(read("src/app/api/mesh/route.ts"));
  if (/isMeshPro:\s*user\.isMeshPro\b/.test(meshRoute) || /isMeshPro:\s*targetUser\.isMeshPro\b/.test(meshRoute)) {
    fail("6 broadcast", "a mesh payload reads the raw isMeshPro column again — use hasMeshPro() on both sides of the visit");
  } else ok();
  const cache = strip(read("src/lib/mechat-meshi-cache.ts"));
  if (!/hasMeshPro\(/.test(cache)) {
    fail("6 broadcast", "the MeChat Meshi cache no longer derives isPro — typing/read-receipt Meshis lost the mark");
  } else ok();
}

// ── 7. Redelivery grants exactly once ────────────────────────────────────────
{
  const billing = strip(read("src/lib/stripe-billing.ts"));
  const giftFn = /export async function applyMeshProGiftSession[\s\S]*?\n}\n\nexport/.exec(billing + "\n\nexport")?.[0] ?? "";
  if (giftFn && !/stripeSessionId:\s*session\.id\s*,/.test(giftFn)) {
    fail("7 idempotent", "the gift receipt row is no longer keyed on the checkout session id — Stripe redelivery would stack months twice");
  } else ok();
  if (giftFn && !/P2002/.test(giftFn)) {
    fail("7 idempotent", "the unique-violation retry path is gone — Stripe redelivery would 500 forever instead of settling");
  } else ok();
  const schema = read("prisma/schema.prisma");
  if (!/stripeSessionId String\s+@unique/.test(schema)) {
    fail("7 idempotent", "MeshProGift.stripeSessionId lost @unique — the idempotency key is decorative");
  } else ok();
}

if (failures.length) {
  console.error(`\nmeshpro-gift: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  console.error("");
  process.exit(1);
}
console.log(`meshpro-gift: ${checks} assertions passed — gifts grant the recipient, stack once, and outlive everyone else's churn.`);
