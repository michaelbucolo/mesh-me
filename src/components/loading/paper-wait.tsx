/** A small, CSS-only thread of activity. Labels are opt-in to avoid duplicate announcements inside busy buttons. */
export function PaperWait({ size = "md", label, className = "" }: { size?: "sm" | "md"; label?: string; className?: string }) {
  const announced = Boolean(label);
  return (
    <span
      {...(announced ? { role: "status" as const, "aria-live": "polite" as const } : { "aria-hidden": true })}
      className={`paper-wait paper-wait-${size} ${className}`.trim()}
    >
      <span className="paper-wait-thread" />
      <span className="paper-wait-dot" /><span className="paper-wait-dot" /><span className="paper-wait-dot" />
      {announced ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
