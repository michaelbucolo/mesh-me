"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ChevronsDown, Sparkles, X } from "lucide-react";
import { PostCard } from "@/components/feed/post-card";

type ReelPost = {
  id: string;
  content: string;
  createdAt: Date | string;
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; isVerified: boolean };
  community?: { id: string; name: string; slug: string } | null;
  media: { id: string; url: string; type: string }[];
  tags: { id: string; tag: string }[];
  _count: { comments: number; reactions: number; reposts: number };
  reactions?: { id: string }[];
  savedBy?: { id: string }[];
  platform?: string;
  sourceId?: string;
};

type FlowReelsProps = {
  posts: ReelPost[];
  startId: string | null;
  currentUserId: string;
  connectedPlatforms: string[];
  hasMore: boolean;
  loadingMore: boolean;
  onClose: () => void;
  onLoadMore: () => void;
};

const subscribeNoop = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

// Posts related to the anchor: same author, shared community, or overlapping tags.
function relatedTo(anchor: ReelPost, all: ReelPost[]): ReelPost[] {
  const anchorTags = new Set(anchor.tags.map((tag) => tag.tag.toLowerCase()));
  const scored = all
    .filter((post) => post.id !== anchor.id)
    .map((post) => {
      let score = 0;
      if (post.author.id === anchor.author.id) score += 3;
      if (anchor.community && post.community?.id === anchor.community.id) score += 2;
      for (const tag of post.tags) {
        if (anchorTags.has(tag.tag.toLowerCase())) score += 1;
      }
      return { post, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((entry) => entry.post);
  return scored;
}

// The platform's loading motif: a sparkle with a brand mote orbiting it — on
// brand where a spinner used to be. Framer degrades it to a calm static
// sparkle under reduced motion.
function OrbitSparkle({ size = 16 }: { size?: number }) {
  const box = size + 8;
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: box, height: box }} aria-hidden>
      <motion.span className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 2.2, ease: "linear", repeat: Infinity }}>
        <span className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 rounded-full" style={{ background: "var(--mesh-cyan)", boxShadow: "0 0 6px var(--mesh-cyan)" }} />
      </motion.span>
      <Sparkles size={size} className="text-[var(--accent)]" style={{ filter: "drop-shadow(0 0 3px var(--accent))" }} />
    </span>
  );
}

export function FlowReels({
  posts,
  startId,
  currentUserId,
  connectedPlatforms,
  hasMore,
  loadingMore,
  onClose,
  onLoadMore,
}: FlowReelsProps) {
  const verticalRef = useRef<HTMLDivElement | null>(null);
  const laneRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(startId ?? posts[0]?.id ?? null);
  const [activeHasRelated, setActiveHasRelated] = useState(false);
  const mounted = useSyncExternalStore(subscribeNoop, getTrue, getFalse);
  const reduce = useReducedMotion();

  const relatedByPost = useMemo(() => {
    const map = new Map<string, ReelPost[]>();
    for (const post of posts) map.set(post.id, relatedTo(post, posts));
    return map;
  }, [posts]);

  // Scroll the chosen starting post into view on open.
  useEffect(() => {
    if (!startId || !mounted) return;
    const lane = laneRefs.current.get(startId);
    lane?.scrollIntoView({ block: "start" });
  }, [startId, mounted]);

  // Track which lane is centered (the active reel) + whether it has related content.
  useEffect(() => {
    const root = verticalRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const best = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        const id = (best?.target as HTMLElement | undefined)?.dataset.reelId;
        if (id) {
          setActiveId(id);
          setActiveHasRelated((relatedByPost.get(id)?.length ?? 0) > 0);
        }
      },
      { root, threshold: [0.5, 0.85] },
    );
    laneRefs.current.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [posts, relatedByPost, mounted]);

  // Pull more reels when the viewer nears the end of the stack.
  useEffect(() => {
    if (!activeId) return;
    const index = posts.findIndex((post) => post.id === activeId);
    if (hasMore && !loadingMore && index >= posts.length - 3) onLoadMore();
  }, [activeId, hasMore, loadingMore, onLoadMore, posts]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const setLaneRef = useCallback((id: string, node: HTMLElement | null) => {
    if (node) laneRefs.current.set(id, node);
    else laneRefs.current.delete(id);
  }, []);

  if (!mounted) return null;

  return createPortal(
    <motion.div
      className="flow-reels-overlay"
      role="dialog"
      aria-label="Immersive Flow"
      // Override the class's flat opacity fade; framer owns the reveal now.
      style={{ animation: "none" }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, clipPath: "circle(0% at 50% 62%)" }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, clipPath: "circle(150% at 50% 62%)" }}
      transition={reduce ? { duration: 0.2 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Brand glows bloom in behind the content (kept below the feed). */}
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: -1,
            background:
              "radial-gradient(60% 42% at 50% 0%, rgba(110, 139, 255, 0.22), transparent 60%), radial-gradient(52% 36% at 50% 100%, rgba(139, 92, 246, 0.16), transparent 62%)",
          }}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
        />
      )}
      <motion.button
        type="button"
        onClick={onClose}
        className="flow-reels-close"
        aria-label="Exit immersive Flow"
        // Let framer own the transform; keep only the class's background transition.
        style={{ transition: "background 0.15s ease" }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.8 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={reduce ? { duration: 0.2 } : { type: "spring", stiffness: 380, damping: 22, delay: 0.15 }}
        whileTap={{ scale: 0.92 }}
      >
        <X size={20} aria-hidden="true" />
      </motion.button>

      {posts.length === 0 ? (
        <div className="flex min-h-full flex-col items-center justify-center px-6 text-center">
          <p className="text-lg font-semibold text-[var(--text-primary)]">Nothing to flow through yet</p>
          <p className="mt-2 max-w-sm text-sm text-[var(--text-secondary)]">
            Connect an account or follow more meshes to find your next strand.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-tertiary)]"
          >
            Back to feed
          </button>
        </div>
      ) : (
        <div ref={verticalRef} className="flow-reels-vertical">
          {posts.map((post) => {
            const related = relatedByPost.get(post.id) ?? [];
            const lane = [post, ...related];
            return (
              <section
                key={post.id}
                ref={(node) => setLaneRef(post.id, node)}
                data-reel-id={post.id}
                className="flow-reels-lane"
              >
                <div className="flow-reels-horizontal">
                  {lane.map((item, index) => (
                    <article key={item.id} className="flow-reels-slide">
                      {index > 0 && (
                        <span className="flow-reels-related-tag">Related to @{post.author.username}</span>
                      )}
                      <div className="flow-reels-card">
                        <PostCard
                          post={item}
                          currentUserId={currentUserId}
                          connectedPlatforms={connectedPlatforms}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}

          {loadingMore && (
            <div className="flow-reels-loading" role="status">
              <OrbitSparkle size={16} />
            </div>
          )}
        </div>
      )}

      {posts.length > 0 && (
        <div className="flow-reels-hints" aria-hidden="true">
          <span className="flow-reels-hint">
            <ChevronsDown size={14} /> Swipe for more
          </span>
          {activeHasRelated && (
            <span className="flow-reels-hint">
              <ChevronLeft size={14} /> Related <ChevronRight size={14} />
            </span>
          )}
        </div>
      )}
    </motion.div>,
    document.body,
  );
}
