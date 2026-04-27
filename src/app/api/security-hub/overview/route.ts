import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const [postCount, platformPostCount, localVideoCount, platformVideoCount, commentCount, platformCommentCount] = await Promise.all([
    prisma.post.count({ where: { authorId: session.userId } }),
    prisma.platformPost.count({ where: { connectedAccount: { userId: session.userId } } }),
    prisma.postMedia.count({
      where: {
        type: "video",
        post: { authorId: session.userId },
      },
    }),
    prisma.platformPost.count({
      where: {
        connectedAccount: { userId: session.userId },
        postType: { in: ["video", "reel", "short"] },
      },
    }),
    prisma.comment.count({ where: { authorId: session.userId } }),
    prisma.platformComment.count({
      where: {
        connectedAccount: { userId: session.userId },
        isOwnComment: true,
      },
    }),
  ]);

  return NextResponse.json({
    content: {
      postsAndPhotos: postCount + platformPostCount,
      videos: localVideoCount + platformVideoCount,
      commentsAndReplies: commentCount + platformCommentCount,
    },
  });
}
