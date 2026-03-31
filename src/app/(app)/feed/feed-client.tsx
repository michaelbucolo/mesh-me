"use client";

import { useState, useEffect } from "react";
import { PostComposer } from "@/components/feed/post-composer";
import { PostCard } from "@/components/feed/post-card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  FileText, LayoutGrid, LayoutList, Smartphone, MessageSquare,
  SlidersHorizontal, ChevronDown, Link2, Globe,
} from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// Feed layout modes inspired by popular platforms
type FeedLayout = "timeline" | "grid" | "reels" | "compact" | "cards";

const LAYOUT_OPTIONS: { id: FeedLayout; label: string; icon: React.ElementType; description: string; inspired: string }[] = [
  { id: "timeline", label: "Timeline", icon: LayoutList, description: "Classic scrolling feed", inspired: "X / Twitter" },
  { id: "grid", label: "Grid", icon: LayoutGrid, description: "Visual grid layout", inspired: "Instagram" },
  { id: "reels", label: "Reels", icon: Smartphone, description: "Full-screen vertical scroll", inspired: "Instagram Reels / TikTok" },
  { id: "compact", label: "Compact", icon: MessageSquare, description: "Dense thread view", inspired: "Reddit" },
  { id: "cards", label: "Cards", icon: FileText, description: "Large card format", inspired: "Facebook" },
];

// Platform filter options
const PLATFORM_FILTERS = [
  { id: "all", label: "All", color: "#3b82f6" },
  { id: "meshme", label: "mesh.me", color: "#2d7ff9" },
  { id: "instagram", label: "Instagram", color: "#E4405F" },
  { id: "youtube", label: "YouTube", color: "#FF0000" },
  { id: "tiktok", label: "TikTok", color: "#000000" },
  { id: "twitter", label: "X", color: "#1DA1F2" },
  { id: "reddit", label: "Reddit", color: "#FF4500" },
  { id: "twitch", label: "Twitch", color: "#9146FF" },
  { id: "linkedin", label: "LinkedIn", color: "#0A66C2" },
];

interface FeedClientProps {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };
  initialPosts: Array<{
    id: string;
    content: string;
    createdAt: Date | string;
    author: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      isVerified: boolean;
    };
    community?: { id: string; name: string; slug: string } | null;
    media: { id: string; url: string; type: string }[];
    tags: { id: string; tag: string }[];
    _count: { comments: number; reactions: number; reposts: number };
    reactions?: { id: string }[];
    savedBy?: { id: string }[];
    isPinned?: boolean;
  }>;
}

