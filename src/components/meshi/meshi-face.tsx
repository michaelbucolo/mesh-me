// A MESHI'S FACE IS AN IDENTITY. ITS MOOD IS SOMETHING THAT HAPPENS TO IT.
//
// Those were the same thing here, and that is why "customizing" a face never
// felt like customizing anything. The Settings group was called "Expression",
// it wrote `faceStyle`, and every call site did `mood={faceStyle as MeshiMood}`
// — so a person's chosen face was really their STARTING MOOD, overwritten the
// instant Meshi reacted to anything. The mascot never read faceStyle at all: it
// drew SVG_FACES[renderedMood], one shared table, so every Meshi in the product
// had literally the same eyes.
//
// So the model is inverted here. A FACE is a shape language — how this
// particular Meshi's eyes are built. A MOOD is a transform applied to that
// language. Meshi still blinks, winks, goes sleepy and falls in love, and
// through all of it the face stays recognisably yours.
//
// ── WHY THIS IS PARAMETRIC AND NOT 192 DRAWINGS ─────────────────────────────
//
// There are 16 moods. Twelve faces drawn against all of them by hand is 192
// SVG variants to author and to keep consistent, and the first one that drifted
// would be invisible until someone happened to be sad in that face. Instead a
// face declares geometry, a mood declares a deformation of it, and the eyes are
// GENERATED. Adding a face costs one row. Adding a mood costs one row. Every
// combination exists by construction, so none of them can be forgotten.
//
// ── AND WHY THE LASHES LIVE IN HERE ─────────────────────────────────────────
//
// Lashes used to be six fixed line segments at hardcoded coordinates, rendered
// as a SIBLING of the eye group — outside both the gaze transform and the
// mouse-follow transform. So the eyes looked around and the lashes stayed
// behind, exactly as reported: "lines on the face that don't move with the
// eyes". They are not decoration on a face. They are part of an eye.
//
// Here they are computed from the same geometry the eye is drawn from, in the
// same group, so they cannot come apart: they sit on the lid, they narrow as
// the lid closes, and on a blink they sweep down with it because the lid
// position IS their position.

import type { MeshiMood } from "./meshi-mascot";

// ── FACES ───────────────────────────────────────────────────────────────────

/**
 * One eye's resting construction, in the mascot's SVG units (the head is a
 * ~28-unit radius circle centred on the origin, so eyes live around ±5 x, 0 y).
 */
type FaceGeometry = {
  /** Half-width and half-height of one eye at rest. */
  rx: number;
  ry: number;
  /** Distance from the centre line to each eye's centre. */
  spacing: number;
  /** Vertical placement of the eye centres. */
  cy: number;
  /** How the eye body is drawn. */
  shape: "ellipse" | "rounded" | "ring" | "bar";
  /** Outer-corner tilt in degrees; positive lifts the outer corner. */
  tilt?: number;
  /** A specular dot — reads as glossy/awake rather than flat. */
  highlight?: boolean;
  /** Stroke weight for ring eyes. */
  ringWidth?: number;
};

/**
 * The twelve faces. Each is chosen to hold its silhouette at 20px — the size a
 * Meshi renders at on the mesh — as well as at 200px in the customizer, which
 * rules out anything that depends on fine interior detail to be recognisable.
 */
const FACE_TABLE = {
  bean:       { rx: 2.4, ry: 3.7, spacing: 5,   cy: 0,    shape: "ellipse", highlight: true },
  dot:        { rx: 1.8, ry: 1.8, spacing: 4.6, cy: 0.2,  shape: "ellipse" },
  wide:       { rx: 3.2, ry: 3.9, spacing: 5.6, cy: 0,    shape: "ellipse", highlight: true },
  almond:     { rx: 3.1, ry: 2.5, spacing: 5.2, cy: 0,    shape: "ellipse", tilt: 8, highlight: true },
  upturned:   { rx: 2.9, ry: 2.9, spacing: 5.2, cy: -0.2, shape: "ellipse", tilt: 18 },
  downturned: { rx: 2.9, ry: 2.9, spacing: 5.2, cy: 0.2,  shape: "ellipse", tilt: -16 },
  square:     { rx: 2.5, ry: 2.9, spacing: 5.2, cy: 0,    shape: "rounded" },
  tall:       { rx: 1.9, ry: 4.3, spacing: 4.8, cy: 0,    shape: "rounded", highlight: true },
  ring:       { rx: 3.0, ry: 3.0, spacing: 5.4, cy: 0,    shape: "ring", ringWidth: 1.5 },
  halo:       { rx: 3.4, ry: 3.4, spacing: 5.8, cy: 0,    shape: "ring", ringWidth: 0.9, highlight: true },
  visor:      { rx: 4.2, ry: 2.2, spacing: 4.6, cy: 0,    shape: "bar" },
  sleepylid:  { rx: 3.2, ry: 3.4, spacing: 5.2, cy: 0.3,  shape: "ellipse", highlight: true },
} satisfies Record<string, FaceGeometry>;

