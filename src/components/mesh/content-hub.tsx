"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  Heart,
  MessageCircle,
  Eye,
  Share2,
  Loader2,
  AlertTriangle,
  PenLine,
  Check,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  BarChart3,
  Clock,
  Globe,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

// --- Types ---

interface PlatformPost {
  id: string;
  platformPostId: string;
  content?: string | null;
  title?: string | null;
  url?: string | null;
  postType: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  visibility: string;
  publishedAt?: string | null;
  thumbnailUrl?: string | null;
  isPinned?: boolean;
  connectedAccount: {
    platform: string;
    platformUsername?: string | null;
  };
}

interface ContentHubProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteSuccess?: () => void;
}

// --- Constants ---

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  youtube: "#FF0000",
  tiktok: "#69C9D0",
  twitter: "#1DA1F2",
  twitch: "#9146FF",
  spotify: "#1DB954",
  soundcloud: "#FF5500",
  linkedin: "#0A66C2",
  github: "#8B5CF6",
  discord: "#5865F2",
  snapchat: "#FFFC00",
  pinterest: "#E60023",
  reddit: "#FF4500",
  facebook: "#1877F2",
  threads: "#ffffff",
  bluesky: "#0085FF",
};

const PLATFORM_ICONS: Record<string, string> = {
  instagram: "IG",
  youtube: "YT",
  tiktok: "TT",
  twitter: "X",
  twitch: "TW",
  spotify: "SP",
  soundcloud: "SC",
  linkedin: "LI",
  github: "GH",
  discord: "DC",
  snapchat: "SN",
  pinterest: "PI",
  reddit: "RD",
  facebook: "FB",
  threads: "TH",
  bluesky: "BS",
};

function PostTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "image":
    case "photo":
    case "carousel":
      return <ImageIcon className="h-3 w-3" />;
    case "video":
    case "reel":
    case "short":
    case "story":
      return <Video className="h-3 w-3" />;
    case "audio":
    case "track":
    case "podcast":
      return <Music className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins + "m ago";
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  const days = Math.floor(hrs / 24);
  if (days < 30) return days + "d ago";
  const months = Math.floor(days / 30);
  if (months < 12) return months + "mo ago";
  return Math.floor(months / 12) + "y ago";
}

// --- Component ---

