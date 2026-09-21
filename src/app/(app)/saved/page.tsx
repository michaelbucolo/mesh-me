import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Bookmark } from "lucide-react";
import { PageIntro } from "@/components/ui/signature-art";
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
    <div className="social-page social-saved mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
      <PageIntro className="social-page-intro" heading="h1" eyebrow="Your collection" title="Worth keeping." description="The posts, links, and moments you saved for later." action={<Link href="/explore" className="mesh-action px-4 text-sm">Find something new <ArrowUpRight size={15} aria-hidden="true" /></Link>} />
      <div className="social-section-heading"><span><Bookmark size={15} aria-hidden="true" /> Saved</span><span>Newest first</span></div>
      <SavedList initial={rows} />
    </div>
  );
}