export type MeshiFace = keyof typeof FACE_TABLE;
/**
 * Widened to FaceGeometry on purpose: `satisfies` alone keeps each entry's
 * literal type, which would make `geom.tilt` a type error on any face that
 * happens not to declare it. The keys stay exact; only the values widen.
 */
const MESHI_FACES: Record<MeshiFace, FaceGeometry> = FACE_TABLE;
export const MESHI_FACE_IDS = Object.keys(FACE_TABLE) as MeshiFace[];

/** Faces are identity, so an unknown value must never render blank. */
const DEFAULT_FACE: MeshiFace = "bean";
export function resolveFace(value: string | null | undefined): MeshiFace {
  return value && value in FACE_TABLE ? (value as MeshiFace) : DEFAULT_FACE;
}

// ── MOODS AS DEFORMATIONS ───────────────────────────────────────────────────

type MoodShape = {
  /** 0 = wide open, 1 = shut. Scales the eye's height. */
  lid?: number;
  /**
   * Curvature of a closed/nearly-closed eye. Positive arcs upward (a smiling
   * eye), negative arcs downward (a tired one).
   */
  curve?: number;
  /** Overall size multiplier. */
  scale?: number;
  /** Vertical shift of both eyes. */
  dy?: number;
  /** Horizontal shift — a glance. */
  dx?: number;
  /** Close only one eye. */
  wink?: "left" | "right";
  /** Replace the eye body entirely; identity survives in size and spacing. */
  glyph?: "heart" | "star" | "spiral";
  /** Extra sparkle marks beside the eyes. */
  sparkle?: boolean;
};

/**
 * Every mood in MeshiMood gets an entry. A face renders all of them because
 * they are transforms, not drawings — which is what makes "each face has its
 * own emotes" true rather than aspirational.
 */
const MOODS: Record<MeshiMood, MoodShape> = {
  happy:       {},
  excited:     { scale: 1.16, dy: -0.3 },
  thinking:    { lid: 0.28, dy: -0.6, dx: 0.9, curve: -0.2 },
  sleepy:      { lid: 0.86, curve: -1, dy: 0.5 },
  surprised:   { scale: 1.34 },
  love:        { glyph: "heart", scale: 1.05 },
  cool:        { lid: 0.42, curve: 0.35 },
  wink:        { wink: "left", curve: 0.7 },
  petted:      { lid: 0.72, curve: 0.9, dy: 0.2 },
  giggle:      { lid: 0.66, curve: 1, dy: 0.1 },
  shy:         { lid: 0.5, curve: 0.5, dy: 0.4, scale: 0.94 },
  synergy1017: { glyph: "spiral", scale: 1.08 },
  searching:   { lid: 0.2, dx: 1.4, scale: 1.04 },
  learning:    { lid: 0.15, dy: -0.5, sparkle: true },
  celebrating: { glyph: "star", scale: 1.12, sparkle: true },
  blinking:    { lid: 1, curve: 0.25 },
};

function moodShape(mood: MeshiMood | string): MoodShape {
  return MOODS[mood as MeshiMood] ?? MOODS.happy;
}

// ── LASHES ──────────────────────────────────────────────────────────────────

type LashSpec = { count: number; length: number; spread: number; width: number; lower: boolean };

