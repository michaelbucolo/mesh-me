"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatRelativeTime, formatCount } from "@/lib/utils";
import { Heart, MessageCircle, Repeat2, Bookmark, MoreHorizontal, Share2, Flag, Trash2, Pin, Copy, ExternalLink, Link2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useState, useTransition, useRef, useEffect } from "react";
import { toggleReaction, toggleSavePost, repost, deletePost } from "@/lib/actions";

// Platform colors for origin badges
const PLATFORM_BADGE: Record<string, { label: string; color: string; abbr: string }> = {
  instagram: { label: "Instagram", color: "#E4405F", abbr: "IG" },
  youtube: { label: "YouTube", color: "#FF0000", abbr: "YT" },
  tiktok: { label: "TikTok", color: "#69C9D0", abbr: "TT" },
  twitter: { label: "X", color: "#1DA1F2", abbr: "X" },
  twitch: { label: "Twitch", color: "#9146FF", abbr: "TW" },
  spotify: { label: "Spotify", color: "#1DB954", abbr: "SP" },
  linkedin: { label: "LinkedIn", color: "#0A66C2", abbr: "IN" },
  reddit: { label: "Reddit", color: "#FF4500", abbr: "RD" },
  facebook: { label: "Facebook", color: "#1877F2", abbr: "FB" },
  discord: { label: "Discord", color: "#5865F2", abbr: "DC" },
  meshme: { label: "mesh.me", color: "#2d7ff9", abbr: "M" },
};

interface PostCardProps {
  post: {
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
    platform?: string; // Origin platform (e.g. "instagram", "twitter", "meshme")
    crossPostedTo?: string[]; // Platforms this was cross-posted to
  };
  currentUserId?: string;
  compact?: boolean;
}

