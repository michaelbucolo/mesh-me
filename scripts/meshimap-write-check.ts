// THE LOCATION WRITE CONTRACT — proving the database never sees a real point.
//
// meshimap-privacy:check proves the MATH is unaveraging. This proves the
// PLUMBING actually uses it: that the value handed to the store is the cell
// and not the reading, that an unrecognised audience stores as "nobody", and
// that switching sharing off deletes rather than hides.
//
// The recording fake is the whole technique. It captures the exact arguments
// the store received, so the assertion can be "the database was handed
// 51.505, not 51.5074" — a claim no amount of reading the code can make.
//
// Run: npm run meshimap-write:check

import assert from "node:assert/strict";
import {
  isUsableReading,
  readAudience,
  readPrecision,
  reportLocation,
  type LocationDb,
  type LocationRow,
} from "../src/lib/meshimap/report-location";
import { coarsen } from "../src/lib/meshimap/coarse";

let n = 0;
function ok(condition: boolean, label: string): void {
  n++;
  assert.ok(condition, label);
}

type Recorded = { upserts: LocationRow[]; deletes: string[] };

function fakeDb(): { db: LocationDb; log: Recorded } {
  const log: Recorded = { upserts: [], deletes: [] };
  const db: LocationDb = {
    userLocation: {
      async upsert(args) {
        log.upserts.push(args.create);
        return undefined;
      },
      async delete(args) {
        log.deletes.push(args.where.userId);
        return undefined;
      },
    },
  };
  return { db, log };
}

const NOW = 1_800_000_000_000;

