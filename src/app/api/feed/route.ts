import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") || "all";

  const following = await prisma.follow.findMany({
    where: { followerId: user.id },
    select: { followingId: true },
  });
  const followingIds = following.map((f) => f.followingId);

  const communityMemberships = await prisma.communityMember.findMany({
    where: { userId: user.id },
    select: { communityId: true },
  });
  const communityIds = communityMemberships.map((cm) => cm.communityId);

  let whereClause = {};
  if (source === "following") {
    whereClause = { authorId: { in: [...followingIds, user.id] } };
  } else if (source === "discover") {
    whereClause = { authorId: { notIn: [...followingIds, user.id] } };
  } else {
    whereClause = {
      OR: [
        { authorId: { in: [...followingIds, user.id] } },
        { communityId: { in: communityIds } },
      ],
    };
  }

  const posts = await prisma.post.findMany({
    where: whereClause,
    include: {
      author: {
        select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
      },
      community: { select: { name: true, slug: true } },
      media: true,
      tags: true,
      _count: { select: { comments: true, reactions: true, reposts: true } },
      reactions: { where: { userId: user.id }, select: { id: true } },
      savedBy: { where: { userId: user.id }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ posts });
}
