// MeshiLayer — the DOM sprite layer over the canvas: your cursor Meshi, the
// owner's heart Meshi, remote visitors, departure fade-outs, the precise
// cursor reticle, and the hearts-in-flight host. Positions are written
// imperatively by the domSync phase (THE projection edge — sprites live in
// world coordinates; see live/meshi-machine); this component only mounts the
// elements and re-renders on roster/appearance changes.
//
// PR6: each remote visitor is a MEMOIZED component keyed on its stable
// roster entry (live/roster reuses the object while a person's appearance
// signature is unchanged), so one Meshi's mood or cosmetic change re-renders
// exactly that Meshi — never the whole room.

"use client";

import { memo, useCallback, useEffect, useState } from "react";
import {
  MeshiMascot,
  type MeshiAccessory,
  type MeshiBadge,
  type MeshiColor,
  type MeshiEyeStyle,
  type MeshiHair,
  type MeshiHat,
  type MeshiMood,
  type MeshiOutfit,
} from "@/components/meshi/meshi-mascot";
import type { MeshiPreferences } from "@/hooks/use-meshi-preferences";
import { GHOST_EVENT, readGhostMode } from "@/lib/ghost-mode";
import type { MeshApiResponse } from "../core/domain";
import type { LeavingMeshi, MeshRuntimeRef, RemotePresence } from "../scene/runtime";
import type { SceneNode } from "../scene/scene-model";

/** Rich hover preview — STILLS ONLY (the Lens is the only video surface). */
function HoverPreviewCard({ node }: { node: SceneNode }) {
  return (
    <div
      className="mesh-glass absolute left-1/2 top-full mt-1.5 w-max max-w-[16.5rem] -translate-x-1/2 animate-[fadeIn_.14s_ease] overflow-hidden rounded-xl text-center shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
      style={{ boxShadow: `0 12px 40px rgba(0,0,0,0.55), inset 0 2px 0 ${node.color || "var(--accent)"}` }}
    >
      <div className="px-3 py-2">
        <p className="truncate text-[11.5px] font-semibold text-white">{node.label}</p>
        {node.sublabel && <p className="truncate text-[10px] text-white/55">{node.sublabel}</p>}
        {node.kind === "person" && node.placeReason && (
          <p className="mt-0.5 text-[9.5px] leading-snug text-white/45">{node.placeReason}</p>
        )}
        {node.content && node.content !== node.label && (
          <p className="mt-1 line-clamp-2 text-left text-[10px] leading-snug text-white/75">{node.content}</p>
        )}
        {node.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.imageUrl} alt="" className="mt-1.5 h-20 w-full rounded-lg object-cover" />
        )}
        {node.meta && node.meta.length > 0 && (
          <div className="mt-1.5 flex flex-wrap justify-center gap-x-2.5 gap-y-0.5">
            {node.meta.map((m) => (
              <span key={m.label} className="text-[10px] text-white/55">
                <span className="font-semibold text-white/90">{m.value}</span> {m.label.toLowerCase()}
              </span>
            ))}
          </div>
        )}
      </div>
      <p className="border-t border-white/8 bg-white/[0.04] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/45">
        {node.kind === "person"
          ? "Click to visit their mesh"
          : node.kind === "post" && node.href?.startsWith("/feed/")
            ? "Click to open in the Flow"
            : "Click to open"}
      </p>
    </div>
  );
}

/** One remote visitor. Memoized: `p` keeps its identity while this person's
 * appearance signature is unchanged (live/roster), so one Meshi's motion or
 * mood never re-renders the rest of the room. Mounted invisible at the
 * centre — the very next domSync frame places it at its world spot. */
