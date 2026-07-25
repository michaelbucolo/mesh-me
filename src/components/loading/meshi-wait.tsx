/**
 * The only wait state Meshi appears in.
 *
 * Meshi showing up for a 200ms route change is noise — a character with a
 * personality line is a bigger event than the wait it covers, which is why the
 * old system read as busy rather than alive. So Meshi is reserved for waits
 * that are genuinely long and have something true to report: the mesh weaving
 * itself, and pulling an account's history across. Two places, both over a
 * second, both with real work behind them.
 *
 * Two things keep it honest:
 *
 *   1. Meshi fades in at 900ms, in CSS, with no timer and no state. A wait that
 *      resolves quickly never shows a mascot at all — the element is in the
 *      tree from the first frame but transparent, so there is no layout shift
 *      when it arrives and no client chunk to download first.
 *   2. `detail` is for a real, counted number and nothing else. If the caller
 *      does not know one, it passes nothing. A fake percentage that jumps to
 *      100% on completion is worse than no number, because the next time the
 *      user sees a number they will not believe it.
 */

import { UserMeshi } from "@/components/meshi/user-meshi";

export function MeshiWait({
  headline,
  detail,
  size = 96,
  className = "",
}: {
  /** One short line. Present tense — this is happening now. */
  headline: string;
  /**
   * A true, counted number ("128 posts woven"). Omit unless you have one.
   */
  detail?: string;
  size?: number;
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
        {/* The user's own Meshi — their colour, their cosmetics. A generic
            mascot here would be a stranger telling them their world is
            loading. */}
        <UserMeshi size={size} />
        <p className="meshi-wait-headline">{headline}</p>
        {/* Reserved whether or not a number exists, so the line arriving does
            not push the headline up. */}
        <p className="meshi-wait-detail">{detail ?? " "}</p>
      </div>
    </div>
  );
}
