// THE LIQUID GLASS TRANSLUCENCY LEVEL — A DEVICE SETTING, NOT AN ACCOUNT ONE.
//
// iOS 27 added Settings > Appearance > Liquid Glass after a year of complaints
// that iOS 26's translucency was hard to read. It runs from ultra clear to
// fully tinted and defaults to the middle.
//
// It lives in localStorage rather than on the account on purpose, and that
// matches Apple: the right amount of translucency depends on the SCREEN you are
// looking at — its brightness, its contrast, whether you are outdoors — not on
// who you are. Syncing it would push a phone-in-sunlight setting onto a desktop
// in a dark room. It is also why it needs no migration.
//
// The levels themselves are declared in tokens.css, where each one is a literal
// `--lg-alpha` that scripts/glass-check.ts proves against every backdrop that
// could ever sit behind the glass. This module only decides WHICH level is on;
// it cannot invent a new one, which is the point.

import { useSyncExternalStore } from "react";

const GLASS_LEVELS = [0, 1, 2, 3, 4] as const;
export type GlassLevel = (typeof GLASS_LEVELS)[number];

/** Step 2 is each ground's long-standing default, so an untouched app is unchanged. */
const DEFAULT_GLASS_LEVEL: GlassLevel = 2;

const STORAGE_KEY = "mesh-glass-level";

/** Plain-language names, clearest first — the direction the slider runs. */
export const GLASS_LEVEL_LABELS: Record<GlassLevel, string> = {
  0: "Solid",
  1: "Frosted",
  2: "Default",
  3: "Clearer",
  4: "Clearest",
};

function isLevel(value: unknown): value is GlassLevel {
  return typeof value === "number" && (GLASS_LEVELS as readonly number[]).includes(value);
}

function readGlassLevel(): GlassLevel {
  if (typeof window === "undefined") return DEFAULT_GLASS_LEVEL;
  try {
    const parsed = Number(window.localStorage.getItem(STORAGE_KEY));
    return isLevel(parsed) ? parsed : DEFAULT_GLASS_LEVEL;
  } catch {
    // Private-mode Safari throws on localStorage rather than returning null.
    return DEFAULT_GLASS_LEVEL;
  }
}

export function writeGlassLevel(level: GlassLevel): void {
  if (typeof document === "undefined") return;
  // The attribute is set BEFORE the write so the interface responds even if
  // storage is unavailable — a person in private browsing still gets to change
  // how their glass looks for the length of the session.
  document.documentElement.setAttribute("data-lg", String(level));
  try {
    window.localStorage.setItem(STORAGE_KEY, String(level));
  } catch {
    /* Nothing to do: the setting simply does not survive the tab. */
  }
  for (const listener of listeners) listener();
}

// ── READING IT FROM REACT ───────────────────────────────────────────────────
//
// This is an external store, not component state, so it is read through
// `useSyncExternalStore` rather than by setting state from an effect. The
// difference is not stylistic: the value only exists on the client, so the
// effect version renders the default, then corrects itself, and the slider
// visibly jumps to the person's real setting one frame after the page settles.
// A server snapshot says "the default" during SSR and hydration and the client
// snapshot takes over cleanly, with no correcting render.
//
// `storage` is subscribed to as well, so changing the level in one tab moves
// the slider in the others — the same behaviour a system setting has.

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useGlassLevel(): GlassLevel {
  return useSyncExternalStore(subscribe, readGlassLevel, () => DEFAULT_GLASS_LEVEL);
}
