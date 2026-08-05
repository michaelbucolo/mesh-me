import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readMap } from "@/lib/meshimap/read-map";

// THE ROOM, RE-READ.
//
// PictoChat's whole feel is that somebody draws and it APPEARS. Requiring a
// refresh turns a conversation into a mailbox you have to go and check, which
// is the difference between the thing the user asked for and a worse thing
// wearing its name.
//
// ── WHY THIS CALLS `readMap` RATHER THAN A LEANER QUERY ────────────────────
//
// A poll endpoint that fetched "just the drawings" would need its own
// visibility logic, and that is a second copy of the privacy rule — which is
// exactly the defect that has cost this feature area the most: the room's
// payload reader, the movement epsilon, an audience narrowing that turned out
// to be redundant. `readMap` is the one path that applies blocking, ghost
// mode, audience, freshness and coarsening, and a slightly heavier query is a
// cheap price for there being nothing here that can drift away from it.
//
// ── WHY POLLING RATHER THAN THE PRESENCE STREAM ────────────────────────────
//
// The presence transport is scoped to a mesh ROOM — `viewingMesh` is a user
// id. A map has no owner, so riding that lane would mean inventing a synthetic
// room key and teaching the presence store about geography, which is a lot of
// new surface for a feature whose content expires in fifteen minutes. A poll
// on a visible tab is the honest amount of machinery, and the cadence is set
// by the client so a hidden tab costs nothing.

export async function GET() {
  const user = await getCurrentUser();
  // Not an error — the map itself shows nothing to a signed-out viewer, so
  // this agrees with it rather than inventing a 401 the UI would have to
  // special-case.
  if (!user) return NextResponse.json({ pins: [], doodles: [], nowMs: Date.now() });

  const { pins, doodles, nowMs } = await readMap(user.id);
  return NextResponse.json(
    { pins, doodles, nowMs },
    // Never cached. A stale room is worse than a slow one: it shows people who
    // have left and hides the drawing that just arrived, which is precisely
    // the failure this endpoint exists to prevent.
    { headers: { "cache-control": "no-store" } },
  );
}
