"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/lib/actions";
import type { FeedCardPost } from "@/lib/feed-data";
import { formatCount } from "@/lib/utils";
import { motion } from "framer-motion";
import { BadgeCheck, Heart, MessageCircle, Play, Search, UserCheck, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";

const PLATFORM_CHIP: Record<string, { label: string; color: string }> = {
  instagram: { label: "Instagram", color: "#E4405F" },
  youtube: { label: "YouTube", color: "#FF0000" },
  tiktok: { label: "TikTok", color: "#69C9D0" },
  twitter: { label: "X", color: "#1DA1F2" },
  twitch: { label: "Twitch", color: "#9146FF" },
  spotify: { label: "Spotify", color: "#1DB954" },
  linkedin: { label: "LinkedIn", color: "#0A66C2" },
  reddit: { label: "Reddit", color: "#FF4500" },
  facebook: { label: "Facebook", color: "#1877F2" },
  discord: { label: "Discord", color: "#5865F2" },
  github: { label: "GitHub", color: "#8b949e" },
  meshme: { label: "mesh.me", color: "#2d7ff9" },
};

const spring = { type: "spring" as const, stiffness: 320, damping: 30, mass: 0.7 };

type SuggestedUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
  interests: { id: string; tag: string }[];
  followerCount: number;
};

type SuggestedCommunity = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  iconUrl: string | null;
  memberCount: number;
  postCount: number;
};

type TrendingTag = { tag: string; count: number };

type ExploreDiscoveryProps = {
  currentUserId: string;
  posts: FeedCardPost[];
  trendingTags: TrendingTag[];
  suggestedUsers: SuggestedUser[];
  communities: SuggestedCommunity[];
};

