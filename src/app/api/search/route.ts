import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();

  if (q.length < 2) {
    return NextResponse.json({ users: [], posts: [], communities: [] });
  }

  const [users, posts, communities] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q } },
          { displayName: { contains: q } },
          { bio: { contains: q } },
        ],
        id: { not: user.id },
        isSuspended: false,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
        _count: { select: { followers: true } },
      },
      take: 12,
      orderBy: { followers: { _count: "desc" } },
    }),
    prisma.post.findMany({
      where: {
        content: { contains: q },
        author: { isSuspended: false },
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        _count: { select: { comments: true, reactions: true } },
      },
      take: 20,
      orderBy: { createdAt: "desc" },
    }),
    prisma.community.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        _count: { select: { members: true } },
      },
      take: 12,
      orderBy: { members: { _count: "desc" } },
    }),
  ]);

  return NextResponse.json({ users, posts, communities });
}
