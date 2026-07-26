/**
 * A PEN IS NOT A FINGER, AND PRECISION IS A FACT ABOUT THE EVENT.
 *
 * mesh.me classified a stylus as touch and excluded it from every precision
 * path. On an iPad with an Apple Pencil, or a Galaxy with an S Pen, a 1mm-
 * accurate tip was given the 22px hit slop, the 12px drag threshold and the
 * screen-centre cursor position that exist for a fingertip — and hover, the
 * thing a pen is uniquely good at, never fired at all.
 *
 * Two separate mistakes produced that, and only fixing both changes anything:
 *
 *   1. Six handlers asked `pointerType === "mouse"`, so a pen fell through the
 *      else. Those are easy to find.
 *   2. `rt.coarse` — read at nineteen behavioural sites — is set ONCE from
 *      `matchMedia("(pointer: coarse)")`, a statement about the DEVICE'S PRIMARY
 *      pointer. On any tablet that is touch, so `coarse` stays true for the whole
 *      session including every single pen event. This is the one that matters:
 *      fixing the six type checks while leaving `coarse` alone would change
 *      almost nothing on the exact devices the feature is for.
 *
 * So precision is asked per EVENT here, never per device.
 *
 * WHAT THIS DELIBERATELY DOES NOT OFFER, because the platforms do not:
 *
 *   - An ERASER. No Apple Pencil — 1, 2, USB-C or Pro — has an eraser end or a
 *     barrel button exposed to the web, and no shipping Galaxy S Pen has an
 *     eraser tip. `buttons === 32` would be dead code on every device a user
 *     actually holds.
 *   - BARREL ROTATION. `twist` is in the IDL on both engines and is always 0;
 *     Apple Pencil Pro's roll is native-only. `tangentialPressure` likewise
 *     needs an airbrush wheel no consumer stylus has.
 *   - ALTITUDE/AZIMUTH as a baseline. Chromium has had them since 86, but WebKit
 *     only since Safari 18.2 — so they are read defensively and never required.
 *
 * `pressure` and `tiltX`/`tiltY` are the two rich signals that are genuinely
 * available on both engines, so those are what the product may build on.
 */

/** Pointer types that resolve a position precisely enough to trust exactly. */
export function isPrecisePointer(pointerType: string | undefined | null): boolean {
  return pointerType === "mouse" || pointerType === "pen";
}

/** A stylus specifically — for affordances only a pen should get. */
export function isPen(pointerType: string | undefined | null): boolean {
  return pointerType === "pen";
}

/**
 * Hover, as opposed to contact. Apple Pencil (M2 iPad and later) and the S Pen
 * both report a hovering tip as a pen pointer with no buttons held and, per
 * spec, zero pressure. Contact reports pressure > 0.
 */
export function isPenHover(event: Pick<PointerEvent, "pointerType" | "pressure" | "buttons">): boolean {
  return event.pointerType === "pen" && event.buttons === 0 && event.pressure === 0;
}

/** 0..1, defaulting to a firm-but-not-maximum press when unreported. */
export function penPressure(event: Pick<PointerEvent, "pointerType" | "pressure">): number {
  if (event.pointerType !== "pen") return 1;
  // Spec: 0 when the hardware cannot report it. 0.5 is the documented default
  // for a device with no pressure sensor, so an unreported press is not silent.
  const raw = event.pressure;
  if (!Number.isFinite(raw) || raw <= 0) return 0.5;
  return Math.min(1, raw);
}

/**
 * Tilt as a 0..1 lean, or null when the tip is upright or unreported.
 * tiltX/tiltY are degrees from vertical in each plane, -90..90 on both engines.
 */
export function penTilt(event: Pick<PointerEvent, "pointerType" | "tiltX" | "tiltY">): number | null {
  if (event.pointerType !== "pen") return null;
  const x = Number.isFinite(event.tiltX) ? event.tiltX : 0;
  const y = Number.isFinite(event.tiltY) ? event.tiltY : 0;
  if (x === 0 && y === 0) return null;
  const lean = Math.min(90, Math.hypot(x, y)) / 90;
  return lean;
}

/**
 * ONE GESTURE, ONE POINTER — and a pen outranks a palm.
 *
 * The OS rejects palms below the web layer and says so with `pointercancel`,
 * which the canvas already handles correctly. What the OS cannot do is arbitrate
 * the moment BEFORE it decides: a palm landing mid-stroke arrives as a second
 * pointer, the canvas sees `pointers.size === 2` and turns a Pencil line into a
 * pinch-zoom. A palm landing FIRST claims the gesture outright and the pen
 * becomes pointer two.
 *
 * This holds the single fact those decisions need — is a pen down, and which
 * pointerId — so the answer cannot differ between the four places that ask.
 * It classifies nothing: geometric palm detection from `width`/`height` is a
 * worse version of what the digitizer already did with data the web never sees.
 */
const penPointers = new Set<number>();

export function notePenDown(event: Pick<PointerEvent, "pointerType" | "pointerId">): void {
  if (event.pointerType === "pen") penPointers.add(event.pointerId);
}

export function notePenUp(event: Pick<PointerEvent, "pointerId">): void {
  penPointers.delete(event.pointerId);
}

/** Is a stylus currently in contact anywhere? */
export function penIsDown(): boolean {
  return penPointers.size > 0;
}

/**
 * Should this pointer be ignored for gesture purposes?
 *
 * True only for a NON-pen pointer arriving while a pen is down — the palm case.
 * Two fingers pinching with no pen present are unaffected, which is why this
 * asks about the pen rather than trying to recognise a palm.
 */
export function yieldsToPen(event: Pick<PointerEvent, "pointerType">): boolean {
  return penIsDown() && event.pointerType !== "pen";
}

/** Test seam: the module holds process-wide state, so tests must be able to reset it. */
export function resetPenArbiterForTest(): void {
  penPointers.clear();
}
