type MotionSubscription = {
  intersecting: boolean;
  active: boolean | undefined;
  notify: (active: boolean) => void;
};

// One viewport observer and one pair of lifecycle listeners serve every Meshi.
// Static portraits never subscribe. Offscreen/hidden characters retain their
// identity, but stop their layout sampling, blinking and idle animations.
const subscriptions = new Map<Element, MotionSubscription>();
let observer: IntersectionObserver | null = null;
let reducedMotion: MediaQueryList | null = null;

function publish(entry: MotionSubscription) {
  const active = entry.intersecting && document.visibilityState === "visible" && !reducedMotion?.matches;
  if (entry.active === active) return;
  entry.active = active;
  entry.notify(active);
}

function refreshVisibility() {
  subscriptions.forEach(publish);
}

export function observeMeshiMotion(element: Element, notify: (active: boolean) => void): () => void {
  if (subscriptions.size === 0) {
    reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)") ?? null;
    reducedMotion?.addEventListener("change", refreshVisibility);
    document.addEventListener("visibilitychange", refreshVisibility);
    if (typeof IntersectionObserver !== "undefined") {
      const currentObserver = new IntersectionObserver((entries) => {
        if (observer !== currentObserver) return;
        for (const item of entries) {
          const entry = subscriptions.get(item.target);
          if (!entry) continue;
          entry.intersecting = item.isIntersecting;
          publish(entry);
        }
      });
      observer = currentObserver;
    }
  }

  const entry: MotionSubscription = { intersecting: !observer, active: undefined, notify };
  subscriptions.set(element, entry);
  observer?.observe(element);
  publish(entry);

  return () => {
    observer?.unobserve(element);
    subscriptions.delete(element);
    if (subscriptions.size !== 0) return;
    observer?.disconnect();
    observer = null;
    reducedMotion?.removeEventListener("change", refreshVisibility);
    reducedMotion = null;
    document.removeEventListener("visibilitychange", refreshVisibility);
  };
}
