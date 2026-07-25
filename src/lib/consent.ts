import "server-only";
import { prisma } from "./prisma";

/**
 * Consent gates for the three DataVisibilityPolicy switches.
 *
 * The privacy control center shows one dropdown per data category and the
 * client expands each choice into three booleans on DataVisibilityPolicy:
 * `allowDiscovery`, `allowAnalytics`, `allowMeshiUse`. They were written and
 * echoed back to the UI, but nothing ever read them — the switches promised
 * control over discovery, analytics and Meshi and changed nothing. This module
 * is the single place those three promises are turned into real filters.
 *
 * Two rules hold everywhere in here:
 *
 *  1. ABSENT POLICY = PERMISSIVE. A user with no row for a category has not
 *     answered the question, so they keep today's behaviour. This mirrors the
 *     sibling `visibility` field, which is already enforced exactly this way in
 *     /api/mesh: `!policy || (policy.visibility !== "private" && ...)`. It is
 *     also why turning these gates on does not blank the app for the (large)
 *     majority of accounts, which have no policy rows at all.
 *
 *  2. ONE FLAG IS ONLY EVER READ ON THE CATEGORY ITS SWITCH GOVERNS. The client
 *     writes all three booleans on every row, so a row carries values it has no
 *     opinion about — `allowMeshiUse` is hard-coded `false` on every category
 *     except `meshi_memory`, for instance. Reading a flag outside its own
 *     category would enforce a placeholder instead of a choice, so each helper
 *     below pins the entityType it consults.
 *
 * The category → flag map, taken from the UI copy in
 * src/components/privacy/privacy-control-center.tsx:
 *
 *   profile       "Who can discover your identity outside direct shares."
 *                 → allowDiscovery gates the USER appearing in people
 *                   discovery (search, suggestions, global mesh membership).
 *   native_posts  "Default handling for posts created directly on Mesh.me."
 *                 → allowDiscovery gates the user's NATIVE POSTS appearing in
 *                   content discovery (explore, search, discover feed).
 *   analytics     "Performance data used inside the private analytics
 *                 dashboard."
 *                 → allowAnalytics gates computing that dashboard.
 *   meshi_memory  "What Meshi can use locally to answer questions about your
 *                 Mesh."
 *                 → allowMeshiUse gates Meshi reading the user's mesh, and
 *                   gates their data being surfaced through anyone else's
 *                   Meshi or shipped to the reasoning provider.
 *
 * Imported platform content is deliberately NOT covered by allowDiscovery: the
 * privacy centre governs it through per-post `PlatformPost.visibility`, which
 * every discovery query already filters on (`visibility: "public"`), and the
 * per-post policy row's allowDiscovery is written as an exact mirror of that
 * same choice (`visibility === "public"`). Gating on it a second time would add
 * machinery without adding a promise.
 */

// The privacy centre renamed this category; rows written before the rename are
// still in the table and the UI still folds them together, so every read has to
// accept both spellings. Mirrors LEGACY_ENTITY_ALIASES in /api/data-controls.
const MESHI_CATEGORIES = ["meshi_memory", "meshi_ai"];

/**
 * Does a loaded policy row grant `flag`? A missing row is a grant (rule 1).
 * Exported for in-memory call sites that have already fetched policies, and to
 * give the consent gate a pure function to assert against.
 */
export function policyGrants(
  policy: { allowDiscovery?: boolean; allowAnalytics?: boolean; allowMeshiUse?: boolean } | null | undefined,
  flag: "allowDiscovery" | "allowAnalytics" | "allowMeshiUse",
): boolean {
  if (!policy) return true;
  return policy[flag] !== false;
}

// ─── allowDiscovery ─────────────────────────────────────────────────────────

/**
 * Filter fragment for a User `where` — "this account did not switch profile
 * discovery off". Spread it next to the `showInDiscovery: true` clause it
 * refines; `showInDiscovery` is the account-wide switch, this is the privacy
 * centre's per-category one.
 *
 * Expressed as `none: { ...allowDiscovery: false }` rather than
 * `some: { allowDiscovery: true }` precisely so that having no row passes.
 */
export function profileDiscoveryConsentWhere() {
  return {
    dataVisibilityPolicies: {
      none: { entityType: "profile", entityId: null, allowDiscovery: false },
    },
  };
}

/**
 * Filter fragment for a User `where` — "this account did not switch native-post
 * discovery off". Applies to the POST AUTHOR, so it belongs inside the
 * `author: { ... }` / `user: { ... }` clause of a post query.
 */
export function nativePostDiscoveryConsentWhere() {
  return {
    dataVisibilityPolicies: {
      none: { entityType: "native_posts", entityId: null, allowDiscovery: false },
    },
  };
}

// ─── allowAnalytics ─────────────────────────────────────────────────────────

/**
 * May we compute the private analytics dashboard for this user? False only
 * when they explicitly set the Analytics category to a denying value — the
 * whole dashboard is derived from their own activity, so the honest response to
 * a denial is not to build it at all.
 */
export async function hasAnalyticsConsent(userId: string): Promise<boolean> {
  const denial = await prisma.dataVisibilityPolicy.findFirst({
    where: { userId, entityType: "analytics", entityId: null, allowAnalytics: false },
    select: { id: true },
  });
  return !denial;
}

// ─── allowMeshiUse ──────────────────────────────────────────────────────────

/**
 * May Meshi (and the reasoning provider behind it) use this user's mesh data?
 * Read in both directions: for the caller, before grounding an answer in their
 * own mesh or shipping their mesh context upstream; and for a THIRD PARTY,
 * before their posts, channels or presence are surfaced through someone else's
 * Meshi. The second direction is the one that actually leaves the account —
 * a grounded answer is pasted verbatim into the OpenAI prompt.
 */
export async function hasMeshiConsent(userId: string): Promise<boolean> {
  const denial = await prisma.dataVisibilityPolicy.findFirst({
    where: {
      userId,
      entityType: { in: MESHI_CATEGORIES },
      entityId: null,
      allowMeshiUse: false,
    },
    select: { id: true },
  });
  return !denial;
}

/**
 * Filter fragment for a User `where` — "this account did not switch Meshi use
 * off". Every Meshi read reaches its subjects through a Prisma query, so this
 * one fragment covers them all: the person resolver behind the five person_*
 * intents, the cross-author post search, and the presence roll-call.
 */
export function meshiConsentWhere() {
  return {
    dataVisibilityPolicies: {
      none: { entityType: { in: MESHI_CATEGORIES }, entityId: null, allowMeshiUse: false },
    },
  };
}

/**
 * Which of these user ids switched Meshi use OFF. Absent row = permissive, the
 * same rule the fragments above encode; the query asks only for denials.
 *
 * This exists because one Meshi path does not reach its subjects through a
 * Prisma query the server controls: the mesh graph is loaded for the mesh UI,
 * handed to the client, and posted back as `context.meshEntities`, which is
 * rendered into the reasoning provider's prompt. Gating the graph read itself
 * would be wrong — it also draws the person's own mesh, and someone who
 * declined Meshi should still appear there. The consent question is only about
 * EGRESS, so it is answered here, at the egress.
 */
export async function meshiDeniedUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const denials = await prisma.dataVisibilityPolicy.findMany({
    where: {
      userId: { in: userIds },
      entityType: { in: MESHI_CATEGORIES },
      entityId: null,
      allowMeshiUse: false,
    },
    select: { userId: true },
  });
  return new Set(denials.map((d) => d.userId));
}
