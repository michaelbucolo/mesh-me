// The pluck radial ring — the quick-action layer a long-press opens over a
// content node: Like / Save / Share / Mute source, arranged around the node.
//
// DOM overlay, never canvas: the frame loop only performs the cosmetic spring
// stretch (sim/toys.ts); this component is plain React over the world.
// The gesture completes two ways:
//   - keep holding, drag onto an action, RELEASE ON IT → the action fires;
//   - release near the node → the ring stays for a follow-up tap;
//   - release (or tap) anywhere else → dismiss, nothing happens.
//
// Actions derive from ViewerCaps: Global read-only gets no Like/Save (no
// writes of any kind), Mute-source exists only on the viewer's own mesh, and
// Like/Save only exist for native posts (the seen-bridge's nativePostId is
// the single authority on what "native" means). Reduced motion: the ring
// appears instantly (Tailwind's motion-reduce strips the pop-in).

"use client";

import { Bookmark, Check, Heart, Share2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toggleMeshSourceMute, toggleReaction, toggleSavePost } from "@/lib/actions";
import { meshNodeMuteKey } from "@/lib/muted-sources";
import type { ViewerCaps } from "../core/viewer";
import type { SceneNode } from "../scene/scene-model";
import { nativePostId } from "./seen-bridge";
import { useShare } from "./use-share";

/** Distance from the anchor to each action button's centre (px). */
const RING_RADIUS = 84;
/** Releasing within this distance of the anchor keeps the ring open. */
const HOLD_ZONE = 56;

// Same check the heart/burst toys use: reduced motion means the ring appears
// INSTANTLY — no pop-in, no stagger (the spring stretch is skipped in
// sim/toys.ts by the runtime's reducedMotion flag).
function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

interface RingAction {
  id: "like" | "save" | "share" | "mute";
  label: string;
  icon: React.ReactNode;
  run: () => void;
}

export function MeshPluckRing({
  node,
  viewer,
  anchor,
  onHearted,
  onMuted,
  onClose,
}: {
  node: SceneNode;
  viewer: ViewerCaps;
  /** Screen position of the plucked node when the ring opened. */
  anchor: { x: number; y: number };
  /** A like fired — let the scene throw the visible heart. */
  onHearted: (node: SceneNode) => void;
  /** The source was muted — the scene quiet-reloads so it drops out. */
  onMuted: () => void;
  onClose: () => void;
}) {
  const postId = nativePostId(node);
  const muteKey = meshNodeMuteKey(node.id);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [, startAction] = useTransition();
  const { share } = useShare();

  // Confirm briefly at the centre, then let go of the whole ring.
  const confirmAndClose = useCallback((text: string) => setConfirmation(text), []);
  useEffect(() => {
    if (!confirmation) return;
    const timer = setTimeout(onClose, 700);
    return () => clearTimeout(timer);
  }, [confirmation, onClose]);

  const actions: RingAction[] = [];
  if (viewer.canLike && postId) {
    actions.push({
      id: "like",
      label: "Like",
      icon: <Heart size={17} />,
      run: () => {
        onHearted(node);
        startAction(async () => {
          await toggleReaction(postId);
        });
        confirmAndClose("Liked");
      },
    });
  }
  if (viewer.canSave && postId) {
    actions.push({
      id: "save",
      label: "Save",
      icon: <Bookmark size={17} />,
      run: () => {
        startAction(async () => {
          await toggleSavePost(postId);
        });
        confirmAndClose("Saved");
      },
    });
  }
  actions.push({
    id: "share",
    label: "Share",
    icon: <Share2 size={17} />,
    run: () => {
      const isExternal = Boolean(node.href && node.href.startsWith("http"));
      const url = isExternal
        ? node.href!
        : node.href
          ? `${window.location.origin}${node.href}`
          : window.location.href;
      share({
        title: node.label || "mesh.me",
        text: node.content ? node.content.slice(0, 160) : node.label,
        url,
        dialogTitle: "Share post",
      });
      onClose();
    },
  });
  if (viewer.canMuteSources && muteKey) {
    actions.push({
      id: "mute",
      label: "Mute",
      icon: <VolumeX size={17} />,
      run: () => {
        startAction(async () => {
          const res = await toggleMeshSourceMute(muteKey);
          if (res && "success" in res) onMuted();
        });
        confirmAndClose("Source muted");
      },
    });
  }

  // Resolve the INITIAL press's release exactly once: the still-held finger
  // lands here, since the canvas holds pointer capture and the ring never
  // receives that pointerup directly. Releasing over an action button clicks
  // it (release-on-action); near the node → the ring stays open for a
  // follow-up tap (normal clicks from here on); anywhere else → dismiss.
  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const actionButton = el?.closest?.("[data-ring-action]");
      if (actionButton instanceof HTMLElement) {
        actionButton.click();
        return;
      }
      if (Math.hypot(e.clientX - anchor.x, e.clientY - anchor.y) <= HOLD_ZONE) return;
      onClose();
    };
    window.addEventListener("pointerup", onUp, { once: true });
    return () => window.removeEventListener("pointerup", onUp);
  }, [anchor.x, anchor.y, onClose]);

  // Keep the whole ring on screen even for nodes plucked near an edge.
  const cx = typeof window !== "undefined"
    ? Math.max(RING_RADIUS + 34, Math.min(window.innerWidth - RING_RADIUS - 34, anchor.x))
    : anchor.x;
  const cy = typeof window !== "undefined"
    ? Math.max(RING_RADIUS + 88, Math.min(window.innerHeight - RING_RADIUS - 34, anchor.y))
    : anchor.y;

  // Fan the actions across the top arc, centred over the node.
  const spread = Math.min(Math.PI * 0.62, 0.62 * actions.length);
  const start = -Math.PI / 2 - spread / 2;
  const step = actions.length > 1 ? spread / (actions.length - 1) : 0;
  const reducedMotion = prefersReducedMotion();

  return (
    <div className="absolute inset-0 z-50" data-testid="mesh-pluck-ring">
      {/* Backdrop: a tap anywhere off the ring lets the node go. */}
      <button
        type="button"
        aria-label="Dismiss quick actions"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-transparent"
      />
      {confirmation ? (
        <span
          className="mesh-glass pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
          style={{ left: cx, top: cy, animation: reducedMotion ? undefined : "bubbleIn .18s ease" }}
        >
          <Check size={13} className="text-emerald-300" />
          {confirmation}
        </span>
      ) : (
        actions.map((action, i) => {
          const angle = start + step * i;
          const x = cx + Math.cos(angle) * RING_RADIUS;
          const y = cy + Math.sin(angle) * RING_RADIUS;
          return (
            <span
              key={action.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: x,
                top: y,
                animation: reducedMotion
                  ? undefined
                  : `bubbleIn .22s cubic-bezier(0.22,1,0.36,1) ${i * 30}ms backwards`,
              }}
            >
              <button
                type="button"
                data-ring-action={action.id}
                aria-label={
                  action.id === "mute" ? `Mute ${node.sublabel || "this source"}` : `${action.label} this post`
                }
                onPointerDown={(e) => e.stopPropagation()}
                onClick={action.run}
                className="mesh-glass mesh-ctl ds-focus-ring flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-full text-white/90 transition-transform hover:scale-110"
              >
                {action.icon}
                <span className="text-[8px] font-semibold uppercase tracking-wide text-white/60">
                  {action.label}
                </span>
              </button>
            </span>
          );
        })
      )}
    </div>
  );
}
