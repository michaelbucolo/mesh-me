// Hit-testing derived from the model + camera — NEVER written by the painter.
//
// Every frame (after physics settles positions, before paint) the scene
// rebuilds this map from node positions and the same LOD decisions the
// painter consumes. A tap target therefore exists exactly when the node
// exists in the model: a node that is gated away, culled, or not yet born
// simply has no entry, and a node that leaves the model can never leave a
// stale "ghost" hitbox behind — the bug class where interaction correctness
// depended on what was painted last frame dies by construction. This is also
// a privacy property: hidden/gated nodes are absent from the model, so they
// are untappable, structurally.
//
// The painter shares this module's vocabulary (radii, birth progress,
// emphasis, card boxes) so what is DRAWN and what is TAPPABLE come from one
// set of decisions; the few geometry blocks it cannot share (text-measured
// pills and the self panel) are mirrored here and marked in both files.

import { projectPoint, type Camera } from "../core/camera";
import type { BranchKey, SceneModel, SceneNode } from "../scene/scene-model";

export interface HitCircle {
  x: number;
  y: number;
  r: number;
}

export interface HitRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Hitmap {
  /** Screen-space circles keyed by node id — the primary tap targets. */
  circles: Map<string, HitCircle>;
  /** Screen-space branch label-pill rects keyed by node id. */
  pills: Map<string, HitRect>;
  /** Screen-space rect for the self node's View-Profile button. */
  profile: Map<string, HitRect>;
}

export function createHitmap(): Hitmap {
  return { circles: new Map(), pills: new Map(), profile: new Map() };
}

export interface HitmapInputs {
  model: SceneModel;
  camera: Camera;
  width: number;
  height: number;
  /** The frame's rAF timestamp — birth choreography gates tappability too. */
  time: number;
  activeBranch: BranchKey | null;
  selectedId: string | null;
  hoverId: string | null;
  /** Loaded node images — a post card is only tall when its media is in. */
  images: Map<string, HTMLImageElement>;
  /** Keep pills clear of the screen centre (where the pinned Meshi sits). */
  avoidCenter: boolean;
}

// ---------------------------------------------------------------------------
// Shared scene vocabulary — the painter imports these so drawing and
// hit-testing can never disagree about size, birth, or emphasis.
// ---------------------------------------------------------------------------

const BIRTH_MS = 1150;

/**
 * 0→1 arrival progress (easeOutCubic) for a freshly joined node; 1 if
 * settled. Nodes whose birth moment hasn't arrived yet return 0 — they are
 * neither drawn nor tappable, which lets the world FORM in choreographed
 * waves instead of appearing all at once.
 */
export function birthProgress(node: SceneNode, time: number): number {
  if (node.bornAt == null) return 1;
  const age = time - node.bornAt;
  if (age < 0) return 0;
  if (age >= BIRTH_MS) return 1;
  return 1 - Math.pow(1 - age / BIRTH_MS, 3);
}

/** A node's resting world-unit radius, before zoom scaling. */
export function baseRadius(node: SceneNode): number {
  switch (node.kind) {
    case "self":
      return 30;
    case "branch":
      return 18;
    case "person":
    case "persona":
      return 16 + node.weight * 14;
    case "platform":
      return 13 + node.weight * 11;
    case "community":
      return 14 + node.weight * 11;
    case "interest":
      return 10 + node.weight * 10;
    default:
      return 8 + node.weight * 10;
  }
}

/** Chain of ids from a node back to the centre — hover/selection lineage. */
export function chainFrom(model: SceneModel, id: string | null | undefined): Set<string> {
  const chain = new Set<string>();
  if (!id) return chain;
  let cursor: SceneNode | undefined = model.nodes.get(id);
  while (cursor) {
    chain.add(cursor.id);
    cursor = cursor.parentId ? model.nodes.get(cursor.parentId) : undefined;
  }
  return chain;
}

/**
 * How lit a node is. Selecting something focuses the world on its lineage:
 * the selected node, its maker, and you stay bright; everything unrelated
 * recedes. At rest the mesh reads as CONTENT, not dim geometry — posts and
 * people stay bright enough to recognize without focusing a branch.
 */
