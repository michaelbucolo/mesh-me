/**
 * What a route shows while it is arriving.
 *
 * The old system put a full-screen animated mascot over every navigation. That
 * reads as "something is wrong" rather than "this is nearly here", because a
 * character with a personality line is a bigger event than the 200ms wait it
 * covers. This renders the page's own furniture instead — the same columns,
 * cards and rails the real page has, drawn empty. The layout does not move when
 * the content lands, which is the entire point.
 *
 * Three rules hold this together:
 *
 *   1. No visible text. A wait under a second that announces itself is louder
 *      than the wait. Screen readers still get a label via `aria-label`.
 *   2. No indicator below 600ms. `.paper-well` shimmers on a 600ms
 *      `animation-delay`, so a fast route paints flat blocks and is gone before
 *      anything starts moving. That delay is pure CSS — no timers, no state.
 *   3. Server component. This is the fallback for a streaming boundary; giving
 *      it a client boundary would ship a chunk that must load before the
 *      loading state can show.
 *
 * Meshi is deliberately absent. Meshi appears in waits that are genuinely long
 * AND can report a true number — the mesh weave and account import — where a
 * character with something real to say is welcome. Everywhere else Meshi
 * showing up for 200ms is noise, and noise is what made the product feel busy
 * instead of alive.
 */

type WaitShape =
  | "feed"
  | "flow"
  | "grid"
  | "list"
  | "profile"
  | "settings"
  | "conversation"
  | "rail-list"
  | "search"
  | "canvas"
  | "page";

/** A single empty block. `w`/`h` are any CSS length. */
function Well({
  w,
  h,
  radius,
  className = "",
}: {
  w?: string;
  h: string;
  radius?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`paper-well ${className}`.trim()}
      style={{ width: w ?? "100%", height: h, borderRadius: radius }}
    />
  );
}

function AvatarRow({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex items-center gap-3">
      <Well w="2.5rem" h="2.5rem" radius="999px" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Well w="38%" h="0.7rem" />
        {lines > 1 ? <Well w="22%" h="0.6rem" /> : null}
      </div>
    </div>
  );
}

function FeedCard({ media }: { media: boolean }) {
  return (
    <article className="paper-wait-card flex flex-col gap-3">
      <AvatarRow />
      <div className="flex flex-col gap-2">
        <Well h="0.7rem" />
        <Well w="72%" h="0.7rem" />
      </div>
      {media ? <Well h="18rem" radius="var(--radius-lg, 1rem)" /> : null}
      <div className="flex gap-2 pt-1">
        <Well w="3.5rem" h="1.5rem" radius="999px" />
        <Well w="3.5rem" h="1.5rem" radius="999px" />
        <Well w="3.5rem" h="1.5rem" radius="999px" />
      </div>
    </article>
  );
}