const LASH_TABLE = {
  none: null,
  // Hairs, not wings. The first pass used ~1.1-unit strokes on an eye barely
  // 3 units tall, which rendered as feathered blobs; a lash reads as a lash
  // only when it is much finer than the eye it sits on and stays close to it.
  natural: { count: 3, length: 1.15, spread: 0.66, width: 0.5, lower: false },
  dramatic: { count: 4, length: 1.85, spread: 0.86, width: 0.52, lower: false },
  lower: { count: 3, length: 1.0, spread: 0.62, width: 0.44, lower: true },
} satisfies Record<string, LashSpec | null>;

export type MeshiLash = keyof typeof LASH_TABLE;
export const MESHI_LASH_IDS = Object.keys(LASH_TABLE) as MeshiLash[];
export function resolveLash(value: string | null | undefined): MeshiLash {
  // "regular" is the legacy eyeStyle value for "no lashes"; keep it working so
  // existing rows do not suddenly grow lashes or lose their face.
  if (value === "regular" || !value) return "none";
  return value in LASH_TABLE ? (value as MeshiLash) : "none";
}

// ── RENDERING ───────────────────────────────────────────────────────────────

/** Round to keep the emitted path text short and byte-stable across renders. */
const r = (n: number) => Math.round(n * 100) / 100;

function eyeBody(
  geom: FaceGeometry,
  rx: number,
  ry: number,
  openness: number,
  curve: number,
  color: string,
  key: string,
) {
  // Nearly shut: a stroked arc reads as a closed eye where a squashed solid
  // reads as a bug. The arc's bow follows the mood's curve, so a happy squint
  // smiles and a sleepy one droops.
  if (openness < 0.16) {
    const bow = r(curve * ry * 0.9);
    return (
      <path
        key={key}
        d={`M ${r(-rx)} 0 Q 0 ${r(-bow)} ${r(rx)} 0`}
        fill="none"
        stroke={color}
        strokeWidth={r(Math.max(1.3, ry * 0.55))}
        strokeLinecap="round"
      />
    );
  }

  switch (geom.shape) {
    case "rounded":
      return (
        <rect
          key={key}
          x={r(-rx)}
          y={r(-ry)}
          width={r(rx * 2)}
          height={r(ry * 2)}
          rx={r(Math.min(rx, ry) * 0.45)}
          fill={color}
        />
      );
    case "ring":
      return (
        <circle
          key={key}
          cx={0}
          cy={0}
          r={r(Math.max(rx, 0.6))}
          fill="none"
          stroke={color}
          strokeWidth={r(geom.ringWidth ?? 1.4)}
        />
      );
    case "bar":
      return (
        <rect
          key={key}
          x={r(-rx)}
          y={r(-ry)}
          width={r(rx * 2)}
          height={r(ry * 2)}
          rx={r(ry)}
          fill={color}
        />
      );
    default:
      return <ellipse key={key} cx={0} cy={0} rx={r(rx)} ry={r(ry)} fill={color} />;
  }
}

function glyphBody(kind: NonNullable<MoodShape["glyph"]>, size: number, color: string, key: string) {
  const s = size / 3.7; // normalise against the default eye height
  switch (kind) {
    case "heart":
      return (
        <path
          key={key}
          transform={`scale(${r(s)})`}
          d="M 0 2.4 C -3.2 -0.4 -2.6 -3.6 -0.7 -2.4 C 0 -1.9 0 -1.5 0 -1.5 C 0 -1.5 0 -1.9 0.7 -2.4 C 2.6 -3.6 3.2 -0.4 0 2.4 Z"
          fill={color}
        />
      );
    case "star":
      return (
        <path
          key={key}
          transform={`scale(${r(s)})`}
          d="M 0 -3.4 L 1 -1.1 L 3.4 -0.8 L 1.6 0.8 L 2.1 3.2 L 0 2 L -2.1 3.2 L -1.6 0.8 L -3.4 -0.8 L -1 -1.1 Z"
          fill={color}
        />
      );
    case "spiral":
      return (
        <path
          key={key}
          transform={`scale(${r(s)})`}
          d="M 0 -2.8 A 2.8 2.8 0 1 1 -2 2 A 2 2 0 1 1 1.4 0.6 A 1.2 1.2 0 1 1 -0.5 -0.4"
          fill="none"
          stroke={color}
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      );
  }
}

