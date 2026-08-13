// NodeDetail — the bottom sheet / side card for person, platform, community
// and interest nodes. Extracted from the old mesh-scene.tsx; its share
// affordance rides the ONE useShare() flow, and its person actions now come
// from ViewerCaps (Follow was already owner-only; Message follows canDM so
// the read-only Global view offers no DM entry point). Source hubs (person /
// platform) on your own mesh also carry the Mute-source toggle — the
// viewer-side preference the pluck ring sets, and the only way back out.

"use client";

import Link from "next/link";
import { Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { getMeshiProvenance, toggleFollow, toggleMeshSourceMute } from "@/lib/actions";
import type { WornGiftLabel } from "@/lib/meshi-provenance";
import { meshNodeMuteKey } from "@/lib/muted-sources";
import type { ViewerCaps } from "../core/viewer";
import type { SceneNode } from "../scene/scene-model";
import { useShare } from "./use-share";

export function NodeDetail({
  node,
  viewer,
  onClose,
  onEnterMesh,
  onMuteChanged,
}: {
  node: SceneNode;
  // Follow only when the node's isFollowing is authoritative for the VIEWER —
  // i.e. on your own mesh (viewer.canFollow). On a visited/global mesh the
  // follow flags describe the mesh owner's ties, not yours, so we show
  // Enter / Message / Share / Profile only.
  viewer: ViewerCaps;
  onClose: () => void;
  onEnterMesh: (node: SceneNode) => void;
  /** Mute toggled — the scene quiet-reloads so content drops out / returns. */
  onMuteChanged?: () => void;
}) {
  const isPerson = node.kind === "person" && !!node.userId;
  const [following, setFollowing] = useState(!!node.isFollowing);
  const [, startFollow] = useTransition();
  const { copied: shareCopied, share } = useShare();

  // The stitched-in garment label: lazy, ambient, and server-adjudicated —
  // the action re-runs the profile-visibility fence itself, so this render
  // can only ever be as curious as the profile page. Nothing shows while
  // loading or on failure; the lines arrive or they don't. The answer is
  // keyed to the node it was fetched for, so switching nodes shows nothing
  // rather than someone else's labels.
  const [giftAnswer, setGiftAnswer] = useState<{ forUserId: string; labels: WornGiftLabel[] } | null>(null);
  useEffect(() => {
    if (!isPerson || !node.userId) return;
    const forUserId = node.userId;
    let alive = true;
    getMeshiProvenance(forUserId)
      .then((res) => {
        if (alive && res && Array.isArray(res.labels)) setGiftAnswer({ forUserId, labels: res.labels });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [isPerson, node.userId]);
  const giftLabels = giftAnswer && giftAnswer.forUserId === node.userId ? giftAnswer.labels : [];

  // Mute-source: own mesh only (ViewerCaps), person/platform hubs only.
  const muteKey =
    viewer.canMuteSources && (node.kind === "person" || node.kind === "platform")
      ? meshNodeMuteKey(node.id)
      : null;
  const [muted, setMuted] = useState(!!node.muted);
  const [, startMute] = useTransition();
  const onToggleMute = () => {
    if (!muteKey) return;
    const next = !muted;
    setMuted(next); // optimistic
    startMute(async () => {
      const res = await toggleMeshSourceMute(muteKey);
      if (res && "error" in res && res.error) setMuted(!next);
      else {
        if (res && "muted" in res && typeof res.muted === "boolean") setMuted(res.muted);
        onMuteChanged?.();
      }
    });
  };

  const onToggleFollow = () => {
    if (!node.userId) return;
    const next = !following;
    setFollowing(next); // optimistic
    startFollow(async () => {
      const res = await toggleFollow(node.userId!);
      // Server authorizes + guards blocks/self. Reconcile to its truth: revert on
      // error, otherwise take the authoritative follow state it returns.
      if (res && "error" in res && res.error) setFollowing(!next);
      else if (res && "following" in res) setFollowing(res.following ?? next);
    });
  };

  const onShare = () => {
    const url =
      node.href && typeof window !== "undefined"
        ? `${window.location.origin}${node.href}`
        : typeof window !== "undefined"
          ? window.location.href
          : "";
    share({
      title: node.label || "mesh.me",
      text: node.sublabel || node.label,
      url,
      dialogTitle: "Share profile",
    });
  };

  return (
    <div
      className="mesh-panel absolute inset-x-3 bottom-3 z-40 mx-auto max-w-md animate-[bubbleIn_.32s_cubic-bezier(0.22,1,0.36,1)] rounded-2xl p-4 shadow-2xl sm:inset-x-auto sm:right-3 sm:bottom-3 sm:w-80"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="flex items-start gap-3">
        {node.avatarUrl || node.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={(node.avatarUrl || node.imageUrl) as string}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <span
            className="h-12 w-12 shrink-0 rounded-xl"
            style={{ background: `radial-gradient(circle at 35% 30%, #ffffff55, ${node.color})` }}
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{node.label}</p>
          {node.sublabel && <p className="truncate text-xs text-[var(--text-tertiary)]">{node.sublabel}</p>}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="rounded-md p-1 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--paper-hover)] hover:text-[var(--text-primary)]"
        >
          <X size={16} />
        </button>
      </div>

      {node.placeReason && (
        <p className="mt-2.5 rounded-lg bg-[var(--paper-2)] px-2.5 py-1.5 text-micro leading-snug text-[var(--text-tertiary)]">
          {node.placeReason}
        </p>
      )}

      {muteKey && muted && (
        // THE SAME NOTE MATERIAL AS placeReason, four lines up — and it should
        // always have been, because it is the same kind of sentence.
        //
        // This was `bg-amber-400/[0.08]` under `text-amber-100/80`: raw Tailwind
        // palette, both halves translucent, so they composite twice and the ink
        // is pulled toward the very surface it is sitting on. Measured over the
        // .mesh-panel fill (--glass-card-bg -> --paper-1):
        //
        //     Daylight   #fffaed surface, #fef4cf ink      1.06:1
        //     Worklight  #2e291e surface, #d4cba5 ink      8.87:1
        //
        // One theme fine, the other unreadable — which is exactly what an
        // unmeasured pigment does, and why the range that first fixed this
        // called it "an unreadable pair". The wash was invisible in Daylight
        // too, so it was not even buying the warning colour it implied.
        //
        // And the colour was wrong on its own terms: amber says WARNING, while
        // "you muted this, only you can see it" is a plain statement of fact
        // about the viewer's own preference. Nothing is wrong; nothing needs
        // attention.
        //
        // --text-tertiary on --paper-2 is measured by the contrast gate in both
        // themes: 4.95:1 Daylight, 5.86:1 Worklight.
        <p className="mt-2.5 rounded-lg bg-[var(--paper-2)] px-2.5 py-1.5 text-micro leading-snug text-[var(--text-tertiary)]">
          Muted — this source&apos;s posts stay off your mesh and Flow. Only you can see this.
        </p>
      )}

      {node.content && <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-[var(--text-secondary)]">{node.content}</p>}

      {node.meta && node.meta.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {node.meta.map((m) => (
            <span key={m.label} className="rounded-lg bg-[var(--paper-2)] px-2.5 py-1 text-micro text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)]">{m.value}</span> {m.label}
            </span>
          ))}
        </div>
      )}

      {/* The garment label: informs, never sells — the same note material as
          placeReason above, no link, no price, no name. Month-year only. */}
      {giftLabels.length > 0 && (
        <div className="mt-2.5 rounded-lg bg-[var(--paper-2)] px-2.5 py-1.5">
          {giftLabels.length > 1 && <p className="mesh-eyebrow text-[var(--text-tertiary)]">Stitched in</p>}
          {giftLabels.map((line) => (
            <p key={line.label} className="text-micro leading-snug text-[var(--text-tertiary)]">
              {line.label} — a gift, {line.since}
            </p>
          ))}
        </div>
      )}

      {isPerson ? (
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => onEnterMesh(node)}
            className="mesh-bubble-btn mesh-cta ds-focus-ring w-full rounded-full py-2 text-xs font-semibold"
          >
            Enter their mesh
          </button>
          <div className="grid grid-cols-2 gap-2">
            {viewer.canFollow && (
              <button
                type="button"
                onClick={onToggleFollow}
                aria-pressed={following}
                className={`mesh-bubble-btn ds-focus-ring rounded-full py-2 text-xs font-semibold ${
                  following ? "mesh-glass mesh-ctl text-[var(--text-primary)]" : "mesh-cta"
                }`}
              >
                {following ? (node.isMutual ? "Friends" : "Following") : "Follow"}
              </button>
            )}
            {viewer.canDM && (
              <Link
                href={`/messages/${node.userId}?new=true`}
                className="mesh-bubble-btn mesh-glass mesh-ctl ds-focus-ring rounded-full py-2 text-center text-xs font-semibold text-[var(--text-primary)]"
              >
                Message
              </Link>
            )}
            <button
              type="button"
              onClick={onShare}
              className="mesh-bubble-btn mesh-glass mesh-ctl ds-focus-ring rounded-full py-2 text-xs font-semibold text-[var(--text-primary)]"
            >
              {shareCopied ? "Copied" : "Share"}
            </button>
            {node.href && (
              <Link
                href={node.href}
                className="mesh-bubble-btn mesh-glass mesh-ctl ds-focus-ring rounded-full py-2 text-center text-xs font-semibold text-[var(--text-primary)]"
              >
                Profile
              </Link>
            )}
            {muteKey && (
              <button
                type="button"
                onClick={onToggleMute}
                aria-pressed={muted}
                className="mesh-bubble-btn mesh-glass mesh-ctl ds-focus-ring col-span-2 flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold text-[var(--text-primary)]"
              >
                {muted ? <Volume2 size={13} /> : <VolumeX size={13} />}
                {muted ? "Unmute source" : "Mute source"}
              </button>
            )}
          </div>
        </div>
      ) : (
        (node.href || muteKey) && (
          <div className="mt-4 flex gap-2">
            {node.href && (
              <Link
                href={node.href}
                target={node.href.startsWith("http") ? "_blank" : undefined}
                className="mesh-bubble-btn mesh-glass mesh-ctl ds-focus-ring flex-1 rounded-full py-2 text-center text-xs font-semibold text-[var(--text-primary)]"
              >
                {node.kind === "post" ? "Open post" : node.kind === "platform" ? "Manage account" : "Open"}
              </Link>
            )}
            {muteKey && (
              <button
                type="button"
                onClick={onToggleMute}
                aria-pressed={muted}
                className="mesh-bubble-btn mesh-glass mesh-ctl ds-focus-ring flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-semibold text-[var(--text-primary)]"
              >
                {muted ? <Volume2 size={13} /> : <VolumeX size={13} />}
                {muted ? "Unmute source" : "Mute source"}
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}
