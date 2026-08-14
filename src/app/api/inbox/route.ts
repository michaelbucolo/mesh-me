import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readInbox } from "@/lib/inbox/read-inbox";

// THE INBOX AS JSON — for clients that are not this Next app.
//
// The web inbox is a server component (src/app/(app)/inbox/page.tsx) reading
// readInbox directly; the native SwiftUI app (apple/MeshMe) has no server
// components, so this route serves the SAME read over HTTP. One reader, one
// owed judgement (wants-you.ts) — this file contains no logic of its own,
// which is the whole point.

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  const inbox = await readInbox(user.id, "all");
  return NextResponse.json(inbox, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
