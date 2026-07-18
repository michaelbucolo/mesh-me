import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getFeedPostById } from "@/lib/feed-data";
import { getPostById } from "@/lib/queries";
import { ExternalPostDetail } from "./external-post-detail";
import { PostDetailClient } from "./post-detail-client";

export const metadata: Metadata = {
  title: "Post",
  description: "View a Mesh.me post with source credit, synced actions, comments, privacy state, and Mesh context.",
};

type PostDetailPageProps = {
  params: Promise<{ postId: string }>;
};

function serializePost(post: NonNullable<Awaited<ReturnType<typeof getPostById>>>) {
  return {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    comments: post.comments.map((comment) => ({
      ...comment,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      replies: comment.replies.map((reply) => ({
        ...reply,
        createdAt: reply.createdAt.toISOString(),
        updatedAt: reply.updatedAt.toISOString(),
      })),
    })),
  };
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login?next=/feed");
  if (!currentUser.onboarded) redirect("/onboarding");

  const { postId } = await params;
  const post = await getPostById(postId);
  if (!post) {
    // Connected-platform and external-feed posts get an in-app home too —
    // the Flow, shares, and saves all link here, and nothing should 404.
    if (postId.startsWith("platform-") || postId.startsWith("feeditem-")) {
      const external = await getFeedPostById(currentUser, postId);
      if (external) {
        return <ExternalPostDetail post={{ ...external, createdAt: String(external.createdAt) }} />;
      }
    }
    notFound();
  }

  return <PostDetailClient post={serializePost(post)} currentUserId={currentUser.id} />;
}
