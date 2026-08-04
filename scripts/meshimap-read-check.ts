// THE MAP READ CONTRACT.
//
// `coarse.ts` decides who may be seen and how coarsely; this read only gathers
// the facts those rules need. So the failure mode it has to be watched for is
// not "the rule is wrong" — it is "the read handed the rule the wrong facts",
// which produces a perfectly-obeyed rule applied to a lie.
//
// The one that keeps people up at night: `followsSubject` and
// `subjectFollowsViewer` are a single character apart, mean opposite things,
// and swapping them shows your location to exactly the people you did not pick.
// No type catches that; this does.
//
// Run: npm run meshimap-read:check

import assert from "node:assert/strict";
import { readMap, type MapDb, type MapLocationRow } from "../src/lib/meshimap/read-map";
import { LOCATION_TTL_MS } from "../src/lib/meshimap/coarse";

let n = 0;
function ok(condition: boolean, label: string): void {
  n++;
  assert.ok(condition, label);
}

const NOW = 1_800_000_000_000;
const ME = "viewer";

function row(over: Partial<MapLocationRow> & { userId: string }): MapLocationRow {
  return {
    lat: 51.5,
    lng: -0.12,
    precision: "town",
    audience: "everyone",
    reportedAt: new Date(NOW - 60_000),
    user: { username: over.userId, displayName: null, ghostMode: false, isSuspended: false },
    ...over,
  } as MapLocationRow;
}

function db(
  rows: MapLocationRow[],
  edges: Array<{ followerId: string; followingId: string }> = [],
  blocks: Array<{ blockerId: string; blockedId: string }> = [],
): { db: MapDb; queries: { since: Date | null; take: number } } {
  const queries = { since: null as Date | null, take: 0 };
  return {
    queries,
    db: {
      userLocation: {
        async findMany(args) {
          queries.since = args.where.reportedAt.gte;
          queries.take = args.take;
          return rows;
        },
      },
      follow: { async findMany() { return edges; } },
      block: { async findMany() { return blocks; } },
    } as MapDb,
  };
}

