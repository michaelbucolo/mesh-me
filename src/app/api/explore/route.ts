import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDiscoverUsers, getExplorePosts, getTrendingCommunities } from "@/lib/queries";

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? "12"), 1), 30);
    const timed = async <T>(label: string, fn: () => Promise<T>): Promise<[string, number, T]> => {
      const t0 = Date.now();
      const value = await fn();
      return [label, Date.now() - t0, value];
    };
    const t0 = Date.now();
    const [[, postsMs, posts], [, usersMs, users], [, communitiesMs, communities]] = await Promise.all([
      timed("posts", () => getExplorePosts(1, limit)),
      timed("users", () => getDiscoverUsers(currentUser)),
      timed("communities", () => getTrendingCommunities()),
    ]);
    const totalMs = Date.now() - t0;
    if (totalMs > 400) {
      console.log(
        `[explore-timing] total=${totalMs}ms posts=${postsMs}ms users=${usersMs}ms communities=${communitiesMs}ms`,
      );
    }

    return NextResponse.json(
      {
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
      },
      // Discovery tolerates a little staleness — let the browser reuse it
      // briefly so hopping back to Explore is instant.
      { headers: { "Cache-Control": "private, max-age=45, stale-while-revalidate=120" } },
    );
  } catch {
    return NextResponse.json({ posts: [], users: [], communities: [] });
  }
}
