import { areVisualEffectsEnabled, subscribeInteractionPreferences } from "./interaction-preferences";

type CelebrationKind = "like" | "save" | "send" | "success";
type Burst = { kind: CelebrationKind; x: number; y: number };
const EVENT = "mesh:celebrate";
const MAX_PARTICLES = 27;

/** Call only after an action succeeds. This never plays sound or changes data. */
export function celebrate({ kind, anchor }: { kind: CelebrationKind; anchor?: HTMLElement | null }): void {
  if (typeof window === "undefined" || document.hidden || !areVisualEffectsEnabled()) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const target = anchor ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
  if (!target?.isConnected || target === document.body) return;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height || rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight || rect.left > innerWidth) return;
  window.dispatchEvent(new CustomEvent<Burst>(EVENT, { detail: {
    kind,
    x: Math.max(12, Math.min(innerWidth - 12, rect.left + rect.width / 2)),
    y: Math.max(12, Math.min(innerHeight - 12, rect.top + rect.height / 2)),
  } }));
}

/** One short-lived overlay, no canvas loop, and a hard cap even during rapid taps. */
export function installCelebrations(): () => void {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const contrast = window.matchMedia("(forced-colors: active)");
  const active = new Set<() => void>();
  let layer: HTMLDivElement | null = null;
  let lastBurst = -Infinity;
  const allowed = () => !document.hidden && !reduced.matches && !contrast.matches && areVisualEffectsEnabled();
  const clear = () => { for (const finish of [...active]) finish(); };
  const checkPreference = () => {
    const enabled = allowed();
    document.documentElement.dataset.meshEffects = enabled ? "on" : "off";
    if (!enabled) clear();
  };
  checkPreference();

  const onBurst = (event: Event) => {
    if (!allowed() || typeof Element.prototype.animate !== "function") return;
    const detail = (event as CustomEvent<Burst>).detail;
    if (!detail || !["like", "save", "send", "success"].includes(detail.kind) || !Number.isFinite(detail.x) || !Number.isFinite(detail.y)) return;
    const now = performance.now();
    if (now - lastBurst < 140 || active.size + 9 > MAX_PARTICLES) return;
    lastBurst = now;
    if (!layer) {
      layer = document.createElement("div");
      layer.className = "mesh-celebrations";
      layer.setAttribute("aria-hidden", "true");
      document.body.append(layer);
    }
    for (let index = 0; index < 9; index++) {
      const ring = index === 0;
      const particle = document.createElement("span");
      particle.className = ring ? "mesh-celebration-ring" : `mesh-celebration-dot${index % 3 === 0 ? " mesh-celebration-star" : ""}`;
      particle.dataset.kind = detail.kind;
      particle.style.left = `${detail.x}px`;
      particle.style.top = `${detail.y}px`;
      layer.append(particle);
      const angle = ((index - 1) / 8) * Math.PI * 2;
      const distance = 24 + (index % 3) * 9;
      const dx = detail.kind === "send" ? Math.cos(angle) * distance * .6 - 15 : Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance - (detail.kind === "send" ? 28 : 10);
      const duration = ring ? 420 : 500 + (index % 3) * 60;
      const frames = ring
        ? [{ transform: "translate(-50%, -50%) scale(.55)", opacity: .5 }, { transform: "translate(-50%, -50%) scale(1.8)", opacity: 0 }]
        : [
          { transform: "translate(-50%, -50%) scale(.3)", opacity: 0, offset: 0 },
          { transform: `translate(calc(-50% + ${dx * .35}px), calc(-50% + ${dy * .35}px)) scale(1)`, opacity: .9, offset: .22 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.2)`, opacity: 0, offset: 1 },
        ];
      const animation = particle.animate(frames, { duration, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" });
      const finish = () => {
        if (!active.delete(finish)) return;
        window.clearTimeout(timer);
        animation.cancel();
        particle.remove();
        if (!active.size) { layer?.remove(); layer = null; }
      };
      active.add(finish);
      // A fallback also handles browsers that suspend animation completion.
      const timer = window.setTimeout(finish, duration + 100);
      void animation.finished.then(finish, finish);
    }
  };
  window.addEventListener(EVENT, onBurst);
  document.addEventListener("visibilitychange", checkPreference);
  reduced.addEventListener("change", checkPreference);
  contrast.addEventListener("change", checkPreference);
  const unsubscribe = subscribeInteractionPreferences(checkPreference);
  return () => {
    window.removeEventListener(EVENT, onBurst);
    document.removeEventListener("visibilitychange", checkPreference);
    reduced.removeEventListener("change", checkPreference);
    contrast.removeEventListener("change", checkPreference);
    unsubscribe();
    clear();
    delete document.documentElement.dataset.meshEffects;
  };
}
