"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatRelativeTime, formatCount } from "@/lib/utils";
import { Heart, MessageCircle, Repeat2, Bookmark, MoreHorizontal, Share2, Flag, Trash2, Pin, Copy, ExternalLink, Link2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, useRef, useEffect } from "react";
import { toggleReaction, toggleSavePost, repost, deletePost } from "@/lib/actions";

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
    setLiked(!liked);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
    startTransition(async () => { await toggleReaction(post.id); });
  };

  const handleSave = () => {
    if (!currentUserId) return;
    setSaved(!saved);
    startTransition(async () => { await toggleSavePost(post.id); });
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
    startTransition(async () => { await deletePost(post.id); });
    setShowMenu(false);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/feed/${post.id}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowShareMenu(false);
  };

  const isOwner = currentUserId === post.author.id;

  return (
    <article className={cn(
      "rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm hover:border-zinc-700 transition-all duration-200 group",
      post.isPinned && "ring-1 ring-blue-500/30"
    )}>
      <div className={cn("p-5", compact && "p-3")}>
        {post.isPinned && (
          <div className="flex items-center gap-1.5 text-xs text-blue-400 mb-2">
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
                <Link href={`/profile/${post.author.username}`} className="font-semibold text-zinc-100 hover:underline text-sm">
                  {post.author.displayName}
                </Link>
                {post.author.isVerified && (
                  <svg className="h-4 w-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                <Link href={`/profile/${post.author.username}`} className="hover:text-zinc-400">
                  @{post.author.username}
                </Link>
                <span>&middot;</span>
                <span>{formatRelativeTime(post.createdAt)}</span>
                {post.community && (
                  <>
                    <span>&middot;</span>
                    <Link href={`/communities/${post.community.slug}`} className="text-blue-400 hover:text-blue-300">
                      {post.community.name}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* More menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setShowMenu(!showMenu)} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-8 w-48 rounded-xl border border-zinc-700 bg-zinc-800 shadow-xl z-20 py-1">
                <button onClick={handleCopyLink} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700/50 transition-colors">
                  <Copy className="h-4 w-4" /> Copy link
                </button>
                <Link href={`/feed/${post.id}`} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700/50 transition-colors">
                  <ExternalLink className="h-4 w-4" /> Open post
                </Link>
                {!isOwner && (
                  <button className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700/50 transition-colors">
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
          <p className={cn("text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap mb-3", compact && "line-clamp-3")}>{post.content}</p>
        </Link>

        {/* Media */}
        {post.media.length > 0 && (
          <div className={cn("rounded-xl overflow-hidden mb-3", post.media.length === 1 && "max-h-96", post.media.length >= 2 && "grid grid-cols-2 gap-1")}>
            {post.media.slice(0, 4).map((media, idx) => (
              <div key={media.id} className={cn("relative overflow-hidden", post.media.length === 3 && idx === 0 && "row-span-2", post.media.length >= 4 && "aspect-square")}>
                <img src={media.url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" loading="lazy" />
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
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
          <div className="flex items-center gap-1">
            <button onClick={handleLike} disabled={isPending} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200", liked ? "text-rose-400 hover:text-rose-300" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50")}>
              <Heart className={cn("h-4 w-4 transition-transform", liked && "fill-current scale-110")} />
              <span className="text-xs">{formatCount(likeCount)}</span>
            </button>
            <Link href={`/feed/${post.id}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors">
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">{formatCount(post._count.comments)}</span>
            </Link>
            <button onClick={handleRepost} disabled={isPending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-emerald-400 hover:bg-zinc-800/50 transition-colors">
              <Repeat2 className="h-4 w-4" />
              <span className="text-xs">{formatCount(repostCount)}</span>
            </button>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative" ref={shareRef}>
              <button onClick={() => setShowShareMenu(!showShareMenu)} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors">
                <Share2 className="h-4 w-4" />
              </button>
              {showShareMenu && (
                <div className="absolute right-0 bottom-8 w-44 rounded-xl border border-zinc-700 bg-zinc-800 shadow-xl z-20 py-1">
                  <button onClick={handleCopyLink} className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700/50 transition-colors">
                    <Link2 className="h-4 w-4" /> {copied ? "Copied!" : "Copy link"}
                  </button>
                </div>
              )}
            </div>
            <button onClick={handleSave} className={cn("p-1.5 rounded-lg transition-all duration-200", saved ? "text-blue-400 hover:text-blue-300" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50")}>
              <Bookmark className={cn("h-4 w-4 transition-transform", saved && "fill-current scale-110")} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