export function nodeEmphasis(
  node: SceneNode,
  hoverChain: ReadonlySet<string>,
  selChain: ReadonlySet<string>,
  activeBranch: BranchKey | null,
): number {
  if (hoverChain.has(node.id) || selChain.has(node.id)) return 1;
  if (node.kind === "self" || node.kind === "branch") return 1;
  if (selChain.size > 0) return 0.24;
  if (!activeBranch) return 0.8;
  return node.branch === activeBranch ? 1 : 0.18;
}

/** Posts float as rich cards only once the camera is close enough to READ
 * them — the one LOD decision paint and hit-testing must share. */
export const POST_CARD_MIN_ZOOM = 0.42;
export const POST_CARD_MIN_EMPH = 0.2;

/** Post-card scale at this zoom and content weight. */
export function postCardScale(zoom: number, weight: number): number {
  return Math.max(0.78, Math.min(zoom, 1.35)) * (0.82 + weight * 0.36);
}

/** Outer box of a floating post card: header + optional media + text + footer. */
export function postCardSize(scale: number, hasImage: boolean): { w: number; h: number } {
  return { w: 172 * scale, h: (22 + 32 + 22) * scale + (hasImage ? 96 * scale : 0) };
}

// ---------------------------------------------------------------------------
// Text-measured geometry mirrored from the painter (scene-render.ts). These
// blocks measure the same strings with the same font specs on a scratch
// context, so the rects land exactly where the pixels do. Any change to the
// painter's pill or self-panel layout must be mirrored here (both sites are
// marked); the drift risk retires with the legacy painter in PR3/4.
// ---------------------------------------------------------------------------

const FONT_STACK = "ui-sans-serif, system-ui, sans-serif";

let measureCtx: CanvasRenderingContext2D | null = null;

function measureText(font: string, text: string): number {
  if (!measureCtx) {
    if (typeof document === "undefined") return 0;
    measureCtx = document.createElement("canvas").getContext("2d");
    if (!measureCtx) return 0;
  }
  measureCtx.font = font;
  return measureCtx.measureText(text).width;
}

/** How many lines the painter's two-line bio wrap produces (0, 1, or 2) —
 * mirrors wrapTwoLines in scene-render.ts, line-count only. */
function bioLineCount(text: string, font: string, maxW: number): number {
  if (!text) return 0;
  if (measureText(font, text) <= maxW) return 1;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measureText(font, text.slice(0, mid)) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  const breakAt = text.lastIndexOf(" ", lo) > lo * 0.6 ? text.lastIndexOf(" ", lo) : lo;
  return text.slice(breakAt).trim() ? 2 : 1;
}

/** The self node's View-Profile button rect — mirrors drawSelfProfile's
 * panel layout (scene-render.ts) down to each spacing constant. */
function selfProfileButtonRect(node: SceneNode, x: number, y: number, zoom: number): HitRect {
  const zoomScale = Math.max(0.68, Math.min(1.18, zoom * 1.08));
  const avatarR = 31 * zoomScale;
  const nameFont = Math.max(16, 18 * zoomScale);
  const handleFont = Math.max(11, 12 * zoomScale);
  const bioFont = Math.max(11, 12 * zoomScale);
  const buttonFont = Math.max(11, 11.5 * zoomScale);
  const bodyMaxW = 272 * zoomScale;
  const contentTop = y + avatarR + 18 * zoomScale;
  const bioLines = bioLineCount(node.description || "", `500 ${bioFont}px ${FONT_STACK}`, bodyMaxW);
  const bioHeight = bioLines > 0 ? bioLines * (bioFont + 4 * zoomScale) - 4 * zoomScale : 0;
  const nameY = contentTop;
  const handleY = nameY + nameFont + 9 * zoomScale;
  const bioY = handleY + handleFont + 12 * zoomScale;
  const buttonY = bioY + bioHeight + (bioLines > 0 ? 18 * zoomScale : 12 * zoomScale);
  const buttonW = measureText(`600 ${buttonFont}px ${FONT_STACK}`, "View Profile") + 28;
  const buttonH = buttonFont + 12;
  return { x: x - buttonW / 2, y: buttonY, w: buttonW, h: buttonH };
}

