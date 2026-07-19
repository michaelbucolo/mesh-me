"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Navigation feedback as a luminous sweep — not a progress bar. When an
 * in-app navigation starts, a thin brand-gradient light glides across the top
 * edge; it settles the moment the new route commits. Indeterminate and
 * energetic, matching the mesh's aesthetic rather than a filling bar.
 */
// Each area of the app gives the loading sweep its own tint, so moving around
// has a subtle sense of place (cyan for discovery, pink for social, green for
// settings/secure, amber for pro). [a, b] = [lead color, trail/comet color].
function sweepPersonality(path: string): [string, string] {
  if (path.startsWith("/messages") || path.startsWith("/feed") || path.startsWith("/notifications")) {
    return ["#ec4899", "#f9a8d4"];
  }
  if (path.startsWith("/settings") || path.startsWith("/privacy") || path.startsWith("/account") || path.startsWith("/connected")) {
    return ["#34d399", "#6ee7b7"];
  }
  if (path.startsWith("/meshpro") || path.startsWith("/billing") || path.startsWith("/analytics")) {
    return ["#f59e0b", "#fcd34d"];
  }
  if (path.startsWith("/mesh") || path.startsWith("/explore") || path.startsWith("/search") || path.startsWith("/communities")) {
    return ["#34e4ea", "#a8d8ff"];
  }
  return ["var(--accent)", "var(--mesh-cyan)"];
}

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [sweep, setSweep] = useState<[string, string]>(["var(--accent)", "var(--mesh-cyan)"]);
  const hideTimer = useRef<number | null>(null);

  // Settle shortly after the committed route (path or query) changes.
  useEffect(() => {
    if (!active) return;
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setActive(false), 360);
    return () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Kick off the sweep as soon as an in-app navigation is initiated.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href || href.startsWith("#") || target === "_blank" || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setSweep(sweepPersonality(url.pathname));
      setActive(true);
    };
    const onPopState = () => setActive(true);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      className="nav-sweep"
      aria-hidden="true"
      style={{ ["--sweep-a" as string]: sweep[0], ["--sweep-b" as string]: sweep[1] }}
    >
      <span className="nav-sweep-line" />
    </div>
  );
}
