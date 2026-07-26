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
 * Does this account have MeshPro? Paid, or a founder.
 *
 * Takes the two fields it needs rather than a full User so it can be called
 * from anywhere — the session user, a profile payload, a presence row — without
 * dragging a Prisma type through the signature.
 */
export function hasMeshPro(user: { username?: string | null; isMeshPro?: boolean | null } | null | undefined): boolean {
  if (!user) return false;
  return Boolean(user.isMeshPro) || isFounderUsername(user.username);
}

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
  outfits: new Set(["none"]),
} as const;

export function isFreeMeshiOption(group: keyof typeof FREE_MESHI_OPTIONS, value: string | null | undefined) {
  return FREE_MESHI_OPTIONS[group].has((value || "none").trim().toLowerCase());
}
