export default function InnovationLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="animate-pulse space-y-5">
        <div className="h-36 rounded-3xl bg-[var(--bg-secondary)]/60" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-[var(--bg-secondary)]/60" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <div className="h-72 rounded-2xl bg-[var(--bg-secondary)]/60" />
          <div className="h-72 rounded-2xl bg-[var(--bg-secondary)]/60" />
        </div>
      </div>
    </main>
  );
}
