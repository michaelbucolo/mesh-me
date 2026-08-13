/**
 * MESHI PROVENANCE — the stitched-in garment label: passive, fenced, unnamed.
 *
 * The failure shapes this gate exists to catch, each fatal to a promise the
 * design ruled on explicitly:
 *
 *   - THE LABEL THAT SELLS: a link, a price, or a pitch inside a label
 *     renderer turns a garment tag into injected commerce on a social
 *     surface — banned platform-wide, no exceptions.
 *   - THE NAME THAT LEAKS: every purchaserId was written under a
 *     recipient-only disclosure contract. A public payload that starts
 *     selecting purchaser fields hands the who-funds-whom graph to anyone
 *     who taps a Meshi.
 *   - THE SIDE CHANNEL: provenance answered past the profile-visibility
 *     fence would out-see the profile itself. The fence adjudicates FIRST.
 *   - COMPELLED DISCLOSURE: wearing a gift must not force the owner to
 *     announce it — the quiet switch has exactly one writer, owner-scoped.
 *   - THE UNDEAD RECEIPT: a revoked (refunded) piece labeling itself as a
 *     live gift would let a chargeback keep its sentiment.
 *
 * WHAT THIS CANNOT PROVE (stated): source text, not dataflow; dynamically
 * assembled queries are invisible; a future surface that renders labels
 * without importing the resolver is caught only by review.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveWornGiftLabels } from "../src/lib/meshi-provenance";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const strip = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const failures: string[] = [];
const fail = (section: string, detail: string) => failures.push(`[${section}] ${detail}`);
let checks = 0;
const ok = () => { checks += 1; };

const provenance = strip(read("src/lib/meshi-provenance.ts"));
const actions = strip(read("src/lib/actions.ts"));
const queries = strip(read("src/lib/queries.ts"));
const nodeDetail = strip(read("src/components/mesh/ui/node-detail.tsx"));
const profileView = strip(read("src/app/(app)/profile/profile-view.tsx"));
const panel = strip(read("src/components/settings/meshi-wardrobe-panel.tsx"));
const meshiLayer = strip(read("src/components/mesh/live/meshi-layer.tsx"));

function body(source: string, marker: string) {
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const next = source.indexOf("export ", start + marker.length);
  return next > start ? source.slice(start, next) : source.slice(start);
}

/** The render block for a marker like `{giftLabels.length > 0 && (` — from the
 *  marker to the next line that closes the conditional at its indent. */
function renderBlock(source: string, marker: string) {
  const start = source.indexOf(marker);
  if (start < 0) return "";
  const close = source.indexOf(")}", start);
  return close > start ? source.slice(start, close + 2) : "";
}

// ── 1. The CTA fence is absolute ─────────────────────────────────────────────
{
  // The pure module renders toward social surfaces: no links, prices, or
  // checkout anywhere near it.
  if (/href|<Link|<a |\/meshpro|\$1\.99|MeshProCheckoutButton|stripe/i.test(provenance)) {
    fail("1 fence", "meshi-provenance.ts grew a link, price, or checkout reference — the label may inform, never sell");
  } else ok();

  const meshLabelBlock = renderBlock(nodeDetail, "{giftLabels.length > 0 && (");
  if (!meshLabelBlock) {
    fail("1 fence", "node-detail.tsx no longer renders the garment label block");
  } else if (/href|<Link|\/meshpro|\$1\.99/.test(meshLabelBlock)) {
    fail("1 fence", "the mesh garment label carries a link or price — injected commerce on a social surface");
  } else ok();

  const profileLabelBlock = renderBlock(profileView, "{profile.wornGiftLabels.length > 0 && (");
  if (!profileLabelBlock) {
    fail("1 fence", "profile-view.tsx no longer renders the garment label lines");
  } else if (/href|<Link|\/meshpro|\$1\.99/.test(profileLabelBlock)) {
    fail("1 fence", "the profile garment label carries a link or price");
  } else ok();

  // The owner's wardrobe shelf is history, not a storefront.
  if (/<Link|<a |href=|\/meshpro|\$1\.99|meshiItemLabel|MeshProCheckoutButton/.test(panel)) {
    fail("1 fence", "meshi-wardrobe-panel.tsx grew a link, price, or label import — the shelf is not a storefront");
  } else ok();

  // Hover previews and presence sprites get nothing: passive also means not
  // everywhere. The live layer must never import provenance.
  if (/meshi-provenance|getMeshiProvenance|wornGiftLabels/.test(meshiLayer)) {
    fail("1 fence", "meshi-layer.tsx reaches for provenance — hover/presence surfaces were ruled out");
  } else ok();
}

