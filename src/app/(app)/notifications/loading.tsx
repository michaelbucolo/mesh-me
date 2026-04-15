export default function NotificationsLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-7 w-36 rounded-lg bg-[var(--bg-tertiary)]" />
        <div className="h-8 w-24 rounded-lg bg-[var(--bg-tertiary)]" />
      </div>
      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {[50, 50, 70, 60, 70, 60].map((w, i) => (
          <div key={i} className="h-8 rounded-lg bg-[var(--bg-tertiary)] flex-shrink-0" style={{ width: w }} />
        ))}
      </div>
      {/* Notification items */}
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <div key={i} className="flex items-start gap-3 p-4 rounded-xl mb-2 bg-[var(--bg-secondary)]">
          <div className="h-10 w-10 rounded-full bg-[var(--bg-tertiary)] flex-shrink-0" />
          <div className="flex-1">
            <div className="h-4 w-3/4 rounded bg-[var(--bg-tertiary)] mb-2" />
            <div className="h-3 w-20 rounded bg-[var(--bg-tertiary)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
