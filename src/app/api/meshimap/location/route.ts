import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { reportLocation, type LocationDb } from "@/lib/meshimap/report-location";

// WHERE A DEVICE READING ENTERS THE SYSTEM — and the last place it exists.
//
// The body carries a real GPS fix. `reportLocation` uses it to pick a grid
// cell and discards it; nothing below this handler ever holds the point. The
// response deliberately echoes the CELL rather than the reading, so a client
// can show the user exactly what was stored and there is no round-trip that
// hands the precise value back.
//
// This route logs nothing. A request log containing a body is a location
// history with extra steps, which is precisely the thing the storage design
// exists to prevent.

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await readJsonObject(request);

  // Ghost mode is server-authoritative everywhere else on mesh.me, and a map
  // is the surface where it matters most. A ghosting account's report is
  // accepted and then erased rather than rejected, so the client does not have
  // to special-case it and cannot end up with a stale row it thinks is hidden.
  if (user.ghostMode) {
    await prisma.userLocation.delete({ where: { userId: user.id } }).catch(() => undefined);
    return NextResponse.json({ ok: true, sharing: false, ghost: true });
  }

  const result = await reportLocation(
    user.id,
    {
      lat: typeof body.lat === "number" ? body.lat : Number.NaN,
      lng: typeof body.lng === "number" ? body.lng : Number.NaN,
      // Both are narrowed inside reportLocation — passed through raw so there
      // is exactly one place that decides what an unknown value means.
      precision: body.precision as never,
      audience: body.audience as never,
    },
    prisma as unknown as LocationDb,
    Date.now(),
  );

  if (!result.ok) {
    return NextResponse.json({ error: "That reading is not a location" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    sharing: result.stored.audience !== "nobody",
    // The CELL, so the user can see what is actually stored about them.
    at: result.stored.audience === "nobody" ? null : { lat: result.stored.lat, lng: result.stored.lng },
    precision: result.stored.precision,
    audience: result.stored.audience,
  });
}