/**
 * Lashes for ONE eye, derived from that eye's live geometry.
 *
 * `ry` here is the eye's CURRENT half-height, already reduced by the mood's
 * lid, so the lash roots ride down as the eye closes and land on the lid line
 * at a blink. Nothing about their position is hardcoded — that is the whole
 * point, and the reason the old version drifted off the face.
 */
function lashes(
  lash: Exclude<MeshiLash, "none">,
  rx: number,
  ry: number,
  side: -1 | 1,
  color: string,
) {
  const spec = LASH_TABLE[lash];
  if (!spec) return null;

  // ROOTED ON THE LID'S ARC, POINTING ALONG ITS NORMAL.
  //
  // The first attempt spaced the roots evenly across the eye's WIDTH and threw
  // every hair upward, which bunched them into a tuft at the outer corner of a
  // tall open eye. Real lashes leave the lid perpendicular to it, so each root
  // is placed at an angle on the ellipse and each hair follows the outward
  // normal at that exact point. That derivation works for any eye this engine
  // can draw — round, tall, almond or squashed to a slit — and it keeps working
  // as `ry` shrinks under a closing lid, which is what makes them ride it down.
  const marks = [];
  // STAY IN THE UPPER-OUTER QUADRANT, AND ALWAYS ANGLE AWAY FROM THE FACE.
  //
  // A pure surface normal is right in principle and wrong in practice: past
  // about 70 degrees it points sideways, and on a squinting eye (small ry) it
  // points sideways almost immediately — which drew hairs radiating flat out of
  // the eye like whiskers. So the sweep stops short of the horizontal, and the
  // normal is blended with a fixed up-and-out vector, which is the direction a
  // lash actually leaves the lid.
  const MAX = 0.72;                        // never reach the eye's equator
  const from = 0.34;
  const to = Math.min(MAX, from + spec.spread * 0.55);
  const flip = spec.lower ? 1 : -1;
  for (let i = 0; i < spec.count; i += 1) {
    const f = spec.count === 1 ? (from + to) / 2 : from + (i / (spec.count - 1)) * (to - from);
    const theta = f * (Math.PI / 2);       // 0 = top of the eye, PI/2 = outer edge

    const px = side * rx * Math.sin(theta);
    const py = flip * ry * Math.cos(theta);

    // Outward normal of the ellipse at that point, normalised.
    let nx = (Math.sin(theta) * side) / Math.max(rx, 0.001);
    let ny = (flip * Math.cos(theta)) / Math.max(ry, 0.001);
    let mag = Math.hypot(nx, ny) || 1;
    nx /= mag;
    ny /= mag;

    // Blend toward up-and-out so a squashed eye cannot produce whiskers.
    nx = nx * 0.45 + side * 0.55;
    ny = ny * 0.45 + flip * 0.55;
    mag = Math.hypot(nx, ny) || 1;
    nx /= mag;
    ny /= mag;

    // Longest in the middle of the sweep, shorter at both ends — the taper a
    // lash line actually has. A closing eye gets shorter lashes too, so they
    // lie along the lid at a blink instead of spiking off it.
    const taper = 0.62 + 0.38 * Math.sin(theta * 1.6);
    const lidFactor = 0.55 + 0.45 * Math.min(1, ry / 2.6);
    const len = spec.length * taper * lidFactor;
    // Start just OUTSIDE the lid, not on it. A root sitting on the fill merges
    // with it — the thicker "dramatic" set fused into the eye and read as a
    // lump rather than as hair.
    const rootGap = spec.width * 0.75;
    const rootX = px + nx * rootGap;
    const rootY = py + ny * rootGap;
    const tipX = rootX + nx * len;
    const tipY = rootY + ny * len;
    // A touch of outward curl at the tip, away from the nose.
    const curlX = side * len * 0.18;

    marks.push(
      <path
        key={`l${i}`}
        d={`M ${r(rootX)} ${r(rootY)} Q ${r(rootX + nx * len * 0.55)} ${r(rootY + ny * len * 0.55)} ${r(tipX + curlX)} ${r(tipY)}`}
        fill="none"
        stroke={color}
        strokeWidth={r(spec.width)}
        strokeLinecap="round"
        opacity="0.92"
      />,
    );
  }
  return <g>{marks}</g>;
}

