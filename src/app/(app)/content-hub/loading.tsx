export default function ContentHubLoading() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 animate-pulse">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-6 w-6 rounded" style={{ background: "var(--bg-tertiary)" }} />
        <div className="h-7 w-36 rounded" style={{ background: "var(--bg-tertiary)" }} />
      </div>
      <div className="flex gap-2 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-lg" style={{ background: "var(--bg-tertiary)" }} />
        ))}
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl" style={{ background: "var(--bg-tertiary)" }} />
        ))}
      </div>
      <div className="h-64 rounded-2xl" style={{ background: "var(--bg-tertiary)" }} />
    </div>
  );
}
