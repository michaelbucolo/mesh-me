// ONE ITEM PER SLOT — WHICH IS BOTH THE UNIQUENESS AND THE CONFLICT FIX.
//
// Accessories were a single choice from a flat list of thirteen. That is why
// "customize your Meshi so everyone is a little unique" could not be true: with
// one accessory, the whole free-choice space is
//
//     12 faces x 4 lashes x 13 hair x 19 hats x 14 colours x 13 accessories
//   = 2,157,792
//
// which sounds large until you remember it has to spread across millions of
// people. It also forced a false choice: freckles OR earrings, never both,
// even though they occupy completely different parts of the face.
//
// The flat list was hiding a structure. Those thirteen items live in five
// disjoint regions, and items in different regions never overlap:
//
//     eyewear   the eye band          glasses, sunglasses, monocle, eyepatch
//     ears      beside the head       earrings
//     neck      below the chin        bowtie, necklace
//     brow      above the lip         mustache
//     marks     the cheeks            freckles, blush, star
//
// Model that directly and two things happen at once. Someone can wear glasses
// AND earrings AND freckles, so the space becomes
//
//     ... x 5 eyewear x 2 ears x 3 neck x 2 brow x 8 mark-combinations
//   = 79,672,320  (26.2 bits)
//
// and conflicts stop being a thing that has to be policed, because two items
// can only collide if they are in the same slot and only one item per slot is
// ever rendered. The special-cases that used to paper over collisions —
// choosing lashes silently disabling your accessory, for one — are not needed.
//
// ── HONESTLY, WHAT 80 MILLION BUYS ──────────────────────────────────────────
//
// At a million people, ~1.3% share their exact combination with someone else.
// At ten million, ~12.6% do. That is "everyone is a little unique", not
// "everyone is provably unique", and the difference is worth stating plainly.
// The single biggest remaining multiplier — hair with its own colour,
// independent of the body — now exists: MeshiPreference.hairColor, with the
// palette in meshi-hair.tsx and the honest math in combinationCount below
// (colours multiply only real hair; bald-with-blond is not a look).
//
// ── STORAGE STAYS PUT ───────────────────────────────────────────────────────
//
// All of this packs into the existing accessoryStyle TEXT column as a
// comma-separated list. A row holding one legacy value like "glasses" parses
// as exactly that and nothing else, so no migration runs and no one's Meshi
// changes underneath them.

export type MeshiSlot = "eyewear" | "ears" | "neck" | "brow" | "marks";

/** Which slot each accessory belongs to. The regions are disjoint by design. */
const SLOT_OF: Record<string, MeshiSlot> = {
  glasses: "eyewear",
  sunglasses: "eyewear",
  monocle: "eyewear",
  eyepatch: "eyewear",
  earrings: "ears",
  bowtie: "neck",
  necklace: "neck",
  mustache: "brow",
  freckles: "marks",
  blush: "marks",
  star: "marks",
};

export const SLOTS: MeshiSlot[] = ["eyewear", "ears", "neck", "brow", "marks"];

export const SLOT_LABELS: Record<MeshiSlot, string> = {
  eyewear: "Eyewear",
  ears: "Ears",
  neck: "Neck",
  brow: "Brow",
  marks: "Marks",
};

/** Items available in each slot, in picker order. */
export const SLOT_ITEMS: Record<MeshiSlot, string[]> = {
  eyewear: ["none", "glasses", "sunglasses", "monocle", "eyepatch"],
  ears: ["none", "earrings"],
  neck: ["none", "bowtie", "necklace"],
  brow: ["none", "mustache"],
  marks: ["none", "freckles", "blush", "star"],
};

/**
 * `marks` is the one slot that stacks: freckles, blush and a star sit in
 * different places on the cheeks and reading them as mutually exclusive was
 * arbitrary. Everything else is genuinely one-at-a-time — you cannot wear two
 * pairs of glasses.
 */
export const STACKING_SLOTS: ReadonlySet<MeshiSlot> = new Set<MeshiSlot>(["marks"]);

export type MeshiOutfitSelection = {
  eyewear: string;
  ears: string;
  neck: string;
  brow: string;
  /** Zero or more marks, in a stable order. */
  marks: string[];
};

const EMPTY: MeshiOutfitSelection = { eyewear: "none", ears: "none", neck: "none", brow: "none", marks: [] };

/**
 * Read the stored accessory string into slots.
 *
 * Accepts the legacy single value ("glasses"), the new list
 * ("glasses,freckles,earrings"), and junk. Unknown tokens are dropped rather
 * than rendered, so a value from a future version degrades to fewer
 * accessories instead of a broken Meshi. "lashes" is deliberately ignored: it
 * moved to the eye engine, where it belongs.
 */
export function parseAccessories(value: string | null | undefined): MeshiOutfitSelection {
  if (!value) return { ...EMPTY, marks: [] };
  const out: MeshiOutfitSelection = { ...EMPTY, marks: [] };
  for (const raw of value.split(",")) {
    const item = raw.trim();
    if (!item || item === "none" || item === "lashes") continue;
    const slot = SLOT_OF[item];
    if (!slot) continue;
    if (slot === "marks") {
      if (!out.marks.includes(item)) out.marks.push(item);
    } else {
      // Last one wins; a stored string with two pairs of glasses is malformed,
      // not a request to draw both.
      out[slot] = item;
    }
  }
  // Stable order so the same selection always serialises identically — two
  // people with the same Meshi must produce the same string.
  out.marks.sort();
  return out;
}

/** Back to storage, in a canonical order. */
export function serializeAccessories(sel: MeshiOutfitSelection): string {
  const parts: string[] = [];
  for (const slot of SLOTS) {
    if (slot === "marks") { parts.push(...[...sel.marks].sort()); continue; }
    const item = sel[slot];
    if (item && item !== "none") parts.push(item);
  }
  return parts.length ? parts.join(",") : "none";
}

/** Every token the validator should accept, plus the legacy spellings. */
export const ALL_ACCESSORY_ITEMS: string[] = ["none", "lashes", ...Object.keys(SLOT_OF)];

/**
 * The full free-choice space, computed rather than asserted, so the number in
 * the docs cannot drift from the code that produces it.
 */
export function combinationCount(counts: {
  faces: number;
  lashes: number;
  hair: number;
  /** Hair-color ids INCLUDING "inherit". Colors only apply to real hair, so
      the hair axis contributes 1 (bald) + (styles - 1) x colors — counting
      bald-with-blond as distinct would inflate the number with looks nobody
      can see. This is the multiplier the header comment above reserved. */
  hairColors: number;
  hats: number;
  colors: number;
}): number {
  const perSlot = SLOTS.map((slot) =>
    STACKING_SLOTS.has(slot)
      ? 2 ** (SLOT_ITEMS[slot].length - 1) // each mark independently on or off
      : SLOT_ITEMS[slot].length,
  ).reduce((a, b) => a * b, 1);
  const hairLooks = 1 + (counts.hair - 1) * counts.hairColors;
  return counts.faces * counts.lashes * hairLooks * counts.hats * counts.colors * perSlot;
}
