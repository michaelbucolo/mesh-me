"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { cn, formatRelativeTime, formatCount, safeHref } from "@/lib/utils";
import { Heart, MessageCircle, Bookmark, MoreHorizontal, Share2, Flag, Trash2, Pin, Copy, ExternalLink, Link2, Loader2, Globe, Lock, Users, BadgeCheck, Ban } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { AutoplayVideo } from "@/components/feed/autoplay-video";
import { NativeAspectMedia } from "@/components/ui/native-aspect-media";
import { useState, useTransition, useRef, useEffect, memo, type ReactNode } from "react";
import { toggleReaction, toggleSavePost, repost, deletePost, reportPost } from "@/lib/actions";
import { BlockAuthorConfirmDialog } from "@/components/privacy/block-controls";
import { getPlatformActionCapability } from "@/lib/platform-capabilities";
import { getVideoEmbedUrl } from "@/lib/video-embed";
import { Play } from "lucide-react";
import { playSound } from "@/lib/sound";

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
    media: { id: string; url: string; type: string; posterUrl?: string }[];
    tags: { id: string; tag: string }[];
    _count: { comments: number; reactions: number; reposts: number };
    reactions?: { id: string }[];
    savedBy?: { id: string }[];
    isPinned?: boolean;
    platform?: string; // Origin platform (e.g. "instagram", "twitter", "meshme")
    sourceId?: string; // PlatformPost id when this card comes from a connected source
    externalUrl?: string | null;
    platformPostId?: string;
    crossPostedTo?: string[]; // Platforms this was cross-posted to
    externalAuthor?: { name: string; username?: string | null; avatarUrl?: string | null; profileUrl?: string | null };
    optimistic?: boolean;
    isNsfw?: boolean;
    contentRating?: string;
    visibility?: string;
  };
  currentUserId?: string;
  connectedPlatforms?: string[];
  compact?: boolean;
  eager?: boolean;
}

function normalizePlatform(platform?: string | null) {
  if (!platform) return null;
  const value = platform.toLowerCase();
  if (value === "x") return "twitter";
  return value;
}

function getMediaTypes(media: { type: string }[]) {
  return [...new Set(media.map((item) => item.type.toLowerCase()).filter(Boolean))];
}

function isVisualMedia(type: string) {
  const normalized = type.toLowerCase();
  return normalized === "image" || normalized === "video";
}

function getLinkHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function VisibilityIcon({ visibility }: { visibility?: string }) {
  if (visibility === "private") return <Lock className="h-3 w-3" aria-label="Only me" />;
  if (visibility === "friends") return <Users className="h-3 w-3" aria-label="Friends only" />;
  return <Globe className="h-3 w-3" aria-label="Public" />;
}

