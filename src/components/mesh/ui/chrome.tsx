// MeshChrome — the mesh's ONE stacking manager.
//
// Two jobs:
//
// 1. LAYERED DISMISSAL. Every overlay (tips, search, compose, list,
//    shortcuts, rewind, and the selection-driven lens/detail) registers in
//    one ordered stack. Esc closes the TOPMOST layer only — never the old
//    close-everything sledgehammer. Tap-empty on the canvas keeps its floor
//    behavior (deselect) because full-screen overlays catch their own
//    backdrop taps above it.
//
// 2. THE MARQUEE. Top-center is ONE slot: a priority queue (catch-up chip >
//    weave toast > presence toast) so the three ambient signals can never
//    pile on top of each other or the Mesh/Global tabs again.
//
// It also owns the scene's global keyboard map (/, l, ?, +/-, 0/f, Esc) and
// the first-visit tips gate, so shortcuts and education live in one place.

"use client";

import { Sparkles, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BranchKey } from "../scene/scene-model";
import type { UnseenBranchCount } from "../scene/seen-marks";
import type { ViewerCaps } from "../core/viewer";
import type { MeshCopy } from "./copy";
import { MeshContextBar } from "./context-bar";
import { MeshDock } from "./dock";
import { MeshRewindPanel } from "./rewind-panel";

const TIPS_SEEN_KEY = "mesh-tips-seen";

type MeshLayerId =
  | "tips"
  | "search"
  | "compose"
  | "list"
  | "shortcuts"
  | "rewind"
  | "selection"
  | "emote"
  // The dock's two popovers. They live in the stack rather than in the dock's
  // own state for the reason this file exists: Esc must close the TOPMOST
  // layer, and a popover holding private state is not in that ordering — it
  // would either swallow every Esc or be skipped by all of them.
  | "dock-more"
  | "dock-new";

export interface MeshChromeController {
  isOpen: (id: MeshLayerId) => boolean;
  open: (id: MeshLayerId) => void;
  close: (id: MeshLayerId) => void;
  toggle: (id: MeshLayerId) => void;
  /** Close ONLY the topmost open layer. Returns false when nothing was open. */
  closeTop: () => boolean;
  /** Mark the first-visit tips as seen (persisted) and close them. */
  dismissTips: () => void;
  /** Reopen the welcome tips (from the shortcuts/help sheet). */
  reopenTips: () => void;
}

export function useMeshChrome(opts: {
  /** Close whatever the current selection drives (lens/detail) + any tour. */
  closeSelection: () => void;
  /** Leaving the rewind layer returns the world to now. */
  closeRewind: () => void;
  /** Close the emote wheel (its open state lives with the surface). */
  closeEmote?: () => void;
  zoomBy: (factor: number) => void;
  fitToContent: () => void;
}): MeshChromeController {
  const { closeSelection, closeRewind, closeEmote, zoomBy, fitToContent } = opts;
  // First visit: walk newcomers through how to explore the mesh — the tips
  // layer starts open until they've been seen once.
  const [stack, setStack] = useState<MeshLayerId[]>(() => {
    try {
      return localStorage.getItem(TIPS_SEEN_KEY) ? [] : ["tips"];
    } catch {
      // Storage may be unavailable; skip the intro.
      return [];
    }
  });
  const stackRef = useRef<MeshLayerId[]>([]);
  useEffect(() => {
    stackRef.current = stack;
  }, [stack]);

  const open = useCallback((id: MeshLayerId) => {
    setStack((s) => (s[s.length - 1] === id ? s : [...s.filter((x) => x !== id), id]));
  }, []);
  const close = useCallback((id: MeshLayerId) => {
    setStack((s) => (s.includes(id) ? s.filter((x) => x !== id) : s));
  }, []);
  const toggle = useCallback(
    (id: MeshLayerId) => {
      if (stackRef.current.includes(id)) close(id);
      else open(id);
    },
    [open, close],
  );
  const isOpen = useCallback((id: MeshLayerId) => stack.includes(id), [stack]);

  const markTipsSeen = useCallback(() => {
    try {
      localStorage.setItem(TIPS_SEEN_KEY, "1");
    } catch {
      // Storage may be unavailable.
    }
  }, []);

  const closeTop = useCallback((): boolean => {
    const top = stackRef.current[stackRef.current.length - 1];
    if (!top) return false;
    if (top === "selection") closeSelection();
    else if (top === "rewind") closeRewind();
    else if (top === "emote") closeEmote?.();
    else if (top === "tips") markTipsSeen();
    close(top);
    return true;
  }, [close, closeSelection, closeRewind, closeEmote, markTipsSeen]);

  const dismissTips = useCallback(() => {
    markTipsSeen();
    close("tips");
  }, [markTipsSeen, close]);

  const reopenTips = useCallback(() => {
    close("shortcuts");
    open("tips");
  }, [close, open]);

  // Keyboard shortcuts: / search, +/- zoom, 0/f fit, l list, ? shortcuts,
  // Escape closes ONE layer at a time (topmost — layered dismissal).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "Escape") {
        closeTop();
        return;
      }
      if (typing) return;
      if (e.key === "/") {
        e.preventDefault();
        open("search");
      } else if (e.key === "?") {
        e.preventDefault();
        toggle("shortcuts");
      } else if (e.key === "+" || e.key === "=") zoomBy(1.25);
      else if (e.key === "-") zoomBy(0.8);
      else if (e.key === "0" || e.key.toLowerCase() === "f") fitToContent();
      else if (e.key.toLowerCase() === "l") toggle("list");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toggle, closeTop, zoomBy, fitToContent]);

  return { isOpen, open, close, toggle, closeTop, dismissTips, reopenTips };
}

