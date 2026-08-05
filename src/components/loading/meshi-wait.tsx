/**
 * What a long wait SAYS. Meshi himself is not here.
 *
 * This file used to be "the only wait state Meshi appears in", and it drew the
 * user's own mascot. That was the bug: the companion is a single character who
 * lives at the app root and is never unmounted, and this mounted a second copy
 * of him for the length of the gate. Entering your own mesh played three bodies
 * in a row — the float hiding on the pathname, this one fading in centred, then
 * the canvas one at the heart. See mesh/live/meshi-presence.ts for the handoff
 * that replaced it; the one Meshi now stays with you through the wait.
 *
 * Two things still keep it honest:
 *
 *   1. It fades in at 900ms, in CSS, with no timer and no state. A wait that
 *      resolves quickly shows nothing at all — the element is in the tree from
 *      the first frame but transparent, so there is no layout shift when it
 *      arrives and no client chunk to download first.
 *   2. `detail` is for a real, counted number and nothing else. If the caller
 *      does not know one, it passes nothing. A fake percentage that jumps to
 *      100% on completion is worse than no number, because the next time the
 *      user sees a number they will not believe it.
 */

export function MeshiWait({
  headline,
  detail,
  className = "",
}: {
  /** One short line. Present tense — this is happening now. */
  headline: string;
  /**
   * A true, counted number ("128 posts woven"). Omit unless you have one.
   */
  detail?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`meshi-wait ${className}`.trim()}
    >
      <div className="meshi-wait-body">
        {/* THIS NO LONGER DRAWS A MESHI, and that is the point.
            It used to render the user's own <UserMeshi/> here — a second body,
            mounted for the length of the gate and thrown away when the scene
            arrived, while the floating companion had already hidden itself and
            the canvas one had not yet appeared. Three Meshis in a row for one
            character. The companion stays on screen through the wait now (see
            mesh/live/meshi-presence.ts), so the wait needs words, not a mascot. */}
        <p className="meshi-wait-headline">{headline}</p>
        {/* Reserved whether or not a number exists, so the line arriving does
            not push the headline up. */}
        <p className="meshi-wait-detail">{detail ?? " "}</p>
      </div>
    </div>
  );
}
