/**
 * The one indeterminate wait indicator in the product.
 *
 * Three ink dots that rise and fade in sequence. Nothing rotates — the design
 * system bans rotation outright, and this is the primitive that makes that ban
 * affordable: there were 47 `animate-spin` in the tree and no replacement,
 * which is exactly why they survived every previous pass.
 *
 * Use this for a wait INSIDE a surface that already exists — a button that is
 * saving, a panel fetching more, a form submitting. For a whole route arriving,
 * use `RouteWait`, which renders the page's own furniture instead of an
 * indicator, because at ~300ms an indicator is noise.
 *
 * Announcement is opt-in, and defaults off. Nearly every call site is inside a
 * button that is already disabled and already re-labelled ("Saving…"), where a
 * second live region just makes a screen reader say it twice. Pass `label` only
 * when this indicator is the ONLY thing conveying that work is happening.
 *
 * It is deliberately a server-safe component: no state, no effects, no client
 * boundary. The animation is three CSS delays.
 */

export function PaperWait({
  size = "md",
  label,
  className = "",
}: {
  size?: "sm" | "md";
  /**
   * Announced to screen readers, and the only thing that makes this a live
   * region. Omit inside anything that already announces its own busy state.
   */
  label?: string;
  className?: string;
}) {
  const announced = Boolean(label);
  return (
    <span
      {...(announced
        ? { role: "status" as const, "aria-live": "polite" as const }
        : { "aria-hidden": true })}
      className={`paper-wait paper-wait-${size} ${className}`.trim()}
    >
      <span className="paper-wait-dot" />
      <span className="paper-wait-dot" />
      <span className="paper-wait-dot" />
      {announced ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
