"use client";

import { useRouter } from "next/navigation";
import { FlowReels } from "../feed/flow-reels";
import type { FeedCardPost } from "@/lib/feed-data";

type FlowPageClientProps = {
  posts: FeedCardPost[];
  currentUserId: string;
  connectedPlatforms: string[];
};

export function FlowPageClient({ posts, currentUserId, connectedPlatforms }: FlowPageClientProps) {
  const router = useRouter();

  return (
    <FlowReels
      posts={posts}
      startId={null}
      currentUserId={currentUserId}
      connectedPlatforms={connectedPlatforms}
      hasMore={false}
      loadingMore={false}
      onClose={() => router.push("/mesh")}
      onLoadMore={() => {}}
    />
  );
}
