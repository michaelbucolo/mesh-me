"use client";

import { useState, useEffect, useTransition } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  LayoutGrid,
  LayoutList,
  Smartphone,
  Film,
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Repeat2,
  ExternalLink,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import { toggleReaction, toggleSavePost, repost } from "@/lib/actions";

type FeedLayout = "cards" | "grid" | "reels" | "video";

interface FeedPost {
  id: string;
  content: string;
  authorId: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isVerified: boolean;
  };
  media: { id: string; url: string; type: string }[];
  tags: { tag: string }[];
  community?: { name: string; slug: string } | null;
  _count: { comments: number; reactions: number; reposts: number };
  reactions: { id: string }[];
  savedBy: { id: string }[];
  createdAt: string;
  platform?: string;
  platformPostUrl?: string;
}

const LAYOUT_OPTIONS: { id: FeedLayout; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "cards", label: "Cards", icon: LayoutList, desc: "Twitter/X style card feed" },
  { id: "grid", label: "Grid", icon: LayoutGrid, desc: "Instagram style photo grid" },
  { id: "reels", label: "Reels", icon: Smartphone, desc: "Short-form vertical scroll" },
  { id: "video", label: "Video", icon: Film, desc: "YouTube style video feed" },
];

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  youtube: "#FF0000",
  tiktok: "#000000",
  twitter: "#1DA1F2",
  twitch: "#9146FF",
  spotify: "#1DB954",
  mesh: "#3b82f6",
};