// ── 2. The name never leaves the owner's ring ────────────────────────────────
{
  // Truth-table the resolver: no output field but label + month-year string.
  const pref = {
    hatStyle: "tophat", faceStyle: "happy", colorTheme: "blue", hairStyle: "none",
    hairColor: "inherit", accessoryStyle: "none", eyeStyle: "regular", badgeStyle: "none",
  };
  const mid = new Date("2026-03-15T12:00:00Z");
  const giftRow = { category: "hats", value: "tophat", createdAt: mid, ownerId: "o", purchaserId: "p", revokedAt: null, labelQuietedAt: null };

  const gift = resolveWornGiftLabels(pref, [giftRow]);
  if (gift.length !== 1 || gift[0].label !== "Top hat" || gift[0].since !== "March 2026") {
    fail("2 name", `a live worn gift resolves wrong: ${JSON.stringify(gift)}`);
  } else ok();
  if (gift.length === 1 && Object.keys(gift[0]).sort().join(",") !== "label,since") {
    fail("2 name", `the public shape leaks fields beyond label+since: ${Object.keys(gift[0]).join(",")}`);
  } else ok();
  if (JSON.stringify(gift).includes("March 15")) {
    fail("2 name", "the public label carries an exact date — month-year is the granularity");
  } else ok();

  if (resolveWornGiftLabels(pref, [{ ...giftRow, purchaserId: "o" }]).length !== 0) {
    fail("2 name", "a self-purchase resolves a public mark");
  } else ok();
  if (resolveWornGiftLabels(pref, [{ ...giftRow, purchaserId: null }]).length !== 1) {
    fail("2 name", "a deleted gifter erased the mark — the mark never carried their name, so it must survive");
  } else ok();
  if (resolveWornGiftLabels(pref, [{ ...giftRow, labelQuietedAt: mid }]).length !== 0) {
    fail("2 name", "a quieted piece still resolves — compelled disclosure");
  } else ok();
  if (resolveWornGiftLabels(pref, [{ ...giftRow, revokedAt: mid }]).length !== 0) {
    fail("2 name", "a revoked (refunded) piece still resolves — the chargeback kept its sentiment");
  } else ok();
  if (resolveWornGiftLabels({ ...pref, hatStyle: "none" }, [giftRow]).length !== 0) {
    fail("2 name", "an unworn piece resolves — the label describes the Meshi in front of you, not a closet");
  } else ok();

  // The two public query sites never select purchaser fields.
  const meshQuery = body(actions, "export async function getMeshiProvenance");
  if (!/select: \{ category: true, value: true, createdAt: true \}/.test(meshQuery) || /purchaser: |message: true/.test(meshQuery)) {
    fail("2 name", "getMeshiProvenance selects beyond category/value/createdAt — purchaser fields on a public path");
  } else ok();
  const profileLabels = queries.slice(queries.indexOf("let wornGiftLabels"), queries.indexOf("return {", queries.indexOf("let wornGiftLabels")));
  if (!profileLabels || !/select: \{ category: true, value: true, createdAt: true \}/.test(profileLabels) || /purchaser: |message: true/.test(profileLabels)) {
    fail("2 name", "the profile payload's gift rows select beyond category/value/createdAt");
  } else ok();
  // Exactly one display query may name the purchaser: the self-scoped
  // settings payload.
  if ((queries.match(/purchaser: \{ select: \{ displayName: true \} \}/g) ?? []).length !== 1) {
    fail("2 name", "purchaser.displayName is selected in more or fewer than one query site — the settings payload is the only ring with names");
  } else ok();
}

// ── 3. The note is the owner's, and only the owner's ─────────────────────────
{
  // message reaches display in exactly two places: the grant notification
  // (meshi-item.ts, pinned by meshi-item-check §12) and the settings payload.
  if ((queries.match(/message: true/g) ?? []).length !== 1) {
    fail("3 note", "OwnedMeshiItem.message is selected in more or fewer than one queries.ts site");
  } else ok();
  // Post-grant, exactly one writer exists and it writes null (removal).
  if ((actions.match(/data: \{ message: null \}/g) ?? []).length !== 1) {
    fail("3 note", "removeMeshiGiftNote's null-write is missing or duplicated");
  } else ok();
  const noteBody = body(actions, "export async function removeMeshiGiftNote");
  if (!/ownerId: user\.id/.test(noteBody)) {
    fail("3 note", "removeMeshiGiftNote lost its ownership fence");
  } else ok();
}

// ── 4. The fence adjudicates FIRST ───────────────────────────────────────────
{
  const meshQuery = body(actions, "export async function getMeshiProvenance");
  const fenceAt = meshQuery.indexOf("canViewProfile(");
  const blockAt = meshQuery.indexOf("prisma.block.findFirst");
  const wardrobeAt = meshQuery.indexOf("ownedMeshiItem.findMany");
  if (fenceAt < 0 || wardrobeAt < 0 || fenceAt > wardrobeAt) {
    fail("4 fence-order", "getMeshiProvenance reads wardrobe rows before canViewProfile — provenance out-sees the profile");
  } else ok();
  if (blockAt < 0 || blockAt > wardrobeAt) {
    fail("4 fence-order", "getMeshiProvenance reads wardrobe rows before the block check");
  } else ok();
  // The profile payload computes labels only behind profileVisible.
  if (!/if \(profileVisible && user\.meshiPreference\)/.test(queries)) {
    fail("4 fence-order", "the profile payload's labels are no longer fenced on profileVisible");
  } else ok();
  // Never on the cached mesh payload: one viewer's answer must not serve
  // another. The mesh-cache module stays provenance-free.
  if (/meshi-provenance|wornGiftLabels/.test(strip(read("src/lib/mesh-cache.ts")))) {
    fail("4 fence-order", "mesh-cache.ts touches provenance — a cached digest would serve one viewer's fence to everyone");
  } else ok();
}

