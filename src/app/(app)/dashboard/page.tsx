import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [postCount, followerCount, followingCount, connectedAccounts, recentPosts, unreadNotifs] = await Promise.all([
    prisma.post.count({ where: { authorId: user.id } }),
    prisma.follow.count({ where: { followingId: user.id } }),
    prisma.follow.count({ where: { followerId: user.id } }),
    prisma.connectedAccount.findMany({
      where: { userId: user.id },
      select: { platform: true, platformUsername: true, lastSyncAt: true },
    }),
    prisma.post.findMany({
      where: { authorId: user.id },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { comments: true, reactions: true } },
      },
    }),
    prisma.notification.count({ where: { recipientId: user.id, read: false } }),
  ]);

  return (
    <DashboardClient
      user={{
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      }}
      stats={{
        posts: postCount,
        followers: followerCount,
        following: followingCount,
        platforms: connectedAccounts.length,
        unreadNotifs,
      }}
      connectedAccounts={connectedAccounts.map((a) => ({
        platform: a.platform,
        username: a.platformUsername,
        lastSync: a.lastSyncAt?.toISOString() || null,
      }))}
      recentPosts={recentPosts.map((p) => ({
        id: p.id,
        content: p.content,
        createdAt: p.createdAt.toISOString(),
        comments: p._count.comments,
        reactions: p._count.reactions,
      }))}
    />
  );
}
