// HAIR THAT IS ACTUALLY ON THE HEAD.
//
// The old hair looked wrong for one measurable reason: there is no head to put
// it on. Meshi's "head" IS its body — a single `circle r="16"` centred on the
// origin with a 2-wide stroke, and the eyes sit at that circle's dead centre.
// So the entire scalp is the top sliver of a ball: 21.2 units wide at y=-12,
// 11.1 at y=-15, and nothing at y=-16. Every hair style was drawn as a flat
// 24-26 unit cap, as if resting on a wide dome-shaped cranium that does not
// exist. Measured against the real circle:
//
//   fluffy   99.6% of its area fell OUTSIDE the head, with a 2.6-unit
//            transparent gap over the crown and 7.2 units of protrusion
//   bangs    a 26-unit dome overhanging the skull by 6.3 units per side
//   spikes   a hairline that was a straight horizontal chord at y=-10.01
//            laid across a sphere — up to 6.0 units off the surface
//   curls    asymmetric by 0.9 units, four unequal balls straddling the rim
//
// Hand-tuning those paths would only move the error around. So hair is
// GENERATED from the skull instead: every style's inner boundary is literally
// the head's arc, which makes a gap or an overhang geometrically impossible
// rather than merely unlikely.
//
// ── AND WHY THE OLD HAT "TUCK" MADE IT WORSE ────────────────────────────────
//
// HAIR_TUCK_TRANSFORM was `translate(0, 2.4) scale(0.88)`. SVG scales about the
// origin, and the origin here is the point between the eyes — so it pulled hair
// 12% toward the FACE and then pushed it 2.4 further down, dropping every
// style's bottom edge by ~3.5 units onto the eyes. It was meant to tuck hair
// under a hat brim. It buried it in the face instead. Hair is clipped to the
// brim line now, which is what tucking actually is.

// ── THE SKULL ───────────────────────────────────────────────────────────────

/**
 * The body circle IS the head: r=16 with a 2-wide stroke, so the painted rim
 * spans 15..17. INNER sits just inside it, which is where hair meets scalp
 * with no seam; every outer silhouette must clear 17 or the hair hides behind
 * the body's own stroke.
 */
const INNER = 15;

/** A point on a circle of radius `r` at angle `t` measured from straight up. */
function pt(t: number, r: number): [number, number] {
  return [r * Math.sin(t), -r * Math.cos(t)];
}

const D = (n: number) => Math.round(n * 100) / 100;

/**
 * A closed shell between the skull arc and an outer silhouette.
 *
 * Sampled rather than drawn with SVG arc commands: the inner edge is then the
 * head's own curve by construction, at every sample, for any outer profile a
 * style cares to define.
 */
function shell(
  hairline: number,
  outer: (t: number) => number,
  steps = 30,
  innerR = INNER,
): string {
  const parts: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = -hairline + (i / steps) * (hairline * 2);
    const [x, y] = pt(t, innerR);
    parts.push(`${i === 0 ? "M" : "L"} ${D(x)} ${D(y)}`);
  }
  for (let i = steps; i >= 0; i -= 1) {
    const t = -hairline + (i / steps) * (hairline * 2);
    const [x, y] = pt(t, outer(t));
    parts.push(`L ${D(x)} ${D(y)}`);
  }
  parts.push("Z");
  return parts.join(" ");
}

const deg = (d: number) => (d * Math.PI) / 180;

// ── STYLES ──────────────────────────────────────────────────────────────────

type HairStyle = {
  label: string;
  /** Everything is drawn from the skull outward; `c` is the hair colour. */
  render: (c: string) => React.ReactNode;
};

/** A soft inner shadow where hair meets scalp, so it reads as sitting ON. */
function seam(hairline: number, c: string) {
  const [lx, ly] = pt(-hairline, INNER);
  const [rx, ry] = pt(hairline, INNER);
  return (
    <path
      d={`M ${D(lx)} ${D(ly)} A ${INNER} ${INNER} 0 0 1 ${D(rx)} ${D(ry)}`}
      fill="none"
      stroke="rgba(0,0,0,0.18)"
      strokeWidth="0.9"
      strokeLinecap="round"
      style={{ color: c }}
    />
  );
}

