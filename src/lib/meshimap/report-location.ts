// THE ONLY WRITE PATH FOR LOCATION — and the point where precision is thrown
// away for good.
//
// A device reading arrives here, is used to pick a grid cell, and is then
// GONE: it is never returned, never logged, and never written. What lands in
// the database is the cell centre, which is the same value the map would show
// to somebody already allowed to see it.
//
// ── WHY THE COARSENING IS HERE AND NOT ON READ ─────────────────────────────
//
// "Store the true point, coarsen when rendering" sounds equivalent and is
// strictly worse: it makes every later query, export, backup, admin tool and
// debug log a place the real location can escape, and it only takes one of
// them forgetting. Coarsening at the edge leaves nothing to forget — there is
// no precise value in the system to leak.
//
// ── THE OTHER RULE ─────────────────────────────────────────────────────────
//
// Audience travels WITH the write. A row cannot exist without one, and an
// unrecognised value is stored as "nobody" rather than guessed, so the failure
// mode of a newer client or a corrupted body is invisibility, not exposure.

import { coarsen, type Audience, type Precision } from "./coarse";

export type LocationReport = {
  lat: number;
  lng: number;
  precision: Precision;
  audience: Audience;
};

/** The row this write produces. Deliberately has no field for a raw reading —
 * the type itself refuses to carry one. */
export type LocationRow = {
  userId: string;
  lat: number;
  lng: number;
  precision: Precision;
  audience: Audience;
  reportedAt: Date;
};

/** What the store needs to accept a report. Injected so the rule is testable
 * without a database — the same shape the other reads use. */
export interface LocationDb {
  userLocation: {
    upsert(args: {
      where: { userId: string };
      create: LocationRow;
      update: Omit<LocationRow, "userId">;
    }): Promise<unknown>;
    delete(args: { where: { userId: string } }): Promise<unknown>;
  };
}

const PRECISIONS: readonly Precision[] = ["block", "town", "region"];
const AUDIENCES: readonly Audience[] = ["nobody", "mutuals", "followers", "everyone"];

/** Anything we do not recognise is read as the most private option. A guess in
 * this direction costs a missing pin; a guess the other way costs a person. */
export function readPrecision(value: unknown): Precision {
  return PRECISIONS.includes(value as Precision) ? (value as Precision) : "region";
}

export function readAudience(value: unknown): Audience {
  return AUDIENCES.includes(value as Audience) ? (value as Audience) : "nobody";
}

/** A reading has to be a real point on Earth. NaN, Infinity and out-of-range
 * values are rejected outright rather than clamped, because a clamped bad
 * reading is a confident pin in the wrong place. */
export function isUsableReading(lat: unknown, lng: unknown): boolean {
  if (typeof lat !== "number" || typeof lng !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export type ReportResult =
  | { ok: true; stored: { lat: number; lng: number; precision: Precision; audience: Audience } }
  /** Nothing was written and nothing is on the map. */
  | { ok: false; reason: "unusable-reading" };

/**
 * Record where somebody is, coarsely.
 *
 * Choosing "nobody" is a DELETE, not a flag: a hidden row is still a row, and
 * the honest way to stop appearing on a map is for the location to stop
 * existing. It also means turning sharing off actually removes the data rather
 * than promising to ignore it.
 */
export async function reportLocation(
  userId: string,
  report: LocationReport,
  db: LocationDb,
  nowMs: number,
): Promise<ReportResult> {
  const audience = readAudience(report.audience);

  if (audience === "nobody") {
    // Already absent is fine — this is idempotent by design, because a client
    // retrying "stop sharing" must never fail.
    await db.userLocation.delete({ where: { userId } }).catch(() => undefined);
    return { ok: true, stored: { lat: 0, lng: 0, precision: "region", audience: "nobody" } };
  }

  if (!isUsableReading(report.lat, report.lng)) return { ok: false, reason: "unusable-reading" };

  const precision = readPrecision(report.precision);
  // THE LINE WHERE PRECISION DIES. Everything below this point works with the
  // cell; `report.lat`/`report.lng` are not referenced again.
  const cell = coarsen(report.lat, report.lng, precision);

  const row: LocationRow = {
    userId,
    lat: cell.lat,
    lng: cell.lng,
    precision,
    audience,
    reportedAt: new Date(nowMs),
  };
  await db.userLocation.upsert({
    where: { userId },
    create: row,
    update: { lat: row.lat, lng: row.lng, precision, audience, reportedAt: row.reportedAt },
  });

  return { ok: true, stored: { lat: cell.lat, lng: cell.lng, precision, audience } };
}
