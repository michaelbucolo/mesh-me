import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDiscoverUsers, getExplorePosts, getTrendingCommunities } from "@/lib/queries";

export async function GET(req: NextRequest) {
  try {
    if (!(await getCurrentUser())) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? "12"), 1), 30);
    const [posts, users, communities] = await Promise.all([
      getExplorePosts(1, limit),
      getDiscoverUsers(),
      getTrendingCommunities(),
    ]);

    return NextResponse.json({
      posts: posts.map((post) => ({
        id: post.id,
        content: post.content,
        createdAt: post.createdAt,
        author: post.author,
        community: post.community,
        reactionCount: post._count.reactions,
        commentCount: post._count.comments,
        repostCount: post._count.reposts,
      })),
      users: users.slice(0, limit).map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        followerCount: user._count.followers,
        postCount: user._count.posts,
        interests: user.interests.map((interest) => interest.tag),
      })),
      communities: communities.slice(0, limit).map((community) => ({
        id: community.id,
        name: community.name,
        slug: community.slug,
        description: community.description,
        category: community.category,
        memberCount: community._count.members,
        postCount: community._count.posts,
      })),
    });
  } catch {
    return NextResponse.json({ posts: [], users: [], communities: [] });
  }
}
