// The EMOTE WHEEL — a small radial picker for the room's world actions
// (heart / wave / star / spark / wow), riding the existing versioned action
// bus. Two ways in, one wheel:
//
//   - long-press a PERSON node (their Meshi's home) — the wheel opens around
//     them and the heart flies AT them;
//   - the rail's React button — the wheel opens by the rail and sends the
//     targetless flourishes (a heart needs somewhere to fly, so it only
//     appears with a target; the server enforces the same rule).
//
// DOM overlay only (the canvas never draws chrome), mounted by the surface
// exclusively when `viewer.canBroadcastPresence` — Global never instantiates
// it — and registered as a layer with the chrome stacking manager, so Esc
// and layered dismissal treat it like every other overlay (one at a time).
//
// Gesture grammar matches the pluck ring exactly: keep holding and release
// on an emote to send it; release near the anchor to keep the wheel open for
// a tap; release anywhere else dismisses. Reduced motion: the wheel appears
// instantly (no pop-in, no stagger).

"use client";

import { Check } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { reactionGlyphSvg, type ReactionGlyph } from "../scene/reaction-glyphs";
import type { SceneNode } from "../scene/scene-model";

/** Distance from the anchor to each emote button's centre (px). */
const RING_RADIUS = 84;
/** Releasing within this distance of the anchor keeps the wheel open. */
const HOLD_ZONE = 56;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

const EMOTES: Array<{ verb: ReactionGlyph; label: string; targeted: boolean }> = [
  { verb: "heart", label: "Heart", targeted: true },
  { verb: "wave", label: "Wave", targeted: false },
  { verb: "star", label: "Star", targeted: false },
  { verb: "spark", label: "Spark", targeted: false },
  { verb: "wow", label: "Wow", targeted: false },
];

export function MeshEmoteWheel({
  target,
  anchor,
  heldPointer,
  onSend,
  onClose,
}: {
  /** The person the wheel opened on (hearts fly at them) — null from the rail. */
  target: SceneNode | null;
  /** Screen position the wheel fans around. */
  anchor: { x: number; y: number };
  /** True when opened by a long-press whose pointer is STILL down — the
   * release resolves on the wheel (release-on-emote), pluck-ring style. */
  heldPointer: boolean;
  /** Send the verb on the bus. False = the courtesy rate cap held it. */
  onSend: (verb: ReactionGlyph, target: SceneNode | null) => boolean;
  onClose: () => void;
}) {
  const [confirmation, setConfirmation] = useState<string | null>(null);

  // Confirm briefly at the centre, then let the wheel go.
  const confirmAndClose = useCallback((text: string) => setConfirmation(text), []);
  useEffect(() => {
    if (!confirmation) return;
    const timer = setTimeout(onClose, 650);
    return () => clearTimeout(timer);
  }, [confirmation, onClose]);

  const emotes = EMOTES.filter((e) => !e.targeted || target !== null);

  // Long-press flow only: the still-held finger's release lands here (the
  // canvas holds pointer capture, so the wheel never receives that pointerup
  // directly). Release over an emote clicks it; near the anchor → the wheel
  // stays for a follow-up tap; anywhere else → dismiss. The rail flow skips
  // this — its opening click has already ended, and native taps just work.
  useEffect(() => {
    if (!heldPointer) return;
    const onUp = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const emoteButton = el?.closest?.("[data-emote-verb]");
      if (emoteButton instanceof HTMLElement) {
        emoteButton.click();
        return;
      }
      if (Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y) <= HOLD_ZONE) return;
      onClose();
    };
    window.addEventListener("pointerup", onUp, { once: true });
    return () => window.removeEventListener("pointerup", onUp);
  }, [heldPointer, anchor.x, anchor.y, onClose]);

  // Keep the whole wheel on screen even near an edge.
  const cx = typeof window !== "undefined"
    ? Math.max(RING_RADIUS + 34, Math.min(window.innerWidth - RING_RADIUS - 34, anchor.x))
    : anchor.x;
  const cy = typeof window !== "undefined"
    ? Math.max(RING_RADIUS + 88, Math.min(window.innerHeight - RING_RADIUS - 34, anchor.y))
    : anchor.y;

  // Fan the emotes across the top arc, centred over the anchor.
  const spread = Math.min(Math.PI * 0.72, 0.58 * emotes.length);
  const start = -Math.PI / 2 - spread / 2;
  const step = emotes.length > 1 ? spread / (emotes.length - 1) : 0;
  const reducedMotion = prefersReducedMotion();

  return (
    <div className="absolute inset-0 z-50" data-testid="mesh-emote-wheel">
      {/* Backdrop: a tap anywhere off the wheel closes it. */}
      <button
        type="button"
        aria-label="Dismiss emotes"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-transparent"
      />
      {confirmation ? (
        <span
          className="mesh-glass pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
          style={{ left: cx, top: cy, animation: reducedMotion ? undefined : "bubbleIn .18s ease" }}
        >
          <Check size={13} className="text-emerald-300" />
          {confirmation}
        </span>
      ) : (
        emotes.map((emote, i) => {
          const angle = start + step * i;
          const x = cx + Math.cos(angle) * RING_RADIUS;
          const y = cy + Math.sin(angle) * RING_RADIUS;
          return (
            <span
              key={emote.verb}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: x,
                top: y,
                animation: reducedMotion
                  ? undefined
                  : `bubbleIn .22s cubic-bezier(0.22,1,0.36,1) ${i * 30}ms backwards`,
              }}
            >
              <button
                type="button"
                data-emote-verb={emote.verb}
                aria-label={
                  emote.verb === "heart" && target
                    ? `Send a heart to ${target.label}`
                    : `Send a ${emote.label.toLowerCase()}`
                }
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  const sent = onSend(emote.verb, emote.targeted ? target : null);
                  confirmAndClose(sent ? "Sent" : "One at a time…");
                }}
                className="mesh-glass mesh-ctl ds-focus-ring flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-full text-white/90 transition-transform hover:scale-110"
              >
                {/* The same hand-drawn glyphs every reaction uses — never emoji. */}
                <span
                  aria-hidden
                  className="flex h-5 w-5 items-center justify-center [&_svg]:h-full [&_svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: reactionGlyphSvg(emote.verb) }}
                />
                <span className="text-[8px] font-semibold uppercase tracking-wide text-white/60">
                  {emote.label}
                </span>
              </button>
            </span>
          );
        })
      )}
    </div>
  );
}
