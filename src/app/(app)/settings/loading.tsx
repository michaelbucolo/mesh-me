export default function SettingsLoading() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 animate-pulse">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-6 w-6 rounded" style={{ background: "var(--bg-tertiary)" }} />
        <div className="h-7 w-32 rounded" style={{ background: "var(--bg-tertiary)" }} />
      </div>
      <div className="flex gap-8">
        <div className="w-52 flex-shrink-0 hidden md:block space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 rounded-lg" style={{ background: "var(--bg-tertiary)" }} />
          ))}
        </div>
        <div className="flex-1 space-y-4">
          <div className="h-48 rounded-2xl" style={{ background: "var(--bg-tertiary)" }} />
          <div className="h-32 rounded-2xl" style={{ background: "var(--bg-tertiary)" }} />
        </div>
      </div>
    </div>
  );
}
