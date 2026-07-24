// Status gates over the mesh canvas: loading, error, the private-mesh gate
// (now with the inline Follow the copy always promised), and the empty-mesh
// hint. Extracted from the old mesh-scene.tsx; copy semantics unchanged. The
// gate never shows anything beyond the identity fields the server already
// returned for the locked state, plus the viewer's OWN follow edge (fetched
// to seed the Follow button — never owner data).

"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { getViewerFollowsUser, toggleFollow } from "@/lib/actions";
import { MeshiLoader } from "@/components/meshi/meshi-loader";
import { MeshFormingLoader } from "../scene/mesh-forming-loader";
import type { MeshApiResponse } from "../core/domain";
import type { ViewerCaps } from "../core/viewer";

/** The one gate switch: loading / error / private / empty-hint, plus the
 * travel veil — everything full-screen that sits between the viewer and a
 * ready world. */
export function MeshGates({
  status,
  viewer,
  viewUserId,
  meshData,
  viewedUser,
  meshIsEmpty,
  composeOpen,
  traveling,
  onRetry,
  onCompose,
}: {
  status: "loading" | "ready" | "error" | "private";
  viewer: ViewerCaps;
  viewUserId?: string;
  meshData: MeshApiResponse | null;
  viewedUser: { username: string; displayName: string | null } | null;
  meshIsEmpty: boolean;
  composeOpen: boolean;
  traveling: { label: string } | null;
  onRetry: () => void;
  onCompose: () => void;
}) {
  return (
    <>
      {status === "loading" && <MeshLoadingGate viewUserId={viewUserId} isGlobal={viewer.isGlobal} />}
      {status === "error" && <MeshErrorGate onRetry={onRetry} />}
      {status === "private" && <MeshPrivateGate meshData={meshData} viewer={viewer} />}
      {status === "ready" && meshIsEmpty && !composeOpen && (
        <MeshEmptyHint viewer={viewer} viewedUser={viewedUser} onCompose={onCompose} />
      )}
      {/* Travel dive — the veil rises as the camera plunges into their node. */}
      {traveling && (
        <div className="pointer-events-none absolute inset-0 z-[70] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(110,139,255,0.32),rgba(4,5,12,0.97)_72%)]"
            style={{ animation: "meshTravelVeil .72s ease-in forwards" }}
          />
          <p className="relative text-sm font-semibold tracking-wide text-white" style={{ animation: "meshTravelText .72s ease-in forwards" }}>
            Entering {traveling.label}&apos;s mesh…
          </p>
        </div>
      )}
    </>
  );
}

function MeshLoadingGate({ viewUserId, isGlobal }: { viewUserId?: string; isGlobal: boolean }) {
  return (
    <div className="absolute inset-0 z-40 overflow-hidden bg-[#04050c]">
      {/* The constellation weaves itself into being behind Meshi, so the
          loader dissolves straight into the real scene it precedes. */}
      <MeshFormingLoader backdrop className="opacity-80" />
      <MeshiLoader
        title={viewUserId ? "Opening their world…" : isGlobal ? "Weaving the Global Mesh…" : "Weaving your world…"}
        mode="mesh-building"
        transparent
      />
    </div>
  );
}

function MeshErrorGate({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[#04050c] text-center">
      <p className="text-sm text-white/70">Your mesh couldn&apos;t be reached.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mesh-glass mesh-ctl ds-focus-ring rounded-full px-4 py-2 text-xs text-white"
      >
        Try again
      </button>
    </div>
  );
}

function MeshPrivateGate({
  meshData,
  viewer,
}: {
  meshData: MeshApiResponse | null;
  viewer: ViewerCaps;
}) {
  const user = meshData?.user ?? null;
  // Inline Follow-to-request: the gate says "Follow each other and their
  // world opens up to you" — so let the viewer act on it right here. The
  // server authorizes the follow (guards blocks/self/guests); the mesh still
  // only opens once the follow is mutual, so no owner data leaks pre-follow.
  //
  // The locked payload carries no viewer-follow state, and toggleFollow is a
  // true toggle — so we MUST seed the real state first. A viewer already
  // following one-way (exactly the "waiting for them" state this gate
  // renders for) would otherwise see "Follow", click, and silently DELETE
  // their follow. `null` = unknown; the button stays inert until seeded.
  const [following, setFollowing] = useState<boolean | null>(null);
  const [, startFollow] = useTransition();
  const canFollowOwner = !viewer.isGlobal && !!user?.id;
  const userId = user?.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void getViewerFollowsUser(userId)
      .then((res) => {
        if (!cancelled) setFollowing(Boolean(res?.following));
      })
      .catch(() => {
        // Leave `following` unknown — better an inert button than a
        // mis-seeded toggle that unfollows on first click.
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const onFollow = () => {
    if (!user?.id || following === null) return;
    const next = !following;
    setFollowing(next); // optimistic
    startFollow(async () => {
      const res = await toggleFollow(user.id);
      if (res && "error" in res && res.error) setFollowing(!next);
      else if (res && "following" in res) setFollowing(res.following ?? next);
    });
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-[#04050c] px-6 text-center">
      {user?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover ring-2 ring-white/15" />
      ) : (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-xl font-bold text-white">
          {(user?.displayName || user?.username || "?").slice(0, 1).toUpperCase()}
        </span>
      )}
      <div>
        <p className="text-base font-semibold text-white">
          {user?.displayName || `@${user?.username}`}&apos;s mesh is private
        </p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-white/55">
          Follow each other and their world opens up to you.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {canFollowOwner && (
          <button
            type="button"
            onClick={onFollow}
            disabled={following === null}
            aria-pressed={following === true}
            className={`mesh-bubble-btn ds-focus-ring rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60 ${
              following ? "mesh-glass mesh-ctl text-white" : "mesh-cta"
            }`}
          >
            {following ? "Following — waiting for them" : `Follow @${user?.username}`}
          </button>
        )}
        <Link
          href={`/profile/${user?.username}`}
          className="mesh-bubble-btn rounded-full bg-white px-5 py-2 text-sm font-bold text-black hover:bg-white/90"
        >
          View profile
        </Link>
        <Link
          href="/mesh"
          className="mesh-bubble-btn mesh-cta ds-focus-ring rounded-full px-5 py-2 text-sm font-semibold"
        >
          Back to my mesh
        </Link>
      </div>
    </div>
  );
}

function MeshEmptyHint({
  viewer,
  viewedUser,
  onCompose,
}: {
  viewer: ViewerCaps;
  viewedUser: { username: string; displayName: string | null } | null;
  onCompose: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-8 z-30 flex justify-center px-6">
      <div className="mesh-glass pointer-events-auto flex max-w-sm flex-col items-center gap-2.5 rounded-2xl px-5 py-4 text-center">
        <p className="text-sm text-white/80">
          {viewedUser
            ? `This mesh is just ${viewedUser.displayName || "@" + viewedUser.username} for now.`
            : viewer.isGlobal
              ? "The Global Mesh is quiet right now."
              : "Your mesh is just you for now."}
        </p>
        {viewer.isOwner && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onCompose}
              className="mesh-bubble-btn rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white"
            >
              Create your first post
            </button>
            <Link
              href="/connected-accounts"
              className="mesh-bubble-btn mesh-glass mesh-ctl ds-focus-ring rounded-full px-4 py-2 text-xs font-medium text-white/85"
            >
              Connect accounts
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