export type FaceRenderOptions = {
  face: MeshiFace;
  mood: MeshiMood | string;
  lash: MeshiLash;
  color: string;
};

/**
 * The eyes — body, lashes and any mood glyph — as one group.
 *
 * The caller mounts this INSIDE the gaze/mouse-follow transforms, so every part
 * of it moves together. There is no way to mount the lashes anywhere else,
 * which is the structural version of the fix.
 */
export function renderMeshiEyes({ face, mood, lash, color }: FaceRenderOptions) {
  const geom = MESHI_FACES[face] ?? MESHI_FACES[DEFAULT_FACE];
  const shape = moodShape(mood);
  const scale = shape.scale ?? 1;
  const dy = (shape.dy ?? 0) + geom.cy;
  const dx = shape.dx ?? 0;
  const curve = shape.curve ?? 0;

  const eye = (side: -1 | 1) => {
    const closed = shape.wink === (side === -1 ? "left" : "right");
    const lid = closed ? 1 : (shape.lid ?? 0);
    const openness = Math.max(0, 1 - lid);
    // NO MOOD MAY MAKE THE EYES COLLIDE.
    //
    // `surprised` scales by 1.34 and `excited` by 1.16, which on the widest
    // faces pushed the two eyes into each other — the visor's two bars fused
    // into a single blob, and the rings overlapped. Half the gap between eye
    // centres is the hard ceiling for a half-width, less a hairline so they
    // stay visibly separate rather than merely tangent.
    const maxRx = geom.spacing - 0.55;
    const rx = Math.min(geom.rx * scale, maxRx);
    const ry = Math.max(0.2, geom.ry * scale * openness);
    const cx = side * geom.spacing + dx;
    // Tilt lifts (or drops) the OUTER corner, so it mirrors across the centre.
    const tilt = (geom.tilt ?? 0) * side * -1;

    return (
      <g key={side} transform={`translate(${r(cx)}, ${r(dy)}) rotate(${r(tilt)})`}>
        {shape.glyph
          ? glyphBody(shape.glyph, geom.ry * scale, color, "glyph")
          : eyeBody(geom, rx, ry, openness, curve, color, "body")}
        {/* A highlight belongs to an open, solid eye — not to a glyph or a
            closed lid, where it would float free of anything. */}
        {geom.highlight && !shape.glyph && openness > 0.45 && geom.shape !== "bar" && (
          <circle
            cx={r(-rx * 0.3)}
            cy={r(-ry * 0.34)}
            r={r(Math.max(0.35, Math.min(rx, ry) * 0.26))}
            fill="rgba(255,255,255,0.85)"
          />
        )}
        {lash !== "none" && !shape.glyph && lashes(lash, rx, ry, side, color)}
      </g>
    );
  };

  return (
    <g>
      {eye(-1)}
      {eye(1)}
      {shape.sparkle && (
        <g fill={color} opacity="0.75">
          <path d="M -9.6 -3.6 L -9.1 -2.4 L -7.9 -1.9 L -9.1 -1.4 L -9.6 -0.2 L -10.1 -1.4 L -11.3 -1.9 L -10.1 -2.4 Z" />
          <path d="M 9.6 -4.4 L 10 -3.5 L 10.9 -3.1 L 10 -2.7 L 9.6 -1.8 L 9.2 -2.7 L 8.3 -3.1 L 9.2 -3.5 Z" />
        </g>
      )}
    </g>
  );
}

/** Human labels for the customizer. */
export const MESHI_FACE_LABELS: Record<MeshiFace, string> = {
  bean: "Bean",
  dot: "Dot",
  wide: "Wide",
  almond: "Almond",
  upturned: "Upturned",
  downturned: "Downturned",
  square: "Square",
  tall: "Tall",
  ring: "Ring",
  halo: "Halo",
  visor: "Visor",
  sleepylid: "Half-lidded",
};

export const MESHI_LASH_LABELS: Record<MeshiLash, string> = {
  none: "None",
  natural: "Natural",
  dramatic: "Dramatic",
  lower: "Lower",
};
