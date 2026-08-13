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

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ViewerCaps } from "../core/viewer";
import type { MeshCopy } from "./copy";
import { MeshModeTabs, MeshVisitingHeader } from "./mode-tabs";
import { MeshRail } from "./rail";
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
  | "emote";

export interface MeshChromeController {
  isOpen: (id: MeshLayerId) => boolean;
  /** True while a graceful layer is playing its exit — still mounted, leaving. */
  isClosing: (id: MeshLayerId) => boolean;
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

/** Layers that play a drawn exit before unmounting. Every close path — Escape
 * via closeTop, a scrim tap, a close key — funnels through close(), so putting
 * the grace HERE means no overlay has to reimplement it and no path can skip
 * it. The felt audit measured these three vanishing 30-40ms after Escape: the
 * entrance was choreographed and the exit was a hard unmount. Layers not in
 * this set keep the old instant close (they have no exit drawn, and holding
 * them mounted with nothing to show would just feel laggy). */
const GRACEFUL_LAYERS = new Set<MeshLayerId>(["search", "compose", "shortcuts"]);
/** Matches the 160ms exit animations (bubbleOut / fadeOut) plus a frame. */
const EXIT_MS = 170;

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

  // Graceful layers linger in the stack for EXIT_MS with `closing` set, so
  // their exit animation has something to play on. One timer per layer; a
  // reopen mid-exit cancels the pending removal.
  const [closingSet, setClosingSet] = useState<ReadonlySet<MeshLayerId>>(new Set());
  const closeTimersRef = useRef(new Map<MeshLayerId, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = closeTimersRef.current;
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  const open = useCallback((id: MeshLayerId) => {
    const pending = closeTimersRef.current.get(id);
    if (pending) {
      clearTimeout(pending);
      closeTimersRef.current.delete(id);
      setClosingSet((c) => {
        const next = new Set(c);
        next.delete(id);
        return next;
      });
    }
    setStack((s) => (s[s.length - 1] === id ? s : [...s.filter((x) => x !== id), id]));
  }, []);
  const close = useCallback((id: MeshLayerId) => {
    if (!GRACEFUL_LAYERS.has(id)) {
      setStack((s) => (s.includes(id) ? s.filter((x) => x !== id) : s));
      return;
    }
    if (closeTimersRef.current.has(id)) return; // already leaving
    if (!stackRef.current.includes(id)) return;
    setClosingSet((c) => new Set(c).add(id));
    closeTimersRef.current.set(
      id,
      setTimeout(() => {
        closeTimersRef.current.delete(id);
        setClosingSet((c) => {
          const next = new Set(c);
          next.delete(id);
          return next;
        });
        setStack((s) => s.filter((x) => x !== id));
      }, EXIT_MS),
    );
  }, []);
  const toggle = useCallback(
    (id: MeshLayerId) => {
      // A layer mid-exit is visually leaving: the intuitive toggle is "bring it
      // back", which open() does by cancelling the pending removal.
      if (closeTimersRef.current.has(id)) open(id);
      else if (stackRef.current.includes(id)) close(id);
      else open(id);
    },
    [open, close],
  );
  const isOpen = useCallback((id: MeshLayerId) => stack.includes(id), [stack]);
  const isClosing = useCallback((id: MeshLayerId) => closingSet.has(id), [closingSet]);

  const markTipsSeen = useCallback(() => {
    try {
      localStorage.setItem(TIPS_SEEN_KEY, "1");
    } catch {
      // Storage may be unavailable.
    }
  }, []);

  const closeTop = useCallback((): boolean => {
    // Skip layers already playing their exit — Escape pressed twice during the
    // 170ms grace should dismiss the NEXT layer down, not re-close a ghost.
    const live = stackRef.current.filter((id) => !closeTimersRef.current.has(id));
    const top = live[live.length - 1];
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

  return { isOpen, isClosing, open, close, toggle, closeTop, dismissTips, reopenTips };
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
        className="absolute left-1/2 top-32 z-30 flex items-center gap-1.5 rounded-full border border-cyan-300/40 bg-black/70 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur transition-colors hover:bg-black/80"
        style={{ animation: "chipBob 3.4s ease-in-out infinite" }}
      >
        <Sparkles size={13} className="text-cyan-200" />
        Catch up: {item.count === 1 ? "1 new thing" : `${item.count} new things`} since your last visit
      </button>
    );
  }
  if (item.kind === "weave") {
    // Something just wove itself into the mesh, live.
    return (
      <div
        key={item.key}
        className="pointer-events-none absolute left-1/2 top-32 z-30 flex items-center gap-1.5 rounded-full border border-emerald-300/35 bg-black/70 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur"
        style={{ animation: "meshWeaveToast 4s ease forwards" }}
      >
        <Sparkles size={13} className="text-emerald-200" />
        {item.count === 1 ? "Something new just arrived" : `${item.count} new things just arrived`}
      </div>
    );
  }
  // Someone just walked into your mesh.
  return (
    <div
      key={item.key}
      className="pointer-events-none absolute left-1/2 top-32 z-30 flex items-center gap-1.5 rounded-full border border-violet-300/35 bg-black/70 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur"
      style={{ animation: "meshWeaveToast 3.5s ease forwards" }}
    >
      {item.text}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MeshChrome — the persistent chrome group: tabs / visiting header / rail /
// marquee / rewind panel, all under the one stacking manager.
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
  chrome,
  onRewindInput,
  onBackToNow,
  navigate,
  onRecenter,
  onEmote,
}: {
  viewer: ViewerCaps;
  copy: MeshCopy;
  viewUserId?: string;
  viewedUser: { username: string; displayName: string | null } | null;
  canCompose: boolean;
  shareUsername: string | null;
  status: "loading" | "ready" | "error" | "private";
  oldestMoment: number | null;
  rewindAt: number | null;
  rewindValue: number;
  marquee: MarqueeItem | null;
  chrome: MeshChromeController;
  onRewindInput: (value: number) => void;
  onBackToNow: () => void;
  navigate: (href: string) => void;
  onRecenter: () => void;
  /** Open the emote wheel by the rail — only provided when the viewer may
   * broadcast presence (capability-derived; absent = no React button). */
  onEmote?: (anchor: { x: number; y: number }) => void;
}) {
  return (
    <>
      <MeshModeTabs
        show={!viewUserId}
        isGlobal={viewer.isGlobal}
        onMesh={() => navigate("/mesh")}
        onGlobal={() => navigate("/mesh?view=global")}
      />
      <MeshVisitingHeader viewedUser={viewedUser} onBack={() => navigate("/mesh")} />
      <MeshRail
        viewer={viewer}
        copy={copy}
        canCompose={canCompose}
        shareUsername={shareUsername}
        showRewind={oldestMoment != null}
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
      />
      {/* ONE top-center ambient message at a time. */}
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
