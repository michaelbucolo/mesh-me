// WHAT THE MAP IS ALLOWED TO SHOW YOU.
//
// This assembles the subjects and hands them to `pinsFor`, which is the only
// function that turns a stored location into something renderable. The gating
// itself is NOT restated here — blocking, ghost mode, audience, freshness and
// coarsening all live in meshimap/coarse.ts, and this read's job is to gather
// the facts those rules need and then get out of the way.
//
// That division is deliberate. The last three times a rule got copied into a
// second place in this codebase, the copy was the one that was wrong.

import { prisma } from "@/lib/prisma";
import {
  LOCATION_TTL_MS,
  pinsFor,
  type Audience,
  type MapPin,
  type MapSubject,
  type Precision,
} from "./coarse";
import { readAudience, readPrecision } from "./report-location";
import { doodlesFor, DOODLE_TTL_MS, type Doodle, type DoodleRow } from "./doodles";

/** How many pins one read can produce. The map draws Meshis, not dots, so
 * past a few hundred it stops being a place and becomes a smear — and the
 * query cost stops being bounded. */
const MAX_PINS = 300;

export type MapRead = { pins: MapPin[]; nowMs: number; you: MapPin | null; doodles: Doodle[] };

export interface MapDb {
  userLocation: {
    findMany(args: {
      where: { reportedAt: { gte: Date } };
      orderBy: { reportedAt: "desc" };
      take: number;
      select: {
        userId: true;
        lat: true;
        lng: true;
        precision: true;
        audience: true;
        reportedAt: true;
        user: { select: { username: true; displayName: true; ghostMode: true; isSuspended: true } };
      };
    }): Promise<MapLocationRow[]>;
  };
  follow: {
    findMany(args: {
      where: { OR: Array<{ followerId: string } | { followingId: string }> };
      select: { followerId: true; followingId: true };
    }): Promise<Array<{ followerId: string; followingId: string }>>;
  };
  block: {
    findMany(args: {
      where: { OR: Array<{ blockerId: string } | { blockedId: string }> };
      select: { blockerId: true; blockedId: true };
    }): Promise<Array<{ blockerId: string; blockedId: string }>>;
  };
  mapDoodle: {
    findMany(args: {
      where: { createdAt: { gte: Date } };
      orderBy: { createdAt: "desc" };
      take: number;
      select: { id: true; userId: true; ink: true; createdAt: true };
    }): Promise<Array<{ id: string; userId: string; ink: string; createdAt: Date }>>;
  };
}

export type MapLocationRow = {
  userId: string;
  lat: number;
  lng: number;
  precision: string;
  audience: string;
  reportedAt: Date;
  user: { username: string; displayName: string | null; ghostMode: boolean; isSuspended: boolean } | null;
};

/**
 * The map, for one viewer.
 *
 * A signed-out viewer gets NOTHING — not "everyone" pins, nothing. A public
 * map of real people's locations, readable without an account, is a scraping
 * target with a UI, and "everyone" plainly means everyone on mesh.me rather
 * than everyone on the internet.
 */