// ---------------------------------------------------------------------------
// The marquee — one top-center ambient slot.
// ---------------------------------------------------------------------------

export type MarqueeItem =
  | { kind: "catchup"; count: number; onStart: () => void }
  | { kind: "weave"; count: number; key: number }
  | { kind: "presence"; text: string; key: number };

/** Pick the single ambient message the marquee shows: catch-up chip beats the
 * weave toast beats the presence toast. */
export function pickMarqueeItem(items: {
  catchup: { count: number; onStart: () => void } | null;
  weave: { count: number; key: number } | null;
  presence: { text: string; key: number } | null;
}): MarqueeItem | null {
  if (items.catchup) return { kind: "catchup", ...items.catchup };
  if (items.weave) return { kind: "weave", ...items.weave };
  if (items.presence) return { kind: "presence", ...items.presence };
  return null;
}

/**
 * ONE LOOK FOR ALL THREE.
 *
 * These were `bg-cyan-400/10` + `border-cyan-300/30` + `text-cyan-100`, then
 * emerald, then violet — three raw Tailwind palette hues used as FILLS, on a
 * surface whose design system reserves pigment for ink and never for a fill.
 * Three ambient signals in three colours read as three unrelated systems all
 * shouting; the hue carried no meaning a person could learn, because you never
 * see two of them at once (this slot is a priority queue — that is its whole
 * point).
 *
 * So the hue is gone and the ICON carries the difference. Catch-up is a key,
 * because it is the only one you can press. The other two are `.plate` —
 * information, and information does not get a side wall.
 */
