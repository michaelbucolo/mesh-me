// Mesh/Global mode tabs + the top-left visiting cluster (back button, owner
// label, profile link). Extracted verbatim from the old mesh-scene.tsx.

"use client";

import { ArrowLeft, UserRound } from "lucide-react";
import Link from "next/link";

export function MeshModeTabs({
  show,
  isGlobal,
  onMesh,
  onGlobal,
}: {
  /** Shown only on your own mesh or the Global view — never when viewing a
   * specific person (that owns the top-left with its Back button). */
  show: boolean;
  isGlobal: boolean;
  onMesh: () => void;
  onGlobal: () => void;
}) {
  if (!show) return null;
  // URL-driven (router.push, not local state) so the load keys off the prop,
  // the prefetch keeps URL parity, and back/refresh behave.
  return (
    <div className="mesh-glass absolute left-1/2 top-20 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full p-1">
      <button
        type="button"
        onClick={onMesh}
        aria-pressed={!isGlobal}
        className={`mesh-ctl ds-focus-ring rounded-full border border-transparent px-4 py-2 text-xs font-semibold ${!isGlobal ? "mesh-ctl-active" : ""}`}
      >
        Mesh
      </button>
      <button
        type="button"
        onClick={onGlobal}
        aria-pressed={isGlobal}
        className={`mesh-ctl ds-focus-ring rounded-full border border-transparent px-4 py-2 text-xs font-semibold ${isGlobal ? "mesh-ctl-active" : ""}`}
      >
        Global
      </button>
    </div>
  );
}

export function MeshVisitingHeader({
  viewedUser,
  onBack,
}: {
  viewedUser: { username: string; displayName: string | null } | null;
  onBack: () => void;
}) {
  if (!viewedUser) return null;
  return (
    <div className="absolute left-3 top-20 z-30 flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        className="mesh-glass mesh-ctl ds-focus-ring flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-white"
      >
        <ArrowLeft size={14} />
        Back to your mesh
      </button>
      <span className="mesh-glass rounded-full px-3 py-2 text-xs text-white/80">
        {viewedUser.displayName || "@" + viewedUser.username}&apos;s mesh
      </span>
      <Link
        href={`/profile/${viewedUser.username}`}
        className="mesh-glass mesh-ctl ds-focus-ring flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-white"
      >
        <UserRound size={14} aria-hidden="true" />
        View profile
      </Link>
    </div>
  );
}