// Scripts execute as CommonJS here, so there is no top-level await —
// the asynchronous assertions live in main() and the process exit code is
// the gate's verdict.
async function main(): Promise<void> {

  // ---------------------------------------------------------------------------
  // 1. THE POINT NEVER REACHES THE DATABASE.
  // ---------------------------------------------------------------------------

  {
    // A real address-level reading — 10 Downing Street, to six decimals.
    const LAT = 51.503368;
    const LNG = -0.127716;
    const { db, log } = fakeDb();
    const result = await reportLocation(
      "u1",
      { lat: LAT, lng: LNG, precision: "block", audience: "everyone" },
      db,
      NOW,
    );

    ok(result.ok, "a usable reading is accepted");
    ok(log.upserts.length === 1, "exactly one row is written");
    const row = log.upserts[0];
    ok(row.lat !== LAT, "the stored latitude is NOT the reading");
    ok(row.lng !== LNG, "the stored longitude is NOT the reading");

    const cell = coarsen(LAT, LNG, "block");
    ok(row.lat === cell.lat && row.lng === cell.lng, "the stored value is exactly the grid cell");

    // The serialized row must not contain the reading anywhere — a stray field,
    // a debug copy, a "raw" escape hatch would all show up here.
    const serialized = JSON.stringify(row);
    ok(!serialized.includes("51.503368"), "the raw latitude appears nowhere in the written row");
    ok(!serialized.includes("-0.127716"), "the raw longitude appears nowhere in the written row");
    ok(!serialized.includes("0.127716"), "…not even unsigned");
  }

  // Two people in the same cell must be indistinguishable after the write, or
  // the grid has not actually done anything.
  {
    const a = fakeDb();
    const b = fakeDb();
    await reportLocation("a", { lat: 51.5031, lng: -0.1277, precision: "block", audience: "everyone" }, a.db, NOW);
    await reportLocation("b", { lat: 51.5049, lng: -0.1211, precision: "block", audience: "everyone" }, b.db, NOW);
    ok(
      a.log.upserts[0].lat === b.log.upserts[0].lat && a.log.upserts[0].lng === b.log.upserts[0].lng,
      "two neighbours in one cell write byte-identical coordinates",
    );
  }

  // Sampling a stationary person repeatedly writes the same row every time —
  // the anti-averaging property, checked through the plumbing rather than the
  // maths, because a write path that re-jittered would break it invisibly.
  {
    const { db, log } = fakeDb();
    for (let i = 0; i < 200; i++) {
      await reportLocation("u1", { lat: 40.712776, lng: -74.005974, precision: "town", audience: "everyone" }, db, NOW + i * 1000);
    }
    const distinct = new Set(log.upserts.map((r) => `${r.lat},${r.lng}`));
    ok(distinct.size === 1, `200 reports from a stationary person write one point (got ${distinct.size})`);
  }

  // ---------------------------------------------------------------------------
  // 2. Audience: unknown means nobody, and nobody means DELETE.
  // ---------------------------------------------------------------------------

  ok(readAudience("everyone") === "everyone", "known audiences pass through");
  ok(readAudience("mutuals") === "mutuals", "…all of them");
  ok(readAudience("friends-of-friends") === "nobody", "an audience we do not understand is nobody");
  ok(readAudience(undefined) === "nobody", "a missing audience is nobody");
  ok(readAudience(null) === "nobody", "a null audience is nobody");
  ok(readAudience(true) === "nobody", "a non-string audience is nobody");

  ok(readPrecision("block") === "block", "known precisions pass through");
  ok(readPrecision("exact") === "region", "there is no 'exact' — an unknown precision is the COARSEST, not the finest");
  ok(readPrecision(undefined) === "region", "a missing precision is the coarsest");

  {
    const { db, log } = fakeDb();
    await reportLocation("u1", { lat: 51.5, lng: -0.12, precision: "block", audience: "nobody" }, db, NOW);
    ok(log.upserts.length === 0, "choosing nobody writes NO row");
    ok(log.deletes.length === 1 && log.deletes[0] === "u1", "choosing nobody DELETES — a hidden row is still a row");
  }

  {
    const { db, log } = fakeDb();
    await reportLocation("u1", { lat: 51.5, lng: -0.12, precision: "block", audience: "whatever" as never }, db, NOW);
    ok(log.upserts.length === 0 && log.deletes.length === 1, "an unrecognised audience takes the delete path, not the write path");
  }

  // "Stop sharing" must never fail, even when there is nothing to stop.
  {
    const log: string[] = [];
    const db: LocationDb = {
      userLocation: {
        async upsert() {
          throw new Error("should not be called");
        },
        async delete(args) {
          log.push(args.where.userId);
          throw new Error("record not found");
        },
      },
    };
    const result = await reportLocation("u1", { lat: 0, lng: 0, precision: "town", audience: "nobody" }, db, NOW);
    ok(result.ok, "deleting a location that was never shared still succeeds — retries must be safe");
    ok(log.length === 1, "…and it did attempt the delete");
  }

  // ---------------------------------------------------------------------------
  // 3. Junk readings are refused, not clamped. A clamped bad reading is a
  //    confident pin in the wrong place.
  // ---------------------------------------------------------------------------

  ok(isUsableReading(51.5, -0.12), "an ordinary reading is usable");
  ok(isUsableReading(-90, 180), "the extremes of the range are usable");
  ok(!isUsableReading(Number.NaN, 0), "NaN is not a location");
  ok(!isUsableReading(0, Number.POSITIVE_INFINITY), "Infinity is not a location");
  ok(!isUsableReading(91, 0), "a latitude past the pole is not a location");
  ok(!isUsableReading(0, 181), "a longitude past the antimeridian is not a location");
  ok(!isUsableReading("51.5", 0), "a string is not a location");
  ok(!isUsableReading(null, null), "null is not a location");

  {
    const { db, log } = fakeDb();
    const result = await reportLocation("u1", { lat: Number.NaN, lng: 0, precision: "town", audience: "everyone" }, db, NOW);
    ok(!result.ok && result.reason === "unusable-reading", "an unusable reading is refused");
    ok(log.upserts.length === 0 && log.deletes.length === 0, "…and touches the database not at all");
  }

  console.log(`meshimap write contract OK — ${n} assertions (the database never sees a real point)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
