import { PostSkeleton } from "@/components/ui/skeleton";

export default function FeedLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-[var(--bg-tertiary)] mb-6" />
      {Array.from({ length: 3 }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}