// ── 5. The quiet switch: one writer, owner-scoped, gifts only ────────────────
{
  const writers = (actions + provenance + queries + strip(read("src/lib/meshi-item.ts")) + strip(read("src/lib/stripe-billing.ts"))).match(/labelQuietedAt: quiet|data: \{ labelQuietedAt/g) ?? [];
  if (writers.length !== 1) {
    fail("5 quiet", `labelQuietedAt is written from ${writers.length} sites — setMeshiGiftLabelQuiet must be the only writer`);
  } else ok();
  const quietBody = body(actions, "export async function setMeshiGiftLabelQuiet");
  if (!/ownerId: user\.id/.test(quietBody) || !/purchaserId: \{ not: user\.id \}/.test(quietBody) || !/revokedAt: null/.test(quietBody)) {
    fail("5 quiet", "setMeshiGiftLabelQuiet lost its owner/gift/live scoping — a self-purchase or revoked row could be toggled");
  } else ok();
}

// ── 6. Refund-scan extension (the gap both designers missed) ─────────────────
{
  // meshi-item-check §9 counts `revokedAt: new Date()` writers across a fixed
  // file list. New provenance-era modules must stay out of the revocation
  // business — re-run the census with them added.
  const scanned =
    strip(read("src/lib/meshi-item.ts")) + actions + queries +
    strip(read("src/lib/stripe-billing.ts")) +
    strip(read("src/app/api/stripe/checkout/route.ts")) +
    strip(read("src/app/api/stripe/webhook/route.ts")) +
    provenance + panel + strip(read("src/lib/meshi-wardrobe.ts"));
  const revokers = scanned.match(/revokedAt: new Date\(\)/g) ?? [];
  if (revokers.length !== 1) {
    fail("6 refund-scan", `revokedAt is written from ${revokers.length} sites with provenance modules included — the refund path must stay the only writer`);
  } else ok();
}

// ── 7. Quiet by law ──────────────────────────────────────────────────────────
{
  if (/notification\.create|sendPushForNotification/.test(provenance + panel)) {
    fail("7 quiet-law", "a provenance/recipe surface sends notifications — nothing here notifies, ever");
  } else ok();
  if (/hasMeshPro/.test(provenance)) {
    fail("7 quiet-law", "meshi-provenance.ts imports hasMeshPro — provenance has zero Pro surface in any direction");
  } else ok();
  if (/uppercase/.test(panel + provenance)) {
    fail("7 quiet-law", "an uppercase transform appeared in the new surfaces — typography law");
  } else ok();
  // The provenance action's answer is computed fresh per request.
  if (/unstable_cache|mesh-cache/.test(body(actions, "export async function getMeshiProvenance"))) {
    fail("7 quiet-law", "getMeshiProvenance caches — one viewer's fence would serve another");
  } else ok();
}

// ── 8. Schema parity + preview pin ───────────────────────────────────────────
{
  const ensure = read("prisma/ensure-schema.sql");
  const ensureItem = /CREATE TABLE IF NOT EXISTS "OwnedMeshiItem" \([\s\S]*?\);/.exec(ensure)?.[0] ?? "";
  if (!/"labelQuietedAt" DATETIME/.test(ensureItem)) {
    fail("8 parity", "labelQuietedAt is missing from ensure-schema.sql — production never gets the quiet switch");
  } else ok();
  const schemaItem = /model OwnedMeshiItem \{[\s\S]*?\n\}/.exec(read("prisma/schema.prisma"))?.[0] ?? "";
  if (!/labelQuietedAt\s+DateTime\?/.test(schemaItem)) {
    fail("8 parity", "labelQuietedAt is missing from schema.prisma");
  } else ok();
  // getGiftPreviewMeshi stays pinned to category:value — its select must
  // never grow purchaser fields.
  const preview = body(actions, "export async function getGiftPreviewMeshi");
  if (!/select: \{ category: true, value: true \}/.test(preview) || /purchaserId|message/.test(preview)) {
    fail("8 parity", "getGiftPreviewMeshi's select grew beyond category/value — the gift page must not learn provenance");
  } else ok();
}

if (failures.length) {
  console.error(`\nmeshi-provenance: ${failures.length} failure(s) across ${checks + failures.length} assertions\n`);
  for (const f of failures) console.error("  " + f);
  process.exit(1);
}
console.log(`meshi-provenance: all ${checks} assertions passed — the garment label informs, never sells, never names, and never out-sees the profile.`);
