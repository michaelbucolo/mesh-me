import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listPresences } from "@/lib/mesh-presence-store";
import { getBlockedUserIdSet } from "@/lib/privacy-policy";

// Presence is opt-in at the source (hideActivityStatus stops heartbeats, ghost
// mode hides you), so anyone with a fresh entry is fine to report as active.
const ONLINE_WINDOW_MS = 15000;

/**
 * Who among my MeChat contacts is on mesh.me right now. Sharing a thread is
 * the relationship that unlocks "Active now" — same rule iMessage and
 * Instagram DMs use.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const memberRows = await prisma.threadMember.findMany({
    where: { thread: { members: { some: { userId: user.id } } } },
    select: { userId: true },
  });
  const contactIds = new Set(memberRows.map((row) => row.userId));
  contactIds.delete(user.id);
  if (contactIds.size === 0) return NextResponse.json({ online: [] });

  // Thread membership deliberately survives a block, so presence must subtract
  // blocked users in either direction — never report a blocked user as active.
  const blocked = await getBlockedUserIdSet(user.id);

  const now = Date.now();
  const online = (await listPresences())
    .filter(
      (entry) =>
        contactIds.has(entry.userId) &&
        !blocked.has(entry.userId) &&
        !entry.ghostMode &&
        now - entry.lastSeen < ONLINE_WINDOW_MS,
    )
    .map((entry) => entry.userId);

  return NextResponse.json({ online });
}
