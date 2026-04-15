export default function MeshProLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-pulse">
      <div className="text-center mb-12">
        <div className="h-10 w-48 mx-auto rounded mb-4" style={{ background: "var(--bg-tertiary)" }} />
        <div className="h-4 w-72 mx-auto rounded" style={{ background: "var(--bg-tertiary)" }} />
      </div>
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-56 rounded-2xl" style={{ background: "var(--bg-tertiary)" }} />
        ))}
      </div>
      <div className="h-48 rounded-2xl max-w-lg mx-auto" style={{ background: "var(--bg-tertiary)" }} />
    </div>
  );
}
