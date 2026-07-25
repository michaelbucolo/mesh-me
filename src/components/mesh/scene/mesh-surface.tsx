"use client";

// MeshSurface — the mesh's thin wiring shell (the old 4,200-line
// mesh-scene.tsx dies here). It mounts the canvas + DOM layers, derives
// ViewerCaps once, creates the shared MeshRuntime, registers the scheduler
// phases through the world/frame/input/live hooks, and mounts the chrome:
// every overlay lives in ui/, every live-room behavior in live/. React state
// here is only what the chrome renders from — the frame loop reads the
// runtime and never touches React.

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import { deriveViewerCaps } from "../core/viewer";
import { createMeshStore, type MeshStore } from "../core/store";
import { flickHeart, sendEmote } from "../live/emotes";
import { emitHeart } from "../live/hearts";
import { MeshiLayer } from "../live/meshi-layer";
import { useLivePresence } from "../live/use-live-presence";
import { useMeshiDomSync } from "../live/use-meshi-dom-sync";
import { MeshChrome, pickMarqueeItem, useMeshChrome, type MeshChromeController } from "../ui/chrome";
import { ContentLens } from "../ui/content-lens";
import { MeshComposeModal } from "../ui/compose-modal";
import { meshCopy } from "../ui/copy";
import { MeshEmoteWheel } from "../ui/emote-wheel";
import { MeshGates } from "../ui/gates";
import { MeshListView } from "../ui/list-view";
import { NodeDetail } from "../ui/node-detail";
import { MeshPluckRing } from "../ui/pluck-ring";
import { MeshSearchOverlay } from "../ui/search-overlay";
import { MeshShortcutsSheet } from "../ui/shortcuts-sheet";
import { MeshTipsCard } from "../ui/tips-card";
import { useCatchUp } from "../ui/use-catchup";
import { MeshWedgeCounts } from "../ui/wedge-counts";
import { createMeshRuntime, type MeshRuntime, type MeshRuntimeRef } from "./runtime";
import type { BranchKey, SceneNode } from "./scene-model";
import { useMeshFrame } from "./use-mesh-frame";
import { contentListOf, useMeshInput } from "./use-mesh-input";
import { useMeshWorld } from "./use-mesh-world";

interface MeshSceneProps {
  viewUserId?: string;
  /** "global" loads the guest-viewable world supply as a READ-ONLY view: no
   * presence broadcast, no compose, treated as a visitor (never the owner). */
  viewMode?: "mesh" | "global";
}

