export default function MeshLoading() {
  return (
    <div className="flex items-center justify-center min-h-[80vh]">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <div className="h-12 w-12 rounded-full" style={{ background: "var(--accent-muted)" }} />
        <div className="h-3 w-32 rounded-full" style={{ background: "var(--bg-tertiary)" }} />
      </div>
    </div>
  );
}
