import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { profileDiscoveryConsentWhere } from "@/lib/consent";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  if (!q.trim()) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: q.trim() } },
        { displayName: { contains: q.trim() } },
      ],
      id: { not: user.id },
      isSuspended: false,
      isPublic: true,
      showInDiscovery: true,
      // The profile rule governs being DISCOVERED — found by someone who does
      // not know you. It must not sever people you are already connected to:
      // this endpoint feeds MeChat's new-conversation picker, so gating it
      // flatly would leave you unable to message, or add to a group, someone
      // you already follow. An existing follow edge in either direction is the
      // relationship the rule is explicitly about being "outside" of.
      AND: [
        {
          OR: [
            profileDiscoveryConsentWhere(),
            { following: { some: { followingId: user.id } } },
            { followers: { some: { followerId: user.id } } },
          ],
        },
      ],
    },
    select: {
      id: true,
      username: true,
      displayName: true,
      avatarUrl: true,
    },
    take: 10,
  });

  return NextResponse.json({ users });
}
