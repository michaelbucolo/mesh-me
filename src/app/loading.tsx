export default function PublicLoading() {
  return (
    <main className="min-h-screen bg-[var(--bg-primary)] px-4 py-10" role="status" aria-live="polite" aria-busy="true">
      <p className="sr-only">Loading page content</p>
      <div className="mx-auto w-full max-w-6xl space-y-8 motion-safe:animate-pulse">
        <p className="text-sm text-[var(--text-muted)]">Loading a simple view…</p>
        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="h-4 w-32 rounded-full bg-[var(--bg-tertiary)]" />
            <div className="h-12 w-full max-w-2xl rounded-2xl bg-[var(--bg-tertiary)]" />
            <div className="h-12 w-4/5 rounded-2xl bg-[var(--bg-tertiary)]" />
            <div className="h-5 w-2/3 rounded-full bg-[var(--bg-tertiary)]" />
            <div className="flex gap-3 pt-2">
              <div className="h-11 w-40 rounded-xl bg-[var(--bg-tertiary)]" />
              <div className="h-11 w-40 rounded-xl bg-[var(--bg-tertiary)]" />
            </div>
          </div>
          <div className="h-72 rounded-3xl bg-[var(--bg-secondary)]" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-36 rounded-2xl bg-[var(--bg-secondary)]" />
          <div className="h-36 rounded-2xl bg-[var(--bg-secondary)]" />
          <div className="h-36 rounded-2xl bg-[var(--bg-secondary)]" />
        </div>
      </div>
    </main>
  );
}