export async function readMap(
  viewerId: string | null,
  /** Stamped HERE rather than by the caller, like every other read on this
   * codebase: a server component calling Date.now() during render is an impure
   * call in a function that is supposed to be idempotent, and the read handing
   * its own clock back is what keeps the server and client agreeing about the
   * instant the pins were judged fresh at. Still injectable, so the gate can
   * drive the TTL boundary exactly. */
  nowMs: number = Date.now(),
  db: MapDb = prisma as unknown as MapDb,
): Promise<MapRead> {
  if (!viewerId) return { pins: [], nowMs, you: null, doodles: [] };

  // Stale rows are excluded in the QUERY as well as by `isFresh` downstream.
  // Not redundancy for its own sake: it keeps the row count bounded by how
  // many people are live right now rather than by how many ever shared, so
  // `take` is a cap on a small set instead of a truncation of a large one.
  // The SAME constant `isFresh` uses, not a copy of the number: a window that
  // drifted from the TTL would either hide fresh pins or fetch dead ones.
  const since = new Date(nowMs - LOCATION_TTL_MS);

  const [rows, edges, blocks] = await Promise.all([
    db.userLocation.findMany({
      where: { reportedAt: { gte: since } },
      orderBy: { reportedAt: "desc" },
      take: MAX_PINS,
      select: {
        userId: true,
        lat: true,
        lng: true,
        precision: true,
        audience: true,
        reportedAt: true,
        user: { select: { username: true, displayName: true, ghostMode: true, isSuspended: true } },
      },
    }),
    db.follow.findMany({
      where: { OR: [{ followerId: viewerId }, { followingId: viewerId }] },
      select: { followerId: true, followingId: true },
    }),
    db.block.findMany({
      where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
      select: { blockerId: true, blockedId: true },
    }),
  ]);

  // Drawings are fetched WITHOUT any visibility filter of their own, then
  // filtered against the pins that survive the gate below. That is deliberate:
  // a WHERE clause here would be a second copy of the privacy rule, written in
  // SQL, that nobody would think to update when the real one changes. The cap
  // keeps the unfiltered fetch bounded.
  const doodleRows = await db.mapDoodle.findMany({
    where: { createdAt: { gte: new Date(nowMs - DOODLE_TTL_MS) } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, userId: true, ink: true, createdAt: true },
  });

  const viewerFollows = new Set<string>();
  const followsViewer = new Set<string>();
  for (const e of edges) {
    if (e.followerId === viewerId) viewerFollows.add(e.followingId);
    if (e.followingId === viewerId) followsViewer.add(e.followerId);
  }
  const blocked = new Set<string>();
  for (const b of blocks) {
    blocked.add(b.blockerId === viewerId ? b.blockedId : b.blockerId);
  }

  const subjects: MapSubject[] = [];
  for (const row of rows) {
    // A row whose user is gone or suspended has no business on a map, and a
    // missing join is a data problem rather than a licence to render a pin
    // with no name attached to it.
    if (!row.user || row.user.isSuspended) continue;
    subjects.push({
      userId: row.userId,
      username: row.user.username,
      displayName: row.user.displayName,
      lat: row.lat,
      lng: row.lng,
      reportedAtMs: row.reportedAt.getTime(),
      // Re-read through the same narrowing the write used: a value that got
      // into the column by another route (a migration, a manual fix) is not
      // trusted just because it is in the database.
      //
      // These two are not equally load-bearing, and it is worth saying which
      // is which. PRECISION genuinely protects: `coarsen` looks the value up
      // in a table, so an unrecognised key yields undefined and the cell maths
      // becomes NaN — narrowing it to the coarsest option is the difference
      // between a wide cell and a broken pin. AUDIENCE is belt-and-braces:
      // canSeeOnMap's default branch already refuses anything it does not
      // recognise, so this only makes the TYPE honest about what came out of
      // the column. The decision itself has one home, and it is not here.
      audience: readAudience(row.audience) as Audience,
      precision: readPrecision(row.precision) as Precision,
      ghostMode: row.user.ghostMode,
      relation: {
        isSelf: row.userId === viewerId,
        followsSubject: viewerFollows.has(row.userId),
        subjectFollowsViewer: followsViewer.has(row.userId),
        isBlockedEitherWay: blocked.has(row.userId),
      },
    });
  }

  // The single gate. Everything above only gathered facts.
  const pins = pinsFor(subjects, nowMs);
  return {
    pins,
    // Ink hangs off the pins that survived — a viewer who cannot see somebody
    // on the map cannot see their drawing, by construction.
    doodles: doodlesFor(
      doodleRows.map<DoodleRow>((d) => ({ id: d.id, userId: d.userId, ink: d.ink, createdAtMs: d.createdAt.getTime() })),
      pins,
      nowMs,
    ),
    nowMs,
    // Pulled out so the map can centre on you and so you can SEE what you are
    // broadcasting — a privacy control you cannot observe is not one.
    you: pins.find((p) => p.userId === viewerId) ?? null,
  };
}
