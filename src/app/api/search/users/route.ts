import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { profileDiscoveryConsentWhere } from "@/lib/consent";
import { prisma } from "@/lib/prisma";
import { getBlockedUserIdSet } from "@/lib/privacy-policy";

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

  // Search must never cross a block in either direction. Settings states it
  // without qualification — blocked accounts "don't appear in your feed, search,
  // or live rooms — in both directions" — and searchAll (/api/search) enforces
  // it. This endpoint, the OTHER people search, did not: it is the MeChat
  // new-conversation picker, so the person you blocked stayed one keystroke from
  // being messaged, on the surface where that matters most.
  //
  // The follow-based exemptions below cannot rescue it either: blockUser deletes
  // the follow edges in both directions, so a blocked pair falls through to the
  // bare consent branch, which passes.
  const blocked = await getBlockedUserIdSet(user.id);

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: q.trim() } },
        { displayName: { contains: q.trim() } },
      ],
      id: { notIn: [user.id, ...blocked] },
      isSuspended: false,
      // The profile rule governs being DISCOVERED — found by someone who does
      // not know you. It must not sever people you are already connected to:
      // this endpoint feeds MeChat's new-conversation picker, so gating it
      // flatly would leave you unable to message, or add to a group, someone
      // you already follow. An existing follow edge in either direction is the
      // relationship the rule is explicitly about being "outside" of.
      //
      // The public gate (isPublic + showInDiscovery + discovery consent) must
      // therefore live INSIDE the stranger branch of this OR, not at the top
      // level. When it was a top-level AND, it ran on every row and excluded a
      // private account BEFORE the follow branches could exempt it — so the
      // exemption was dead code, and you could not start a DM or a group with
      // someone private you already follow. Now the public requirement gates
      // only the discovery path; a follow edge in either direction is its own
      // sufficient branch.
      AND: [
        {
          OR: [
            { isPublic: true, showInDiscovery: true, ...profileDiscoveryConsentWhere() },
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