const HAIR_TABLE: Record<string, HairStyle | null> = {
  none: null,

  fluffy: {
    label: "Fluffy",
    render: (c) => {
      const h = deg(70);
      return (
        <g>
          <path d={shell(h, (t) => 18.3 + 2.3 * Math.abs(Math.sin(3 * t)))} fill={c} />
          {seam(h, c)}
        </g>
      );
    },
  },

  bangs: {
    label: "Bangs",
    render: (c) => {
      const h = deg(74);
      // A uniform shell over the crown...
      const cap = shell(h, () => 18.7);
      // ...plus a fringe that continues PAST the hairline beside the face, so
      // it brushes the brow instead of stopping short of it.
      const fringe: string[] = [];
      for (const side of [-1, 1] as const) {
        const a = deg(38) * side;
        const b = deg(74) * side;
        const [ax, ay] = pt(a, INNER);
        const [bx, by] = pt(b, INNER);
        fringe.push(
          `M ${D(ax)} ${D(ay)} Q ${D(ax * 1.16)} ${D(ay + 3.6)} ${D(bx * 1.02)} ${D(by + 3.2)} L ${D(bx)} ${D(by)} Z`,
        );
      }
      return (
        <g>
          <path d={cap} fill={c} />
          <path d={fringe.join(" ")} fill={c} />
          {seam(deg(38), c)}
        </g>
      );
    },
  },

  spikes: {
    label: "Spikes",
    render: (c) => {
      const h = deg(72);
      const n = 7;
      const tris: string[] = [];
      for (let i = 0; i < n; i += 1) {
        // Each spike's base sits ON the arc and its apex points along the
        // RADIUS at that angle, so they fan with the skull instead of all
        // pointing straight up off a flat chord.
        const t = -h + ((i + 0.5) / n) * (h * 2);
        const w = (h * 2) / n / 2.35;
        const [bx1, by1] = pt(t - w, INNER);
        const [bx2, by2] = pt(t + w, INNER);
        const [ax, ay] = pt(t, 21.6 - Math.abs(t) * 1.6);
        tris.push(`M ${D(bx1)} ${D(by1)} L ${D(ax)} ${D(ay)} L ${D(bx2)} ${D(by2)} Z`);
      }
      return (
        <g>
          <path d={shell(h, () => 18.3)} fill={c} />
          <path d={tris.join(" ")} fill={c} />
          {seam(h, c)}
        </g>
      );
    },
  },

  curls: {
    label: "Curls",
    render: (c) => {
      // A wreath of equal, tangent balls on one circle — symmetric by
      // construction, where the old four were unequal and 0.9 units off-centre.
      const rc = 3.2;
      const ring = 16.4;
      const step = 2 * Math.asin(rc / ring);
      const n = 7;
      const span = ((n - 1) / 2) * step;
      const balls = [];
      for (let i = 0; i < n; i += 1) {
        const t = -span + i * step;
        const [x, y] = pt(t, ring);
        balls.push(<circle key={i} cx={D(x)} cy={D(y)} r={rc} fill={c} />);
      }
      return (
        <g>
          <path d={shell(deg(66), () => 18.1)} fill={c} />
          {balls}
        </g>
      );
    },
  },

  swoop: {
    label: "Swoop",
    render: (c) => {
      const h = deg(72);
      // Asymmetric on purpose: thicker on one side, sweeping across the brow.
      const outer = (t: number) => 18.3 + 2.6 * Math.max(0, Math.sin(t + deg(30)));
      const [ax, ay] = pt(-deg(52), INNER);
      const [bx, by] = pt(deg(20), INNER);
      return (
        <g>
          <path d={shell(h, outer)} fill={c} />
          <path
            d={`M ${D(ax)} ${D(ay)} Q ${D(ax * 0.5)} ${D(ay + 5.4)} ${D(bx)} ${D(by + 1.6)} L ${D(bx)} ${D(by)} Q ${D(ax * 0.6)} ${D(ay + 1.2)} ${D(ax)} ${D(ay)} Z`}
            fill={c}
          />
          {seam(h, c)}
        </g>
      );
    },
  },

  bob: {
    label: "Bob",
    render: (c) => {
      const h = deg(88);
      // Falls PAST the hairline on both sides, hugging the head's silhouette.
      const sides: string[] = [];
      for (const side of [-1, 1] as const) {
        const a = deg(58) * side;
        const [ax, ay] = pt(a, INNER);
        const [bx, by] = pt(deg(88) * side, INNER);
        sides.push(
          `M ${D(ax)} ${D(ay)} L ${D(bx * 1.08)} ${D(by)} Q ${D(bx * 1.1)} ${D(by + 6)} ${D(bx * 0.82)} ${D(by + 7.4)} L ${D(ax * 0.8)} ${D(ay + 5)} Z`,
        );
      }
      return (
        <g>
          <path d={shell(h, () => 18.9)} fill={c} />
          <path d={sides.join(" ")} fill={c} />
          {seam(deg(58), c)}
        </g>
      );
    },
  },

  buzz: {
    label: "Buzz",
    render: (c) => (
      <g>
        {/* Barely more than the scalp: a close shell with a soft edge. */}
        <path d={shell(deg(76), () => 18.2)} fill={c} opacity="0.95" />
      </g>
    ),
  },

  wavy: {
    label: "Wavy",
    render: (c) => {
      const h = deg(76);
      return (
        <g>
          <path d={shell(h, (t) => 18.5 + 1.5 * Math.sin(5 * t + 0.6))} fill={c} />
          {seam(h, c)}
        </g>
      );
    },
  },

  parted: {
    label: "Parted",
    render: (c) => {
      const h = deg(72);
      // A PART IS A GROOVE, NOT A HOLE.
      //
      // This was two separate shells with a 5° gap between them, both running
      // from INNER outward — so the gap went all the way down to r=15 and
      // exposed the head's own 15..17 painted rim through it. It read as a
      // bright notch of body colour punched out of the hair, not as a part.
      // One shell whose outer edge dips in the middle keeps the scalp covered
      // (the trough bottoms out at 17.6, past the rim) while still reading as
      // hair falling away to either side.
      const gap = deg(7);
      const outer = (t: number) => {
        const a = Math.abs(t);
        return a >= gap ? 19 : 17.6 + (19 - 17.6) * (a / gap) ** 0.7;
      };
      const [tx, ty] = pt(0, 17.9);
      const [bx, by] = pt(0, INNER + 0.6);
      return (
        <g>
          <path d={shell(h, outer, 60)} fill={c} />
          {/* The parting line itself, so the trough reads at small sizes. */}
          <path d={`M ${D(bx)} ${D(by)} L ${D(tx)} ${D(ty)}`} stroke="rgba(0,0,0,0.22)" strokeWidth="0.7" strokeLinecap="round" />
          {seam(h, c)}
        </g>
      );
    },
  },

  topknot: {
    label: "Topknot",
    render: (c) => {
      const h = deg(70);
      return (
        <g>
          <path d={shell(h, () => 18.4)} fill={c} />
          <circle cx="0" cy={D(-(INNER + 6.4))} r="3.9" fill={c} />
          <path d={`M -2.4 ${D(-(INNER + 0.4))} Q 0 ${D(-(INNER + 2.2))} 2.4 ${D(-(INNER + 0.4))}`} fill="none" stroke={c} strokeWidth="1.6" strokeLinecap="round" />
          {seam(h, c)}
        </g>
      );
    },
  },

  afro: {
    label: "Afro",
    render: (c) => {
      const h = deg(84);
      return (
        <g>
          <path d={shell(h, (t) => 20.4 - 1.2 * Math.abs(Math.sin(t)) + 0.7 * Math.sin(7 * t))} fill={c} />
          {seam(h, c)}
        </g>
      );
    },
  },

  ponytail: {
    label: "Ponytail",
    render: (c) => {
      const h = deg(74);
      const [bx, by] = pt(deg(74), INNER);
      return (
        <g>
          <path d={shell(h, () => 18.6)} fill={c} />
          {/* Trails behind the head, outside the face entirely. */}
          <path
            d={`M ${D(bx)} ${D(by)} Q ${D(bx + 5.4)} ${D(by + 1.2)} ${D(bx + 5.8)} ${D(by + 7)} Q ${D(bx + 5.2)} ${D(by + 11)} ${D(bx + 2.6)} ${D(by + 11.6)} Q ${D(bx + 4)} ${D(by + 7)} ${D(bx + 1.2)} ${D(by + 2)} Z`}
            fill={c}
          />
          <circle cx={D(bx + 1.4)} cy={D(by + 1.2)} r="1.7" fill={c} />
          {seam(h, c)}
        </g>
      );
    },
  },
};

