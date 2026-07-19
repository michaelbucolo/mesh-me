"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/lib/actions";
import type { FeedCardPost } from "@/lib/feed-data";
import { formatCount } from "@/lib/utils";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  BadgeCheck,
  Clock,
  Compass,
  Hash,
  Heart,
  ImageIcon,
  MessageCircle,
  MessagesSquare,
  Play,
  Search,
  SlidersHorizontal,
  TrendingUp,
  UserCheck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
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

const VIDEO_TYPES = ["video", "reel", "short", "stream"];

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

type ExploreTab = "feed" | "people" | "communities";
type FeedMode = "foryou" | "trending" | "media";
type MediaFilter = "all" | "photos" | "videos" | "text";
type SortMode = "top" | "latest";

const TABS: { id: ExploreTab; label: string; icon: typeof Compass }[] = [
  { id: "feed", label: "Discover", icon: Compass },
  { id: "people", label: "People", icon: UsersRound },
  { id: "communities", label: "Communities", icon: MessagesSquare },
];

const FEED_MODES: { id: FeedMode; label: string }[] = [
  { id: "foryou", label: "For you" },
  { id: "trending", label: "Trending" },
  { id: "media", label: "Media" },
];

const MEDIA_FILTERS: { id: MediaFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "photos", label: "Photos" },
  { id: "videos", label: "Videos" },
  { id: "text", label: "Text" },
];

type ExploreDiscoveryProps = {
  currentUserId: string;
  posts: FeedCardPost[];
  trendingTags: TrendingTag[];
  suggestedUsers: SuggestedUser[];
  communities: SuggestedCommunity[];
  /** Guest browsing: everything is viewable, interactions route to login. */
  signedOut?: boolean;
};

function postScore(post: FeedCardPost) {
  return post._count.reactions * 2 + post._count.comments * 3 + post._count.reposts * 4;
}

function isVideoPost(post: FeedCardPost) {
  return post.media.some((item) => VIDEO_TYPES.includes(item.type.toLowerCase()));
}

function isPhotoPost(post: FeedCardPost) {
  return post.media.some((item) => ["image", "photo"].includes(item.type.toLowerCase()));
}