function detectMediaSignals(post: PostCardProps["post"]) {
  const haystack = [
    post.content,
    post.externalUrl,
    ...post.media.map((item) => `${item.url} ${item.type}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const signals: string[] = [];
  [
    ["generated", "caption or media reference says generated"],
    ["authenticity", "caption or media reference mentions authenticity"],
    ["synthetic", "caption or media reference says synthetic"],
    ["deepfake", "caption or media reference says deepfake"],
    ["sora", "media reference mentions Sora"],
    ["runway", "media reference mentions Runway"],
    ["pika", "media reference mentions Pika"],
    ["midjourney", "media reference mentions Midjourney"],
    ["stable diffusion", "media reference mentions Stable Diffusion"],
  ].forEach(([needle, label]) => {
    if (haystack.includes(needle)) signals.push(label);
  });

  return [...new Set(signals)].slice(0, 4);
}

function ExpandablePostText({
  content,
  compact,
  className,
  prefix,
}: {
  content: string;
  compact?: boolean;
  className?: string;
  prefix?: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = content.trim().length > (compact ? 180 : 420);
  if (!content.trim()) return null;

  return (
    <div className={cn("feed-post-copy", className)}>
      <p className={cn("whitespace-pre-wrap", isLong && !expanded && "feed-post-copy-clamped")}>
        {prefix ? <>{prefix} </> : null}
        {content}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-1 text-xs font-semibold text-[var(--text-primary)] transition hover:text-[var(--accent)]"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

export const PostCard = memo(function PostCard({ post, currentUserId, connectedPlatforms = [], compact, eager }: PostCardProps) {
  const [liked, setLiked] = useState(post.reactions && post.reactions.length > 0);
  const [likeCount, setLikeCount] = useState(post._count.reactions);
  const [playingEmbed, setPlayingEmbed] = useState(false);
  const [saved, setSaved] = useState(post.savedBy && post.savedBy.length > 0);
  const [repostCount, setRepostCount] = useState(post._count.reposts);
  const [showMenu, setShowMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [confirmingBlock, setConfirmingBlock] = useState(false);
  const [copied, setCopied] = useState(false);
  const [platformActionMessage, setPlatformActionMessage] = useState("");
  const { addToast } = useToast();
  const [likeAnimating, setLikeAnimating] = useState(false);
  const [bursts, setBursts] = useState<{ id: number; x: number; y: number }[]>([]);
  const [saveAnimating, setSaveAnimating] = useState(false);
  const [removedFromView, setRemovedFromView] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const originPlatform = normalizePlatform(post.platform);
  const connectedPlatformSet = new Set(connectedPlatforms.map((platform) => normalizePlatform(platform)).filter(Boolean));
  const requiresSourceAccount = Boolean(originPlatform && originPlatform !== "meshme");
  const hasSourceAccount = !requiresSourceAccount || connectedPlatformSet.has(originPlatform);
  const platformLabel = originPlatform && PLATFORM_BADGE[originPlatform]?.label;
  const platformBadge = originPlatform ? PLATFORM_BADGE[originPlatform] : null;
  const isOptimistic = Boolean(post.optimistic);
  const externalAuthor = post.externalAuthor;
  const isExternalFeedItem = Boolean(externalAuthor);
  const postMediaAlt = post.content.trim()
    ? `${post.author.displayName}: ${post.content.trim().slice(0, 120)}`
    : "";
  const postHref = isOptimistic ? "/feed" : safeHref(post.externalUrl) || `/feed/${post.id}`;
  const mediaTypes = getMediaTypes(post.media);
  const mediaSignals = detectMediaSignals(post);
  const visualMedia = post.media.filter((item) => isVisualMedia(item.type));
  const linkMedia = post.media.filter((item) => !isVisualMedia(item.type));
  // Page-link videos (YouTube/Vimeo/Twitch) play right inside the card via
  // their embed player — watching never requires leaving mesh.me.
  const cardEmbedUrl = visualMedia.some((m) => m.type.toLowerCase() === "video")
    ? null
    : getVideoEmbedUrl(post.externalUrl, { autoplay: true, muted: false });
  const meChatShareHref = isExternalFeedItem
    ? `/messages?${new URLSearchParams({
        ...(post.externalUrl ? { shareUrl: post.externalUrl } : {}),
        sourcePlatform: originPlatform || "platform",
      }).toString()}`
    : post.sourceId && requiresSourceAccount
    ? `/messages?sharePlatformPostId=${encodeURIComponent(post.sourceId)}&sourcePlatform=${encodeURIComponent(originPlatform || "platform")}${post.externalUrl ? `&shareUrl=${encodeURIComponent(post.externalUrl)}` : ""}`
    : `/messages?sharePostId=${encodeURIComponent(post.id)}`;

  const redirectToSourceConnection = (action: string) => {
    if (!originPlatform) return;
    const params = new URLSearchParams({
      platform: originPlatform,
      next: "/feed",
      reason: action,
    });
    window.location.href = `/connected-accounts?${params.toString()}`;
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false);
      if (shareRef.current && !shareRef.current.contains(event.target as Node)) setShowShareMenu(false);
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setShowMenu(false);
        setShowShareMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const requireSourceAccount = (action: string) => {
    setPlatformActionMessage("");
    if (isExternalFeedItem) {
      setPlatformActionMessage(`Open this post on ${platformLabel || "its platform"} to ${action} it.`);
      return false;
    }
    if (!requiresSourceAccount || hasSourceAccount) return true;
    redirectToSourceConnection(action);
    return false;
  };

  const canRunSourceAction = (action: "like" | "unlike" | "share") => {
    if (!requiresSourceAccount) return true;
    const capability = getPlatformActionCapability(originPlatform, action);
    if (capability.supported) return true;
    setPlatformActionMessage(capability.reason);
    return false;
  };

  const runPlatformAction = async (action: "like" | "unlike" | "share") => {
    if (!post.sourceId) {
      return { error: "This source post is missing its connected platform record." };
    }
    const response = await fetch("/api/platform-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action, postId: post.sourceId }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.error) {
      return { error: payload?.error || "Platform action failed" };
    }
    return payload;
  };

  const handleSourceActionError = (message: string, action: string) => {
    if (/^connect\s/i.test(message) && originPlatform) {
      redirectToSourceConnection(action);
      return;
    }
    setPlatformActionMessage(message);
  };

  const handleLike = (viaDoubleTap = false, coords?: { x: number; y: number }) => {
    if (!currentUserId) return;
    if (!requireSourceAccount("like")) return;
    if (!canRunSourceAction(liked ? "unlike" : "like")) return;
    const newLiked = !liked;
    const previousLiked = liked;
    const previousCount = likeCount;

    setLiked(newLiked);
    setLikeCount((prev) => (newLiked ? prev + 1 : prev - 1));
    if (newLiked) {
      setLikeAnimating(true);
      playSound("heart");
      setTimeout(() => setLikeAnimating(false), 520);
      if (viaDoubleTap) {
        const now = Date.now();
        const point = coords ?? { x: 50, y: 50 };
        setBursts((current) => [...current.slice(-3), { id: now, x: point.x, y: point.y }]);
        window.setTimeout(() => setBursts((current) => current.filter((b) => b.id !== now)), 850);
      }
    }
    startTransition(async () => {
      const result = requiresSourceAccount ? await runPlatformAction(newLiked ? "like" : "unlike") : await toggleReaction(post.id);
      if (result && "error" in result) {
        setLiked(previousLiked);
        setLikeCount(previousCount);
        handleSourceActionError(String(result.error), newLiked ? "like" : "unlike");
      }
    });
  };

  const handleSave = () => {
    if (!currentUserId) return;
    if (requiresSourceAccount) {
      if (!requireSourceAccount("save")) return;
      setSaved(true);
      setSaveAnimating(true);
      setTimeout(() => setSaveAnimating(false), 300);
      return;
    }
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
    if (!requireSourceAccount("share")) return;
    if (!canRunSourceAction("share")) return;
    startTransition(async () => {
      const result = requiresSourceAccount ? await runPlatformAction("share").then((value) => ("error" in value ? value : { reposted: true })) : await repost(post.id);
      if (result && 'reposted' in result) {
        setRepostCount((prev) => result.reposted ? prev + 1 : prev - 1);
      } else if (result && "error" in result) {
        handleSourceActionError(String(result.error), "share");
      }
    });
  };

  const handleDelete = () => {
    if (!currentUserId) return;
    startTransition(async () => {
      const result = await deletePost(post.id);
      if (result?.success) {
        setRemovedFromView(true);
      }
    });
    setShowMenu(false);
  };

  const handleReport = () => {
    setShowMenu(false);
    startTransition(async () => {
      const result = await reportPost(post.id);
      if (result?.success) {
        addToast("Report received — our team will review it.", "success");
      } else {
        addToast(result?.error || "Couldn't send your report. Please try again.", "error");
      }
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(post.externalUrl || `${window.location.origin}/feed/${post.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Close BOTH menus this can be triggered from, and confirm with a toast —
    // otherwise a copy from the "…" menu leaves it hanging with no feedback.
    setShowMenu(false);
    setShowShareMenu(false);
    addToast("Link copied to clipboard", "success");
  };

  const isOwner = currentUserId === post.author.id && !requiresSourceAccount && !isExternalFeedItem;
  // Blocking targets a mesh.me account, so it is only offered where the byline
  // IS one: external feed items carry a synthetic `external-…` author id with
  // no User row behind it.
  const canBlockAuthor = Boolean(currentUserId) && !isExternalFeedItem && post.author.id !== currentUserId;

  if (removedFromView) return null;

  return (
    <article
      data-meshi-content-card="true"
      data-meshi-content-id={post.id}
      data-meshi-content-platform={originPlatform || "meshme"}
      data-meshi-content-author={post.author.displayName}
      data-meshi-content-text={post.content.slice(0, 900)}
      data-meshi-content-media={mediaTypes.join(",")}
      data-meshi-content-url={post.externalUrl || `/feed/${post.id}`}
      data-meshi-content-rating={post.contentRating || (post.isNsfw ? "adult" : "general")}
      data-meshi-content-media-signals={mediaSignals.join("|")}
      className={cn(
        "insta-post-card group relative overflow-hidden",
        post.isPinned && "ring-1 ring-[var(--accent-muted)]",
        isOptimistic && "feed-post-pending",
      )}
      onDoubleClick={(event) => {
        if (!liked && !isOptimistic) {
          // Bloom the hearts from where the user actually tapped, not dead-centre.
          const rect = event.currentTarget.getBoundingClientRect();
          const x = rect.width ? ((event.clientX - rect.left) / rect.width) * 100 : 50;
          const y = rect.height ? ((event.clientY - rect.top) / rect.height) * 100 : 50;
          handleLike(true, { x, y });
        }
      }}
    >
      <div className={cn("px-3 pt-3 pb-2 sm:px-4", compact && "p-3")}>
        {post.isPinned && (
          <div className="mb-2 flex items-center gap-1.5 text-xs" style={{ color: "var(--accent)" }}>
            <Pin className="h-3 w-3" />
            <span>Pinned post</span>
          </div>
        )}

        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            {isExternalFeedItem && externalAuthor?.profileUrl ? (
              <a href={safeHref(externalAuthor.profileUrl)} target="_blank" rel="noopener noreferrer">
                <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size={compact ? "sm" : "md"} />
              </a>
            ) : isExternalFeedItem ? (
              <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size={compact ? "sm" : "md"} />
            ) : (
              <Link href={`/profile/${post.author.username}`}>
                <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size={compact ? "sm" : "md"} />
              </Link>
            )}
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                {isExternalFeedItem && externalAuthor?.profileUrl ? (
                  <a href={safeHref(externalAuthor.profileUrl)} target="_blank" rel="noopener noreferrer" className="truncate text-[0.9rem] font-semibold hover:underline" style={{ color: "var(--text-primary)" }}>
                    {post.author.displayName}
                  </a>
                ) : isExternalFeedItem ? (
                  <span className="truncate text-[0.9rem] font-semibold" style={{ color: "var(--text-primary)" }}>
                    {post.author.displayName}
                  </span>
                ) : (
                  <Link href={`/profile/${post.author.username}`} className="truncate text-[0.9rem] font-semibold hover:underline" style={{ color: "var(--text-primary)" }}>
                    {post.author.displayName}
                  </Link>
                )}
                {post.author.isVerified && (
                  <BadgeCheck className="h-4 w-4" style={{ color: "var(--accent)" }} />
                )}
              </div>
              <div className="flex items-center gap-1 text-[0.8rem] flex-wrap" style={{ color: "var(--text-muted)" }}>
                {isExternalFeedItem && externalAuthor?.profileUrl ? (
                  <a href={safeHref(externalAuthor.profileUrl)} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    @{post.author.username}
                  </a>
                ) : isExternalFeedItem ? (
                  <span>@{post.author.username}</span>
                ) : (
                  <Link href={`/profile/${post.author.username}`} className="hover:underline">
                    @{post.author.username}
                  </Link>
                )}
                <span className="px-0.5">&middot;</span>
                <span>{formatRelativeTime(post.createdAt)}</span>
                {/* Platform origin badge — non-invasive */}
                {platformBadge && (
                  <>
                    <span>&middot;</span>
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0 rounded text-[10px] font-medium"
                      style={{ backgroundColor: platformBadge.color + "18", color: platformBadge.color }}
                    >
                      <span className="w-2.5 h-2.5 rounded-sm flex items-center justify-center text-[7px] font-semibold text-white" style={{ backgroundColor: platformBadge.color }}>
                        {platformBadge.abbr[0]}
                      </span>
                      {platformBadge.label}
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
                {isOptimistic && (
                  <>
                    <span>&middot;</span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-muted)] bg-[var(--accent-subtle)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Posting
                    </span>
                  </>
                )}
                {post.isNsfw && (
                  <>
                    <span>&middot;</span>
                    <span className="inline-flex items-center rounded px-1.5 py-0 text-[10px] font-semibold text-rose-300 bg-rose-500/10">
                      NSFW
                    </span>
                  </>
                )}
                {!requiresSourceAccount && !isExternalFeedItem && (
                  <>
                    <span>&middot;</span>
                    <span className="inline-flex items-center gap-1">
                      <VisibilityIcon visibility={post.visibility} />
                      {post.visibility === "private"
                        ? "Only me"
                        : post.visibility === "friends"
                          ? "Friends"
                          : post.visibility === "unlisted"
                            ? "Unlisted"
                            : post.visibility === "draft"
                              ? "Draft"
                              : "Public"}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {!isOptimistic && (
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              aria-label="More post options"
              className="rounded-full p-1.5 transition-colors opacity-100 hover:bg-[var(--bg-hover)]"
              style={{ color: "var(--text-muted)" }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 w-48 rounded-xl shadow-xl z-20 py-1 glass-dropdown animate-smooth-reveal">
                <button onClick={handleCopyLink} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:opacity-80 transition-colors" style={{ color: "var(--text-secondary)" }}>
                  <Copy className="h-4 w-4" /> Copy link
                </button>
                <Link href={postHref} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:opacity-80 transition-colors" style={{ color: "var(--text-secondary)" }}>
                  <ExternalLink className="h-4 w-4" /> Open post
                </Link>
                {!isOwner && (
                  <button
                    type="button"
                    onClick={handleReport}
                    disabled={isPending}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:opacity-80 transition-colors disabled:opacity-50"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <Flag className="h-4 w-4" /> Report post
                  </button>
                )}
                {canBlockAuthor && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setConfirmingBlock(true);
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:opacity-80 transition-colors"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <Ban className="h-4 w-4" /> Block @{post.author.username}
                  </button>
                )}
                {isOwner && (
                  <button onClick={handleDelete} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="h-4 w-4" /> Delete post
                  </button>
                )}
              </div>
            )}
            {/* Outside the menu: opening the dialog closes the menu, which would
                otherwise unmount the dialog along with it. */}
            {canBlockAuthor && (
              <BlockAuthorConfirmDialog
                open={confirmingBlock}
                onClose={() => setConfirmingBlock(false)}
                userId={post.author.id}
                username={post.author.username}
                // The block already hid this author server-side; drop the card
                // now so the post doesn't sit there until the next revalidation.
                onBlocked={() => setRemovedFromView(true)}
              />
            )}
          </div>
          )}
        </div>
      </div>

        {post.content && (visualMedia.length > 0 || linkMedia.length > 0) && (
          <div className="feed-media-copy px-3 pb-3 sm:px-4">
            <ExpandablePostText
              content={post.content}
              compact={compact}
              className="text-[0.95rem] leading-6 text-[var(--text-primary)]"
            />
          </div>
        )}

        {cardEmbedUrl && (
          <div className="feed-media-frame relative block aspect-video overflow-hidden bg-black">
            {playingEmbed ? (
              <iframe
                src={cardEmbedUrl}
                title="Video player"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                // Send the embedding origin so YouTube/Vimeo authorize playback
                // despite the site-wide no-referrer policy (see flow-client).
                referrerPolicy="strict-origin-when-cross-origin"
                className="absolute inset-0 h-full w-full border-0"
              />
            ) : (
              <button
                type="button"
                onClick={() => setPlayingEmbed(true)}
                aria-label="Play video"
                className="group/embed absolute inset-0 h-full w-full"
              >
                {visualMedia[0] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={visualMedia[0].url} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition group-hover/embed:bg-black/35">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 backdrop-blur transition group-hover/embed:scale-105">
                    <Play size={28} className="ml-1 text-white" fill="currentColor" />
                  </span>
                </span>
              </button>
            )}
          </div>
        )}

        {!cardEmbedUrl && visualMedia.length === 1 && (
          <Link
            href={postHref}
            className="feed-media-frame feed-media-single relative block overflow-hidden bg-[var(--bg-secondary)]"
            aria-label="Open post"
          >
            {/* Single media shows at its NATIVE ratio (clamped 4:5–16:9, extreme
                ratios letterbox over a blurred self-fill) with space reserved
                up front — no stretch, no hard crop, no layout jump. */}
            <NativeAspectMedia
              media={visualMedia[0]}
              alt={postMediaAlt}
              eager={Boolean(eager)}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 640px, 624px"
              className="[max-height:inherit]"
              imageClassName="transition-transform duration-300 group-hover:scale-[1.015]"
            />
          </Link>
        )}

        {!cardEmbedUrl && visualMedia.length >= 2 && (
          <Link
            href={postHref}
            className="feed-media-frame feed-media-grid grid grid-cols-2 gap-px overflow-hidden bg-[var(--bg-secondary)]"
            aria-label="Open post"
          >
            {visualMedia.slice(0, 4).map((media, idx) => (
              <div
                key={media.id}
                className={cn(
                  "relative overflow-hidden",
                  visualMedia.length === 3 && idx === 0 ? "row-span-2 aspect-auto" : "aspect-square",
                )}
              >
                {media.type.toLowerCase() === "video" ? (
                  <AutoplayVideo src={media.url} poster={media.posterUrl} className="h-full w-full object-cover" />
                ) : media.url.startsWith("data:") || media.url.startsWith("blob:") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.url} alt={postMediaAlt} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.015]" />
                ) : (
                  <Image
                    src={media.url}
                    alt={postMediaAlt}
                    fill
                    sizes="(max-width: 640px) 50vw, 320px"
                    priority={Boolean(eager && idx === 0)}
                    loading={eager && idx === 0 ? undefined : "lazy"}
                    decoding="async"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.015]"
                  />
                )}
                {idx === 3 && visualMedia.length > 4 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-semibold text-lg">+{visualMedia.length - 4}</span>
                  </div>
                )}
              </div>
            ))}
          </Link>
        )}

        {linkMedia.length > 0 && (
          <div className="px-3 pb-3 sm:px-4">
            {linkMedia.slice(0, 2).map((media) => (
              <a key={media.id} href={safeHref(media.url)} target="_blank" rel="noopener noreferrer" className="feed-link-preview">
                <span className="feed-link-preview-icon">
                  <ExternalLink className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{getLinkHost(media.url)}</span>
                  <span className="block truncate text-xs text-[var(--text-muted)]">{media.url}</span>
                </span>
              </a>
            ))}
          </div>
        )}

        {visualMedia.length === 0 && linkMedia.length === 0 && (
          <div className="insta-text-post feed-text-post px-4 py-7 sm:px-6">
            <ExpandablePostText
              content={post.content}
              compact={compact}
              className="text-[1.05rem] font-semibold leading-7 text-[var(--text-primary)]"
            />
            {isOptimistic ? (
              <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving to feed
              </p>
            ) : (
              <Link href={postHref} className="mt-3 inline-flex text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-primary)]">
                Open post
              </Link>
            )}
          </div>
        )}

      <div className="px-3 py-2.5 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => handleLike()}
              disabled={isPending || isOptimistic}
              aria-label={liked ? "Unlike post" : "Like post"}
              className={cn("insta-post-action relative", liked ? "text-rose-400" : "text-[var(--text-primary)] hover:text-rose-400")}
            >
              <span className={cn("like-burst", likeAnimating && "like-burst-active")} aria-hidden="true" />
              <Heart className={cn("h-5 w-5 transition-transform", liked && "fill-current", likeAnimating && "animate-heart-bounce")} />
            </button>
            <Link
              href={postHref}
              onClick={(event) => {
                if (isOptimistic) {
                  event.preventDefault();
                  return;
                }
                if (!requireSourceAccount("comment")) event.preventDefault();
                else if (requiresSourceAccount && !getPlatformActionCapability(originPlatform, "reply").supported) {
                  event.preventDefault();
                  setPlatformActionMessage("Comment syncing for this source is not available with the current provider permissions. Open the source post to comment there.");
                }
              }}
              className="insta-post-action"
              aria-label="Comment on post"
            >
              <MessageCircle className="h-5 w-5" />
            </Link>
            <button type="button" onClick={() => setShowShareMenu(!showShareMenu)} disabled={isOptimistic} className="insta-post-action" aria-label="Share post">
              <Share2 className="h-5 w-5" />
            </button>
          </div>
          <div className="relative" ref={shareRef}>
            {showShareMenu && (
              <div className="absolute right-0 top-9 z-20 w-52 rounded-xl py-1 shadow-xl glass-dropdown animate-smooth-reveal">
                <Link href={meChatShareHref} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
                  <MessageCircle className="h-4 w-4" /> Share in MeChat
                </Link>
                <button onClick={handleCopyLink} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:opacity-80" style={{ color: "var(--text-secondary)" }}>
                  <Link2 className="h-4 w-4" /> {copied ? "Copied!" : "Copy link"}
                </button>
              </div>
            )}
            <button type="button" onClick={handleSave} disabled={isOptimistic} aria-label={saved ? "Unsave post" : "Save post"} className={cn("insta-post-action", saved && "text-[var(--accent)]")}>
              <Bookmark className={cn("h-5 w-5 transition-transform", saved && "fill-current", saveAnimating && "animate-bookmark-pop")} />
            </button>
          </div>
        </div>

        <p className="feed-like-count mt-1.5 text-[0.82rem] font-semibold text-[var(--text-primary)]">
          <span key={likeCount} className="mesh-roll-in tabular-nums">{formatCount(likeCount)}</span> likes
        </p>

        {requiresSourceAccount && !hasSourceAccount && (
          <Link
            href={`/connected-accounts?platform=${encodeURIComponent(originPlatform || "")}&next=/feed`}
            className="mt-2 block rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-[var(--accent-muted)] hover:text-[var(--text-primary)]"
          >
            Connect {platformLabel || post.platform} to like, comment, and sync actions back to the source.
          </Link>
        )}

        {platformActionMessage && (
          <p className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs font-semibold leading-5 text-amber-100" role="status">
            {platformActionMessage}
          </p>
        )}

        <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.8rem] text-[var(--text-muted)]">
          <Link
            href={postHref}
            onClick={(event) => {
              if (isOptimistic) {
                event.preventDefault();
                return;
              }
              if (!requireSourceAccount("comment")) event.preventDefault();
              else if (requiresSourceAccount && !getPlatformActionCapability(originPlatform, "reply").supported) {
                event.preventDefault();
                setPlatformActionMessage("Comment syncing for this source is not available with the current provider permissions. Open the source post to comment there.");
              }
            }}
            className="hover:text-[var(--text-primary)]"
          >
            View {formatCount(post._count.comments)} comments
          </Link>
          {repostCount > 0 && (
            <button type="button" onClick={handleRepost} disabled={isPending || isOptimistic} className="hover:text-[var(--accent)]">
              {formatCount(repostCount)} reposts
            </button>
          )}
        </div>

        {post.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <Link key={tag.id} href={`/search?q=${encodeURIComponent(tag.tag)}`}>
                <Badge variant="secondary" className="cursor-pointer text-xs transition-colors hover:bg-zinc-700">
                  #{tag.tag}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Double-tap heart blooms from the exact tap point (not dead-centre),
          with an expanding aurora ring behind it. */}
      {bursts.map((burst) => (
        <span
          key={burst.id}
          className="pointer-events-none absolute z-10 flex items-center justify-center"
          style={{ left: `${burst.x}%`, top: `${burst.y}%`, width: 0, height: 0 }}
        >
          <span className="mesh-burst-ring" style={{ borderColor: "rgba(251,113,133,0.85)" }} />
          <Heart size={104} fill="currentColor" className="flow-heart-burst text-rose-500" />
        </span>
      ))}
    </article>
  );
});
