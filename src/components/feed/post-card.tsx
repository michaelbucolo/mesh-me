"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn, formatRelativeTime, formatCount } from "@/lib/utils";
import { Heart, MessageCircle, Repeat2, Bookmark, MoreHorizontal, Share2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleReaction, toggleSavePost } from "@/lib/actions";

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
  };
  currentUserId?: string;
}

export function PostCard({ post, currentUserId }: PostCardProps) {
  const [liked, setLiked] = useState(post.reactions && post.reactions.length > 0);
  const [likeCount, setLikeCount] = useState(post._count.reactions);
  const [saved, setSaved] = useState(post.savedBy && post.savedBy.length > 0);
  const [isPending, startTransition] = useTransition();

  const handleLike = () => {
    if (!currentUserId) return;
    setLiked(!liked);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
    startTransition(async () => {
      await toggleReaction(post.id);
    });
  };

  const handleSave = () => {
    if (!currentUserId) return;
    setSaved(!saved);
    startTransition(async () => {
      await toggleSavePost(post.id);
    });
  };

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/80 backdrop-blur-sm hover:border-zinc-700 transition-all duration-200">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link href={`/profile/${post.author.username}`}>
              <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size="md" />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <Link href={`/profile/${post.author.username}`} className="font-semibold text-zinc-100 hover:underline text-sm">
                  {post.author.displayName}
                </Link>
                {post.author.isVerified && (
                  <svg className="h-4 w-4 text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
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
                    <Link href={`/communities/${post.community.slug}`} className="text-indigo-400 hover:text-indigo-300">
                      {post.community.name}
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
          <button className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <Link href={`/feed/${post.id}`}>
          <p className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>
        </Link>

        {/* Media */}
        {post.media.length > 0 && (
          <div className={cn(
            "rounded-xl overflow-hidden mb-3",
            post.media.length === 1 && "max-h-96",
            post.media.length > 1 && "grid grid-cols-2 gap-1"
          )}>
            {post.media.map((media) => (
              <img
                key={media.id}
                src={media.url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ))}
          </div>
        )}

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {post.tags.map((tag) => (
              <Badge key={tag.id} variant="secondary" className="text-xs">
                #{tag.tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
          <div className="flex items-center gap-1">
            <button
              onClick={handleLike}
              disabled={isPending}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-200",
                liked
                  ? "text-rose-400 hover:text-rose-300"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              <Heart className={cn("h-4 w-4", liked && "fill-current")} />
              <span className="text-xs">{formatCount(likeCount)}</span>
            </button>

            <Link
              href={`/feed/${post.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">{formatCount(post._count.comments)}</span>
            </Link>

            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors">
              <Repeat2 className="h-4 w-4" />
              <span className="text-xs">{formatCount(post._count.reposts)}</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors">
              <Share2 className="h-4 w-4" />
            </button>
            <button
              onClick={handleSave}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                saved
                  ? "text-indigo-400 hover:text-indigo-300"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
              )}
            >
              <Bookmark className={cn("h-4 w-4", saved && "fill-current")} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
