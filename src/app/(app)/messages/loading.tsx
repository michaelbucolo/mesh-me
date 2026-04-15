export default function MessagesLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-7 w-24 rounded-lg bg-[var(--bg-tertiary)]" />
        <div className="flex gap-2">
          <div className="h-9 w-9 rounded-lg bg-[var(--bg-tertiary)]" />
          <div className="h-9 w-9 rounded-lg bg-[var(--bg-tertiary)]" />
        </div>
      </div>
      {/* Search bar */}
      <div className="h-10 w-full rounded-xl bg-[var(--bg-secondary)] mb-4" />
      {/* Platform filter pills */}
      <div className="flex gap-2 mb-6">
        {[40, 55, 70, 50, 60].map((w, i) => (
          <div key={i} className="h-7 rounded-full bg-[var(--bg-tertiary)]" style={{ width: w }} />
        ))}
      </div>
      {/* Thread list */}
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 p-4 rounded-xl mb-2 bg-[var(--bg-secondary)]">
          <div className="h-12 w-12 rounded-full bg-[var(--bg-tertiary)] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="h-4 w-28 rounded bg-[var(--bg-tertiary)] mb-2" />
            <div className="h-3 w-48 rounded bg-[var(--bg-tertiary)]" />
          </div>
          <div className="h-3 w-10 rounded bg-[var(--bg-tertiary)]" />
        </div>
      ))}
    </div>
  );
}
