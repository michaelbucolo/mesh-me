import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const q = req.nextUrl.searchParams.get("q")?.trim();

    const communities = await prisma.community.findMany({
      where: {
        isPublic: true,
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { description: { contains: q } },
                { category: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { members: true, posts: true } },
        members: {
          where: { userId: user.id },
          select: { id: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    });

    return NextResponse.json({
      communities: communities.map((community) => ({
        id: community.id,
        name: community.name,
        slug: community.slug,
        description: community.description,
        category: community.category,
        isMember: community.members.length > 0,
        role: community.members[0]?.role ?? null,
        memberCount: community._count.members,
        postCount: community._count.posts,
      })),
    });
  } catch {
    return NextResponse.json({ communities: [] });
  }
}
