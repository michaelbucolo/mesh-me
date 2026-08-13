// THE HOUSE MOTION VOCABULARY — import, never re-tune.
//
// Slice 1 of the motion program consolidated the CSS side (globals.css
// carries --mesh-ease-out / --mesh-ease-press / --mesh-spring). This module
// is the TypeScript side of the same law: framer-motion transitions pick
// from FOUR house springs and TWO house eases instead of forty hand-rolled
// tunings that drifted a few points apart for no reason anyone remembers.
//
// What deliberately does NOT consolidate onto these:
//   - Meshi's body physics (meshi-mascot.tsx) — character animation, not
//     UI chrome; its springs are anatomy, not decoration.
//   - The two underdamped indicators (mobile-nav pill, MeChat reply swing)
//     and the livelier chip/row entrances — held as owner taste calls.
//
// The eases mirror the CSS tokens exactly; if one changes, change both.

// The press curve (--mesh-ease-press) and the springy overshoot
// (--mesh-spring, --mesh-spring-lush) live only as CSS tokens today —
// presses and celebration accents are all styled, not framer-driven. Add
// their TS twins here the day a framer consumer exists, not before.

/** The workhorse decisive glide — CSS twin: --mesh-ease-out. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Sheets, panels, overlays, page-section entrances. */
export const SPRING_PANEL = { type: "spring" as const, stiffness: 360, damping: 30, mass: 0.8 };

/** Large, calm hero entrances — the sign-in screen's pace. */
export const SPRING_HERO = { type: "spring" as const, stiffness: 220, damping: 26, mass: 0.7 };

/** Small controls that must feel instant: toggles, steps, dismissals. */
export const SPRING_SNAP = { type: "spring" as const, stiffness: 500, damping: 30 };

/** Overdamped pop-in for focused surfaces (command palette). */
export const SPRING_POP = { type: "spring" as const, stiffness: 460, damping: 38, mass: 0.7 };
