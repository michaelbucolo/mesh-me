// MeshRuntime — the ONE per-mount bag of imperative frame-loop state.
//
// The old mesh-scene.tsx held ~70 React refs that the sim/paint/domSync
// phases, the pointer handlers, and the presence room all reached into.
// Those refs were never React state (nothing renders from them) — they were
// a shared mutable scene. This object makes that explicit: it is created
// once per mount, passed to the world/frame/input/live hooks, and mutated
// imperatively on the hot path. React chrome NEVER reads it during render
// (except one-shot reads like the list view's model snapshot); anything a
// component renders from lives in React state or the core store.

import type { RefObject } from "react";
import type { Camera } from "../core/camera";
import { createCamera } from "../core/camera";
import type { MeshScheduler } from "../core/scheduler";
import { createHitmap, type Hitmap } from "../sim/hitmap";
import { createPhysicsState, type PhysicsState } from "../sim/physics";
import { createStrumState, type StrumState } from "../sim/strum";
import { createToysState, type ToysState } from "../sim/toys";
import type { PaintEngine } from "../paint";
import type { ReactionTrail } from "../paint/types";
import { createReplayGate, type ActionReplayGate, type ActionVerb } from "../live/action-bus";
import { createFunVerbGate, type FunVerbGate } from "../live/emotes";
import type { MeshiSprite } from "../live/meshi-machine";
import { createBehaviorMoodState, type BehaviorMoodState } from "../live/mood";
import { createRoster, type RemotePresence, type RoomRoster } from "../live/roster";
import type { BranchKey, SceneModel } from "./scene-model";
import type { ReactionGlyph } from "./reaction-glyphs";

// The payload entry type lives with the roster logic now; re-exported here so
// existing importers keep one path.
export type { RemotePresence } from "../live/roster";

/** A departed visitor fading out where their Meshi last stood. */
export type LeavingMeshi = {
  key: string;
  x: number;
  y: number;
  /** World scale at departure so the ghost of them matches the zoom. */
  s: number;
  p: RemotePresence;
};

/** A reaction glyph in flight — a heart arcing to a post it liked, or (when
 *  `burst` is set) a targetless flourish that rises out of a point and fades. */
type FlyingHeart = {
  id: number;
  fromX: number;
  fromY: number;
  targetId: string;
  born: number;
  dur: number;
  glyph?: ReactionGlyph;
  /** Fun-verb heart (flick / emote wheel / incoming `fling`): flies and lands
   * with the full flourish but NEVER bumps the Likes tick or pulses the
   * strand — play never mutates data, and no like was written. */
  cosmetic?: boolean;
  /** Free-flight: fly out along `angle` by `dist` world units, no node, no count bump. */
  burst?: { angle: number; dist: number };
};

/** Mesh Pro visuals chosen by this mesh's OWNER — read per-frame. */
interface ProVisuals {
  connectionColor: string | null;
  nodeStyle: string | null;
  motionStyle: string | null;
  atmosphere: string | null;
}

interface DragState {
  active: boolean;
  moved: boolean;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  lastT: number;
  vx: number;
  vy: number;
  pinchDist: number;
  // Screen midpoint between the two fingers, so a pinch can PAN (drag both
  // fingers together) as well as zoom. 0 until a two-finger gesture seeds it.
  pinchMidX: number;
  pinchMidY: number;
}

/** All live-room bookkeeping. Owned by the live/ modules; grouped so the
 * rest of the scene can't reach in ad hoc. The old 12-map, 3-coordinate-
 * space handoff machinery is GONE — one sprite state machine per Meshi
 * (world coords only; see live/meshi-machine) plus the roster, replay gate,
 * and mood state, each owned by its pure module. */
interface PresenceRuntime {
  /** One behaviour-machine sprite per remote Meshi in the room. */
  sprites: Map<string, MeshiSprite>;
  /** Who is in the room (grace/hysteresis/signatures — live/roster). */
  roster: RoomRoster;
  /** Connections online ELSEWHERE — the canvas ring + where-chip data. */
  info: Map<string, { where: string | null; route: string | null }>;
  /** Action replay dedupe (live/action-bus). */
  actionGate: ActionReplayGate;
  /** Your Meshi's inner-life state (live/mood). */
  behavior: BehaviorMoodState;
  ownerHereWorld: { x: number; y: number } | null;
  ownerSeenAt: number;
  greetedRoom: string | null;
  // --- projection-edge motion caches (screen space, cosmetic only) ---
  selfScreen: { x: number; y: number } | null;
  ownerScreen: { x: number; y: number } | null;
  selfLook: { x: number; y: number };
  ownerLook: { x: number; y: number };
  cursorRot: number;
  cursorPrev: { x: number; y: number } | null;
  ownerRot: number;
  ownerPrev: { x: number; y: number } | null;
}

export interface MeshRuntime {
  // --- DOM anchors (set via callback refs) ---
  containerEl: HTMLDivElement | null;
  canvasEl: HTMLCanvasElement | null;
  meshiCursorEl: HTMLDivElement | null;
  cursorDotEl: HTMLDivElement | null;
  ownerMeshiEl: HTMLDivElement | null;
  heartsEl: HTMLDivElement | null;
  presenceEls: Map<string, HTMLDivElement>;

  // --- world / engine ---
  camera: Camera;
  model: SceneModel | null;
  hitmap: Hitmap;
  physics: PhysicsState;
  images: Map<string, HTMLImageElement>;
  stars: { x: number; y: number; r: number; tw: number }[];
  size: { width: number; height: number };
  proVisuals: ProVisuals;
  meshOwnerId: string | null;
  lastVisit: number | null | undefined;
  rewindAt: number | null;
  tourIds: string[] | null;
  scheduler: MeshScheduler | null;
  paintEngine: PaintEngine | null;