export function ExploreDiscovery({ currentUserId, posts, trendingTags, suggestedUsers, communities, signedOut = false }: ExploreDiscoveryProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ExploreTab>("feed");
  const [feedMode, setFeedMode] = useState<FeedMode>("foryou");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("top");
  const [showFilters, setShowFilters] = useState(false);

  const trimmedQuery = query.trim().toLowerCase();

  const availablePlatforms = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      const platform = (post.platform || "meshme").toLowerCase();
      counts.set(platform, (counts.get(platform) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([platform]) => PLATFORM_CHIP[platform])
      .sort((a, b) => b[1] - a[1])
      .map(([platform]) => platform);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    let result = posts;

    if (feedMode === "media") {
      result = result.filter((post) => post.media.length > 0);
    }

    if (activeTag) {
      const needle = activeTag.toLowerCase();
      result = result.filter(
        (post) =>
          post.tags.some((item) => item.tag.toLowerCase() === needle) ||
          post.content.toLowerCase().includes(needle),
      );
    }

    if (activePlatform) {
      result = result.filter((post) => (post.platform || "meshme").toLowerCase() === activePlatform);
    }

    if (mediaFilter === "photos") result = result.filter(isPhotoPost);
    else if (mediaFilter === "videos") result = result.filter(isVideoPost);
    else if (mediaFilter === "text") result = result.filter((post) => post.media.length === 0 && post.content.trim().length > 0);

    if (trimmedQuery) {
      result = result.filter((post) => {
        const authorName = (post.externalAuthor?.name || post.author.displayName).toLowerCase();
        return (
          post.content.toLowerCase().includes(trimmedQuery) ||
          authorName.includes(trimmedQuery) ||
          post.author.username.toLowerCase().includes(trimmedQuery) ||
          post.tags.some((item) => item.tag.toLowerCase().includes(trimmedQuery))
        );
      });
    }

    if (feedMode === "trending" || sortMode === "top") {
      result = [...result].sort((a, b) => postScore(b) - postScore(a));
    } else {
      result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [posts, feedMode, activeTag, activePlatform, mediaFilter, sortMode, trimmedQuery]);

  const filteredUsers = useMemo(() => {
    if (!trimmedQuery) return suggestedUsers;
    return suggestedUsers.filter(
      (user) =>
        user.displayName.toLowerCase().includes(trimmedQuery) ||
        user.username.toLowerCase().includes(trimmedQuery) ||
        user.interests.some((interest) => interest.tag.toLowerCase().includes(trimmedQuery)),
    );
  }, [suggestedUsers, trimmedQuery]);

  const filteredCommunities = useMemo(() => {
    if (!trimmedQuery) return communities;
    return communities.filter(
      (community) =>
        community.name.toLowerCase().includes(trimmedQuery) ||
        (community.description ?? "").toLowerCase().includes(trimmedQuery),
    );
  }, [communities, trimmedQuery]);

  const hasActiveFilters = Boolean(activeTag || activePlatform || mediaFilter !== "all");
  const isPostTab = tab === "feed";

  const clearFilters = () => {
    setActiveTag(null);
    setActivePlatform(null);
    setMediaFilter("all");
  };

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = query.trim();
    if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <div className="sticky top-3 z-20 space-y-3">
        <motion.form
          onSubmit={submitSearch}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="glass-card flex items-center gap-3 rounded-2xl px-4 py-3"
        >
          <Search className="h-4.5 w-4.5 shrink-0 text-[var(--text-muted)]" aria-hidden />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the mesh — filter instantly, press Enter for deep search"
            className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            aria-label="Search the mesh"
            suppressHydrationWarning
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="shrink-0 rounded-full p-1 text-[var(--text-muted)] transition hover:bg-white/5 hover:text-[var(--text-primary)]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
          {query.trim() && (
            <button
              type="submit"
              className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--accent)]/15 px-3 py-1 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/25"
            >
              Deep search <ArrowUpRight className="h-3 w-3" aria-hidden />
            </button>
          )}
        </motion.form>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 }}
          className="glass-card flex items-center gap-1 overflow-x-auto rounded-2xl p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Explore sections"
        >
          {TABS.map((item) => {
            const selected = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(item.id)}
                className={`relative flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
                  selected ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                }`}
              >
                {selected && (
                  <motion.span
                    layoutId="explore-tab-pill"
                    transition={spring}
                    className="absolute inset-0 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/12"
                    aria-hidden
                  />
                )}
                <Icon className={`relative h-3.5 w-3.5 ${selected ? "text-[var(--accent)]" : ""}`} aria-hidden />
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
          {isPostTab && (
            <div className="ml-2 flex shrink-0 items-center gap-0.5 rounded-xl bg-[var(--bg-primary)]/35 p-0.5" role="tablist" aria-label="Discover feed">
              {FEED_MODES.map((mode) => {
                const selected = feedMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setFeedMode(mode.id);
                      if (mode.id === "media" && mediaFilter === "text") setMediaFilter("all");
                    }}
                    className={`relative rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                      selected ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                    }`}
                  >
                    {selected && (
                      <motion.span
                        layoutId="explore-feed-mode-pill"
                        transition={spring}
                        className="absolute inset-0 rounded-lg border border-[var(--accent)]/35 bg-[var(--accent)]/10"
                        aria-hidden
                      />
                    )}
                    <span className="relative">{mode.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          {isPostTab && (
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                showFilters || hasActiveFilters
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              }`}
              aria-expanded={showFilters}
              aria-label="Toggle filters"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              Filters
              {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden />}
            </button>
          )}
        </motion.div>
      </div>

      <AnimatePresence initial={false}>
        {isPostTab && showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="glass-card mt-3 space-y-3 rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Content</span>
                {MEDIA_FILTERS.filter((filter) => feedMode !== "media" || filter.id !== "text").map((filter) => (
                  <FilterChip
                    key={filter.id}
                    label={filter.label}
                    selected={mediaFilter === filter.id}
                    onClick={() => setMediaFilter(filter.id)}
                  />
                ))}
                <span className="mx-1 h-4 w-px bg-[var(--border-secondary)]" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Sort</span>
                <FilterChip
                  label="Top"
                  icon={<TrendingUp className="h-3 w-3" aria-hidden />}
                  selected={sortMode === "top"}
                  onClick={() => setSortMode("top")}
                />
                <FilterChip
                  label="Latest"
                  icon={<Clock className="h-3 w-3" aria-hidden />}
                  selected={sortMode === "latest"}
                  onClick={() => setSortMode("latest")}
                />
              </div>
              {availablePlatforms.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Platform</span>
                  {availablePlatforms.map((platform) => {
                    const chip = PLATFORM_CHIP[platform];
                    const selected = activePlatform === platform;
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => setActivePlatform(selected ? null : platform)}
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                          selected ? "" : "border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        }`}
                        style={selected ? { borderColor: chip.color, backgroundColor: `${chip.color}22`, color: chip.color } : undefined}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
                >
                  <X className="h-3 w-3" aria-hidden /> Clear all filters
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isPostTab && trendingTags.length > 0 && (
        <div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1">
          {trendingTags.map((tag) => {
            const selected = activeTag === tag.tag;
            return (
              <button
                key={tag.tag}
                type="button"
                onClick={() => setActiveTag(selected ? null : tag.tag)}
                className={`flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
                    : "border-[var(--border-secondary)] bg-white/[0.03] text-[var(--text-secondary)] hover:border-[var(--border-primary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <Hash className="h-3 w-3" aria-hidden />
                {tag.tag}
                <span className="text-[10px] text-[var(--text-muted)]">{formatCount(tag.count)}</span>
              </button>
            );
          })}
        </div>
      )}

      {isPostTab && (
        <section className="mt-6" aria-label="Discover content">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
              {feedMode === "trending" ? (
                <>
                  <TrendingUp className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden /> Trending now
                </>
              ) : feedMode === "media" ? (
                <>
                  <ImageIcon className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden /> Media
                </>
              ) : activeTag ? (
                `#${activeTag}`
              ) : (
                "For you"
              )}
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              {filteredPosts.length} {filteredPosts.length === 1 ? "post" : "posts"}
            </span>
          </div>
          {filteredPosts.length === 0 ? (
            <EmptyState
              message={
                hasActiveFilters || trimmedQuery
                  ? "No posts match your filters. Try broadening your search."
                  : "Nothing here yet. Connect more accounts or follow more meshes to fill your discovery grid."
              }
              onClear={hasActiveFilters ? clearFilters : undefined}
            />
          ) : (
            <motion.div
              key={`${feedMode}-${activeTag ?? ""}-${activePlatform ?? ""}-${mediaFilter}-${sortMode}-${trimmedQuery}`}
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3"
            >
              {filteredPosts.map((post) => (
                <ExploreTile key={post.id} post={post} />
              ))}
            </motion.div>
          )}
        </section>
      )}

      {tab === "people" && (
        <section className="mt-6" aria-label="People to follow">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">People to follow</h2>
            <span className="text-xs text-[var(--text-muted)]">
              {filteredUsers.length} {filteredUsers.length === 1 ? "mesh" : "meshes"}
            </span>
          </div>
          {filteredUsers.length === 0 ? (
            <EmptyState message="No meshes match your search." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filteredUsers.map((user) => (
                <ExplorePersonCard key={user.id} user={user} currentUserId={currentUserId} fullWidth signedOut={signedOut} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "communities" && (
        <section className="mt-6" aria-label="Communities">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Communities</h2>
            <span className="text-xs text-[var(--text-muted)]">
              {filteredCommunities.length} {filteredCommunities.length === 1 ? "community" : "communities"}
            </span>
          </div>
          {filteredCommunities.length === 0 ? (
            <EmptyState message="No communities match your search." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCommunities.map((community) => (
                <CommunityCard key={community.id} community={community} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function FilterChip({ label, selected, onClick, icon }: { label: string; selected: boolean; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
        selected
          ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--accent)]"
          : "border-[var(--border-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState({ message, onClear }: { message: string; onClear?: () => void }) {
  return (
    <div className="glass-card flex flex-col items-center gap-3 rounded-2xl p-10 text-center">
      <Compass className="h-8 w-8 text-[var(--text-muted)]" aria-hidden />
      <p className="text-sm text-[var(--text-muted)]">{message}</p>
      {onClear && (
        <Button size="sm" variant="secondary" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

function CommunityCard({ community, compact }: { community: SuggestedCommunity; compact?: boolean }) {
  return (
    <div className={compact ? "shrink-0" : ""}>
      <Link
        href={`/communities/${community.slug}`}
        className={`glass-card group flex flex-col gap-2 rounded-2xl p-4 transition-all hover:border-[var(--border-primary)] ${
          compact ? "w-56 shrink-0" : "h-full"
        }`}
      >
        <div className="flex items-center gap-3">
          <Avatar src={community.iconUrl} alt={community.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent)]">
              {community.name}
            </p>
            <p className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <UsersRound className="h-3 w-3" aria-hidden />
                {formatCount(community.memberCount)}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" aria-hidden />
                {formatCount(community.postCount)}
              </span>
            </p>
          </div>
        </div>
        {community.description && (
          <p className="line-clamp-2 text-xs text-[var(--text-secondary)]">{community.description}</p>
        )}
      </Link>
    </div>
  );
}

function ExplorePersonCard({
  user,
  currentUserId,
  fullWidth,
  signedOut = false,
}: {
  user: SuggestedUser;
  currentUserId: string;
  fullWidth?: boolean;
  signedOut?: boolean;
}) {
  const router = useRouter();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleFollow = () => {
    if (signedOut) {
      router.push("/login?next=/explore");
      return;
    }
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
    <div
      className={`glass-card group rounded-2xl p-4 text-center transition-all hover:border-[var(--border-primary)] ${
        fullWidth ? "w-full" : "w-44 shrink-0"
      }`}
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
    </div>
  );
}

function ExploreTile({ post }: { post: FeedCardPost }) {
  const router = useRouter();
  const media = post.media[0];
  const isVideo = media && VIDEO_TYPES.includes(media.type.toLowerCase());
  const platform = (post.platform || "meshme").toLowerCase();
  const chip = PLATFORM_CHIP[platform];
  const authorName = post.externalAuthor?.name || post.author.displayName;

  return (
    <button
      type="button"
      onClick={() => router.push(`/feed?flow=${encodeURIComponent(post.id)}`)}
      className="glass-card group relative block w-full overflow-hidden rounded-2xl text-left transition-all hover:border-[var(--border-primary)]"
      aria-label={`Open post by ${authorName} in the Flow`}
    >
      {media ? (
        <div className="relative aspect-[4/5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
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
    </button>
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
