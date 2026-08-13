// MESHI PROVENANCE — the stitched-in garment label, as a pure function.
//
// A gifted wardrobe piece may carry a quiet public mark: "Top hat — a gift,
// March 2026". The rules, in the order they gate:
//
//   1. LIVE — a revoked (refunded) receipt labels nothing.
//   2. A GIFT — self-purchases mark nothing anywhere public. A DELETED
//      purchaser (SetNull) still counts as a gift: the mark never carried
//      their name, so their departure changes nothing.
//   3. WORN — the label describes the Meshi in front of you, not a closet.
//   4. NOT QUIETED — wearing a gift must never compel disclosure; the owner
//      can quiet any piece's mark and the row simply doesn't resolve.
//
// The output is label + month-year strings ONLY. No ids, no exact dates, no
// purchaser fields, no message — those exist solely on the owner's own
// settings surface. And the label is PASSIVE: this module renders toward
// social surfaces, so it may never contain a link, a price, or a pitch
// (meshi-provenance-check pins all of this).
//
// Deliberately pure and prisma-free so the gate script can truth-table it
// directly; callers do the querying and are expected to repeat gates 1, 2,
// and 4 in their where-clauses (belt) — this function re-checks any of those
// fields it is handed (braces).

import { MESHI_FIELD_OF_GROUP, meshiItemLabel } from "@/lib/meshi-wardrobe";
import type { FREE_MESHI_OPTIONS } from "@/lib/mesh-pro";

export type ProvenanceRowInput = {
  category: string;
  value: string;
  createdAt: Date;
  /** Optional belt fields: filtered when present, trusted to the caller's
   *  where-clause when absent (public queries must NOT select purchaser). */
  revokedAt?: Date | null;
  labelQuietedAt?: Date | null;
  ownerId?: string;
  purchaserId?: string | null;
};

export type WornGiftLabel = { label: string; since: string };

/** "March 2026" — month-year is the public granularity; exact dates are the
 *  owner's own history, not a fact the mesh broadcasts. */
function formatProvenanceMonth(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

type WornPreference = Partial<Record<string, string | null>>;

/**
 * The adjudicator. Given the subject's equipped preference and their live
 * owned rows, resolve which pieces carry the public mark. Two live rows for
 * one (category, value) — near-impossible past the grant-race auto-refund —
 * resolve to the earliest receipt; the output is a string either way, so a
 * duplicate can never leak anything.
 */
export function resolveWornGiftLabels(
  pref: WornPreference | null,
  rows: ProvenanceRowInput[],
): WornGiftLabel[] {
  if (!pref) return [];

  const earliest = new Map<string, ProvenanceRowInput>();
  for (const row of rows) {
    if (row.revokedAt) continue;
    if (row.labelQuietedAt) continue;
    // Self-purchase: no public mark. Null purchaser is still a gift.
    if (row.ownerId !== undefined && row.purchaserId !== undefined && row.purchaserId === row.ownerId) continue;

    const field = MESHI_FIELD_OF_GROUP[row.category as keyof typeof FREE_MESHI_OPTIONS];
    if (!field) continue;
    const worn = (pref[field] ?? "none").trim().toLowerCase();
    if (worn !== row.value.trim().toLowerCase()) continue;

    const key = `${row.category}:${row.value.trim().toLowerCase()}`;
    const held = earliest.get(key);
    if (!held || row.createdAt.getTime() < held.createdAt.getTime()) earliest.set(key, row);
  }

  return [...earliest.values()]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((row) => ({
      label: meshiItemLabel(row.category, row.value),
      since: formatProvenanceMonth(row.createdAt),
    }));
}
