"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { EASE_OUT } from "@/lib/motion";

type RouteMotionProps = {
  pathname: string;
  direction?: "forward" | "back" | "dive" | "rise";
  children: ReactNode;
};

/** Keep the page subtree mounted; only the decorative arrival light is keyed. */
export function RouteMotion({ pathname, direction, children }: RouteMotionProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const slot = slotRef.current;
    if (reduceMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !slot?.animate || document.visibilityState === "hidden") return;

    // A transform on this ancestor would make fixed dialogs attach to the
    // page instead of the viewport. A small opacity reveal preserves their
    // position, keeps content readable, and never waits before accepting input.
    const arrival = slot.animate(
      [{ opacity: 0.78 }, { opacity: 1 }],
      { duration: 180, easing: `cubic-bezier(${EASE_OUT.join(",")})` },
    );
    return () => arrival.cancel();
  }, [pathname, reduceMotion]);

  return (
    <div ref={slotRef} className="mesh-route-slot relative" data-nav-dir={direction}>
      <span key={pathname} className="mesh-route-arrival" aria-hidden="true" />
      {children}
    </div>
  );
}
