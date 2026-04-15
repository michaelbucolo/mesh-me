export default function ExploreLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-pulse">
      <div className="mb-6">
        <div className="h-7 w-28 rounded-lg bg-[var(--bg-tertiary)] mb-2" />
        <div className="h-4 w-72 rounded bg-[var(--bg-tertiary)]" />
      </div>
      {/* Trending tags */}
      <div className="mb-8">
        <div className="h-5 w-32 rounded bg-[var(--bg-tertiary)] mb-4" />
        <div className="flex flex-wrap gap-2">
          {[60, 80, 50, 70, 90, 55, 75].map((w, i) => (
            <div key={i} className="h-8 rounded-full bg-[var(--bg-tertiary)]" style={{ width: w }} />
          ))}
        </div>
      </div>
      {/* People grid */}
      <div className="mb-8">
        <div className="h-5 w-52 rounded bg-[var(--bg-tertiary)] mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-[var(--border-primary)] p-4 bg-[var(--bg-secondary)] text-center">
              <div className="h-14 w-14 rounded-full bg-[var(--bg-tertiary)] mx-auto mb-3" />
              <div className="h-4 w-20 rounded bg-[var(--bg-tertiary)] mx-auto mb-1" />
              <div className="h-3 w-16 rounded bg-[var(--bg-tertiary)] mx-auto" />
            </div>
          ))}
        </div>
      </div>
      {/* Trending posts */}
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-5 w-24 rounded bg-[var(--bg-tertiary)] mb-4" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-[var(--border-primary)] p-5 bg-[var(--bg-secondary)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-[var(--bg-tertiary)]" />
                <div className="h-4 w-28 rounded bg-[var(--bg-tertiary)]" />
              </div>
              <div className="h-4 w-full rounded bg-[var(--bg-tertiary)] mb-2" />
              <div className="h-4 w-2/3 rounded bg-[var(--bg-tertiary)]" />
            </div>
          ))}
        </div>
        <div>
          <div className="rounded-2xl border border-[var(--border-primary)] p-5 bg-[var(--bg-secondary)]">
            <div className="h-5 w-40 rounded bg-[var(--bg-tertiary)] mb-4" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2 mb-2">
                <div className="h-10 w-10 rounded-xl bg-[var(--bg-tertiary)]" />
                <div className="flex-1">
                  <div className="h-4 w-24 rounded bg-[var(--bg-tertiary)] mb-1" />
                  <div className="h-3 w-20 rounded bg-[var(--bg-tertiary)]" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