const RemoteMeshi = memo(function RemoteMeshi({
  p,
  arriving,
  register,
}: {
  p: RemotePresence;
  arriving: boolean;
  register: (userId: string, el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={(el) => register(p.userId, el)}
      className={`pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2${arriving ? " meshi-arrive" : ""}`}
      style={{ left: "50%", top: "50%", opacity: 0 }}
    >
      <div className="meshi-world-scale">
        {p.isPro && <span className="meshi-pro-aura" aria-hidden />}
        <MeshiMascot
          size={54}
          color={p.meshiColor as MeshiColor}
          hat={p.meshiHat as MeshiHat}
          hair={(p.meshiHair || "none") as MeshiHair}
          accessory={(p.meshiAccessory || "none") as MeshiAccessory}
          eyeStyle={(p.meshiEyeStyle || "regular") as MeshiEyeStyle}
          badge={(p.meshiBadge || "none") as MeshiBadge}
          outfit={(p.meshiOutfit || "none") as MeshiOutfit}
          mood={(p.meshiMood as MeshiMood) || "happy"}
          animate
          showGlow={false}
        />
      </div>
      <p className="mt-0.5 max-w-[5rem] truncate text-center text-[9px] font-medium text-white/70">
        @{p.username}
      </p>
      {arriving && <span className="meshi-arrive-ring" aria-hidden />}
    </div>
  );
});

export function MeshiLayer({
  rtRef,
  prefs,
  isOwnMesh,
  viewUserId,
  meshData,
  hoverNode,
  showCompose,
  behaviorMood,
  remotePresences,
  leavingMeshis,
  ownerLive,
  isCoarsePointer,
}: {
  rtRef: MeshRuntimeRef;
  prefs: MeshiPreferences;
  isOwnMesh: boolean;
  viewUserId?: string;
  meshData: MeshApiResponse | null;
  hoverNode: SceneNode | null;
  showCompose: boolean;
  behaviorMood: MeshiMood | null;
  remotePresences: RemotePresence[];
  leavingMeshis: LeavingMeshi[];
  ownerLive: boolean;
  isCoarsePointer: boolean;
}) {
  // Ghost Mode literally ghosts YOUR Meshi — pale, translucent, drifting —
  // so you can always see that you're browsing unseen.
  const [isGhosting, setIsGhosting] = useState(false);
  useEffect(() => {
    const read = () => setIsGhosting(readGhostMode());
    read();
    window.addEventListener(GHOST_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(GHOST_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  // One stable registrar for every remote Meshi element — stable so the
  // memoized visitors never re-render because of a new callback identity.
  const registerPresenceEl = useCallback(
    (userId: string, el: HTMLDivElement | null) => {
      if (el) rtRef.current.presenceEls.set(userId, el);
      else rtRef.current.presenceEls.delete(userId);
    },
    [rtRef],
  );

  // On your OWN mesh, the owner Meshi pinned at the heart already is you — so
  // don't ALSO render the pointer-following cursor Meshi, or there are two of
  // you. The cursor Meshi is for exploring: show it only when visiting someone
  // else's mesh, or as a fallback when there's no owner Meshi to stand in.
  const showCursorMeshi = prefs.enabled && (!isOwnMesh || !meshData?.meshiPreference);

  return (
    <>
      {/* Precise pointer marker — your exact cursor spot, instant, while your
          Meshi keeps its personality nearby. Also the anchor for the hover
          preview when no cursor Meshi is shown, so rich previews exist on any
          fine pointer regardless of the Meshi cosmetic. */}
      {!isCoarsePointer && (
        <div
          ref={(el) => {
            rtRef.current.cursorDotEl = el;
          }}
          className="mesh-cursor-dot"
          aria-hidden
        >
          {!showCursorMeshi && hoverNode && hoverNode.kind !== "self" && <HoverPreviewCard node={hoverNode} />}
        </div>
      )}

      {/* Hearts mid-flight from Meshis to the posts they just liked. */}
      <div
        ref={(el) => {
          rtRef.current.heartsEl = el;
        }}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[15]"
      />

      {/* Meshi — you, wandering the mesh. On desktop it ambles after your
          pointer; on touch it stays centered while the world moves beneath it.
          Shown when visiting another mesh (on your own mesh the owner Meshi
          at the heart is you, and it does the wandering instead). */}
      {showCursorMeshi && (
        <div
          ref={(el) => {
            rtRef.current.meshiCursorEl = el;
          }}
          className="pointer-events-none absolute left-0 top-0 z-20 opacity-0 transition-opacity duration-150"
        >
          <div className="meshi-world-scale">
            <div className={isGhosting ? "mesh-ghosted" : undefined}>
              <MeshiMascot
                size={54}
                color={prefs.color}
                hat={prefs.hat}
                mood={showCompose ? "thinking" : hoverNode ? "excited" : behaviorMood ?? prefs.face}
                hair={prefs.hair}
                accessory={prefs.accessory}
                eyeStyle={prefs.eye}
                badge={prefs.badge}
                outfit={prefs.outfit}
                prop="compass"
              />
            </div>
          </div>
          {hoverNode && hoverNode.kind !== "self" && <HoverPreviewCard node={hoverNode} />}
        </div>
      )}

      {/* The mesh owner's Meshi. Awake and roaming to their real position when
          they're here browsing their own mesh; curled up asleep with a soft
          "Zzz" at their home node when they're away (offline or exploring
          elsewhere), so a visited mesh shows whether its owner is in the room. */}
      {meshData?.meshiPreference && (() => {
        const m = meshData.meshiPreference;
        // The URL may address this mesh by username; presence always speaks in
        // ids, so compare against the resolved owner id from the payload.
        const ownerOnline = !viewUserId || ownerLive;
        return (
          <div
            ref={(el) => {
              rtRef.current.ownerMeshiEl = el;
            }}
            className="pointer-events-none absolute left-1/2 top-1/2 z-[6] -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <div className="meshi-world-scale">
              {meshData?.user.isMeshPro && ownerOnline && <span className="meshi-pro-aura" aria-hidden />}
              <div className={ownerOnline ? "mesh-owner-meshi is-online" : "mesh-owner-meshi is-asleep"}>
                {!ownerOnline && (
                  <>
                    <span className="mesh-owner-zzz">z</span>
                    <span className="mesh-owner-zzz">z</span>
                    <span className="mesh-owner-zzz">z</span>
                  </>
                )}
                <div className={isOwnMesh && isGhosting ? "mesh-ghosted" : undefined}>
                  <MeshiMascot
                    size={54}
                    color={(m.colorTheme || "blue") as MeshiColor}
                    hat={(m.hatStyle || "none") as MeshiHat}
                    hair={(m.hairStyle || "none") as MeshiHair}
                    accessory={(m.accessoryStyle || "none") as MeshiAccessory}
                    eyeStyle={(m.eyeStyle || "regular") as MeshiEyeStyle}
                    badge={(m.badgeStyle || "none") as MeshiBadge}
                    outfit={(m.outfitStyle || "none") as MeshiOutfit}
                    mood={
                      !ownerOnline
                        ? "sleepy"
                        : isOwnMesh && showCompose
                          ? "thinking"
                          : isOwnMesh && hoverNode
                            ? "excited"
                            : isOwnMesh && behaviorMood
                              ? behaviorMood
                              : ((m.faceStyle || "happy") as MeshiMood)
                    }
                    animate={ownerOnline}
                    showGlow={ownerOnline}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Other users' Meshis — visible only while they're viewing this same
          mesh. Each is memoized; the roster array only changes on membership/
          appearance changes, and unchanged members keep their object identity. */}
      {remotePresences.map((p) => {
        // Transient animation gate, recomputed per roster render by design —
        // the roster only re-renders on join/appearance changes, so the
        // wall-clock read here is what makes the arrive burst expire. The
        // sprite read is a seed, not a subscription (positions ride domSync).
        const joinedAt = rtRef.current.presence.sprites.get(p.userId)?.joinedAt ?? 0;
        // eslint-disable-next-line react-hooks/purity
        const arriving = joinedAt > 0 && Date.now() - joinedAt < 1100;
        return <RemoteMeshi key={p.userId} p={p} arriving={arriving} register={registerPresenceEl} />;
      })}

      {/* Departed visitors fade out right where they stood. */}
      {leavingMeshis.map((l) => (
        <div
          key={l.key}
          className="meshi-leave pointer-events-none absolute z-10"
          style={{ left: `${l.x}px`, top: `${l.y}px` }}
        >
          <div className="meshi-world-scale" style={{ ["--meshi-scale" as string]: l.s.toFixed(3) } as React.CSSProperties}>
            <MeshiMascot
              size={54}
              color={l.p.meshiColor as MeshiColor}
              hat={l.p.meshiHat as MeshiHat}
              hair={(l.p.meshiHair || "none") as MeshiHair}
              accessory={(l.p.meshiAccessory || "none") as MeshiAccessory}
              eyeStyle={(l.p.meshiEyeStyle || "regular") as MeshiEyeStyle}
              badge={(l.p.meshiBadge || "none") as MeshiBadge}
              outfit={(l.p.meshiOutfit || "none") as MeshiOutfit}
              mood="sleepy"
              animate={false}
              showGlow={false}
            />
          </div>
        </div>
      ))}
    </>
  );
}
