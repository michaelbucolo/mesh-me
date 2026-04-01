import { getCurrentUser } from "@/lib/auth";
import { getPostById } from "@/lib/queries";
import { notFound } from "next/navigation";
import { PostDetailClient } from "./post-detail-client";

export default async function PostDetailPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const user = await getCurrentUser();
  const post = await getPostById(postId);

  if (!post) notFound();

  return (
    <PostDetailClient
      post={{
        ...post,
        createdAt: String(post.createdAt),
        updatedAt: String(post.updatedAt),
        comments: post.comments.map((c) => ({
          ...c,
          createdAt: String(c.createdAt),
          updatedAt: String(c.updatedAt),
          replies: c.replies.map((r) => ({
            ...r,
            createdAt: String(r.createdAt),
            updatedAt: String(r.updatedAt),
          })),
        })),
      }}
      currentUserId={user?.id}
    />
  );
}