export type MeshiHair = keyof typeof HAIR_TABLE;
export const MESHI_HAIR_IDS = Object.keys(HAIR_TABLE) as MeshiHair[];
export const MESHI_HAIR_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(HAIR_TABLE).map(([id, s]) => [id, s?.label ?? "None"]),
);

export function resolveHair(value: string | null | undefined): MeshiHair {
  return value && value in HAIR_TABLE ? (value as MeshiHair) : "none";
}

/**
 * Hair colors — the axis meshi-slots.ts reserved ("giving hair its own colour
 * independent of the body ... needs a stored field, so it is a separate
 * change"). "inherit" is the free default and IS today's behaviour: the tone
 * derives from the body color in meshi-mascot.tsx, so a row that never chose
 * a color renders byte-identically to before the column existed.
 *
 * The hexes are final hair tones, not body primaries: hair sits mostly
 * OUTSIDE the r=16 body against the page, and every style's dark seam and
 * parting overlays (rgba black) give even the light tones definition.
 */
export const HAIR_COLOR_TABLE: Record<string, { hex: string | null; label: string }> = {
  inherit: { hex: null, label: "Match body" },
  noir: { hex: "#1f2937", label: "Noir" },
  chestnut: { hex: "#92400e", label: "Chestnut" },
  blond: { hex: "#fbbf24", label: "Blond" },
  copper: { hex: "#ea580c", label: "Copper" },
  silver: { hex: "#e5e7eb", label: "Silver" },
  snow: { hex: "#f8fafc", label: "Snow" },
  rose: { hex: "#f472b6", label: "Rose" },
  lavender: { hex: "#a78bfa", label: "Lavender" },
  mint: { hex: "#34d399", label: "Mint" },
  azure: { hex: "#60a5fa", label: "Azure" },
};

