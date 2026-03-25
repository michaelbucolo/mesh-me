import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const [followingData, followersData, communitiesData, interestsData] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: user.id },
      include: { following: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      take: 50,
    }),
    prisma.follow.findMany({
      where: { followingId: user.id },
      include: { follower: { select: { id: true, username: true, displayName: true, avatarUrl: true } } },
      take: 50,
    }),
    prisma.communityMember.findMany({
      where: { userId: user.id },
      include: { community: { select: { id: true, name: true, slug: true, _count: { select: { members: true } } } } },
    }),
    prisma.userInterest.findMany({ where: { userId: user.id }, select: { tag: true } }),
  ]);

  return NextResponse.json({
    user: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl },
    following: followingData.map((f) => f.following),
    followers: followersData.map((f) => f.follower),
    communities: communitiesData.map((cm) => ({
      id: cm.community.id,
      name: cm.community.name,
      slug: cm.community.slug,
      memberCount: cm.community._count.members,
    })),
    interests: interestsData.map((i) => i.tag),
  });
}
