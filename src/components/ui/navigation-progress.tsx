"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Navigation feedback as a luminous sweep — not a progress bar. When an
 * in-app navigation takes a moment, a thin brand-gradient light glides across the top
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
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [phase, setPhase] = useState<"idle" | "waiting" | "loading" | "settling">("idle");
  const [sweep, setSweep] = useState<[string, string]>(["var(--accent)", "var(--mesh-cyan)"]);
  const phaseRef = useRef(phase);
  const navigationVersion = useRef(0);
  const committedRoute = useRef(routeKey);
  const timers = useRef<{ show: number | null; settle: number | null; fallback: number | null }>({ show: null, settle: null, fallback: null });

  const changePhase = useCallback((next: typeof phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearTimers = useCallback(() => {
    for (const timer of Object.values(timers.current)) {
      if (timer !== null) window.clearTimeout(timer);
    }
    timers.current = { show: null, settle: null, fallback: null };
  }, []);

  const settle = useCallback(() => {
    const wasVisible = phaseRef.current === "loading";
    clearTimers();
    if (!wasVisible) {
      changePhase("idle");
      return;
    }
    changePhase("settling");
    timers.current.settle = window.setTimeout(() => changePhase("idle"), 180);
  }, [changePhase, clearTimers]);

  // Path and query commits end loading. A stable string avoids treating a new
  // search-params object as another journey on unrelated renders.
  useEffect(() => {
    if (committedRoute.current === routeKey) return;
    committedRoute.current = routeKey;
    clearTimers();
    // Settle on the next animation frame, after the destination has painted.
    // A newer click in that frame owns its own feedback and must keep loading.
    const version = navigationVersion.current;
    const frame = window.requestAnimationFrame(() => {
      if (version === navigationVersion.current) settle();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [routeKey, clearTimers, settle]);

  // Cached routes land immediately, without a loading flash. A slower journey
  // gains a light after 100ms; nothing delays the navigation itself.
  useEffect(() => {
    const begin = (path: string) => {
      clearTimers();
      navigationVersion.current += 1;
      setSweep(sweepPersonality(path));
      changePhase("waiting");
      timers.current.show = window.setTimeout(() => changePhase("loading"), 100);
      // A canceled/interrupted navigation must not leave an endless animation.
      timers.current.fallback = window.setTimeout(settle, 10_000);
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.getAttribute("aria-disabled") === "true") return;
      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href || href.startsWith("#") || (target && target !== "_self") || anchor.hasAttribute("download")) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      begin(url.pathname);
    };
    const onPopState = () => {
      const nextRoute = `${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`;
      if (nextRoute !== committedRoute.current) begin(window.location.pathname);
    };
    const onVisibilityChange = () => {
      if (document.visibilityState !== "hidden") return;
      clearTimers();
      changePhase("idle");
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("popstate", onPopState);
      clearTimers();
    };
  }, [changePhase, clearTimers, settle]);

  if (phase === "idle" || phase === "waiting") return null;

  return (
    <div
      className="nav-sweep"
      data-phase={phase}
      aria-hidden="true"
      style={{ ["--sweep-a" as string]: sweep[0], ["--sweep-b" as string]: sweep[1] }}
    >
      <span className="nav-sweep-line" />
    </div>
  );
}
