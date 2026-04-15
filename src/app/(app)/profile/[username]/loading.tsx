export default function ProfileLoading() {
  return (
    <div className="max-w-2xl mx-auto animate-pulse">
      {/* Banner */}
      <div className="h-48 rounded-none bg-[var(--bg-tertiary)]" />
      {/* Profile header */}
      <div className="px-6 -mt-16 relative">
        <div className="flex items-end justify-between mb-4">
          <div className="h-24 w-24 rounded-full bg-[var(--bg-secondary)] ring-4 ring-[var(--bg-primary)]" />
          <div className="flex gap-2 mb-2">
            <div className="h-9 w-24 rounded-lg bg-[var(--bg-tertiary)]" />
          </div>
        </div>
        <div className="mb-4">
          <div className="h-6 w-36 rounded bg-[var(--bg-tertiary)] mb-2" />
          <div className="h-4 w-24 rounded bg-[var(--bg-tertiary)]" />
        </div>
        <div className="h-4 w-full rounded bg-[var(--bg-tertiary)] mb-2" />
        <div className="h-4 w-2/3 rounded bg-[var(--bg-tertiary)] mb-4" />
        <div className="flex gap-4 mb-4">
          <div className="h-4 w-24 rounded bg-[var(--bg-tertiary)]" />
          <div className="h-4 w-24 rounded bg-[var(--bg-tertiary)]" />
        </div>
        {/* Badges */}
        <div className="flex gap-2 mb-4">
          {[60, 80, 70].map((w, i) => (
            <div key={i} className="h-6 rounded-lg bg-[var(--bg-tertiary)]" style={{ width: w }} />
          ))}
        </div>
      </div>
      {/* Tabs */}
      <div className="px-6 mt-4">
        <div className="flex gap-4 border-b border-[var(--border-primary)] pb-2 mb-4">
          {[50, 80, 80, 50].map((w, i) => (
            <div key={i} className="h-8 rounded bg-[var(--bg-tertiary)]" style={{ width: w }} />
          ))}
        </div>
        {/* Post placeholders */}
        {[1, 2].map((i) => (
          <div key={i} className="rounded-2xl border border-[var(--border-primary)] p-5 mb-4 bg-[var(--bg-secondary)]">
            <div className="h-4 w-full rounded bg-[var(--bg-tertiary)] mb-2" />
            <div className="h-4 w-3/4 rounded bg-[var(--bg-tertiary)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