export function PostCard({ post, currentUserId, compact }: PostCardProps) {
  const [liked, setLiked] = useState(post.reactions && post.reactions.length > 0);
  const [likeCount, setLikeCount] = useState(post._count.reactions);
  const [saved, setSaved] = useState(post.savedBy && post.savedBy.length > 0);
  const [repostCount, setRepostCount] = useState(post._count.reposts);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [saveAnimating, setSaveAnimating] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false);
      if (shareRef.current && !shareRef.current.contains(event.target as Node)) setShowShareMenu(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLike = () => {
    if (!currentUserId) return;
    const newLiked = !liked;
    const previousLiked = liked;
    const previousCount = likeCount;

    setLiked(newLiked);
    setLikeCount((prev) => (newLiked ? prev + 1 : prev - 1));
    if (newLiked) {
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 400);
    }
    startTransition(async () => {
      const result = await toggleReaction(post.id);
      if (result && "error" in result) {
        setLiked(previousLiked);
        setLikeCount(previousCount);
      }
    });
  };

  const handleSave = () => {
    if (!currentUserId) return;
    const newSaved = !saved;
    const previousSaved = saved;
    setSaved(newSaved);
    if (newSaved) {
      setSaveAnimating(true);
      setTimeout(() => setSaveAnimating(false), 300);
    }
    startTransition(async () => {
      const result = await toggleSavePost(post.id);
      if (result && "error" in result) {
        setSaved(previousSaved);
      }
    });
  };

  const handleRepost = () => {
    if (!currentUserId) return;
    startTransition(async () => {
      const result = await repost(post.id);
      if (result && 'reposted' in result) {
        setRepostCount((prev) => result.reposted ? prev + 1 : prev - 1);
      }
    });
  };

  const handleDelete = () => {
    if (!currentUserId) return;
    startTransition(async () => {
      const result = await deletePost(post.id);
      if (result?.success) {
        setDeleted(true);
      }
    });
    setShowMenu(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/feed/${post.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowShareMenu(false);
  };

  const isOwner = currentUserId === post.author.id;

  if (deleted) return null;

  return (
    <article className={cn(
      "rounded-2xl border backdrop-blur-sm transition-all duration-200 group",
      "glass-card rounded-2xl",
      post.isPinned && "ring-1 ring-[var(--accent-muted)]"
    )}>
      <div className={cn("p-5", compact && "p-3")}>
        {post.isPinned && (
          <div className="flex items-center gap-1.5 text-xs mb-2" style={{ color: "var(--accent)" }}>
            <Pin className="h-3 w-3" />
            <span>Pinned post</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link href={`/profile/${post.author.username}`}>
              <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size={compact ? "sm" : "md"} />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <Link href={`/profile/${post.author.username}`} className="font-semibold hover:underline text-sm" style={{ color: "var(--text-primary)" }}>
                  {post.author.displayName}
                </Link>
                {post.author.isVerified && (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--accent)" }}>
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs flex-wrap" style={{ color: "var(--text-muted)" }}>
                <Link href={`/profile/${post.author.username}`} className="hover:opacity-80">
                  @{post.author.username}
                </Link>
                <span>&middot;</span>
                <span>{formatRelativeTime(post.createdAt)}</span>
                {/* Platform origin badge — non-invasive */}
                {post.platform && PLATFORM_BADGE[post.platform] && (
                  <>
                    <span>&middot;</span>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0 rounded text-[10px] font-medium"
                      style={{ backgroundColor: PLATFORM_BADGE[post.platform].color + "18", color: PLATFORM_BADGE[post.platform].color }}
                    >
                      <span className="w-2.5 h-2.5 rounded-sm flex items-center justify-center text-[7px] font-bold text-white" style={{ backgroundColor: PLATFORM_BADGE[post.platform].color }}>
                        {PLATFORM_BADGE[post.platform].abbr[0]}
                      </span>
                      {PLATFORM_BADGE[post.platform].label}
                    </span>
                  </>
                )}
                {/* Cross-posted indicator */}
                {post.crossPostedTo && post.crossPostedTo.length > 0 && (
                  <>
                    <span>&middot;</span>
                    <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5">
                      <Share2 className="h-2.5 w-2.5" />
                      +{post.crossPostedTo.length}
                    </span>
                  </>
                )}
                {post.community && (
                  <>
                    <span>&middot;</span>
                    <Link href={`/communities/${post.community.slug}`} className="hover:opacity-80" style={{ color: "var(--accent)" }}>
                      {post.community.name}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* More menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 rounded-lg transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100" style={{ color: "var(--text-muted)" }}>
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 w-48 rounded-xl shadow-xl z-20 py-1 glass-dropdown animate-smooth-reveal">
                <button onClick={handleCopyLink} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:opacity-80 transition-colors" style={{ color: "var(--text-secondary)" }}>
                  <Copy className="h-4 w-4" /> Copy link
                </button>
                <Link href={`/feed/${post.id}`} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:opacity-80 transition-colors" style={{ color: "var(--text-secondary)" }}>
                  <ExternalLink className="h-4 w-4" /> Open post
                </Link>
                {!isOwner && (
                  <button className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:opacity-80 transition-colors" style={{ color: "var(--text-secondary)" }}>
                    <Flag className="h-4 w-4" /> Report post
                  </button>
                )}
                {isOwner && (
                  <button onClick={handleDelete} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="h-4 w-4" /> Delete post
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <Link href={`/feed/${post.id}`}>
          <p className={cn("text-sm leading-relaxed whitespace-pre-wrap mb-3", compact && "line-clamp-3")} style={{ color: "var(--text-secondary)" }}>{post.content}</p>
        </Link>

        {/* Media */}
        {post.media.length > 0 && (
          <div className={cn("rounded-xl overflow-hidden mb-3", post.media.length === 1 && "max-h-96", post.media.length >= 2 && "grid grid-cols-2 gap-1")}>
            {post.media.slice(0, 4).map((media, idx) => (
              <div key={media.id} className={cn("relative overflow-hidden", post.media.length === 3 && idx === 0 && "row-span-2", post.media.length >= 4 && "aspect-square")}>
                <Image src={media.url} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover hover:scale-105 transition-transform duration-300" />
                {idx === 3 && post.media.length > 4 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-bold text-lg">+{post.media.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.map((tag) => (
              <Link key={tag.id} href={`/search?q=${encodeURIComponent(tag.tag)}`}>
                <Badge variant="secondary" className="text-xs hover:bg-zinc-700 transition-colors cursor-pointer">
                  #{tag.tag}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border-primary)" }}>
          <div className="flex items-center gap-1">
            <button onClick={handleLike} disabled={isPending} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200 action-icon", liked ? "text-rose-400 hover:text-rose-300" : "hover:text-rose-400/70")} style={!liked ? { color: "var(--text-muted)" } : undefined}>
              <Heart className={cn("h-4 w-4 transition-transform", liked && "fill-current", likeAnimating && "animate-heart-bounce")} />
              <span className="text-xs">{formatCount(likeCount)}</span>
            </button>
            <Link href={`/feed/${post.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors action-icon hover:opacity-70" style={{ color: "var(--text-muted)" }}>
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">{formatCount(post._count.comments)}</span>
            </Link>
            <button onClick={handleRepost} disabled={isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm hover:text-emerald-400 transition-colors action-icon" style={{ color: "var(--text-muted)" }}>
              <Repeat2 className="h-4 w-4" />
              <span className="text-xs">{formatCount(repostCount)}</span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative" ref={shareRef}>
              <button onClick={() => setShowShareMenu(!showShareMenu)} className="p-1.5 rounded-lg hover:opacity-80 transition-colors" style={{ color: "var(--text-muted)" }}>
                <Share2 className="h-4 w-4" />
              </button>
              {showShareMenu && (
                <div className="absolute right-0 bottom-8 w-52 rounded-xl shadow-xl z-20 py-1 glass-dropdown animate-smooth-reveal">
                  <Link href={`/messages?sharePostId=${encodeURIComponent(post.id)}`} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:opacity-80 transition-colors" style={{ color: "var(--text-secondary)" }}>
                    <MessageCircle className="h-4 w-4" /> Share in MeChat
                  </Link>
                  <button onClick={handleCopyLink} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:opacity-80 transition-colors" style={{ color: "var(--text-secondary)" }}>
                    <Link2 className="h-4 w-4" /> {copied ? "Copied!" : "Copy link"}
                  </button>
                </div>
              )}
            </div>
            <button onClick={handleSave} className={cn("p-1.5 rounded-lg transition-all duration-200 action-icon", saved ? "hover:opacity-80" : "hover:opacity-70")} style={saved ? { color: "var(--accent)" } : { color: "var(--text-muted)" }}>
              <Bookmark className={cn("h-4 w-4 transition-transform", saved && "fill-current", saveAnimating && "animate-bookmark-pop")} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
