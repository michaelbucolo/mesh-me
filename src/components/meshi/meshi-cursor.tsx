"use client";

/**
 * MESHI IS YOUR HAND ON THE PAGE.
 *
 * Meshi rides the pointer on every surface of the product, so the character is
 * attached to the one object you are already looking at 100% of the time
 * instead of living in a corner as a widget.
 *
 * TWO LAYERS, AND `cursor: none` APPEARS NOWHERE
 *
 * Layer 0 is a native `cursor: url()` PNG set in CSS — Meshi's contact shadow
 * plus a 1px aim dot at the hotspot. It is present in the first paint, before
 * any JavaScript runs, and it never goes away. Layer 1 is this component: one
 * real `MeshiMascot` in the DOM, following the pointer.
 *
 * The load-bearing invariant is that there is no code path, in any state, where
 * the user has no pointer. If this component fails to mount, fails to hydrate,
 * throws, or is suppressed, the floor is still there and the product is still
 * usable. That is why the floor draws a SHADOW rather than a second Meshi: a
 * shadow briefly alone reads as "Meshi stepped away", which is true, while two
 * Meshis that disagree read as a rendering fault.
 *
 * WHY THERE IS NO TRAILING OFFSET
 *
 * The sprite is written to the raw pointer position every frame — exactly one
 * frame behind the hardware pointer, which is 6–13px at normal mouse speeds and
 * exactly zero at rest. A pointer that is deliberately lagged is a pointer that
 * is not where you are pointing, and at rest the lag collapses to zero anyway,
 * putting the two layers on top of each other.
 *
 * Occlusion is solved by fixed geometry instead: the body sits entirely
 * up-and-right of the aim point, never over the thing under the hotspot. That
 * is the same reason the standard arrow works — tip at the aim point, mass away
 * from it.
 *
 * What IS allowed to lag is personality: lean, gaze and squash, all driven by
 * `meshi-machine`, which is pure and contract-tested and reused here verbatim.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { UserMeshi } from "@/components/meshi/user-meshi";
import { lookUnit, stepLean, stepLook } from "@/components/mesh/live/meshi-machine";
import {
  cursorSpriteOwnsPointer,
  cursorSpriteOwnsPointerOnServer,
  subscribeToPointerModality,
} from "@/lib/pointer-modality";
import { isPrecisePointer } from "@/lib/pen";

/** Sprite box size. The body occupies x ∈ [+4, +32], y ∈ [−34, −6] from the aim dot. */
const SIZE = 28;
const OFFSET_X = 4;
const OFFSET_Y = -6;

/**
 * Where the sprite must not appear. Text fields keep the native I-beam and get
 * no character on top of it; embedded content owns its own pointer and would
 * swallow our events anyway, so the sprite would freeze mid-air over it.
 */
const SUPPRESS_OVER = [
  "input",
  "textarea",
  "select",
  "[contenteditable]",
  "[data-native-cursor]",
  "iframe",
  "embed",
  "object",
  // The mesh canvas paints Meshi at the pointer itself. Two bodies for one
  // hand is the failure this whole design is built to avoid, so the DOM sprite
  // stands down and the canvas keeps the floor underneath it.
  "[data-meshi-canvas-pointer]",
].join(", ");

/** Anything modal. A character wandering over a scrim undercuts the scrim. */
const MODAL_OPEN = "[role='dialog'][aria-modal='true'], dialog[open]";