export function FeedClient({ user, initialPosts }: FeedClientProps) {
  const [layout, setLayout] = useState<FeedLayout>("reels");
  const [showLayoutPicker, setShowLayoutPicker] = useState(false);
  const [platformFilter, setPlatformFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  // Load saved layout preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("meshFeedLayout");
      if (saved && LAYOUT_OPTIONS.some((l) => l.id === saved)) {
        setLayout(saved as FeedLayout);
      }
    } catch { /* ignore */ }
  }, []);

  // Save layout preference
  useEffect(() => {
    localStorage.setItem("meshFeedLayout", layout);
  }, [layout]);

  const posts = initialPosts;

  return (
    <div data-meshi-zone="feed" className="max-w-3xl mx-auto px-4 py-6 animate-page-enter">
      {/* Header with layout controls */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Feed</h1>
          <p className="text-xs text-[var(--text-muted)]">All your platforms, one beautiful feed</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Platform filter */}
          <div className="relative">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={"flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all " + (
                showFilters ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "glass-surface text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              {platformFilter === "all" ? "All platforms" : PLATFORM_FILTERS.find((p) => p.id === platformFilter)?.label}
              <ChevronDown className="h-3 w-3" />
            </button>
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-52 glass-dropdown rounded-xl shadow-xl z-30 py-1 overflow-hidden"
                >
                  {PLATFORM_FILTERS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setPlatformFilter(p.id); setShowFilters(false); }}
                      className={"w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left transition-all " + (
                        platformFilter === p.id
                          ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                          : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                      )}
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      {p.label}
                    </button>
                  ))}
                  <div className="border-t border-[var(--border-primary)] mt-1 pt-1">
                    <Link
                      href="/connected-accounts"
                      className="flex items-center gap-2.5 px-3 py-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all"
                    >
                      <Link2 className="h-3 w-3" /> Manage platforms
                    </Link>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Layout picker */}
          <div className="relative">
            <button
              onClick={() => setShowLayoutPicker(!showLayoutPicker)}
              className={"flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all " + (
                showLayoutPicker ? "bg-[var(--accent)]/10 text-[var(--accent)]" : "glass-surface text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{LAYOUT_OPTIONS.find((l) => l.id === layout)?.label}</span>
            </button>
            <AnimatePresence>
              {showLayoutPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  className="absolute right-0 top-full mt-1 w-64 glass-dropdown rounded-xl shadow-xl z-30 py-2 overflow-hidden"
                >
                  <p className="px-3 pb-1.5 text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Feed Layout</p>
                  {LAYOUT_OPTIONS.map((opt) => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => { setLayout(opt.id); setShowLayoutPicker(false); }}
                        className={"w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all " + (
                          layout === opt.id
                            ? "bg-[var(--accent)]/10 text-[var(--accent)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium">{opt.label}</p>
                          <p className="text-[10px] text-[var(--text-muted)]">{opt.description} · Inspired by {opt.inspired}</p>
                        </div>
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Composer */}
      <div className="mb-6">
        <PostComposer
          user={{
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          }}
        />
      </div>

      {/* Feed content — layout-dependent rendering */}
      {posts.length > 0 ? (
        <>
          {/* Timeline layout (X/Twitter style) */}
          {layout === "timeline" && (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={user.id} />
              ))}
            </div>
          )}

          {/* Grid layout (Instagram style) */}
          {layout === "grid" && (
            <div className="grid grid-cols-3 gap-1 rounded-xl overflow-hidden">
              {posts.map((post) => (
                <Link key={post.id} href={`/feed/${post.id}`}>
                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="aspect-square bg-[var(--bg-secondary)] relative group cursor-pointer overflow-hidden"
                  >
                    {post.media.length > 0 ? (
                      <img src={post.media[0].url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center p-3">
                        <p className="text-[11px] text-[var(--text-secondary)] text-center line-clamp-5 leading-relaxed">{post.content}</p>
                      </div>
                    )}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <span className="text-white text-xs font-medium flex items-center gap-1">❤️ {post._count.reactions}</span>
                      <span className="text-white text-xs font-medium flex items-center gap-1">💬 {post._count.comments}</span>
                    </div>
                  </motion.div>
                </Link>
              ))}
            </div>
          )}

          {/* Reels layout (TikTok/IG Reels style - full width snap-scroll cards) */}
          {layout === "reels" && (
            <div className="snap-y snap-mandatory overflow-y-auto h-[calc(100vh-10rem)] scrollbar-hide -mx-4 sm:-mx-0">
              {posts.map((post) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  className="relative bg-[var(--bg-secondary)] snap-start snap-always overflow-hidden border-b border-[var(--border-primary)] sm:rounded-2xl sm:border sm:mb-2"
                  style={{ minHeight: "calc(100vh - 10rem)" }}
                >
                  {post.media.length > 0 ? (
                    <img src={post.media[0].url} alt="" className="w-full h-full object-cover absolute inset-0" />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-secondary)] to-[var(--bg-tertiary)] flex items-center justify-center p-8">
                      <p className="text-lg text-[var(--text-primary)] text-center leading-relaxed font-medium">{post.content}</p>
                    </div>
                  )}
                  {/* Bottom overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 pt-16">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
                        {post.author.displayName[0]}
                      </div>
                      <div>
                        <p className="text-white text-sm font-semibold">{post.author.displayName}</p>
                        <p className="text-white/60 text-xs">@{post.author.username}</p>
                      </div>
                    </div>
                    {post.content && <p className="text-white/90 text-sm line-clamp-2">{post.content}</p>}
                  </div>
                  {/* Side action bar */}
                  <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4">
                    <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-all">
                      ❤️
                    </button>
                    <span className="text-white text-[10px]">{post._count.reactions}</span>
                    <button className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-all">
                      💬
                    </button>
                    <span className="text-white text-[10px]">{post._count.comments}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Compact layout (Reddit style) */}
          {layout === "compact" && (
            <div className="space-y-1">
              {posts.map((post) => (
                <Link key={post.id} href={`/feed/${post.id}`}>
                  <div className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-[var(--bg-tertiary)] transition-all cursor-pointer group">
                    {/* Vote column */}
                    <div className="flex flex-col items-center gap-0.5 text-[var(--text-muted)]">
                      <button className="hover:text-[var(--accent)] text-xs transition-colors">▲</button>
                      <span className="text-xs font-bold text-[var(--text-secondary)]">{post._count.reactions}</span>
                      <button className="hover:text-red-400 text-xs transition-colors">▼</button>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--text-primary)] line-clamp-2 group-hover:text-[var(--accent)] transition-colors">{post.content}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-[var(--text-muted)]">
                        <span>by {post.author.displayName}</span>
                        <span>·</span>
                        <span>{post._count.comments} comments</span>
                        {post.community && (
                          <>
                            <span>·</span>
                            <span className="text-[var(--accent)]">{post.community.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Thumbnail */}
                    {post.media.length > 0 && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={post.media[0].url} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Cards layout (Facebook style) */}
          {layout === "cards" && (
            <div className="space-y-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} currentUserId={user.id} />
              ))}
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={FileText}
          title="Your feed is empty"
          description="Follow people, join communities, and connect platforms to fill your feed with content from across the internet."
        >
          <div className="flex gap-3">
            <Link
              href="/explore"
              className="inline-flex brand-button text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all"
            >
              Explore the Mesh
            </Link>
            <Link
              href="/connected-accounts"
              className="inline-flex glass-surface text-[var(--text-secondary)] px-6 py-2.5 rounded-xl text-sm font-medium transition-all hover:text-[var(--text-primary)]"
            >
              Connect Platforms
            </Link>
          </div>
        </EmptyState>
      )}
    </div>
  );
}
