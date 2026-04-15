export default function SearchLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-pulse">
      <div className="h-11 rounded-xl mb-6" style={{ background: "var(--bg-tertiary)" }} />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-tertiary)" }}>
            <div className="h-10 w-10 rounded-full" style={{ background: "var(--bg-secondary)" }} />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded" style={{ background: "var(--bg-secondary)" }} />
              <div className="h-2.5 w-48 rounded" style={{ background: "var(--bg-secondary)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
