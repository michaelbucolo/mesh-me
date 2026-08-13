// THE MESHI WARDROBE, AS DATA.
//
// actions.ts is a "use server" module, which may only export async functions —
// so the wardrobe's vocabulary (which axes exist, what values each accepts,
// what a fresh Meshi wears) lived there as private consts, reachable by nobody
// else. Wardrobe gifts need that vocabulary in three more places (checkout
// validation, the grant path, the gift form), so the DATA moved here, verbatim.
// The GATE FUNCTIONS that consume it stay in actions.ts on purpose: they are
// the adjudicators of what a save may do, and the gates that audit them
// (founder-pro-check §8, charter-check §9) read actions.ts source directly.
//
// This module also owns the $1.99 giftable catalog. It is DERIVED, not listed:
// premium = everything the option table accepts minus the free set, minus the
// things money must never buy — status badges (charter/founder/verified/
// creator are records of fact, not merchandise), the body-color axis (gold and
// rainbow trade on the server-authoritative Pro rim), and accessories (a
// multi-token slot string, not one ownable value). A value added to the
// wardrobe tomorrow becomes giftable automatically unless a fence here says
// otherwise.

import { MESHI_FACE_IDS, MESHI_FACE_LABELS, MESHI_LASH_IDS, MESHI_LASH_LABELS, type MeshiFace, type MeshiLash } from "@/components/meshi/meshi-face";
import { MESHI_HAIR_COLOR_IDS, MESHI_HAIR_COLOR_LABELS, MESHI_HAIR_IDS, MESHI_HAIR_LABELS } from "@/components/meshi/meshi-hair";
import { ALL_ACCESSORY_ITEMS } from "@/components/meshi/meshi-slots";
import { FREE_MESHI_OPTIONS } from "./mesh-pro";

export const MESHI_OPTION_VALUES = {
  hats: new Set(["none", "tophat", "beanie", "cap", "party", "crown", "flower", "headphones", "halo", "wizard", "astronaut", "pirate", "chef", "beret", "headband", "bow", "cowboy", "graduation"]),
  // faceStyle now stores a FACE — a persistent eye shape — not a mood. The old
  // values were mood names, and resolveFace() maps anything unknown to "bean",
  // so existing rows land on the default face instead of failing validation.
  faces: new Set<string>(MESHI_FACE_IDS),
  colors: new Set(["blue", "purple", "pink", "green", "orange", "cyan", "gold", "rainbow", "crimson", "midnight", "rose", "emerald", "arctic", "obsidian"]),
  hairs: new Set<string>(MESHI_HAIR_IDS),
  hairColors: new Set<string>(MESHI_HAIR_COLOR_IDS),
  accessories: new Set<string>(ALL_ACCESSORY_ITEMS),
  // eyeStyle now stores a LASH style. "regular" is the legacy value for "no
  // lashes" and keeps working via resolveLash(), so nobody's Meshi changes
  // under them.
  eyes: new Set<string>(["regular", ...MESHI_LASH_IDS]),
  badges: new Set(["none", "spark", "heart", "shield", "verified", "creator", "founder", "charter", "patron"]),
};

export type MeshiPreferenceUpdate = {
  hatStyle?: string;
  faceStyle?: string;
  colorTheme?: string;
  hairStyle?: string;
  hairColor?: string;
  accessoryStyle?: string;
  eyeStyle?: string;
  badgeStyle?: string;
};

export const DEFAULT_MESHI_PREFERENCE = {
  hatStyle: "none",
  faceStyle: "happy",
  colorTheme: "blue",
  hairStyle: "none",
  hairColor: "inherit",
  accessoryStyle: "none",
  eyeStyle: "regular",
  badgeStyle: "none",
};

export const MESHI_LOCK_CHECKS: Array<[keyof MeshiPreferenceUpdate, keyof typeof FREE_MESHI_OPTIONS, string]> = [
  ["hatStyle", "hats", "hat"],
  ["faceStyle", "faces", "expression"],
  ["colorTheme", "colors", "color"],
  ["hairStyle", "hairs", "hair"],
  ["hairColor", "hairColors", "hair color"],
  ["accessoryStyle", "accessories", "accessory"],
  ["eyeStyle", "eyes", "eyes"],
  ["badgeStyle", "badges", "badge"],
];

