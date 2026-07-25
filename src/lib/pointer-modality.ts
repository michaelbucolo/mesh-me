/**
 * Which Meshi owns the pointer.
 *
 * There are two Meshis in the product and they must never both be chasing your
 * hand: the cursor sprite (`meshi-cursor.tsx`), which IS the pointer on a mouse
 * or trackpad, and the floating companion (`meshi-float.tsx`), which docks and
 * hosts the chat and actions panels.
 *
 * Before this predicate existed they each decided independently — the cursor on
 * `(pointer: fine)`, the companion on `event.pointerType === "mouse"` — and on
 * every desktop that is two characters converging on the same coordinates. One
 * function, read by both, is the only way that stays true after the next edit.
 *
 * When this returns true the sprite is the pointer and the companion holds its
 * dock. When it returns false there is no sprite, and the companion behaves as
 * it always has.
 */
const QUERIES = ["(pointer: fine)", "(forced-colors: active)"] as const;

/**
 * Subscribe to changes in either condition, for `useSyncExternalStore`.
 * Both are live: plugging in a mouse, or switching the OS into high contrast,
 * flips the answer mid-session and the sprite should appear or leave.
 */
export function subscribeToPointerModality(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const lists = QUERIES.map((q) => window.matchMedia(q));
  for (const list of lists) list.addEventListener("change", onChange);
  return () => {
    for (const list of lists) list.removeEventListener("change", onChange);
  };
}

/** Server snapshot: there is no pointer during SSR, so the sprite never renders there. */
export function cursorSpriteOwnsPointerOnServer(): boolean {
  return false;
}

export function cursorSpriteOwnsPointer(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  // Same two conditions meshi-cursor.tsx mounts on. Forced colours opts out
  // because a decorative character is exactly what that mode is asking to
  // remove; there the companion keeps its old behaviour rather than the
  // product losing Meshi entirely.
  return (
    window.matchMedia("(pointer: fine)").matches
    && !window.matchMedia("(forced-colors: active)").matches
  );
}
