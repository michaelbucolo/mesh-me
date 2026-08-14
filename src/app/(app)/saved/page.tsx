import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSavedFlowItems, getSavedPosts } from "@/lib/queries";
import { SavedList, type SavedRow } from "@/components/saved/saved-list";

export const metadata: Metadata = {
  title: "Saved",
  description: "Everything you saved, from every platform, in one list.",
};

// One saved list that spans platforms — the utility door. Native mesh posts
// (SavedPost, audience-gated by getSavedPosts) and external snapshots
// (SavedFlowItem) merge NEWEST SAVE FIRST: this list answers "what did I put
// aside", so it orders by when you saved, not when the author posted.
export default async function SavedPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fsaved");

  const [savedPosts, savedFlowItems, saveTimes] = await Promise.all([
    getSavedPosts(1, 40),
    getSavedFlowItems(80),
    // getSavedPosts returns the posts without their save timestamps (the
    // Collection tab never needed them); the viewer's own SavedPost rows are
    // the cheap source of truth for save order.
    prisma.savedPost.findMany({
      where: { userId: user.id },
      select: { postId: true, createdAt: true },
    }),
  ]);

  const savedAtByPostId = new Map(saveTimes.map((row) => [row.postId, row.createdAt.getTime()]));

  const rows: SavedRow[] = [
    ...savedPosts.map((post): SavedRow => ({
      kind: "native",
      id: `native:${post.id}`,
      postId: post.id,
      content: post.content,
      authorName: post.author.displayName,
      authorUsername: post.author.username,
      authorAvatarUrl: post.author.avatarUrl,
      reactionCount: post._count.reactions,
      commentCount: post._count.comments,
      savedAtMs: savedAtByPostId.get(post.id) ?? new Date(post.createdAt).getTime(),
    })),
    ...savedFlowItems.map((item): SavedRow => ({
      kind: "external",
      id: `external:${item.id}`,
      refId: item.refId,
      platform: item.platform,
      title: item.title,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl,
      authorName: item.authorName,
      savedAtMs: item.createdAt.getTime(),
    })),
  ].sort((a, b) => b.savedAtMs - a.savedAtMs);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">Saved</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Everything you bookmarked — from mesh.me and every platform — in one list.
        </p>
      </header>
      <SavedList initial={rows} />
    </div>
  );
}
