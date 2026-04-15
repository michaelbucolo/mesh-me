export default function CommunitiesLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-7 w-40 rounded-lg bg-[var(--bg-tertiary)] mb-2" />
          <div className="h-4 w-64 rounded bg-[var(--bg-tertiary)]" />
        </div>
        <div className="h-10 w-44 rounded-xl bg-[var(--bg-tertiary)]" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl border border-[var(--border-primary)] p-5 bg-[var(--bg-secondary)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-xl bg-[var(--bg-tertiary)]" />
              <div className="flex-1">
                <div className="h-5 w-32 rounded bg-[var(--bg-tertiary)] mb-2" />
                <div className="h-3 w-24 rounded bg-[var(--bg-tertiary)]" />
              </div>
            </div>
            <div className="h-4 w-full rounded bg-[var(--bg-tertiary)] mb-2" />
            <div className="h-4 w-2/3 rounded bg-[var(--bg-tertiary)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