function MeshMarquee({ item }: { item: MarqueeItem | null }) {
  if (!item) return null;
  if (item.kind === "catchup") {
    // What arrived while you were away — one tap starts a flying tour
    // through it, right in the world.
    return (
      <button
        type="button"
        onClick={item.onStart}
        onPointerDown={(e) => e.stopPropagation()}
        className="mesh-marquee key ds-focus-ring absolute z-30 flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)]"
      >
        <Sparkles size={13} aria-hidden="true" />
        Catch up on {item.count === 1 ? "1 new thing" : `${item.count} new things`}
      </button>
    );
  }
  if (item.kind === "weave") {
    // Something just wove itself into the mesh, live.
    return (
      <div
        key={item.key}
        role="status"
        className="mesh-marquee plate pointer-events-none absolute z-30 flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)]"
        style={{ animation: "meshWeaveToast 4s ease forwards" }}
      >
        <Sparkles size={13} aria-hidden="true" />
        {item.count === 1 ? "Something new just arrived" : `${item.count} new things just arrived`}
      </div>
    );
  }
  // Someone just walked into your mesh.
  return (
    <div
      key={item.key}
      role="status"
      className="mesh-marquee plate pointer-events-none absolute z-30 flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)]"
      style={{ animation: "meshWeaveToast 3.5s ease forwards" }}
    >
      <UserRound size={13} aria-hidden="true" />
      {item.text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MeshChrome — the persistent chrome group. TWO objects: the context bar
// top-left (where am I) and the dock bottom-right (what can I do), plus the
// marquee slot beneath the context bar and the rewind panel. It used to be
// seven anchor points; scripts/mesh-chrome-check.ts keeps it from regrowing.
// ---------------------------------------------------------------------------

export function MeshChrome({
  viewer,
  copy,
  viewUserId,
  viewedUser,
  canCompose,
  shareUsername,
  status,
  oldestMoment,
  rewindAt,
  rewindValue,
  marquee,
  unseen,
  chrome,
  onRewindInput,
  onBackToNow,
  navigate,
  onRecenter,
  onEmote,
  onFocusBranch,
  onMarkSeen,
}: {
  viewer: ViewerCaps;
  copy: MeshCopy;
  viewUserId?: string;
  viewedUser: { username: string; displayName: string | null; avatarUrl?: string | null } | null;
  canCompose: boolean;
  shareUsername: string | null;
  status: "loading" | "ready" | "error" | "private";
  oldestMoment: number | null;
  rewindAt: number | null;
  rewindValue: number;
  marquee: MarqueeItem | null;
  /** Unseen-per-branch, already gated by the caller to own-mesh + present
   *  time (marks are viewer-side, and Rewind's past has no "new"). */
  unseen: UnseenBranchCount[];
  chrome: MeshChromeController;
  onRewindInput: (value: number) => void;
  onBackToNow: () => void;
  navigate: (href: string) => void;
  onRecenter: () => void;
  /** Open the emote wheel from the dock — only provided when the viewer may
   * broadcast presence (capability-derived; absent = no React row). */
  onEmote?: (anchor: { x: number; y: number }) => void;
  onFocusBranch: (branch: BranchKey) => void;
  onMarkSeen: (branch: BranchKey) => void;
}) {
  return (
    <>
      <MeshContextBar
        show={!viewUserId}
        isGlobal={viewer.isGlobal}
        viewedUser={viewUserId ? viewedUser : null}
        onMesh={() => navigate("/mesh")}
        onGlobal={() => navigate("/mesh?view=global")}
        onBack={() => navigate("/mesh")}
      />
      <MeshDock
        viewer={viewer}
        copy={copy}
        canCompose={canCompose}
        shareUsername={shareUsername}
        showRewind={oldestMoment != null}
        unseen={unseen}
        moreOpen={chrome.isOpen("dock-more")}
        newOpen={chrome.isOpen("dock-new")}
        onToggleMore={() => {
          chrome.close("dock-new");
          chrome.toggle("dock-more");
        }}
        onToggleNew={() => {
          chrome.close("dock-more");
          chrome.toggle("dock-new");
        }}
        onCloseMore={() => chrome.close("dock-more")}
        onCloseNew={() => chrome.close("dock-new")}
        onCompose={() => chrome.open("compose")}
        onSearch={() => chrome.open("search")}
        onList={() => chrome.open("list")}
        onRewind={() => {
          if (chrome.isOpen("rewind")) {
            onBackToNow();
            chrome.close("rewind");
          } else {
            chrome.open("rewind");
          }
        }}
        onHelp={() => chrome.toggle("shortcuts")}
        onRecenter={onRecenter}
        onEmote={onEmote}
        onFocusBranch={onFocusBranch}
        onMarkSeen={onMarkSeen}
      />
      {/* ONE ambient message at a time, under the context bar. */}
      <MeshMarquee item={marquee} />
      {/* Rewind — drag through time and watch this world re-assemble. */}
      {chrome.isOpen("rewind") && oldestMoment != null && status === "ready" && (
        <MeshRewindPanel
          oldestMoment={oldestMoment}
          rewindAt={rewindAt}
          rewindValue={rewindValue}
          headingSubject={copy.rewindHeadingSubject}
          onInput={onRewindInput}
          onBackToNow={onBackToNow}
          onClose={() => {
            onBackToNow();
            chrome.close("rewind");
          }}
        />
      )}
    </>
  );
}
