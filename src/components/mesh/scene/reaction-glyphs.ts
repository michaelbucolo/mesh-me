// ── Original reaction glyphs ────────────────────────────────────────────────
//
// Every reaction a Meshi throws on the mesh is a hand-drawn SVG, never an OS
// emoji — so a like, a spark, or a cheer looks like *ours* on every device and
// carries the brand's soft, glossy style. Add new interactions by adding a
// glyph here and spawning it from the scene.

export type ReactionGlyph = "heart" | "star" | "spark" | "wow" | "wave";

const GLYPHS: Record<ReactionGlyph, string> = {
  // A soft rose heart with a glossy highlight.
  heart:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 21C12 21 3.2 15.4 3.2 8.9 3.2 5.9 5.5 3.6 8.4 3.6 10.2 3.6 11.5 4.5 12 5.7 12.5 4.5 13.8 3.6 15.6 3.6 18.5 3.6 20.8 5.9 20.8 8.9 20.8 15.4 12 21 12 21Z" fill="#fb7185"/><path d="M8.6 7C7.4 7.4 6.6 8.5 6.6 9.8" stroke="#fff" stroke-opacity="0.55" stroke-width="1.5" stroke-linecap="round"/></svg>',
  // A five-point gold star, for a celebration or a standout.
  star:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 2 14.35 8.76 21.51 8.91 15.8 13.24 17.88 20.09 12 16 6.12 20.09 8.2 13.24 2.49 8.91 9.65 8.76Z" fill="#fbbf24"/><path d="M12 2 14.35 8.76 12 16Z" fill="#ffffff" fill-opacity="0.28"/></svg>',
  // A four-point twinkle, for a little shine.
  spark:
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 0 13.9 10.1 24 12 13.9 13.9 12 24 10.1 13.9 0 12 10.1 10.1Z" fill="#a5b4fc"/></svg>',
  // A soft violet burst, for surprise/delight.
  wow:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 1 14 8 21 6.5 16.5 12 21 17.5 14 16 12 23 10 16 3 17.5 7.5 12 3 6.5 10 8Z" fill="#c084fc"/><circle cx="12" cy="12" r="2.4" fill="#ffffff" fill-opacity="0.35"/></svg>',
  // A cyan "hello" — a ripple radiating from a bright dot, the greeting a
  // Meshi sends when it arrives in a room.
  wave:
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="7" cy="17" r="2.6" fill="#38bdf8"/><path d="M11 15.5A6.5 6.5 0 0 0 8.5 8" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/><path d="M15 16A11 11 0 0 0 8 6" stroke="#7dd3fc" stroke-width="2" stroke-linecap="round" stroke-opacity="0.7"/></svg>',
};

export function reactionGlyphSvg(glyph: ReactionGlyph): string {
  return GLYPHS[glyph] ?? GLYPHS.heart;
}