export function ContentHub({ isOpen, onClose, onDeleteSuccess }: ContentHubProps) {
  const [posts, setPosts] = useState<PlatformPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [analytics, setAnalytics] = useState<Record<string, number> | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (platformFilter !== "all") params.set("platform", platformFilter);
      if (typeFilter !== "all") params.set("postType", typeFilter);

      const res = await fetch("/api/platform-content?" + params.toString());
      if (!res.ok) throw new Error("Failed to load content");
      const data = await res.json();
      setPosts(data.posts || []);
      setTotal(data.total || 0);
    } catch {
      setError("Could not load your content. Try again.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [page, platformFilter, typeFilter]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch("/api/platform-content?view=analytics");
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics || null);
      }
    } catch {
      // Analytics are non-critical
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchPosts();
      fetchAnalytics();
    }
  }, [isOpen, fetchPosts, fetchAnalytics]);

  const handleDelete = async (postId: string) => {
    setDeletingId(postId);
    try {
      const res = await fetch("/api/platform-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", postId }),
      });
      if (!res.ok) throw new Error("Delete failed");
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setTotal((prev) => prev - 1);
      setDeleteConfirm(null);
      onDeleteSuccess?.();
    } catch {
      setError("Failed to delete. Try again.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditSave = async (postId: string) => {
    setEditSaving(true);
    try {
      // Platform content edit — update locally for now
      // In production this would call the platform's API
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId ? { ...p, content: editContent } : p
        )
      );
      setEditingId(null);
      setEditContent("");
    } catch {
      setError("Failed to save edit.");
    } finally {
      setEditSaving(false);
    }
  };

  const filteredPosts = posts.filter((p) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchContent = p.content?.toLowerCase().includes(q);
      const matchTitle = p.title?.toLowerCase().includes(q);
      const matchPlatform = p.connectedAccount.platform.toLowerCase().includes(q);
      if (!matchContent && !matchTitle && !matchPlatform) return false;
    }
    return true;
  });

  // Unique platforms from loaded posts
  const availablePlatforms = [...new Set(posts.map((p) => p.connectedAccount.platform))];

  return (
    <AnimatePresence>
      {isOpen && <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 32, stiffness: 350 }}
          className="absolute right-0 top-0 bottom-0 w-full max-w-lg bg-[var(--bg-primary)]/95 backdrop-blur-2xl border-l border-[var(--border-primary)] shadow-2xl shadow-black/40 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex-shrink-0 p-4 border-b border-[var(--border-primary)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-[var(--accent)]" />
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">Content Hub</h2>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {total} item{total !== 1 ? "s" : ""} across your digital footprint
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all duration-200 active:scale-90"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Analytics summary */}
            {analytics && (
              <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-hide">
                {Object.entries(analytics).map(([key, val]) => (
                  <div
                    key={key}
                    className="flex-shrink-0 px-3 py-1.5 rounded-lg glass-surface text-[10px]"
                  >
                    <span className="text-[var(--text-muted)] capitalize">{key}</span>
                    <span className="ml-1 font-bold text-[var(--text-primary)]">{formatCount(val)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Search bar */}
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
                <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search your content..."
                  className="flex-1 text-xs bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={"p-2 rounded-xl transition-all border " + (
                  showFilters || platformFilter !== "all" || typeFilter !== "all"
                    ? "bg-[var(--accent)]/10 border-[var(--accent)]/30 text-[var(--accent)]"
                    : "border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                <Filter className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Filter pills */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-2">
                    {/* Platform filter */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider mr-1">Platform:</span>
                      <button
                        onClick={() => { setPlatformFilter("all"); setPage(1); }}
                        className={"px-2 py-1 rounded-lg text-[10px] font-medium transition-all border " + (
                          platformFilter === "all"
                            ? "bg-[var(--accent)]/15 border-[var(--accent)]/30 text-[var(--accent)]"
                            : "border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                        )}
                      >
                        All
                      </button>
                      {availablePlatforms.map((p) => (
                        <button
                          key={p}
                          onClick={() => { setPlatformFilter(p); setPage(1); }}
                          className={"px-2 py-1 rounded-lg text-[10px] font-medium transition-all border flex items-center gap-1 " + (
                            platformFilter === p
                              ? "bg-[var(--accent)]/15 border-[var(--accent)]/30 text-[var(--accent)]"
                              : "border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          )}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[p] || "#888" }} />
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Type filter */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider mr-1">Type:</span>
                      {["all", "text", "image", "video", "audio"].map((t) => (
                        <button
                          key={t}
                          onClick={() => { setTypeFilter(t); setPage(1); }}
                          className={"px-2 py-1 rounded-lg text-[10px] font-medium transition-all border " + (
                            typeFilter === t
                              ? "bg-[var(--accent)]/15 border-[var(--accent)]/30 text-[var(--accent)]"
                              : "border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                          )}
                        >
                          {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Content list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)] mx-auto mb-2" />
                  <p className="text-xs text-[var(--text-muted)]">Loading your content...</p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-center">
                  <AlertTriangle className="h-6 w-6 text-amber-400 mx-auto mb-2" />
                  <p className="text-xs text-[var(--text-muted)]">{error}</p>
                  <button
                    onClick={fetchPosts}
                    className="mt-2 text-[10px] text-[var(--accent)] hover:underline"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <div className="text-center px-6">
                  <BarChart3 className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-3 opacity-40" />
                  <p className="text-sm font-medium text-[var(--text-secondary)] mb-1">
                    {searchQuery ? "No results found" : "No content yet"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {searchQuery
                      ? "Try a different search term"
                      : "Connect your platforms and sync your content to see it here"
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-primary)]">
                {filteredPosts.map((post) => (
                  <ContentPostCard
                    key={post.id}
                    post={post}
                    isDeleting={deletingId === post.id}
                    isDeleteConfirm={deleteConfirm === post.id}
                    isEditing={editingId === post.id}
                    editContent={editContent}
                    editSaving={editSaving}
                    onDelete={() => handleDelete(post.id)}
                    onDeleteConfirm={() => setDeleteConfirm(post.id)}
                    onDeleteCancel={() => setDeleteConfirm(null)}
                    onEditStart={() => {
                      setEditingId(post.id);
                      setEditContent(post.content || post.title || "");
                    }}
                    onEditCancel={() => {
                      setEditingId(null);
                      setEditContent("");
                    }}
                    onEditSave={() => handleEditSave(post.id)}
                    onEditChange={setEditContent}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex-shrink-0 p-3 border-t border-[var(--border-primary)] flex items-center justify-between">
              <p className="text-[10px] text-[var(--text-muted)]">
                Page {page} of {Math.ceil(total / 20)}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-medium glass-surface text-[var(--text-secondary)] disabled:opacity-30 hover:bg-[var(--bg-tertiary)] transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * 20 >= total}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-medium glass-surface text-[var(--text-secondary)] disabled:opacity-30 hover:bg-[var(--bg-tertiary)] transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>}
    </AnimatePresence>
  );
}

// --- Post Card ---

interface ContentPostCardProps {
  post: PlatformPost;
  isDeleting: boolean;
  isDeleteConfirm: boolean;
  isEditing: boolean;
  editContent: string;
  editSaving: boolean;
  onDelete: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  onEditStart: () => void;
  onEditCancel: () => void;
  onEditSave: () => void;
  onEditChange: (val: string) => void;
}

function ContentPostCard({
  post,
  isDeleting,
  isDeleteConfirm,
  isEditing,
  editContent,
  editSaving,
  onDelete,
  onDeleteConfirm,
  onDeleteCancel,
  onEditStart,
  onEditCancel,
  onEditSave,
  onEditChange,
}: ContentPostCardProps) {
  const platform = post.connectedAccount.platform;
  const color = PLATFORM_COLORS[platform] || "#888";
  const icon = PLATFORM_ICONS[platform] || platform.charAt(0).toUpperCase();

  return (
    <div className="p-4 hover:bg-[var(--bg-hover)] transition-colors group">
      <div className="flex items-start gap-3">
        {/* Platform badge */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
          style={{ backgroundColor: color + "30", color }}
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Platform + time */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-semibold capitalize" style={{ color }}>
              {platform}
            </span>
            {post.connectedAccount.platformUsername && (
              <span className="text-[10px] text-[var(--text-muted)]">
                @{post.connectedAccount.platformUsername}
              </span>
            )}
            <div className="flex items-center gap-1 text-[9px] text-[var(--text-muted)] ml-auto">
              <PostTypeIcon type={post.postType} />
              <span className="capitalize">{post.postType}</span>
            </div>
          </div>

          {/* Post content / title */}
          {isEditing ? (
            <div className="mb-2">
              <textarea
                value={editContent}
                onChange={(e) => onEditChange(e.target.value)}
                className="w-full p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-focus)] text-xs text-[var(--text-primary)] resize-none outline-none focus:ring-1 focus:ring-[var(--accent)]"
                rows={3}
                autoFocus
              />
              <div className="flex gap-1.5 mt-1.5">
                <button
                  onClick={onEditSave}
                  disabled={editSaving}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium brand-button text-white transition-all active:scale-95"
                >
                  {editSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  Save
                </button>
                <button
                  onClick={onEditCancel}
                  className="px-2.5 py-1 rounded-lg text-[10px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {post.title && (
                <p className="text-xs font-semibold text-[var(--text-primary)] mb-0.5 line-clamp-1">
                  {post.title}
                </p>
              )}
              {post.content && (
                <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed mb-1.5">
                  {post.content}
                </p>
              )}
            </>
          )}

          {/* Thumbnail */}
          {post.thumbnailUrl && !isEditing && (
            <div className="mb-2 rounded-lg overflow-hidden w-full max-w-[200px] aspect-video bg-[var(--bg-tertiary)]">
              <img
                src={post.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Engagement stats */}
          <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
            {post.likeCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Heart className="h-2.5 w-2.5" /> {formatCount(post.likeCount)}
              </span>
            )}
            {post.commentCount > 0 && (
              <span className="flex items-center gap-0.5">
                <MessageCircle className="h-2.5 w-2.5" /> {formatCount(post.commentCount)}
              </span>
            )}
            {post.viewCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Eye className="h-2.5 w-2.5" /> {formatCount(post.viewCount)}
              </span>
            )}
            {post.shareCount > 0 && (
              <span className="flex items-center gap-0.5">
                <Share2 className="h-2.5 w-2.5" /> {formatCount(post.shareCount)}
              </span>
            )}
            {post.publishedAt && (
              <span className="flex items-center gap-0.5 ml-auto">
                <Clock className="h-2.5 w-2.5" /> {timeAgo(post.publishedAt)}
              </span>
            )}
          </div>

          {/* Actions */}
          {!isEditing && (
            <div className="flex items-center gap-1 mt-2.5 pt-2 border-t border-[var(--border-primary)]/50 opacity-0 group-hover:opacity-100 transition-all duration-300">
              <button
                onClick={onEditStart}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all"
              >
                <PenLine className="h-3 w-3" /> Edit
              </button>
              {post.url && (
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all"
                >
                  <ExternalLink className="h-3 w-3" /> Open
                </a>
              )}
              {isDeleteConfirm ? (
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-[10px] text-amber-400">Delete?</span>
                  <button
                    onClick={onDelete}
                    disabled={isDeleting}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all"
                  >
                    {isDeleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Yes
                  </button>
                  <button
                    onClick={onDeleteCancel}
                    className="px-2 py-1 rounded-lg text-[10px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] transition-all"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  onClick={onDeleteConfirm}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all ml-auto"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              )}
            </div>
          )}

          {/* Visibility + pinned badges */}
          <div className="flex items-center gap-1.5 mt-1.5">
            {post.visibility !== "public" && (
              <Badge variant="secondary" className="text-[8px] px-1.5 py-0 capitalize">{post.visibility}</Badge>
            )}
            {post.isPinned && (
              <Badge className="text-[8px] px-1.5 py-0 bg-amber-500/15 text-amber-400 border-amber-500/20">Pinned</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