/** The lock table, inverted: which MeshiPreference column does a category set? */
export const MESHI_FIELD_OF_GROUP = Object.fromEntries(
  MESHI_LOCK_CHECKS.map(([field, group]) => [group, field]),
) as Record<keyof typeof FREE_MESHI_OPTIONS, keyof MeshiPreferenceUpdate>;

// ─── Ownership (one $1.99 receipt = one value, forever) ─────────

export type OwnedMeshiSets = Partial<Record<keyof typeof FREE_MESHI_OPTIONS, Set<string>>>;

/** Live OwnedMeshiItem rows (revokedAt null), folded for O(1) gate lookups. */
export function buildOwnedMeshiSets(rows: Array<{ category: string; value: string }>): OwnedMeshiSets {
  const sets: OwnedMeshiSets = {};
  for (const row of rows) {
    const group = row.category as keyof typeof FREE_MESHI_OPTIONS;
    if (!(group in FREE_MESHI_OPTIONS)) continue;
    (sets[group] ??= new Set()).add(row.value.trim().toLowerCase());
  }
  return sets;
}

export function isOwnedMeshiOption(owned: OwnedMeshiSets, group: keyof typeof FREE_MESHI_OPTIONS, value: string | null | undefined) {
  return owned[group]?.has((value || "none").trim().toLowerCase()) ?? false;
}

// ─── The giftable catalog ───────────────────────────────────────

/** One flat price. Tiers would put price tags on tiles, and that's a storefront. */
export const MESHI_ITEM_PRICE_CENTS = 199;

const GIFTABLE_AXES = ["hats", "faces", "hairs", "hairColors", "eyes", "badges"] as const;

export type GiftableMeshiCategory = (typeof GIFTABLE_AXES)[number];

// Only ornaments. Status badges assert facts about an account, so they are
// excluded even though they live on the same axis; spark/heart/shield decorate
// and claim nothing. Lash "none" is excluded because free "regular" already
// means no-lashes — selling it would be $1.99 for a free thing.
const GIFTABLE_BADGES = new Set(["spark", "heart", "shield"]);

export const GIFTABLE_MESHI_ITEMS: Record<GiftableMeshiCategory, string[]> = Object.fromEntries(
  GIFTABLE_AXES.map((axis) => {
    let values = [...MESHI_OPTION_VALUES[axis]].filter((value) => !FREE_MESHI_OPTIONS[axis].has(value));
    if (axis === "badges") values = values.filter((value) => GIFTABLE_BADGES.has(value));
    if (axis === "eyes") values = values.filter((value) => value !== "none");
    return [axis, values];
  }),
) as Record<GiftableMeshiCategory, string[]>;

export function isGiftableMeshiItem(category: string, value: string | null | undefined): category is GiftableMeshiCategory {
  const values = GIFTABLE_MESHI_ITEMS[category as GiftableMeshiCategory];
  return Boolean(values?.includes((value || "").trim().toLowerCase()));
}

// ─── Labels (Stripe product names, notification copy, the gift form) ─

const HAT_LABELS: Record<string, string> = {
  tophat: "Top hat",
  party: "Party hat",
  wizard: "Wizard hat",
  astronaut: "Astronaut helmet",
  pirate: "Pirate hat",
  chef: "Chef's hat",
  cowboy: "Cowboy hat",
  graduation: "Graduation cap",
};

function titleCase(value: string) {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}

/** "hats"+"tophat" → "Top hat"; "hairColors"+"rose" → "Rose hair color". */
export function meshiItemLabel(category: string, value: string): string {
  const v = value.trim().toLowerCase();
  switch (category) {
    case "hats":
      return HAT_LABELS[v] ?? titleCase(v);
    case "faces":
      return `${MESHI_FACE_LABELS[v as MeshiFace] ?? titleCase(v)} face`;
    case "hairs":
      return `${MESHI_HAIR_LABELS[v] ?? titleCase(v)} hair`;
    case "hairColors":
      return `${MESHI_HAIR_COLOR_LABELS[v] ?? titleCase(v)} hair color`;
    case "eyes":
      return `${MESHI_LASH_LABELS[v as MeshiLash] ?? titleCase(v)} lashes`;
    case "badges":
      return `${titleCase(v)} badge`;
    default:
      return titleCase(v);
  }
}