export function MeshScene({ viewUserId, viewMode = "mesh" }: MeshSceneProps) {
  const router = useRouter();
  // What this viewer MAY do here, derived ONCE (core/viewer.ts): the Global
  // view is read-only by capability, and "am I on my own mesh?" stays an
  // EXPLICIT test, never just `!viewUserId`.
  const viewer = useMemo(() => deriveViewerCaps({ viewUserId, viewMode }), [viewUserId, viewMode]);
  const isOwnMesh = viewer.isOwner;
  const prefs = useMeshiPreferences();

  // The one per-mount bag of imperative frame-loop state. Dereferenced ONLY
  // inside callbacks/effects — render never reads the runtime.
  const rtNullableRef = useRef<MeshRuntime | null>(null);
  if (rtNullableRef.current === null) rtNullableRef.current = createMeshRuntime();
  const rtRef = rtNullableRef as MeshRuntimeRef;
  // The core store mirror of the coarse interactive facts (PR1 wiring).
  const storeRef = useRef<MeshStore | null>(null);
  if (storeRef.current === null) storeRef.current = createMeshStore(viewer);

  // --- React state the chrome renders from ---
  const [selectedNode, setSelectedNode] = useState<SceneNode | null>(null);
  const [activeBranch, setActiveBranch] = useState<BranchKey | null>(null);
  const [hoverNode, setHoverNode] = useState<SceneNode | null>(null);
  const [tourIds, setTourIds] = useState<string[] | null>(null);
  // A long-press plucked this node — the radial quick-action ring is open.
  const [pluck, setPluck] = useState<{ node: SceneNode; anchor: { x: number; y: number } } | null>(null);
  // The emote wheel — open on a person (long-press; hearts fly at them) or
  // from the rail (targetless flourishes). `held` = the opening pointer is
  // still down, so the wheel resolves release-on-emote.
  const [emote, setEmote] = useState<{
    node: SceneNode | null;
    anchor: { x: number; y: number };
    held: boolean;
  } | null>(null);
  // The one-time "Sound on?" affordance — armed by the first playful gesture
  // of the session, and only while no explicit sound choice exists.
  // Travel veil, keyed by the view it started from — arriving at the new view
  // (new props) derives it away without an imperative reset.
  const viewKey = `${viewUserId ?? ""}|${viewMode}`;
  const [travelState, setTravelState] = useState<{ key: string; label: string } | null>(null);
  const traveling = travelState && travelState.key === viewKey ? travelState : null;
  const [isCoarsePointer, setIsCoarsePointer] = useState(true);
  const [presenceToast, setPresenceToast] = useState<{ text: string; key: number } | null>(null);

  // Runtime/store mirrors so the frame loop and heartbeat read fresh values.
  useEffect(() => {
    const rt = rtRef.current;
    rt.selectedId = selectedNode?.id ?? null;
    rt.activeBranch = activeBranch;
    rt.tourIds = tourIds;
    storeRef.current?.select(selectedNode?.id ?? null);
  }, [rtRef, selectedNode, activeBranch, tourIds]);
  useEffect(() => {
    storeRef.current?.setViewer(viewer);
  }, [viewer]);
  useEffect(() => {
    rtRef.current.traveling = false;
  }, [rtRef, viewKey, isOwnMesh]);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => {
      rtRef.current.coarse = mq.matches;
      setIsCoarsePointer(mq.matches);
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [rtRef]);
  useEffect(() => {
    if (!presenceToast) return;
    const t = setTimeout(() => setPresenceToast(null), 3600);
    return () => clearTimeout(t);
  }, [presenceToast]);

  // Clearing selection: the lens/detail closers. closeSelection also ends a
  // catch-up tour (closing the lens un-dims the world and drops the tour).
  const clearSelectionOnly = useCallback(() => {
    setSelectedNode(null);
    setActiveBranch(null);
  }, []);
  const closeSelection = useCallback(() => {
    setSelectedNode(null);
    setActiveBranch(null);
    rtRef.current.tourIds = null;
    setTourIds(null);
  }, [rtRef]);

  // --- PR7 fun layer ---
  // Social fun verbs (flick heart, emote wheel) exist only where presence
  // broadcast does — Global's read-only view never wires the handlers, so
  // the gestures/buttons are structurally absent, not disabled.
  const canEmote = viewer.canBroadcastPresence;
  const closeEmote = useCallback(() => setEmote(null), []);
  const openEmoteHold = useCallback(
    (node: SceneNode, anchor: { x: number; y: number }) => {
      setEmote({ node, anchor, held: true });
    },
    [],
  );
  const openEmoteFromRail = useCallback((anchor: { x: number; y: number }) => {
    setEmote({ node: null, anchor, held: false });
  }, []);
  // Flinging a plucked node throws a heart at it (courtesy-capped in
  // live/emotes; broadcast rides the existing bus heart verb).
  const handleFlick = useCallback(
    (node: SceneNode) => {
      flickHeart(rtRef.current, isOwnMesh, node);
    },
    [rtRef, isOwnMesh],
  );

  // --- world / frame / input / chrome / live ---
  const world = useMeshWorld(rtRef, viewer, {
    viewUserId,
    viewMode,
    onWorldReplaced: clearSelectionOnly,
    onSelectionInvalid: clearSelectionOnly,
  });
  useMeshFrame(rtRef, { viewUserId, viewMode, isOwnMesh, fitToContent: world.fitToContent });

  const chromeRef = useRef<MeshChromeController | null>(null);
  const push = useCallback((href: string) => router.push(href), [router]);
  const input = useMeshInput(rtRef, {
    fitToContent: world.fitToContent,
    push,
    setSelectedNode,
    setActiveBranch,
    setHoverNode,
    onTravel: useCallback((label: string) => setTravelState({ key: viewKey, label }), [viewKey]),
    onStartTour: setTourIds,
    openList: useCallback(() => chromeRef.current?.open("list"), []),
    onPluck: useCallback(
      (node: SceneNode, anchor: { x: number; y: number }) => {
        // The blueprint's "first pluck/strum" moment — may offer sound.
        setPluck({ node, anchor });
      },
      [],
    ),
    // Capability-by-construction: no broadcast capability, no handler — the
    // person long-press and the flick never even arm in Global.
    onEmoteHold: canEmote ? openEmoteHold : undefined,
    onFlick: canEmote ? handleFlick : undefined,
  });

  const chrome = useMeshChrome({
    closeSelection,
    closeRewind: world.backToNow,
    closeEmote,
    zoomBy: input.zoomBy,
    fitToContent: world.fitToContent,
  });
  useEffect(() => {
    chromeRef.current = chrome;
  }, [chrome]);
  // The selection (lens/detail) participates in the layered-dismissal stack.
  const { open: chromeOpen, close: chromeClose } = chrome;
  useEffect(() => {
    if (selectedNode) chromeOpen("selection");
    else chromeClose("selection");
  }, [selectedNode, chromeOpen, chromeClose]);
  // The emote wheel joins the layered-dismissal stack (Esc closes it first
  // when it's on top; one overlay at a time via the one stacking manager).
  useEffect(() => {
    if (emote) chromeOpen("emote");
    else chromeClose("emote");
  }, [emote, chromeOpen, chromeClose]);
  const showCompose = chrome.isOpen("compose");
  useEffect(() => {
    rtRef.current.composing = showCompose;
  }, [rtRef, showCompose]);

  const live = useLivePresence(rtRef, {
    viewer,
    viewUserId,
    viewMode,
    prefs,
    onPresenceToast: useCallback((text: string) => setPresenceToast({ text, key: Date.now() }), []),
  });
  useMeshiDomSync(rtRef, { viewUserId, viewMode, isOwnMesh });

  // Ownership-dependent copy, derived once from ViewerCaps + the owner.
  const copy = useMemo(
    () =>
      meshCopy(
        viewer,
        world.meshData
          ? { username: world.meshData.user.username, displayName: world.meshData.user.displayName }
          : world.viewedUser,
      ),
    [viewer, world.meshData, world.viewedUser],
  );

  // The ONE top-center ambient slot: catch-up > weave > presence.
  const marqueeItem = pickMarqueeItem({
    catchup:
      world.status === "ready" && isOwnMesh && world.newCount > 0 && world.rewindAt == null && !tourIds
        ? { count: world.newCount, onStart: input.startCatchUp }
        : null,
    weave: world.weaveToast,
    presence: presenceToast,
  });

  // The lens's stream, derived from the STATE model (identical object to the
  // runtime's — refreshed on every load/rewind rebuild).
  const lensList = useMemo(() => contentListOf(world.model, tourIds), [world.model, tourIds]);

  // Catch-up mode: the tour auto-advances (oldest first) with progress dots;
  // manual navigation and any touch inside the lens pause it.
  const catchup = useCatchUp({
    tourIds,
    selectedId: selectedNode?.id ?? null,
    navigate: input.navigateContent,
    end: closeSelection,
  });

  // Opening content in the lens clears its New mark for this session — the
  // viewer-side half of "seen" (wedge counts fall as you actually read). The
  // cross-Flow impression bridge is separate and lives in the lens itself.
  const { markNodeSeen } = world;
  useEffect(() => {
    if (selectedNode && (selectedNode.kind === "post" || selectedNode.kind === "activity")) {
      markNodeSeen(selectedNode.id);
    }
  }, [selectedNode, markNodeSeen]);

  const isContentSelection =
    selectedNode && (selectedNode.kind === "post" || selectedNode.kind === "activity");
  const isDetailSelection =
    selectedNode &&
    selectedNode.kind !== "self" &&
    selectedNode.kind !== "branch" &&
    selectedNode.kind !== "post" &&
    selectedNode.kind !== "activity";

  return (
    <div
      ref={(el) => {
        rtRef.current.containerEl = el;
      }}
      data-testid="mesh-scene"
      className="relative h-full min-h-0 w-full min-w-0 flex-1 touch-none overflow-hidden bg-[#04050c] select-none"
      onWheel={input.onWheel}
    >
      {/* The canvas draws Meshi at the pointer itself, so it owns the BODY
          layer here and the global DOM sprite stands down over it —
          `data-meshi-canvas-pointer` is what tells the sprite that.

          It no longer hides the native cursor. That used to read as "the
          reticle IS the cursor", but the floor image is Meshi's contact shadow
          and aim dot: keeping it means the exact same two-layer arrangement as
          every other surface, with the body simply painted by canvas instead of
          by the DOM. It also means no state anywhere in the product leaves the
          user without a pointer — including the frames before the scene has
          drawn anything at all. */}
      <canvas
        ref={(el) => {
          rtRef.current.canvasEl = el;
        }}
        data-testid="mesh-canvas"
        data-meshi-canvas-pointer={!isCoarsePointer ? "" : undefined}
        role="img"
        aria-label="Your mesh constellation"
        className="block h-full w-full"
        onPointerDown={input.onPointerDown}
        onPointerMove={input.onPointerMove}
        onPointerUp={input.onPointerUp}
        onPointerCancel={input.onPointerCancel}
        onPointerLeave={input.onPointerLeave}
      />

      {/* Rate-limit pause pip: when the presence transport backs off after a
          429 it says so — a quiet room must never be a silent mystery. */}
      {live.liveLink === "paused" && (
        <div
          role="status"
          className="mesh-glass pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full px-3 py-1.5 text-[10.5px] font-semibold text-white/75"
        >
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" aria-hidden />
          Live paused — reconnecting…
        </div>
      )}

      {/* Meshis, hearts-in-flight, cursor reticle, hover previews. */}
      <MeshiLayer
        rtRef={rtRef}
        prefs={prefs}
        isOwnMesh={isOwnMesh}
        viewUserId={viewUserId}
        meshData={world.meshData}
        hoverNode={hoverNode}
        showCompose={showCompose}
        behaviorMood={live.behaviorMood}
        remotePresences={live.remotePresences}
        leavingMeshis={live.leavingMeshis}
        ownerLive={live.ownerLive}
        isCoarsePointer={isCoarsePointer}
      />

      {/* Tabs / visiting header / rail / marquee / rewind — the persistent
          chrome, under the one stacking manager. */}
      <MeshChrome
        viewer={viewer}
        copy={copy}
        viewUserId={viewUserId}
        viewedUser={world.viewedUser}
        canCompose={viewer.canPost && !!world.meshUser}
        shareUsername={world.meshData?.user.username ?? null}
        status={world.status}
        oldestMoment={world.oldestMoment}
        rewindAt={world.rewindAt}
        rewindValue={world.rewindValue}
        marquee={marqueeItem}
        chrome={chrome}
        onRewindInput={world.onRewindInput}
        onBackToNow={world.backToNow}
        navigate={push}
        onRecenter={world.fitToContent}
        onEmote={canEmote ? openEmoteFromRail : undefined}
      />

      {/* Wedge unseen counts + mark-seen pills — the manage layer's "what's
          piled up where". Own mesh, present time only (marks are viewer-side
          and Rewind's past has no "new"). */}
      {viewer.isOwner && world.status === "ready" && world.rewindAt == null && (
        <MeshWedgeCounts
          unseen={world.unseen}
          onFocusBranch={(branch) => setActiveBranch((prev) => (prev === branch ? null : branch))}
          onMarkSeen={world.markBranchSeen}
        />
      )}

      {/* Status gates + travel veil. */}
      <MeshGates
        status={world.status}
        viewer={viewer}
        viewUserId={viewUserId}
        meshData={world.meshData}
        viewedUser={world.viewedUser}
        meshIsEmpty={world.meshIsEmpty}
        composeOpen={showCompose}
        traveling={traveling}
        onRetry={() => router.refresh()}
        onCompose={() => chrome.open("compose")}
      />

      {/* How to explore — first visit, and reopenable from Help & shortcuts. */}
      {chrome.isOpen("tips") && world.status === "ready" && (
        <MeshTipsCard isCoarsePointer={isCoarsePointer} onDismiss={chrome.dismissTips} />
      )}
      {chrome.isOpen("shortcuts") && (
        <MeshShortcutsSheet
          isCoarsePointer={isCoarsePointer}
          onShowTips={chrome.reopenTips}
          onClose={() => chrome.close("shortcuts")}
        />
      )}

      {/* The ONE mesh search — on-mesh nodes + "Across mesh.me" discovery. */}
      {chrome.isOpen("search") && (
        <MeshSearchOverlay
          rtRef={rtRef}
          model={world.model}
          placeholder={copy.searchPlaceholder}
          onJump={(node) => {
            chrome.close("search");
            input.jumpToNode(node);
          }}
          onVisitUser={(id) => {
            chrome.close("search");
            router.push(`/mesh?user=${encodeURIComponent(id)}`);
          }}
          onClose={() => chrome.close("search")}
        />
      )}

      {/* Content lens — consume posts & activity right on the mesh. */}
      {isContentSelection && (
        <ContentLens
          key={selectedNode.id}
          node={selectedNode}
          list={lensList}
          viewer={viewer}
          streamLabel={tourIds ? "new since your last visit" : copy.streamLabel}
          catchup={catchup}
          onHearted={(node) => emitHeart(rtRef.current, isOwnMesh, node)}
          onClose={closeSelection}
          onNavigate={(dir) => {
            // Manual browsing means "my pace now" — pause the auto-advance.
            catchup?.onInteract();
            input.navigateContent(dir);
          }}
        />
      )}

      {/* Detail sheet — people, platforms, communities, interests. */}
      {isDetailSelection && (
        <NodeDetail
          node={selectedNode}
          viewer={viewer}
          onClose={clearSelectionOnly}
          onEnterMesh={input.enterFriendMesh}
          onMuteChanged={() => void world.loadScene({ quiet: true })}
        />
      )}

      {/* Pluck radial ring — the long-press quick-action layer. DOM overlay
          over the canvas; the canvas only performs the spring stretch. */}
      {pluck && (
        <MeshPluckRing
          node={pluck.node}
          viewer={viewer}
          anchor={pluck.anchor}
          onHearted={(node) => emitHeart(rtRef.current, isOwnMesh, node)}
          onMuted={() => void world.loadScene({ quiet: true })}
          onClose={() => setPluck(null)}
        />
      )}

      {/* Emote wheel — the radial picker for the room's bus verbs. Mounted
          only with broadcast capability (never in Global) and stacked under
          the one chrome manager like every overlay. */}
      {emote && canEmote && (
        <MeshEmoteWheel
          target={emote.node}
          anchor={emote.anchor}
          heldPointer={emote.held}
          onSend={(verb, target) => {
            return sendEmote(rtRef.current, isOwnMesh, verb, target);
          }}
          onClose={closeEmote}
        />
      )}

      {/* The one-time "Sound on?" opt-in — the mesh's fun sounds stay silent
          until the user explicitly says yes (persisted through the ONE
          existing sound preference; no second toggle). */}

      {/* The same world, as a list — the canvas's accessible twin. */}
      {chrome.isOpen("list") && world.status === "ready" && (
        <MeshListView
          model={world.model}
          copy={copy}
          onClose={() => chrome.close("list")}
          onOpen={(node) => {
            chrome.close("list");
            input.jumpToNode(node);
          }}
        />
      )}

      {/* Compose: post straight onto your constellation. Gated on the
          viewer's caps, not just world state — meshUser persists across an
          in-place switch to Global (same instance, props-only change), and
          Global is read-only in every layer. */}
      {showCompose && viewer.canPost && world.meshUser && (
        <MeshComposeModal
          meshUser={world.meshUser}
          onClose={() => chrome.close("compose")}
          onPostCreated={() => {
            chrome.close("compose");
            setActiveBranch("posts");
            void world.loadScene({ quiet: true });
          }}
        />
      )}
    </div>
  );
}
