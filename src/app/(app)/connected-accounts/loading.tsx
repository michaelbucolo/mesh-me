export default function ConnectedAccountsLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-6 animate-pulse">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-6 w-6 rounded" style={{ background: "var(--bg-tertiary)" }} />
        <div className="h-7 w-48 rounded" style={{ background: "var(--bg-tertiary)" }} />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl" style={{ background: "var(--bg-tertiary)" }} />
        ))}
      </div>
    </div>
  );
}
