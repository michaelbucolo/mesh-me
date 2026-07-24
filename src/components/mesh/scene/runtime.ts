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
import type { PaintEngine } from "../paint";
import type { BranchKey, SceneModel } from "./scene-model";
import type { ReactionGlyph } from "./reaction-glyphs";
import type { MeshiMood } from "@/components/meshi/meshi-mascot";

export type RemotePresence = {
  userId: string;
  username: string;
  displayName: string;
  meshiColor: string;
  meshiHat: string;
  meshiHair?: string;
  meshiAccessory?: string;
  meshiEyeStyle?: string;
  meshiBadge?: string;
  meshiOutfit?: string;
  meshiMood: string;
  viewportPosition: { vx: number; vy: number };
  position?: { x: number; y: number };
  viewingMesh: string;
  surface?: string;
  /** The node this person is reading right now — their Meshi stands at it. */
  activeNodeId?: string | null;
  /** Encoded tiny world action ("heart|targetId|atMs") to replay in the room. */
  lastAction?: string | null;
  /** Where on mesh.me they are when not on a mesh surface (e.g. "/flow"). */
  activeRoute?: string | null;
  /** Mesh Pro member — their Meshi carries a subtle gold aura. */
  isPro?: boolean;
  isOnline: boolean;
};

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

/** All live-room bookkeeping (positions, hysteresis, dedupe, gaze). Owned by
 * the live/ modules; grouped so the rest of the scene can't reach in ad hoc. */
interface PresenceRuntime {
  targets: Map<string, { vx: number; vy: number }>;
  pos: Map<string, { vx: number; vy: number }>;
  // "room" = viewing this same mesh (drifts like a live cursor);
  // "perch" = a connection online elsewhere, perched on their own node.
  mode: Map<string, "room" | "perch">;
  perchPos: Map<string, { x: number; y: number }>;
  world: Map<string, { x: number; y: number }>;
  worldPos: Map<string, { x: number; y: number }>;
  perchWorldPos: Map<string, { x: number; y: number }>;
  avoidOffset: Map<string, { x: number; y: number }>;
  info: Map<string, { where: string | null; route: string | null }>;
  seenAt: Map<string, number>;
  obj: Map<string, RemotePresence>;
  remoteSig: string;
  look: Map<string, { x: number; y: number }>;
  lastScreenPos: Map<string, { x: number; y: number }>;
  perchNode: Map<string, string>;
  seenActions: Map<string, number>;
  actionBaseline: boolean;
  prevIds: Set<string> | null;
  prevList: RemotePresence[];
  joinStamp: Map<string, number>;
  ownerHereWorld: { x: number; y: number } | null;
  ownerSeenAt: number;
  greetedRoom: string | null;
  selfScreen: { x: number; y: number } | null;
  ownerScreen: { x: number; y: number } | null;
  socialUntil: number;
  behaviorMood: MeshiMood | null;
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

  // --- hearts / strand pulses ---
  hearts: FlyingHeart[];
  heartSeq: number;
  strandPulses: Map<string, number>;

  // --- presence bridge (written by input/lens, read by the heartbeat) ---
  heartbeatNow: (() => void) | null;
  pendingAction: { kind: ReactionGlyph; targetId: string; at: number } | null;

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

    heartbeatNow: null,
    pendingAction: null,

    presence: {
      targets: new Map(),
      pos: new Map(),
      mode: new Map(),
      perchPos: new Map(),
      world: new Map(),
      worldPos: new Map(),
      perchWorldPos: new Map(),
      avoidOffset: new Map(),
      info: new Map(),
      seenAt: new Map(),
      obj: new Map(),
      remoteSig: "",
      look: new Map(),
      lastScreenPos: new Map(),
      perchNode: new Map(),
      seenActions: new Map(),
      actionBaseline: false,
      prevIds: null,
      prevList: [],
      joinStamp: new Map(),
      ownerHereWorld: null,
      ownerSeenAt: 0,
      greetedRoom: null,
      selfScreen: null,
      ownerScreen: null,
      socialUntil: 0,
      behaviorMood: null,
      cursorRot: 0,
      cursorPrev: null,
      ownerRot: 0,
      ownerPrev: null,
    },
  };
}
