export default function FeedLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 w-24 rounded-lg bg-[var(--bg-tertiary)]" />
        <div className="flex gap-2">
          <div className="h-9 w-9 rounded-lg bg-[var(--bg-tertiary)]" />
          <div className="h-9 w-9 rounded-lg bg-[var(--bg-tertiary)]" />
        </div>
      </div>
      {/* Source tabs */}
      <div className="flex gap-2 mb-6">
        {[80, 90, 70].map((w, i) => (
          <div key={i} className="h-8 rounded-lg bg-[var(--bg-tertiary)]" style={{ width: w }} />
        ))}
      </div>
      {/* Post composer skeleton */}
      <div className="rounded-2xl border border-[var(--border-primary)] p-4 mb-6 bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[var(--bg-tertiary)]" />
          <div className="h-10 flex-1 rounded-xl bg-[var(--bg-tertiary)]" />
        </div>
      </div>
      {/* Post cards skeleton */}
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-[var(--border-primary)] p-5 mb-4 bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-[var(--bg-tertiary)]" />
            <div className="flex-1">
              <div className="h-4 w-32 rounded bg-[var(--bg-tertiary)] mb-2" />
              <div className="h-3 w-20 rounded bg-[var(--bg-tertiary)]" />
            </div>
          </div>
          <div className="space-y-2 mb-4">
            <div className="h-4 w-full rounded bg-[var(--bg-tertiary)]" />
            <div className="h-4 w-3/4 rounded bg-[var(--bg-tertiary)]" />
          </div>
          <div className="flex gap-6">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-4 w-12 rounded bg-[var(--bg-tertiary)]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