export default function CustomFeedPage() {
  const [layout, setLayout] = useState<FeedLayout>("cards");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLayoutPicker, setShowLayoutPicker] = useState(false);
  const [feedSource, setFeedSource] = useState("all");

  useEffect(() => {
    async function loadFeed() {
      try {
        const res = await fetch("/api/feed?source=" + feedSource);
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts || []);
        }
      } catch {
        // empty feed
      } finally {
        setLoading(false);
      }
    }
    loadFeed();
  }, [feedSource]);

  const currentLayout = LAYOUT_OPTIONS.find((l) => l.id === layout);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Your Feed</h1>
          <p className="text-sm text-[var(--text-muted)]">Customized to how you like to browse</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Source filter */}
          <div className="relative">
            <button
              onClick={() => setShowLayoutPicker(!showLayoutPicker)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl glass-surface text-sm text-[var(--text-secondary)] hover:border-[var(--glass-border)] transition-colors"
            >
              {currentLayout && <currentLayout.icon className="h-4 w-4" style={{ color: "var(--accent)" }} />}
              {currentLayout?.label}
              <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            </button>

            {showLayoutPicker && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-2 w-64 glass-dropdown rounded-xl p-2 shadow-2xl z-20"
              >
                <p className="text-xs text-[var(--text-muted)] px-2 py-1 mb-1">Choose your feed layout</p>
                {LAYOUT_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => { setLayout(opt.id); setShowLayoutPicker(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                      layout === opt.id ? "bg-[var(--accent-subtle)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
                    }`}
                  >
                    <opt.icon className="h-5 w-5" />
                    <div>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-[var(--text-muted)]">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </div>

          {/* Feed source tabs */}
          <div className="flex gap-1 glass-surface rounded-xl p-1">
            {[
              { id: "all", label: "All" },
              { id: "following", label: "Following" },
              { id: "discover", label: "Discover" },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setFeedSource(s.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  feedSource === s.id ? "brand-button text-white" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feed Content */}
      {posts.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LayoutList className="h-8 w-8 text-[var(--text-muted)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-2">Your feed is empty</h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">Follow people and join communities to see content here</p>
          <Link href="/explore">
            <Button variant="gradient">Explore mesh.me</Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Cards Layout */}
          {layout === "cards" && (
            <div className="space-y-4">
              {posts.map((post) => (
                <CardPost key={post.id} post={post} />
              ))}
            </div>
          )}

          {/* Grid Layout */}
          {layout === "grid" && (
            <div className="grid grid-cols-3 gap-1">
              {posts.map((post) => (
                <GridPost key={post.id} post={post} />
              ))}
            </div>
          )}

          {/* Reels Layout */}
          {layout === "reels" && (
            <div className="max-w-sm mx-auto space-y-4">
              {posts.map((post) => (
                <ReelPost key={post.id} post={post} />
              ))}
            </div>
          )}

          {/* Video Layout */}
          {layout === "video" && (
            <div className="space-y-6">
              {posts.map((post) => (
                <VideoPost key={post.id} post={post} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CardPost({ post }: { post: FeedPost }) {
  const [liked, setLiked] = useState(post.reactions.length > 0);
  const [saved, setSaved] = useState(post.savedBy.length > 0);
  const [likeCount, setLikeCount] = useState(post._count.reactions);
  const [reposted, setReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(post._count.reposts);
  const [, startTransition] = useTransition();
  const platform = post.platform || "mesh";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-4 transition-all"
    >
      <div className="flex items-start gap-3">
        <Link href={`/profile/${post.author.username}`}>
          <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size="md" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/profile/${post.author.username}`} className="font-semibold text-sm text-[var(--text-primary)] hover:underline">
              {post.author.displayName}
            </Link>
            {post.author.isVerified && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">verified</Badge>}
            <span className="text-xs text-[var(--text-muted)]">@{post.author.username}</span>
            <span className="text-xs text-[var(--text-muted)]">&middot;</span>
            <span className="text-xs text-[var(--text-muted)]">{formatRelativeTime(post.createdAt)}</span>
            {platform !== "mesh" && (
              <span className="ml-auto px-2 py-0.5 rounded-md text-[10px] font-medium text-white" style={{ backgroundColor: PLATFORM_COLORS[platform] || "#666" }}>
                {platform}
              </span>
            )}
          </div>

          {post.community && (
            <Link href={`/communities/${post.community.slug}`} className="text-xs transition-colors hover:underline" style={{ color: "var(--accent)" }}>
              in {post.community.name}
            </Link>
          )}

          <p className="text-sm text-[var(--text-secondary)] mt-2 whitespace-pre-wrap">{post.content}</p>

          {post.media.length > 0 && (
            <div className={`mt-3 rounded-xl overflow-hidden ${post.media.length > 1 ? "grid grid-cols-2 gap-1" : ""}`}>
              {post.media.map((m) => (
                <div key={m.id} className="bg-[var(--bg-tertiary)] aspect-video rounded-lg flex items-center justify-center">
                  <span className="text-xs text-[var(--text-muted)]">{m.type === "image" ? "Image" : "Video"}</span>
                </div>
              ))}
            </div>
          )}

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {post.tags.map((t) => (
                <span key={t.tag} className="text-xs cursor-pointer transition-colors" style={{ color: "var(--accent)" }}>#{t.tag}</span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-6 mt-3 pt-3 border-t border-[var(--border-primary)]">
            <button onClick={() => { setLiked(!liked); setLikeCount(liked ? likeCount - 1 : likeCount + 1); startTransition(async () => { await toggleReaction(post.id); }); }}
              className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? "text-red-500" : "text-[var(--text-muted)] hover:text-red-400"}`}>
              <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />{likeCount > 0 && likeCount}
            </button>
            <Link href={`/feed/${post.id}`} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors">
              <MessageCircle className="h-4 w-4" />{post._count.comments > 0 && post._count.comments}
            </Link>
            <button onClick={() => { startTransition(async () => { const result = await repost(post.id); if (result && 'reposted' in result) { const didRepost = !!result.reposted; setReposted(didRepost); setRepostCount(prev => didRepost ? prev + 1 : prev - 1); } }); }}
              className={`flex items-center gap-1.5 text-xs transition-colors ${reposted ? "text-green-500" : "text-[var(--text-muted)] hover:text-green-400"}`}>
              <Repeat2 className="h-4 w-4" />{repostCount > 0 && repostCount}
            </button>
            <button className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
              <Share2 className="h-4 w-4" />
            </button>
            <button onClick={() => { setSaved(!saved); startTransition(async () => { await toggleSavePost(post.id); }); }}
              className={`flex items-center gap-1.5 text-xs ml-auto transition-colors ${saved ? "text-yellow-500" : "text-[var(--text-muted)] hover:text-yellow-400"}`}>
              <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
            </button>
            {post.platformPostUrl && (
              <a href={post.platformPostUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function GridPost({ post }: { post: FeedPost }) {
  return (
    <Link href={`/feed/${post.id}`}>
      <div className="aspect-square glass-surface rounded-sm overflow-hidden relative group cursor-pointer">
        {post.media.length > 0 ? (
          <div className="w-full h-full bg-[var(--bg-tertiary)] flex items-center justify-center">
            <span className="text-xs text-[var(--text-muted)]">Media</span>
          </div>
        ) : (
          <div className="w-full h-full p-3 flex items-center justify-center">
            <p className="text-xs text-[var(--text-tertiary)] line-clamp-4 text-center">{post.content}</p>
          </div>
        )}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
          <span className="flex items-center gap-1 text-white text-sm"><Heart className="h-4 w-4 fill-current" />{post._count.reactions}</span>
          <span className="flex items-center gap-1 text-white text-sm"><MessageCircle className="h-4 w-4 fill-current" />{post._count.comments}</span>
        </div>
        {post.media.length > 1 && (
          <div className="absolute top-2 right-2"><LayoutGrid className="h-4 w-4 text-white drop-shadow" /></div>
        )}
      </div>
    </Link>
  );
}

function ReelPost({ post }: { post: FeedPost }) {
  const [liked, setLiked] = useState(post.reactions.length > 0);
  const [, startTransition] = useTransition();
  return (
    <div className="relative aspect-[9/16] glass-card rounded-2xl overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center">
        {post.media.length > 0 ? (
          <span className="text-[var(--text-muted)]">Video Content</span>
        ) : (
          <p className="text-[var(--text-secondary)] text-center px-6 text-lg font-medium">{post.content}</p>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center gap-2 mb-2">
          <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size="sm" />
          <span className="text-sm font-semibold text-white">{post.author.displayName}</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{post.content}</p>
      </div>
      <div className="absolute right-3 bottom-20 flex flex-col items-center gap-4">
        <button onClick={() => { setLiked(!liked); startTransition(async () => { await toggleReaction(post.id); }); }} className="flex flex-col items-center gap-1">
          <Heart className={`h-7 w-7 ${liked ? "text-red-500 fill-current" : "text-white"}`} />
          <span className="text-xs text-white">{post._count.reactions}</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <MessageCircle className="h-7 w-7 text-white" />
          <span className="text-xs text-white">{post._count.comments}</span>
        </button>
        <button className="flex flex-col items-center gap-1">
          <Share2 className="h-7 w-7 text-white" />
        </button>
      </div>
    </div>
  );
}

function VideoPost({ post }: { post: FeedPost }) {
  return (
    <div className="bg-[var(--bg-secondary)]/50 border border-[var(--border-primary)] rounded-2xl overflow-hidden">
      <div className="aspect-video bg-[var(--bg-tertiary)] flex items-center justify-center">
        {post.media.length > 0 ? (
          <span className="text-[var(--text-muted)]">Video Player</span>
        ) : (
          <p className="text-[var(--text-tertiary)] text-center px-8">{post.content}</p>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size="md" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] line-clamp-2">{post.content}</h3>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {post.author.displayName} &middot; {post._count.reactions} likes &middot; {formatRelativeTime(post.createdAt)}
            </p>
          </div>
          <button className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]"><MoreHorizontal className="h-5 w-5" /></button>
        </div>
      </div>
    </div>
  );
}