async function main(): Promise<void> {
  // ── 1. A signed-out viewer gets nothing. Not "everyone" pins — nothing. ──
  {
    const { db: d } = db([row({ userId: "open" })]);
    const result = await readMap(null, NOW, d);
    ok(result.pins.length === 0, "a signed-out viewer sees no pins at all");
    ok(result.you === null, "…and has no pin of their own");
  }

  // ── 2. THE DIRECTION OF A FOLLOW. ────────────────────────────────────────
  //
  // "followers" = people who follow THEM. So the viewer must follow the
  // subject: an edge from ME to THEM. An edge the other way is somebody
  // following me, which grants nothing.
  {
    const subject = row({ userId: "ada", audience: "followers" });
    const iFollowThem = db([subject], [{ followerId: ME, followingId: "ada" }]);
    const theyFollowMe = db([subject], [{ followerId: "ada", followingId: ME }]);

    const a = await readMap(ME, NOW, iFollowThem.db);
    ok(a.pins.length === 1, "following someone lets you see them under 'followers'");

    const b = await readMap(ME, NOW, theyFollowMe.db);
    ok(
      b.pins.length === 0,
      "being followed BY someone does NOT let you see them — swap these two and the map shows your location to the opposite set of people",
    );
  }

  // Mutuals need both directions, and a mutual must also pass "followers",
  // which is the strictly wider setting.
  {
    const subject = row({ userId: "ada", audience: "mutuals" });
    const oneWay = db([subject], [{ followerId: ME, followingId: "ada" }]);
    const both = db([subject], [
      { followerId: ME, followingId: "ada" },
      { followerId: "ada", followingId: ME },
    ]);
    ok((await readMap(ME, NOW, oneWay.db)).pins.length === 0, "a one-way follow is not a mutual");
    ok((await readMap(ME, NOW, both.db)).pins.length === 1, "a real mutual is visible");

    const asFollowers = db([row({ userId: "ada", audience: "followers" })], [
      { followerId: ME, followingId: "ada" },
      { followerId: "ada", followingId: ME },
    ]);
    ok(
      (await readMap(ME, NOW, asFollowers.db)).pins.length === 1,
      "a mutual also passes 'followers' — the wider setting can never show fewer people",
    );
  }

  // ── 3. Blocks are mutual, whichever direction they run. ─────────────────
  for (const block of [
    { blockerId: ME, blockedId: "ada" },
    { blockerId: "ada", blockedId: ME },
  ]) {
    const { db: d } = db([row({ userId: "ada" })], [], [block]);
    const result = await readMap(ME, NOW, d);
    ok(result.pins.length === 0, `a block (${block.blockerId} → ${block.blockedId}) hides them either way`);
  }

  // ── 4. Ghost mode and suspension. ───────────────────────────────────────
  {
    const ghost = row({ userId: "ada" });
    ghost.user = { username: "ada", displayName: null, ghostMode: true, isSuspended: false };
    ok((await readMap(ME, NOW, db([ghost]).db)).pins.length === 0, "ghost mode hides an 'everyone' pin");

    const gone = row({ userId: "ada" });
    gone.user = { username: "ada", displayName: null, ghostMode: false, isSuspended: true };
    ok((await readMap(ME, NOW, db([gone]).db)).pins.length === 0, "a suspended account is not on the map");

    const orphan = row({ userId: "ada" });
    orphan.user = null;
    ok(
      (await readMap(ME, NOW, db([orphan]).db)).pins.length === 0,
      "a row whose user is missing renders no nameless pin",
    );
  }

  // ── 5. You always see yourself, so you can tell what you broadcast. ─────
  {
    const mine = row({ userId: ME, audience: "nobody" });
    const result = await readMap(ME, NOW, db([mine]).db);
    ok(result.pins.length === 1, "your own pin shows even at audience 'nobody'");
    ok(result.you?.userId === ME, "…and is handed back separately so the map can open on it");
  }

  // ── 6. Freshness: the query window and `isFresh` must agree, or the read
  //      either fetches dead rows or hides live ones.
  // ------------------------------------------------------------------------
  {
    const { db: d, queries } = db([]);
    await readMap(ME, NOW, d);
    ok(
      queries.since !== null && NOW - queries.since.getTime() === LOCATION_TTL_MS,
      "the query window is exactly the TTL, not a second copy of the number that can drift",
    );
    ok(queries.take > 0, "the row count is capped");
  }
  {
    const stale = row({ userId: "ada", reportedAt: new Date(NOW - LOCATION_TTL_MS - 1) });
    ok((await readMap(ME, NOW, db([stale]).db)).pins.length === 0, "a stale row never becomes a pin");
    const future = row({ userId: "ada", reportedAt: new Date(NOW + 10 * 60_000) });
    ok((await readMap(ME, NOW, db([future]).db)).pins.length === 0, "a future-dated row is a clock problem, not a pin");
  }

  // ── 7. Stored values are re-narrowed on the way out. A value that got into
  //      the column by another route is not trusted for being in a database.
  // ------------------------------------------------------------------------
  {
    // An unrecognised audience is invisible. Note what this does NOT prove:
    // deleting the read's `readAudience` narrowing leaves it passing, because
    // canSeeOnMap's default branch already refuses values it does not know.
    // That redundancy is deliberate — the narrowing is there so the TYPE is
    // honest about what came out of the column — but the rule that protects
    // the user lives in coarse.ts and is gated there, and a label here
    // claiming otherwise would be taking credit for somebody else's work.
    const junk = row({ userId: "ada", audience: "public" });
    ok(
      (await readMap(ME, NOW, db([junk]).db)).pins.length === 0,
      "an audience nobody recognises produces no pin (decided by canSeeOnMap's default)",
    );
  }
  {
    // An unrecognised precision must coarsen to the widest cell, never the
    // finest — the read is the last chance to catch a bad column value.
    const junk = row({ userId: "ada", precision: "exact", lat: 51.503368, lng: -0.127716 });
    const pins = (await readMap(ME, NOW, db([junk]).db)).pins;
    ok(pins.length === 1 && pins[0].at.precision === "region", "an unknown precision reads as the COARSEST");
  }

  // ── 8. The pin carries a cell, and no raw coordinate rides along. ───────
  {
    const subject = row({ userId: "ada", lat: 51.503368, lng: -0.127716, precision: "block" });
    const pins = (await readMap(ME, NOW, db([subject]).db)).pins;
    const serialized = JSON.stringify(pins[0]);
    ok(!serialized.includes("51.503368"), "the pin carries no raw latitude");
    ok(!serialized.includes("0.127716"), "…and no raw longitude");
  }

  console.log(`meshimap read contract OK — ${n} assertions (follow direction, blocks both ways, TTL agrees)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
