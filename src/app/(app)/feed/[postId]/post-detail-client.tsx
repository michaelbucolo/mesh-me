"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatRelativeTime, formatCount, safeHref } from "@/lib/utils";
import { Heart, MessageCircle, Repeat2, Bookmark, ArrowLeft, Send, Copy, Link2, ExternalLink, Globe, Lock, Users } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { NativeAspectMedia } from "@/components/ui/native-aspect-media";
import { useState, useTransition, useRef } from "react";
import { attachNormalizer } from "@/lib/audio-normalize";
import { toggleReaction, toggleSavePost, repost, createComment } from "@/lib/actions";
import { useRouter } from "next/navigation";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  replies: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }>;
}

interface PostDetailClientProps {
  post: {
    id: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    author: {
      id: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      isVerified: boolean;
      bio?: string | null;
    };
    community?: { id: string; name: string; slug: string } | null;
    media: { id: string; url: string; type: string }[];
    tags: { id: string; tag: string }[];
    comments: Comment[];
    _count: { comments: number; reactions: number; reposts: number };
    reactions?: { id: string }[] | false;
    savedBy?: { id: string }[] | false;
    visibility?: string;
    isNsfw?: boolean;
    contentRating?: string;
  };
  currentUserId?: string;
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

function VisibilityLabel({ visibility }: { visibility?: string }) {
  if (visibility === "private") {
    return <span className="inline-flex items-center gap-1"><Lock className="h-3 w-3" /> Only me</span>;
  }
  if (visibility === "friends") {
    return <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> Friends</span>;
  }
  return <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" /> Public</span>;
}

export function PostDetailClient({ post, currentUserId }: PostDetailClientProps) {
  const router = useRouter();
  const [liked, setLiked] = useState(Array.isArray(post.reactions) && post.reactions.length > 0);
  const [likeCount, setLikeCount] = useState(post._count.reactions);
  const [saved, setSaved] = useState(Array.isArray(post.savedBy) && post.savedBy.length > 0);
  const [repostCount, setRepostCount] = useState(post._count.reposts);
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const visualMedia = post.media.filter((item) => isVisualMedia(item.type));
  const linkMedia = post.media.filter((item) => !isVisualMedia(item.type));

  const handleLike = () => {
    if (!currentUserId) return;
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);
    startTransition(async () => {
      const result = await toggleReaction(post.id);
      // Roll back the optimistic heart if the server rejected it.
      if (result && "error" in result) {
        setLiked(prevLiked);
        setLikeCount(prevCount);
      }
    });
  };

  const handleSave = () => {
    if (!currentUserId) return;
    const prevSaved = saved;
    setSaved(!prevSaved);
    startTransition(async () => {
      const result = await toggleSavePost(post.id);
      if (result && "error" in result) setSaved(prevSaved);
    });
  };

  const handleRepost = () => {
    if (!currentUserId) return;
    startTransition(async () => {
      const result = await repost(post.id);
      if (result && "reposted" in result) {
        setRepostCount((prev) => result.reposted ? prev + 1 : prev - 1);
      }
    });
  };

