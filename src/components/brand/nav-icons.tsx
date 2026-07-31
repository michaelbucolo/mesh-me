/**
 * THE TAB MARKS. DRAWN FOR 22px, WHICH IS THE ONLY SIZE THEY SHIP AT.
 *
 * ── HOW THE OLD SET FAILED ───────────────────────────────────────────────────
 *
 * They were designed large and never checked small. Rendered at the size a tab
 * actually draws them, three of the five stopped being what they meant:
 *
 *   Mesh    — six equal dots in a hexagonal ring, joined by hairlines at 0.55
 *             opacity. At 22px the lines vanish and the six dots are gear
 *             teeth. The namesake tab of the product was a SETTINGS COG, and
 *             it was the lit orange one on the mesh page.
 *   Flow    — a play triangle in a landscape rounded box: the generic video
 *             player glyph, indistinguishable from every media app on the
 *             phone, and saying nothing about a never-ending vertical feed.
 *   Explore — a compass whose needle is a 4px blob inside a ring. At 22px, a
 *             circle with a smudge in it.
 *   MeChat  — one bubble with two lines. Legible, but at 22px the lines close
 *             up and it is a rounded rectangle.
 *   Profile — a person. This one was always fine; it is only thickened.
 *
 * ── THE RULES THIS SET IS DRAWN TO ───────────────────────────────────────────
 *
 * 1. LEGIBLE AT 22px. Few elements, thick strokes, large negative space. No
 *    opacity tricks — a 0.55-opacity hairline is invisible at tab size, which
 *    is exactly how the mesh lost its edges and kept its teeth.
 * 2. DISTINCT SILHOUETTES. Closed hexagon · solid triangle on a rule · twin
 *    bubbles · ringed compass · person. You can tell them apart peripherally,
 *    by outline alone, which is how a tab bar is actually read.
 * 3. NO COLLISIONS. An early draft of the mesh mark — a centre node with three
 *    spokes — was rejected because it is lucide's Share2, which this app
 *    already uses in the top bar. Another read as an X, which means dismiss.
 * 4. NO HARDCODED COLOUR. Everything is currentColor, so each icon inverts
 *    correctly on a lit `.key-lit` tab and in both themes. A knock-out pivot
 *    dot for the compass was drawn and dropped for exactly this reason: it
 *    needed a literal background colour and broke on light and on orange.
 *
 * Checked as images at 20 / 22 / 26 / 56px, on dark and light, with each tab
 * lit in turn, before any of it was written here.
 */

import type { ComponentType, SVGProps } from "react";

export type BrandIcon = ComponentType<SVGProps<SVGSVGElement>>;

function base(props: SVGProps<SVGSVGElement>) {
  return {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    // 1.9, not 1.75: measured at 22px the thinner stroke greys out against a
    // moulded face, and these ride on --face, not on the page.
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

/**
 * A house: one roofline, one door.
 *
 * Drawn to the same rules as the rest of the set, not borrowed from lucide —
 * the stock house's thin ribs and narrow door close up at 22px. Two elements
 * only, and it is the one angled roof in the bar, so the silhouette reads
 * peripherally the way a home tab must.
 */
export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4.3 10.9 12 4.2l7.7 6.7M5.9 9.9v8.1a2.2 2.2 0 0 0 2.2 2.2h7.8a2.2 2.2 0 0 0 2.2-2.2V9.9" />
      <path d="M9.9 20.2v-4.4a2.1 2.1 0 0 1 4.2 0v4.4" />
    </svg>
  );
}

/**
 * A woven cell with your node at the centre.
 *
 * A closed hexagon has no teeth, which is the whole difference from the cog it
 * replaces — the old mark's six protruding dots WERE the teeth. It is also the
 * only closed polygon in the bar, so the silhouette is unmistakable, and the
 * filled centre dot is the opposite of a hex nut's hole.
 */
export function MeshIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.4 20.1 8v8L12 20.6 3.9 16V8L12 3.4Z" />
      <circle cx="12" cy="12" r="2.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Play, on a rule.
 *
 * The only solid-filled mark in the set, which is why it is the most legible
 * of the five at 22px — a filled triangle survives any size a stroke does not.
 * The rule beneath it is the track the Flow runs along; the box it replaces
 * said "video player", which is a thing you open, not a place you go.
 */
export function FlowIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path
        d="M7.6 4.9c0-.75.82-1.21 1.46-.82l9.2 5.6c.6.37.6 1.25 0 1.62l-9.2 5.6c-.64.4-1.46-.07-1.46-.82V4.9Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M6.2 20.4h11.6" strokeWidth="2.1" />
    </svg>
  );
}

/**
 * Two bubbles: a conversation, not a message.
 *
 * One bubble at 22px is a rounded rectangle. Two overlapping ones have an
 * outline nothing else in the bar shares, and they say the true thing about
 * MeChat — it is where two sides talk, across whichever platforms they are on.
 */
export function MeChatIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3.4 8.2A2.6 2.6 0 0 1 6 5.6h7.6a2.6 2.6 0 0 1 2.6 2.6v3.9a2.6 2.6 0 0 1-2.6 2.6H7.9L4.3 17.9a.55.55 0 0 1-.9-.43V8.2Z" />
      <path d="M18.4 9.1h.4a2.2 2.2 0 0 1 2.2 2.2v4.2a2.2 2.2 0 0 1-2.2 2.2h-.5l-2.6 2.3a.5.5 0 0 1-.83-.38v-1.92" />
    </svg>
  );
}

/** A person. The one mark that never needed replacing — only thickening. */
export function ProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="8" r="3.9" />
      <path d="M4.6 20.2c.9-4 3.8-6.1 7.4-6.1s6.5 2.1 7.4 6.1" />
    </svg>
  );
}

/**
 * A compass whose needle you can actually see.
 *
 * Same idea as before — the ring is wider and the needle is a filled point
 * spanning most of it, instead of the 4px blob that turned into a smudge at
 * tab size. No knock-out pivot: that needs a literal background colour, and
 * would break on a lit tab and in light mode.
 */
export function ExploreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M16.1 7.9 13.9 13.9 7.9 16.1 10.1 10.1 16.1 7.9Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