export type MeshiHairColor = keyof typeof HAIR_COLOR_TABLE;
export const MESHI_HAIR_COLOR_IDS = Object.keys(HAIR_COLOR_TABLE) as MeshiHairColor[];
export const MESHI_HAIR_COLOR_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(HAIR_COLOR_TABLE).map(([id, c]) => [id, c.label]),
);

/** Unknown or absent values degrade to "inherit" — the byte-identical past. */
export function resolveHairColor(value: string | null | undefined): MeshiHairColor {
  return value && value in HAIR_COLOR_TABLE ? (value as MeshiHairColor) : "inherit";
}

/**
 * Where a hat's brim sits, so hair can be CLIPPED to it rather than scaled
 * into the face. A style not listed here does not cover the hair at all.
 */
export const HAT_BRIM_Y: Record<string, number> = {
  // NOT astronaut: its helmet is translucent, so hair is meant to be visible
  // THROUGH it. Clipping under a brim that isn't opaque would delete hair the
  // wearer can see. A hat missing from this map simply does not cover hair.
  cap: -11,
  crown: -10.4,
  tophat: -8.6,
  beanie: -8,
  hardhat: -7.2,
  party: -7.4,
  cowboy: -8.8,
  graduation: -9.6,
  wizard: -8.8,
  pirate: -8.8,
  chef: -8.4,
  beret: -10.2,
  headphones: -9.4,
};

export function renderMeshiHair(hair: MeshiHair, color: string): React.ReactNode {
  return HAIR_TABLE[hair]?.render(color) ?? null;
}