  const handleComment = () => {
    if (!commentText.trim() || !currentUserId) return;
    const formData = new FormData();
    formData.set("content", commentText);
    formData.set("postId", post.id);
    if (replyingTo) formData.set("parentId", replyingTo);

    setCommentError("");
    startTransition(async () => {
      const result = await createComment(formData);
      // createComment RETURNS { error } (never throws). Keep the typed comment
      // and surface the error instead of silently wiping it.
      if (result && "error" in result) {
        setCommentError(String(result.error));
        return;
      }
      setCommentText("");
      setReplyingTo(null);
      router.refresh();
    });
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div data-meshi-zone="post-detail" className="max-w-2xl mx-auto px-4 py-6">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Post content */}
      <article className="rounded-2xl glass-card p-4 sm:p-6 mb-6">
        {/* Author header */}
        <div className="flex items-start gap-3 mb-4">
          <Link href={`/profile/${post.author.username}`} className="shrink-0">
            <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size="md" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Link href={`/profile/${post.author.username}`} className="font-semibold hover:underline text-[var(--text-primary)]">
                {post.author.displayName}
              </Link>
              {post.author.isVerified && (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" style={{ color: "var(--accent-text)" }}>
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--text-muted)]">
              <span>@{post.author.username}</span>
              <span>&middot;</span>
              <span>{formatRelativeTime(post.createdAt)}</span>
              <span>&middot;</span>
              <VisibilityLabel visibility={post.visibility} />
              {post.isNsfw && (
                <>
                  <span>&middot;</span>
                  <span className="rounded bg-amber-400/10 px-1.5 py-0.5 text-micro font-semibold text-[var(--warning)]">NSFW</span>
                </>
              )}
              {post.community && (
                <>
                  <span>&middot;</span>
                  <Link href={`/communities/${post.community.slug}`} style={{ color: "var(--accent-text)" }}>
                    {post.community.name}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <p className="text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap mb-4">{post.content}</p>

        {/* Media — single media keeps its NATIVE ratio (clamped 4:5–16:9,
            extremes letterbox over a blurred self-fill); galleries crop to
            consistent square tiles. */}
        {visualMedia.length === 1 && (
          <div className="rounded-xl overflow-hidden mb-4 bg-[var(--bg-secondary)]">
            <NativeAspectMedia
              media={visualMedia[0]}
              alt=""
              videoMode="controls"
              sizes="(max-width: 768px) 100vw, 672px"
              className="max-h-[min(70dvh,560px)]"
            />
          </div>
        )}
        {visualMedia.length >= 2 && (
          <div className="rounded-xl overflow-hidden mb-4 bg-[var(--bg-secondary)] grid grid-cols-2 gap-1">
            {visualMedia.map((media, idx) => (
              <div
                key={media.id}
                className={cn(
                  "relative overflow-hidden",
                  visualMedia.length === 3 && idx === 0 ? "row-span-2 aspect-auto" : "aspect-square",
                )}
              >
                {media.type.toLowerCase() === "video" ? (
                  <video src={media.url} className="h-full w-full object-cover" controls preload="metadata" playsInline onPlay={(event) => attachNormalizer(event.currentTarget)} />
                ) : media.url.startsWith("data:") || media.url.startsWith("blob:") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Image src={media.url} alt="" fill sizes="(max-width: 768px) 50vw, 336px" className="object-cover" />
                )}
              </div>
            ))}
          </div>
        )}

        {linkMedia.length > 0 && (
          <div className="mb-4 grid gap-2">
            {linkMedia.map((media) => (
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

        {/* Tags */}
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {post.tags.map((tag) => (
              <Link key={tag.id} href={`/search?q=${encodeURIComponent(tag.tag)}`}>
                <Badge variant="secondary" className="text-xs cursor-pointer hover:bg-zinc-700">
                  #{tag.tag}
                </Badge>
              </Link>
            ))}
          </div>
        )}

        {/* Engagement stats */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm text-[var(--text-muted)] border-y border-[var(--border-primary)]">
          <span><strong className="text-[var(--text-primary)]">{formatCount(likeCount)}</strong> likes</span>
          <span><strong className="text-[var(--text-primary)]">{formatCount(post._count.comments)}</strong> comments</span>
          <span><strong className="text-[var(--text-primary)]">{formatCount(repostCount)}</strong> reposts</span>
        </div>

        {/* Actions — the labelled row is wider than a 360px card, so it wraps
            instead of pushing the save/copy pair off the edge. */}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-2">
          <div className="flex items-center gap-0.5 sm:gap-2">
            <button
              onClick={handleLike}
              disabled={isPending}
              className={cn(
                "flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm transition-[color,background-color,border-color,box-shadow,transform,opacity] sm:px-3",
                liked ? "text-rose-400" : "text-[var(--text-muted)] hover:text-rose-400"
              )}
            >
              <Heart className={cn("h-5 w-5", liked && "fill-current")} />
              Like
            </button>
            <button
              onClick={() => {
                setReplyingTo(null);
                commentInputRef.current?.focus();
              }}
              className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-[var(--accent-text)] transition-colors sm:px-3"
            >
              <MessageCircle className="h-5 w-5" />
              Comment
            </button>
            <button
              onClick={handleRepost}
              disabled={isPending}
              className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm text-[var(--text-muted)] hover:text-emerald-400 transition-colors sm:px-3"
            >
              <Repeat2 className="h-5 w-5" />
              Repost
            </button>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={handleCopyLink} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors" title={copied ? "Copied!" : "Copy link"}>
              {copied ? <Link2 className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
            <button
              onClick={handleSave}
              className={cn("p-2 rounded-lg transition-colors", saved ? "text-[var(--accent-text)]" : "text-[var(--text-muted)] hover:text-[var(--accent-text)]")}
            >
              <Bookmark className={cn("h-5 w-5", saved && "fill-current")} />
            </button>
          </div>
        </div>
      </article>

      {/* Comment composer */}
      {currentUserId && (
        <div className="rounded-2xl glass-card p-4 mb-6">
          {replyingTo && (
            <div className="flex items-center gap-2 mb-2 text-xs text-[var(--text-muted)]">
              <span>Replying to a comment</span>
              <button onClick={() => setReplyingTo(null)} className="text-[var(--accent-text)] hover:underline">Cancel</button>
            </div>
          )}
          <div className="flex gap-3">
            <textarea
              ref={commentInputRef}
              value={commentText}
              onChange={(e) => {
                setCommentText(e.target.value);
                if (commentError) setCommentError("");
              }}
              placeholder="Write a comment..."
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-none min-h-[60px]"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleComment();
              }}
            />
            <Button
              onClick={handleComment}
              disabled={!commentText.trim() || isPending}
              size="icon-sm"
              variant="gradient"
              className="self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          {commentError && (
            <p className="mt-2 text-xs text-[var(--ds-danger,#f87171)]">{commentError}</p>
          )}
        </div>
      )}
      {!currentUserId && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl glass-card p-4">
          <p className="min-w-0 text-sm text-[var(--text-secondary)]">
            Sign in to join the conversation — comment, react, and follow.
          </p>
          <Link
            href="/login"
            className="shrink-0 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-contrast)] transition hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      )}

      {/* Comments */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)]">
          {post._count.comments > 0 ? `${post._count.comments} Comments` : "No comments yet"}
        </h3>
        {post.comments.map((comment) => (
          <div key={comment.id} className="rounded-xl glass-card p-4">
            <div className="flex items-start gap-3">
              <Link href={`/profile/${comment.author.username}`}>
                <Avatar src={comment.author.avatarUrl} alt={comment.author.displayName} size="sm" />
              </Link>
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <Link href={`/profile/${comment.author.username}`} className="text-sm font-semibold text-[var(--text-primary)] hover:underline">
                    {comment.author.displayName}
                  </Link>
                  <span className="text-xs text-[var(--text-muted)]">{formatRelativeTime(comment.createdAt)}</span>
                </div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{comment.content}</p>
                <button
                  onClick={() => {
                    setReplyingTo(comment.id);
                    commentInputRef.current?.focus();
                  }}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-text)] mt-1 transition-colors"
                >
                  Reply
                </button>
              </div>
            </div>

            {/* Replies */}
            {comment.replies.length > 0 && (
              <div className="ml-10 mt-3 space-y-3 pl-3 border-l-2 border-[var(--border-primary)]">
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="flex items-start gap-2">
                    <Link href={`/profile/${reply.author.username}`}>
                      <Avatar src={reply.author.avatarUrl} alt={reply.author.displayName} size="xs" />
                    </Link>
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Link href={`/profile/${reply.author.username}`} className="text-xs font-semibold text-[var(--text-primary)] hover:underline">
                          {reply.author.displayName}
                        </Link>
                        <span className="text-micro text-[var(--text-muted)]">{formatRelativeTime(reply.createdAt)}</span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{reply.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