export function ExploreDiscovery({ currentUserId, posts, trendingTags, suggestedUsers, communities }: ExploreDiscoveryProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const visiblePosts = useMemo(() => {
    if (!activeTag) return posts;
    const needle = activeTag.toLowerCase();
    return posts.filter(
      (post) =>
        post.tags.some((tag) => tag.tag.toLowerCase() === needle) ||
        post.content.toLowerCase().includes(needle),
    );
  }, [posts, activeTag]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = query.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <motion.form
        onSubmit={submitSearch}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={spring}
        className="glass-card sticky top-3 z-20 flex items-center gap-3 rounded-2xl px-4 py-3"
      >
        <Search className="h-4.5 w-4.5 shrink-0 text-[var(--text-muted)]" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people, posts, and platforms across the mesh"
          className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          aria-label="Search the mesh"
          suppressHydrationWarning
        />
      </motion.form>

      {trendingTags.length > 0 && (
        <div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 mt-5 flex gap-2 overflow-x-auto px-1 pb-1">
          {trendingTags.map((tag, index) => {
            const selected = activeTag === tag.tag;
            return (
              <motion.button
                key={tag.tag}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.03 * index }}
                whileTap={{ scale: 0.94 }}
                onClick={() => setActiveTag(selected ? null : tag.tag)}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "border-[var(--border-secondary)] bg-white/[0.03] text-[var(--text-secondary)] hover:border-[var(--border-primary)] hover:text-[var(--text-primary)]"
                }`}
              >
                #{tag.tag}
                <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">{formatCount(tag.count)}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {suggestedUsers.length > 0 && (
        <section className="mt-7" aria-label="People to follow">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Meshes to explore</h2>
          <div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {suggestedUsers.map((user, index) => (
              <ExplorePersonCard key={user.id} user={user} currentUserId={currentUserId} index={index} />
            ))}
          </div>
        </section>
      )}

      {communities.length > 0 && (
        <section className="mt-7" aria-label="Communities">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Communities</h2>
          <div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {communities.map((community, index) => (
              <motion.div
                key={community.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.04 * index }}
              >
                <Link
                  href={`/communities/${community.slug}`}
                  className="glass-card group flex w-56 shrink-0 flex-col gap-2 rounded-2xl p-4 transition-all hover:border-[var(--border-primary)]"
                >
                  <div className="flex items-center gap-3">
                    <Avatar src={community.iconUrl} alt={community.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
                        {community.name}
                      </p>
                      <p className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                        <UsersRound className="h-3 w-3" aria-hidden />
                        {formatCount(community.memberCount)} members
                      </p>
                    </div>
                  </div>
                  {community.description && (
                    <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">{community.description}</p>
                  )}
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8" aria-label="Discover content">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">
            {activeTag ? `#${activeTag}` : "For you"}
          </h2>
          {activeTag && (
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className="text-xs text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
            >
              Clear filter
            </button>
          )}
        </div>
        {visiblePosts.length === 0 ? (
          <div className="glass-card rounded-2xl p-10 text-center text-sm text-[var(--text-muted)]">
            Nothing here yet. Connect more accounts or follow more meshes to fill your discovery grid.
          </div>
        ) : (
          <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
            {visiblePosts.map((post, index) => (
              <ExploreTile key={post.id} post={post} index={index} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ExplorePersonCard({ user, currentUserId, index }: { user: SuggestedUser; currentUserId: string; index: number }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleFollow = () => {
    const previous = isFollowing;
    setIsFollowing(!previous);
    startTransition(async () => {
      try {
        const result = await toggleFollow(user.id);
        if (result && "error" in result) setIsFollowing(previous);
      } catch {
        setIsFollowing(previous);
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.04 * index }}
      className="glass-card group w-44 shrink-0 rounded-2xl p-4 text-center transition-all hover:border-[var(--border-primary)]"
    >
      <Link href={`/profile/${user.username}`} className="block">
        <Avatar src={user.avatarUrl} alt={user.displayName} size="lg" className="mx-auto mb-2.5" />
        <p className="flex items-center justify-center gap-1 truncate text-sm font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
          <span className="truncate">{user.displayName}</span>
          {user.isVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--accent)]" aria-label="Verified" />}
        </p>
        <p className="truncate text-xs text-[var(--text-muted)]">@{user.username}</p>
        {user.interests.length > 0 && (
          <div className="mt-2 flex flex-wrap justify-center gap-1">
            {user.interests.slice(0, 2).map((interest) => (
              <Badge key={interest.id} variant="secondary" className="text-[10px]">
                {interest.tag}
              </Badge>
            ))}
          </div>
        )}
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">{formatCount(user.followerCount)} followers</p>
      </Link>
      {currentUserId !== user.id && (
        <Button
          size="sm"
          variant={isFollowing ? "secondary" : "default"}
          onClick={handleFollow}
          disabled={isPending}
          className="mt-3 w-full"
        >
          {isFollowing ? (
            <>
              <UserCheck className="mr-1 h-3.5 w-3.5" /> Following
            </>
          ) : (
            <>
              <UserPlus className="mr-1 h-3.5 w-3.5" /> Follow
            </>
          )}
        </Button>
      )}
    </motion.div>
  );
}

function ExploreTile({ post, index }: { post: FeedCardPost; index: number }) {
  const router = useRouter();
  const media = post.media[0];
  const isVideo = media && ["video", "reel", "short", "stream"].includes(media.type.toLowerCase());
  const platform = (post.platform || "meshme").toLowerCase();
  const chip = PLATFORM_CHIP[platform];
  const authorName = post.externalAuthor?.name || post.author.displayName;

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ ...spring, delay: 0.02 * Math.min(index, 16) }}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => router.push(`/feed?flow=${encodeURIComponent(post.id)}`)}
      className="glass-card group relative block w-full overflow-hidden rounded-2xl text-left transition-all hover:border-[var(--border-primary)]"
      aria-label={`Open post by ${authorName} in the Flow`}
    >
      {media ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.url} alt="" loading="lazy" className="w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          {isVideo && (
            <span className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 backdrop-blur">
              <Play className="h-3.5 w-3.5 fill-white text-white" aria-hidden />
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-3 pt-8">
            <TileMeta post={post} authorName={authorName} chip={chip} overlay />
          </div>
        </div>
      ) : (
        <div className="p-4">
          <p className="line-clamp-5 whitespace-pre-wrap text-sm text-[var(--text-primary)]">{post.content}</p>
          <div className="mt-3">
            <TileMeta post={post} authorName={authorName} chip={chip} />
          </div>
        </div>
      )}
    </motion.button>
  );
}

function TileMeta({ post, authorName, chip, overlay }: { post: FeedCardPost; authorName: string; chip?: { label: string; color: string }; overlay?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className={`min-w-0 truncate font-medium ${overlay ? "text-white/90" : "text-[var(--text-primary)]"}`}>{authorName}</span>
      <span className={`flex shrink-0 items-center gap-2 ${overlay ? "text-white/80" : "text-[var(--text-secondary)]"}`}>
        {chip && chip.label !== "mesh.me" && (
          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: `${chip.color}33`, color: chip.color }}>
            {chip.label}
          </span>
        )}
        <span className="flex items-center gap-0.5">
          <Heart className="h-3 w-3" aria-hidden /> {formatCount(post._count.reactions)}
        </span>
        <span className="flex items-center gap-0.5">
          <MessageCircle className="h-3 w-3" aria-hidden /> {formatCount(post._count.comments)}
        </span>
      </span>
    </div>
  );
}
