/**
 * FOUNDER ACCOUNTS — MeshPro for life.
 *
 * Held in code rather than granted as a row, because "for life" is a property of
 * the account, not a transaction that happened once. A one-time `UPDATE User SET
 * isMeshPro = 1` would have two holes: it silently affects zero rows if the
 * account does not exist yet (so a founder who signs up later never gets it),
 * and anything that later writes the column can take it away. Derived, it cannot
 * lapse and cannot be missed.
 *
 * `isMeshPro` on the User row still exists and still means "this account has
 * paid" — nothing about billing changes. `hasMeshPro()` is the union of the two,
 * and every read path should ask it rather than the raw column.
 */
export const FOUNDER_USERNAMES = ["stephen", "michaelbucolo"] as const;

/** Case-insensitive: usernames are stored as typed but compared lowercased. */
export function isFounderUsername(username: string | null | undefined): boolean {
  if (!username) return false;
  return (FOUNDER_USERNAMES as readonly string[]).includes(username.trim().toLowerCase());
}

/**
 * Is a gifted MeshPro window still open? Shared by hasMeshPro and the session
 * chokepoint in auth.ts so the two cannot disagree about what "active" means.
 */
export function isMeshProGiftActive(until: Date | null | undefined): boolean {
  return until != null && until.getTime() > Date.now();
}

/**
 * Does this account have MeshPro? Paid, a founder, or inside a gifted window.
 *
 * Takes the fields it needs rather than a full User so it can be called from
 * anywhere — the session user, a profile payload, a presence row — without
 * dragging a Prisma type through the signature.
 *
 * `meshProGiftUntil` is REQUIRED in the shape, not optional, on purpose: an
 * optional field would silently read as "no gift" at every call site whose
 * select never fetched the column, and a gifted member would flicker between
 * Pro and free depending on which query built the object. Requiring it makes
 * the compiler walk every caller when the entitlement grows a new leg.
 */
export function hasMeshPro(
  user: { username?: string | null; isMeshPro?: boolean | null; meshProGiftUntil: Date | null } | null | undefined,
): boolean {
  if (!user) return false;
  return Boolean(user.isMeshPro) || isFounderUsername(user.username) || isMeshProGiftActive(user.meshProGiftUntil);
}

/**
 * Gift MeshPro — prepaid months for someone else. One payment, no subscription
 * attached to the recipient, and nothing here ever writes `isMeshPro`: the
 * grant lands in `meshProGiftUntil`, which subscription churn cannot touch.
 * Prices are one-time Stripe Prices (a recurring price is rejected outright by
 * `mode: "payment"` checkouts) keyed by env in stripe.ts, mirroring
 * MESH_PRO_PLANS.
 */
export const MESH_PRO_GIFT_PRICING = {
  "1m": { id: "1m", months: 1, label: "1 month", price: "$4.99", detail: "A taste of the gold rim." },
  "3m": { id: "3m", months: 3, label: "3 months", price: "$12.99", detail: "A season of it." },
  "12m": { id: "12m", months: 12, label: "12 months", price: "$39.99", detail: "A whole year, on you." },
} as const;

export type MeshProGiftPlan = keyof typeof MESH_PRO_GIFT_PRICING;

/** The longest message a gift can carry — rendered as plain text, never markup. */
export const MESH_PRO_GIFT_MESSAGE_MAX = 280;

export const MESH_PRO_PRICING = {
  monthly: {
    id: "monthly",
    label: "Monthly",
    price: "$4.99",
    interval: "month",
    detail: "Best for trying MeshPro.",
    savings: null,
  },
  yearly: {
    id: "yearly",
    label: "Yearly",
    price: "$39.99",
    interval: "year",
    detail: "Best value for creators and power users.",
    savings: "Save 33%",
  },
} as const;

export const FREE_MESHI_OPTIONS = {
  hats: new Set(["none", "cap"]),
  faces: new Set(["happy", "thinking", "wink"]),
  colors: new Set(["blue", "purple", "green"]),
  hairs: new Set(["none"]),
  accessories: new Set(["none"]),
  eyes: new Set(["regular"]),
  badges: new Set(["none"]),
} as const;

export function isFreeMeshiOption(group: keyof typeof FREE_MESHI_OPTIONS, value: string | null | undefined) {
  return FREE_MESHI_OPTIONS[group].has((value || "none").trim().toLowerCase());
}