/**
 * Rebuild the whole hitmap from the model + camera for this frame. Runs in
 * the scheduler's paint phase, before drawScene — so the DOM-sync phase and
 * every pointer query read targets derived from THIS frame's settled state.
 */
export function rebuildHitmap(hitmap: Hitmap, o: HitmapInputs): void {
  const { model, camera, width, height, time } = o;
  hitmap.circles.clear();
  hitmap.pills.clear();
  hitmap.profile.clear();

  const zclamp = Math.max(0.5, Math.min(camera.zoom, 2.2));
  const hoverChain = chainFrom(model, o.hoverId);
  const selChain = chainFrom(model, o.selectedId);

  // Branch pills that would sit on the centre-pinned Meshi stack downward in
  // node order — mirrored from the painter's label pass, so pill rects land
  // exactly where the pills draw.
  let avoidStack = 0;

  model.nodes.forEach((node) => {
    const born = birthProgress(node, time);
    if (born <= 0 && node.kind !== "self") return;
    const p = projectPoint(camera, width, height, node.dx, node.dy);
    const r = Math.max(2.5, baseRadius(node) * zclamp);
    hitmap.circles.set(node.id, { x: p.x, y: p.y, r: Math.max(r, 14) });

    // Offscreen: keep the (true, current-frame) circle — the presence layer
    // dodges nodes just past the edge — but no cards, pills, or profile
    // button exist there, exactly as the painter culls them.
    const cull = node.kind === "post" ? 170 : 80;
    if (p.x < -cull || p.x > width + cull || p.y < -cull || p.y > height + cull) return;

    if (node.kind === "self") {
      // The self target matches the drawn avatar (drawSelfProfile's radius).
      const avatarR = 31 * Math.max(0.68, Math.min(1.18, camera.zoom * 1.08));
      hitmap.circles.set(node.id, { x: p.x, y: p.y, r: Math.max(avatarR * 1.12, 26) });
      // The profile panel (and its button) exists only while the centre is
      // hovered or selected — same gate as the painter.
      if (o.hoverId === node.id || o.selectedId === node.id) {
        hitmap.profile.set(node.id, selfProfileButtonRect(node, p.x, p.y, camera.zoom));
      }
      return;
    }

    const emph = nodeEmphasis(node, hoverChain, selChain, o.activeBranch);
    if (node.kind === "post" && camera.zoom >= POST_CARD_MIN_ZOOM && emph > POST_CARD_MIN_EMPH) {
      // Floating card at this zoom: the tap target is the card's box.
      const scale = postCardScale(camera.zoom, node.weight);
      const hasImage = Boolean(node.imageUrl && o.images.get(node.id));
      const size = postCardSize(scale, hasImage);
      hitmap.circles.set(node.id, { x: p.x, y: p.y, r: Math.max(size.w, size.h) / 2 });
      return;
    }

    if (node.kind === "branch") {
      // Branch label pill — mirrors the painter's pill layout (font, clamp
      // to screen, centre avoidance) including the birth spring-out scale.
      const fontSize = 13;
      const label = node.count != null ? `${node.label} · ${node.count}` : node.label;
      const textW = measureText(`600 ${fontSize}px ${FONT_STACK}`, label);
      let pillR = r;
      if (born < 1) {
        const t1 = born - 1;
        pillR *= Math.max(0.12, 1 + 2.70158 * t1 * t1 * t1 + 1.70158 * t1 * t1);
      }
      let ly = p.y + pillR + 6;
      const halfW = textW / 2 + 9;
      const lx = Math.max(halfW + 4, Math.min(width - halfW - 4, p.x));
      if (o.avoidCenter) {
        const cx = width / 2;
        const cy = height / 2;
        const pillCy = ly + (fontSize + 7) / 2;
        if (Math.hypot(lx - cx, pillCy - cy) < 66) {
          ly = cy + 52 + avoidStack;
          avoidStack += fontSize + 14;
        }
      }
      hitmap.pills.set(node.id, { x: lx - textW / 2 - 7, y: ly, w: textW + 14, h: fontSize + 7 });
    }
  });
}
