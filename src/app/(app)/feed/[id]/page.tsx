import { getCurrentUser } from "@/lib/auth";
import { getPostById } from "@/lib/queries";
import { PostCard } from "@/components/feed/post-card";
import { CommentSection } from "@/components/feed/comment-section";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const post = await getPostById(id);

  if (!post) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="mb-6">
        <Link href="/feed" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </Link>
      </div>

      <PostCard post={post} currentUserId={user?.id} />

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-4">
          Comments ({post._count.comments})
        </h3>
        <CommentSection
          postId={post.id}
          comments={post.comments || []}
          currentUser={user ? { displayName: user.displayName, avatarUrl: user.avatarUrl } : null}
        />
      </div>
    </div>
  );
}