export function MeshiCursor() {
  // Fine pointers only, and never in forced colours — the same predicate the
  // floating companion reads to decide whether to hold its dock, so the two can
  // never both be chasing the pointer.
  //
  // Subscribed rather than read once: both conditions are live. Plugging in a
  // mouse on a tablet, or switching the OS into high contrast, flips the answer
  // mid-session and the sprite should appear or leave accordingly.
  const mounted = useSyncExternalStore(
    subscribeToPointerModality,
    cursorSpriteOwnsPointer,
    cursorSpriteOwnsPointerOnServer,
  );
  const hostRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mounted) return;
    const host = hostRef.current;
    const body = bodyRef.current;
    if (!host || !body) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Raw pointer position, written by the event and read by the frame. Kept in
    // refs rather than state: this changes at pointer rate and a re-render per
    // sample would be the most expensive thing on the page.
    let px = -1000;
    let py = -1000;
    let lastX = px;
    let lastY = py;
    let lastT = 0;
    let rot = 0;
    const look = { x: 0, y: 0 };
    let gazeTarget: { x: number; y: number } | null = null;

    let visible = false;
    let suppressed = true; // until the first real move
    let raf = 0;

    const setVisible = (next: boolean) => {
      if (next === visible) return;
      visible = next;
      host.style.opacity = next ? "1" : "0";
    };

    const onMove = (event: PointerEvent) => {
      // A mouse, a trackpad, or a PEN — anything that resolves a position
      // exactly. Touch must still not summon it. Admitting the pen also closes
      // an asymmetry that was already here: `onOver` below was never
      // type-gated, so a hovering pen updated gaze and suppression while px/py
      // stayed frozen at the last mouse position, and Meshi looked at what the
      // pen was over from wherever the mouse had been.
      if (!isPrecisePointer(event.pointerType)) return;
      px = event.clientX;
      py = event.clientY;
      if (suppressed) return;
      setVisible(true);
    };

    // `pointerover` fires when the element under the pointer CHANGES, not per
    // pixel — so suppression and gaze cost nothing on the hot path. Calling
    // elementFromPoint every frame is what this avoids.
    const onOver = (event: PointerEvent) => {
      const el = event.target instanceof Element ? event.target : null;
      if (!el) return;

      suppressed = Boolean(el.closest(SUPPRESS_OVER)) || Boolean(document.querySelector(MODAL_OPEN));
      if (suppressed) {
        setVisible(false);
        gazeTarget = null;
        return;
      }

      // Meshi looks at whatever is under your hand. The element's centre, not
      // the pointer — otherwise the eyes are always dead-centre on themselves.
      const rect = el.getBoundingClientRect();
      gazeTarget = rect.width > 0 && rect.height > 0
        ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
        : null;
    };

    // Dragging a text selection: the character has no business in the middle of
    // it, and the OS is already showing the right cursor.
    const onSelectStart = () => {
      suppressed = true;
      setVisible(false);
    };
    const onPointerUp = () => {
      suppressed = false;
    };

    // Leaving the document, and native popups (a <select> list, the context
    // menu, an OS drag) — all of which steal focus without a pointer event.
    const onLeave = () => setVisible(false);
    const onBlur = () => setVisible(false);

    const frame = (now: number) => {
      raf = window.requestAnimationFrame(frame);

      const dt = lastT ? Math.min(64, now - lastT) : 16;
      lastT = now;

      // Position is rigid: written to the raw pointer, never eased.
      // The host is a zero-size anchor and the body hangs bottom-left off it,
      // so this IS the bottom-left corner of the body — no dependence on the
      // mascot's intrinsic height, which is larger than `size`.
      const x = px + OFFSET_X;
      const y = py + OFFSET_Y;

      if (reduced) {
        // The character stays — it is the pointer — but nothing about it moves
        // beyond following your hand. No lean, no gaze, no squash.
        host.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        lastX = px;
        lastY = py;
        return;
      }

      const vx = (px - lastX) / dt;
      const vy = (py - lastY) / dt;
      lastX = px;
      lastY = py;

      // Lean banks into travel using horizontal velocity — the body banks, the
      // head never tilts.
      rot = stepLean(rot, vx, dt);

      const want = lookUnit(x + SIZE / 2, y + SIZE / 2, gazeTarget);
      if (stepLook(look, want.x, want.y, dt)) {
        body.style.setProperty("--meshi-look-x", look.x.toFixed(3));
        body.style.setProperty("--meshi-look-y", look.y.toFixed(3));
      }

      // Squash from speed, so a fast flick reads as momentum. Clamped low: this
      // is a pointer first and a character second.
      const speed = Math.hypot(vx, vy);
      const squash = Math.min(0.06, speed * 0.012);

      host.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      body.style.transform = `rotate(${rot.toFixed(2)}deg) scale(${(1 + squash).toFixed(3)}, ${(1 - squash * 0.8).toFixed(3)})`;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    document.addEventListener("selectstart", onSelectStart);
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onBlur);
    raf = window.requestAnimationFrame(frame);

    // The first move un-suppresses; until then the floor alone is the pointer,
    // which is correct — we do not know where the pointer is yet, and guessing
    // would park a character at (0,0).
    suppressed = false;

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("selectstart", onSelectStart);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onBlur);
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={hostRef}
      className="meshi-cursor"
      data-meshi-cursor=""
      aria-hidden="true"
      role="presentation"
    >
      <div ref={bodyRef} className="meshi-cursor-body">
        <UserMeshi size={SIZE} animate={false} />
      </div>
    </div>,
    document.body,
  );
}