function ShapeBody({ shape }: { shape: WaitShape }) {
  switch (shape) {
    case "feed":
      return (
        <div className="paper-wait-column flex flex-col gap-4">
          <FeedCard media />
          <FeedCard media={false} />
          <FeedCard media />
        </div>
      );

    case "flow":
      // Flow is one full-bleed piece of media at a time; anything else would
      // shift the moment the real item mounts.
      return (
        <div className="flex h-full min-h-[70vh] w-full flex-col justify-end gap-3 p-4">
          <Well w="45%" h="0.75rem" />
          <Well w="30%" h="0.65rem" />
        </div>
      );

    case "grid":
      return (
        <div className="paper-wait-column grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Well key={i} h="0" className="paper-well-tile" />
          ))}
        </div>
      );

    case "list":
      return (
        <div className="paper-wait-column flex flex-col gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="paper-wait-row">
              <AvatarRow lines={i % 3 === 0 ? 1 : 2} />
            </div>
          ))}
        </div>
      );

    case "profile":
      return (
        <div className="paper-wait-column flex flex-col gap-5">
          <div className="flex items-center gap-4 sm:gap-6">
            <Well w="5rem" h="5rem" radius="999px" className="sm:h-28 sm:w-28" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Well w="45%" h="1rem" />
              <Well w="30%" h="0.7rem" />
              <div className="flex gap-4 pt-1">
                <Well w="3rem" h="0.65rem" />
                <Well w="3rem" h="0.65rem" />
                <Well w="3rem" h="0.65rem" />
              </div>
            </div>
          </div>
          <Well w="80%" h="0.7rem" />
          <div className="flex gap-2 border-b border-[var(--border-primary)] pb-3">
            <Well w="4.5rem" h="1.4rem" radius="999px" />
            <Well w="4.5rem" h="1.4rem" radius="999px" />
            <Well w="4.5rem" h="1.4rem" radius="999px" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Well key={i} h="0" className="paper-well-tile" />
            ))}
          </div>
        </div>
      );

    case "settings":
      return (
        <div className="paper-wait-column flex flex-col gap-6">
          {Array.from({ length: 3 }).map((_, section) => (
            <section key={section} className="flex flex-col gap-3">
              <Well w="30%" h="0.8rem" />
              <div className="paper-wait-card flex flex-col gap-4">
                {Array.from({ length: 3 }).map((_, row) => (
                  <div key={row} className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <Well w="40%" h="0.7rem" />
                      <Well w="65%" h="0.6rem" />
                    </div>
                    <Well w="2.6rem" h="1.4rem" radius="999px" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      );

    case "conversation":
      // Bubbles alternate sides and vary in width, so the shape reads as a
      // conversation rather than a stack of bars.
      return (
        <div className="flex h-full flex-col justify-end gap-3 p-4">
          {[
            { mine: false, w: "62%" },
            { mine: true, w: "44%" },
            { mine: false, w: "38%" },
            { mine: true, w: "70%" },
            { mine: false, w: "52%" },
          ].map((bubble, i) => (
            <div key={i} className={`flex ${bubble.mine ? "justify-end" : "justify-start"}`}>
              <Well w={bubble.w} h="2.4rem" radius="1.25rem" />
            </div>
          ))}
        </div>
      );

    case "rail-list":
      return (
        <div className="flex flex-col gap-1 p-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="paper-wait-row">
              <AvatarRow />
            </div>
          ))}
        </div>
      );

    case "search":
      return (
        <div className="paper-wait-column flex flex-col gap-4">
          <Well h="2.75rem" radius="999px" />
          <div className="flex gap-2">
            <Well w="4.5rem" h="1.6rem" radius="999px" />
            <Well w="4.5rem" h="1.6rem" radius="999px" />
            <Well w="4.5rem" h="1.6rem" radius="999px" />
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="paper-wait-row">
                <AvatarRow lines={2} />
              </div>
            ))}
          </div>
        </div>
      );

    case "canvas":
      // The mesh paints its own arrival — the scene weaves itself in behind
      // Meshi, with a real count. A skeleton on top of that would be a third
      // loader for one navigation. This exists purely so the segment keeps a
      // `loading.js` boundary: Next only prefetches as far as the nearest one,
      // and /mesh is the most-prefetched destination in the product.
      return null;

    case "page":
    default:
      return (
        <div className="paper-wait-column flex flex-col gap-4">
          <Well w="40%" h="1.1rem" />
          <Well w="65%" h="0.7rem" />
          <div className="paper-wait-card flex flex-col gap-3">
            <Well h="0.7rem" />
            <Well w="85%" h="0.7rem" />
            <Well w="60%" h="0.7rem" />
          </div>
          <div className="paper-wait-card flex flex-col gap-3">
            <Well h="0.7rem" />
            <Well w="70%" h="0.7rem" />
          </div>
        </div>
      );
  }
}

export function RouteWait({
  shape = "page",
  label = "Loading",
  className = "",
}: {
  shape?: WaitShape;
  /**
   * Announced to assistive tech only. Never rendered — see rule 1 above.
   */
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      data-wait-shape={shape}
      className={`paper-wait-route ${className}`.trim()}
    >
      <ShapeBody shape={shape} />
    </div>
  );
}