  // --- gestures / camera intents ---
  pointers: Map<number, { x: number; y: number }>;
  drag: DragState;
  fling: { vx: number; vy: number };
  zoomTarget: { zoom: number; ax: number; ay: number } | null;
  panTarget: { nodeId: string } | null;
  lastTap: { x: number; y: number; t: number } | null;
  coarse: boolean;
  traveling: boolean;

  // --- toys (cosmetic play physics: the pluck, the strand strum) ---
  toys: ToysState;
  /** The strum's presence-point trace (sim/strum) — crossing a strand twangs it. */
  strum: StrumState;
  /** Client-side courtesy caps on outgoing fun verbs (flick hearts, emote
   * wheel) — on TOP of the server's presence-route rate limits. */
  funGate: FunVerbGate;
  /** Pending long-press: armed on pointer-down over a content node, fires
   * the pluck if the pointer stays put; cancelled by move/lift/pinch. */
  pluckHold: { timer: ReturnType<typeof setTimeout>; nodeId: string; pointerId: number } | null;
  /** The pointer currently holding a plucked node (its moves steer the
   * stretch instead of panning; its lift releases the spring, never taps). */
  pluckPointerId: number | null;
  /** The active pluck opened the emote wheel — its lift dismisses the wheel
   *  and must never double as a flick broadcast. */
  pluckEmote: boolean;

  // --- selection mirrors (React state is authoritative; these feed frames) ---
  hoverId: string | null;
  selectedId: string | null;
  activeBranch: BranchKey | null;
  focusId: string | null;
  composing: boolean;

  // --- self Meshi / cursor ---
  cursorWorldTarget: { x: number; y: number; seen: boolean };
  cursorWorldPos: { x: number; y: number };
  cursorVp: { vx: number; vy: number };
  ownerWorldPos: { x: number; y: number };
  pointerOnCanvas: boolean;
  lastInputAt: number;
  lastMoveHb: number;
  reducedMotion: boolean;

  // --- hearts / strand pulses / strums / trails ---
  hearts: FlyingHeart[];
  heartSeq: number;
  strandPulses: Map<string, number>;
  /** Strummed strands (edge key → start time): fx shimmer + re-strum cooldown. */
  strandStrums: Map<string, number>;
  /** Incoming reactions' comet trails (fx layer, tier-budgeted). */
  trails: ReactionTrail[];

  // --- presence bridge (written by input/lens, read by the heartbeat) ---
  heartbeatNow: (() => void) | null;
  pendingAction: { kind: ActionVerb; targetId: string; at: number } | null;

  presence: PresenceRuntime;
}

/** How the runtime travels between hooks: as a React ref, so every consumer
 * dereferences `.current` inside callbacks/effects (never during render). */
export type MeshRuntimeRef = RefObject<MeshRuntime>;

export function createMeshRuntime(): MeshRuntime {
  return {
    containerEl: null,
    canvasEl: null,
    meshiCursorEl: null,
    cursorDotEl: null,
    ownerMeshiEl: null,
    heartsEl: null,
    presenceEls: new Map(),

    camera: createCamera(),
    model: null,
    hitmap: createHitmap(),
    physics: createPhysicsState(),
    images: new Map(),
    stars: [],
    size: { width: 0, height: 0 },
    proVisuals: { connectionColor: null, nodeStyle: null, motionStyle: null, atmosphere: null },
    meshOwnerId: null,
    lastVisit: undefined,
    rewindAt: null,
    tourIds: null,
    scheduler: null,
    paintEngine: null,

    pointers: new Map(),
    drag: {
      active: false,
      moved: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      lastT: 0,
      vx: 0,
      vy: 0,
      pinchDist: 0,
      pinchMidX: 0,
      pinchMidY: 0,
    },
    fling: { vx: 0, vy: 0 },
    zoomTarget: null,
    panTarget: null,
    lastTap: null,
    coarse: true,
    traveling: false,

    toys: createToysState(),
    strum: createStrumState(),
    funGate: createFunVerbGate(),
    pluckHold: null,
    pluckPointerId: null,
    pluckEmote: false,

    hoverId: null,
    selectedId: null,
    activeBranch: null,
    focusId: null,
    composing: false,

    cursorWorldTarget: { x: 0, y: 0, seen: false },
    cursorWorldPos: { x: 0, y: 0 },
    cursorVp: { vx: 0.5, vy: 0.5 },
    ownerWorldPos: { x: 0, y: 0 },
    pointerOnCanvas: false,
    lastInputAt: 0,
    lastMoveHb: 0,
    reducedMotion: false,

    hearts: [],
    heartSeq: 0,
    strandPulses: new Map(),
    strandStrums: new Map(),
    trails: [],

    heartbeatNow: null,
    pendingAction: null,

    presence: {
      sprites: new Map(),
      roster: createRoster(),
      info: new Map(),
      actionGate: createReplayGate(),
      behavior: createBehaviorMoodState(),
      ownerHereWorld: null,
      ownerSeenAt: 0,
      greetedRoom: null,
      selfScreen: null,
      ownerScreen: null,
      selfLook: { x: 0, y: 0 },
      ownerLook: { x: 0, y: 0 },
      cursorRot: 0,
      cursorPrev: null,
      ownerRot: 0,
      ownerPrev: null,
    },
  };
}
