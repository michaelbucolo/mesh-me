"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleFollow } from "@/lib/actions";
import type { FeedCardPost } from "@/lib/feed-data";
import { formatCount, safeHref } from "@/lib/utils";
import { AnimatePresence, motion, useMotionTemplate, useReducedMotion, useSpring } from "framer-motion";
import {
  ArrowUpRight,
  BadgeCheck,
  Clock,
  Compass,
  Flame,
  Hash,
  Heart,
  ImageIcon,
  MessageCircle,
  MessagesSquare,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
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

// The Mesh "decisive glide" easing as a framer cubic-bezier tuple.
const MESH_EASE_OUT = [0.16, 1, 0.3, 1] as const;

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

// The discovery feed is the primary Explore surface; For you / Trending / Media
// are modes of that one feed rather than separate top-level destinations, so
// People and Communities get their own tabs instead of being buried in it.
const TABS: { id: ExploreTab; label: string; icon: typeof Compass }[] = [
  { id: "feed", label: "Feed", icon: Sparkles },
  { id: "people", label: "People", icon: UsersRound },
  { id: "communities", label: "Communities", icon: MessagesSquare },
];

const FEED_MODES: { id: FeedMode; label: string; icon: typeof Compass }[] = [
  { id: "foryou", label: "For you", icon: Sparkles },
  { id: "trending", label: "Trending", icon: Flame },
  { id: "media", label: "Media", icon: ImageIcon },
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

function getPostMediaAlt(post: FeedCardPost, authorName: string) {
  const content = post.content.trim();
  return content ? `${authorName}: ${content.slice(0, 120)}` : `${authorName}'s post media`;
}

export function ExploreDiscovery({ currentUserId, posts, trendingTags, suggestedUsers, communities, signedOut = false }: ExploreDiscoveryProps) {
  const router = useRouter();
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
  const contentFilters = MEDIA_FILTERS.filter((filter) => feedMode !== "media" || filter.id !== "text");

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
            /* Was a bare glyph in a 24px box: no face, no --edge ring, no wall,
               and `hover:bg-white/5` — a hardcoded white that tracks neither
               theme. It is a `.key` now, wearing the chip wall via
               `.explore-chip` because the search chrome must stay quieter than
               the results it filters. Sized 28px square — exactly the height of
               the Deep search key beside it, so the two read as one row of parts
               and the bar does not jump when the first character is typed. */
            <button
              type="button"
              onClick={() => setQuery("")}
              className="key explore-chip inline-flex h-7 w-7 shrink-0 items-center justify-center text-[var(--text-muted)]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
          {query.trim() && (
            /* The one primary action in the bar. It was --accent at 15% alpha
               carrying --accent as its own ink — a wash reading as "how loud",
               with unpinned text on it. Moulded from cobalt with its PINNED ink
               instead, character for character the idiom at
               feed-timeline-client.tsx:656. Object wall, not chip: it outranks
               everything else in the bar. */
            <button
              type="submit"
              className="key key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)] inline-flex shrink-0 items-center gap-1 px-3 py-1.5 text-xs font-semibold"
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
          {/* Three tabs with no material at all: no face, no --edge ring, no
              wall. The selected one was a translucent `--accent`/12 pill sliding
              underneath on a layoutId — a TINT standing in for state, which is
              Law 2 inverted (colour reading as "how loud"). Every tab is a `.key`
              now and the selected one is moulded from cobalt with its pinned ink,
              the same answer globals.css:3367 records for the feed's four chips:
              "all three selected states are moulded from cobalt … a tint is
              'louder = selected', which is exactly the reading Law 2 forbids." */}
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
                className={`key inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2 text-xs font-semibold ${
                  selected
                    ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
          {isPostTab && (
            /* Same treatment. The "on" state was --accent ink on nothing; it is
               the cobalt plastic now, and the active-filter dot rides that
               plastic's PINNED ink instead of --accent, which would have been
               near-invisible against a cobalt face. */
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className={`key ml-auto inline-flex shrink-0 items-center gap-1.5 px-3 py-2 text-xs font-semibold ${
                showFilters || hasActiveFilters
                  ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]"
                  : "text-[var(--text-secondary)]"
              }`}
              aria-expanded={showFilters}
              aria-label="Toggle filters"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              Filters
              {hasActiveFilters && <span className="h-1.5 w-1.5 rounded-full bg-[var(--mould-cobalt-ink)]" aria-hidden />}
            </button>
          )}
        </motion.div>
        {tab === "feed" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.08 }}
            className="glass-card flex items-center gap-1 overflow-x-auto rounded-2xl p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Discover feed mode"
          >
            {/* Second strip, identical failure to the first: three faceless
                buttons and an --accent/12 pill for state. Keys, chip wall — this
                row is chrome about the chrome, so it stays a step quieter than
                the section tabs above it (Law 3). */}
            {FEED_MODES.map((mode) => {
              const selected = feedMode === mode.id;
              const Icon = mode.icon;
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
                  className={`key explore-chip inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ${
                    selected
                      ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]"
                      : "text-[var(--text-secondary)]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isPostTab && showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              height: { duration: 0.26, ease: MESH_EASE_OUT },
              opacity: { duration: 0.2, ease: MESH_EASE_OUT },
            }}
            className="overflow-hidden"
          >
            <div className="glass-card mt-3 space-y-3 rounded-2xl p-4">
              <div className="mesh-cascade-soft flex flex-wrap items-center gap-2">
                <span className="text-micro font-semibold mesh-eyebrow text-[var(--text-muted)]" style={{ "--i": 0 } as React.CSSProperties}>Content</span>
                {contentFilters.map((filter, filterIndex) => (
                  <FilterChip
                    key={filter.id}
                    label={filter.label}
                    selected={mediaFilter === filter.id}
                    onClick={() => setMediaFilter(filter.id)}
                    style={{ "--i": filterIndex + 1 } as React.CSSProperties}
                  />
                ))}
                <span className="mx-1 h-4 w-px bg-[var(--border-secondary)]" aria-hidden style={{ "--i": contentFilters.length + 1 } as React.CSSProperties} />
                <span className="text-micro font-semibold mesh-eyebrow text-[var(--text-muted)]" style={{ "--i": contentFilters.length + 2 } as React.CSSProperties}>Sort</span>
                <FilterChip
                  label="Top"
                  icon={<TrendingUp className="h-3 w-3" aria-hidden />}
                  selected={sortMode === "top"}
                  onClick={() => setSortMode("top")}
                  style={{ "--i": contentFilters.length + 3 } as React.CSSProperties}
                />
                <FilterChip
                  label="Latest"
                  icon={<Clock className="h-3 w-3" aria-hidden />}
                  selected={sortMode === "latest"}
                  onClick={() => setSortMode("latest")}
                  style={{ "--i": contentFilters.length + 4 } as React.CSSProperties}
                />
              </div>
              {availablePlatforms.length > 1 && (
                <div className="mesh-cascade-soft flex flex-wrap items-center gap-2">
                  <span className="text-micro font-semibold mesh-eyebrow text-[var(--text-muted)]" style={{ "--i": 0 } as React.CSSProperties}>Platform</span>
                  {/* The brand hex stays — it identifies a third party, so it is
                      legitimately WHICH-not-how-loud. What goes is the hex as a
                      SURFACE with its own colour as ink: selected was
                      `backgroundColor: ${chip.color}22` under `color: chip.color`,
                      an unpinned ink on a 13%-alpha wash of itself, which is the
                      exact failure the --mould-*-ink triples exist to prevent.
                      Same fix post-card.tsx:482 already landed: the brand colour
                      becomes a decorative swatch carrying NO text, the label rides
                      a pinned ink, and selection is a material change — the cobalt
                      plastic — not a tint. */}
                  {availablePlatforms.map((platform, platformIndex) => {
                    const chip = PLATFORM_CHIP[platform];
                    const selected = activePlatform === platform;
                    return (
                      <button
                        key={platform}
                        type="button"
                        onClick={() => setActivePlatform(selected ? null : platform)}
                        className={`key explore-chip inline-flex items-center gap-1.5 px-3 py-1 text-micro font-semibold ${
                          selected
                            ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]"
                            : "text-[var(--text-secondary)]"
                        }`}
                        style={{ "--i": platformIndex + 1 } as React.CSSProperties}
                        aria-pressed={selected}
                      >
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: chip.color }} aria-hidden />
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {hasActiveFilters && (
                /* Naked text pretending to be a control — no face, no ring, no
                   wall, and the only feedback was an ink change. A key. */
                <button
                  type="button"
                  onClick={clearFilters}
                  className="key explore-chip animate-mesh-rise-soft inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]"
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
          {trendingTags.map((tag, index) => {
            const selected = activeTag === tag.tag;
            return (
              /* `bg-white/[0.03]` for the resting face and `--accent`/15 for the
                 selected one: a hardcoded white that tracks neither theme, and a
                 tint doing the job of a material. Both replaced by the shared key
                 — --face at rest, the cobalt plastic when selected.

                 `whileTap={{ scale: 0.94 }}` is deleted, and that deletion is
                 load-bearing rather than tidying. `transform` and `translate` are
                 separate properties that COMPOSE, so framer's inline scale would
                 have survived underneath `.key:active`'s translate and the chip
                 would have shrunk AND dropped at once — the exact bug
                 globals.css:1080 and :7486 both record. A key answers by
                 bottoming out, never by shrinking away from the finger. */
              <motion.button
                key={tag.tag}
                type="button"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.03 * index }}
                onClick={() => setActiveTag(selected ? null : tag.tag)}
                aria-pressed={selected}
                className={`key explore-chip inline-flex shrink-0 items-center gap-1 px-3.5 py-1.5 text-xs font-semibold ${
                  selected
                    ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                <Hash className="h-3 w-3" aria-hidden />
                {tag.tag}
                {/* On the cobalt face the count inherits the plastic's pinned ink;
                    on --face it drops to --text-muted, which clears AA there. */}
                <span className={selected ? "text-micro" : "text-micro text-[var(--text-muted)]"}>{formatCount(tag.count)}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {tab === "feed" && feedMode === "foryou" && (
        <>
          {!trimmedQuery && !hasActiveFilters && (
            <TrendingHero posts={posts} onSeeAll={() => setFeedMode("trending")} />
          )}
          {!trimmedQuery && suggestedUsers.length > 0 && (
            <section className="mt-6" aria-label="People to follow">
              <SectionHeader title="Meshes to explore" action={{ label: "See all", onClick: () => setTab("people") }} />
              <div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {suggestedUsers.slice(0, 8).map((user, index) => (
                  <ExplorePersonCard key={user.id} user={user} currentUserId={currentUserId} index={index} signedOut={signedOut} />
                ))}
              </div>
            </section>
          )}
          {!trimmedQuery && communities.length > 0 && (
            <section className="mt-6" aria-label="Communities">
              <SectionHeader title="Communities" action={{ label: "See all", onClick: () => setTab("communities") }} />
              <div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
                {communities.slice(0, 6).map((community, index) => (
                  <CommunityCard key={community.id} community={community} index={index} compact />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {isPostTab && (
        <section className="mt-6" aria-label="Discover content">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
              {feedMode === "trending" ? (
                <>
                  <Flame className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden /> Trending now
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
            <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
              {filteredPosts.map((post, index) => (
                <ExploreTile key={post.id} post={post} index={index} />
              ))}
            </div>
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
              {filteredUsers.map((user, index) => (
                <ExplorePersonCard key={user.id} user={user} currentUserId={currentUserId} index={index} fullWidth signedOut={signedOut} />
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
              {filteredCommunities.map((community, index) => (
                <CommunityCard key={community.id} community={community} index={index} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="text-xs font-medium text-[var(--accent)] transition hover:opacity-80"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// Six of these render at once (four content filters, two sort modes) and not one
// of them had a face, an --edge ring or a wall — a 1px --border-secondary hairline
// is a rule, not a legal boundary. They are keys now, chip wall, and the selected
// one is moulded from cobalt rather than washed in 15% accent.
function FilterChip({ label, selected, onClick, icon, style }: { label: string; selected: boolean; onClick: () => void; icon?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      aria-pressed={selected}
      className={`key explore-chip inline-flex items-center gap-1 px-3 py-1 text-micro font-semibold ${
        selected
          ? "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]"
          : "text-[var(--text-secondary)]"
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

function CommunityCard({ community, index, compact }: { community: SuggestedCommunity; index: number; compact?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.04 * index }}
      className={compact ? "shrink-0" : ""}
    >
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
            <p className="flex items-center gap-2 text-micro text-[var(--text-muted)]">
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
    </motion.div>
  );
}

function ExplorePersonCard({
  user,
  currentUserId,
  index,
  fullWidth,
  signedOut = false,
}: {
  user: SuggestedUser;
  currentUserId: string;
  index: number;
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.04 * Math.min(index, 12) }}
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
              <Badge key={interest.id} variant="secondary" className="text-micro">
                {interest.tag}
              </Badge>
            ))}
          </div>
        )}
        <p className="mt-2 text-micro text-[var(--text-muted)]">{formatCount(user.followerCount)} followers</p>
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
  const reduce = useReducedMotion();
  const media = post.media[0];
  const isVideo = media && VIDEO_TYPES.includes(media.type.toLowerCase());
  const platform = (post.platform || "meshme").toLowerCase();
  const chip = PLATFORM_CHIP[platform];
  const authorName = post.externalAuthor?.name || post.author.displayName;

  // Pointer-driven 3D tilt + moving specular sheen. Springs keep it physical;
  // reduced motion skips every update so the tile stays flat and static.
  const rotateX = useSpring(0, { stiffness: 300, damping: 22, mass: 0.6 });
  const rotateY = useSpring(0, { stiffness: 300, damping: 22, mass: 0.6 });
  const sheenX = useSpring(50, { stiffness: 220, damping: 26 });
  const sheenY = useSpring(50, { stiffness: 220, damping: 26 });
  const sheen = useMotionTemplate`radial-gradient(150px circle at ${sheenX}% ${sheenY}%, rgba(255,255,255,0.3), rgba(110,139,255,0.14) 34%, transparent 62%)`;

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (reduce) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    rotateY.set((px - 0.5) * 12); // horizontal → yaw, capped ±6deg
    rotateX.set((0.5 - py) * 12); // vertical → pitch, capped ±6deg
    sheenX.set(px * 100);
    sheenY.set(py * 100);
  };

  const resetTilt = () => {
    rotateX.set(0);
    rotateY.set(0);
    sheenX.set(50);
    sheenY.set(50);
  };

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{ ...spring, delay: 0.02 * Math.min(index, 16) }}
      style={{ rotateX, rotateY, transformPerspective: 900 }}
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.985 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetTilt}
      onClick={() => router.push(`/feed?flow=${encodeURIComponent(post.id)}`)}
      className="glass-card group relative block w-full overflow-hidden rounded-2xl text-left transition-all hover:border-[var(--border-primary)]"
      aria-label={`Open post by ${authorName} in the Flow`}
    >
      {media ? (
        <div className="relative aspect-[4/5]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={media.url} alt={getPostMediaAlt(post, authorName)} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
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
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-10 rounded-2xl opacity-0 mix-blend-plus-lighter transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: sheen }}
      />
    </motion.button>
  );
}

function TileMeta({ post, authorName, chip, overlay }: { post: FeedCardPost; authorName: string; chip?: { label: string; color: string }; overlay?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className={`min-w-0 truncate font-medium ${overlay ? "text-white/90" : "text-[var(--text-primary)]"}`}>{authorName}</span>
      <span className={`flex shrink-0 items-center gap-2 ${overlay ? "text-white/80" : "text-[var(--text-secondary)]"}`}>
        {chip && chip.label !== "mesh.me" && (
          <span className="rounded-full px-1.5 py-0.5 text-micro font-semibold" style={{ backgroundColor: `${chip.color}33`, color: chip.color }}>
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

// The front door of discovery: the hottest posts right now as big swipeable
// cards with rank badges — a reason to open Explore every day.
function TrendingHero({ posts, onSeeAll }: { posts: FeedCardPost[]; onSeeAll: () => void }) {
  const top = [...posts]
    .filter((post) => post.media.length > 0 || post.content.trim().length > 0)
    .sort((a, b) => postScore(b) - postScore(a))
    .slice(0, 5);
  if (top.length === 0) return null;

  return (
    <section className="mt-5" aria-label="Trending now">
      <SectionHeader title="Trending now" action={{ label: "See all", onClick: onSeeAll }} />
      <div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
        {top.map((post, index) => {
          const media = post.media.find((item) => item.type.toLowerCase() !== "video") || post.media[0];
          const still = media?.type.toLowerCase() === "video" ? media.posterUrl : media?.url;
          const authorName = post.externalAuthor?.name || post.author.displayName;
          return (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 16, scale: 0.96, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{ ...spring, delay: 0.06 * index }}
              className="shrink-0 snap-start"
            >
              <Link
                href={safeHref(post.externalUrl) || `/feed/${post.id}`}
                className="group relative block h-44 w-[min(16rem,75vw)] overflow-hidden rounded-2xl border border-[var(--border-secondary)] bg-[var(--bg-secondary)] transition-transform hover:-translate-y-0.5"
              >
                {still ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={still} alt={getPostMediaAlt(post, authorName)} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(47,124,255,0.35),transparent_60%),radial-gradient(circle_at_75%_80%,rgba(168,85,247,0.28),transparent_55%)]" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                <motion.span
                  initial={{ scale: 0, rotate: index === 0 ? -14 : 0 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={
                    index === 0
                      ? { type: "spring", stiffness: 520, damping: 13, delay: 0.06 * index + 0.16 }
                      : { type: "spring", stiffness: 380, damping: 22, delay: 0.06 * index + 0.12 }
                  }
                  className={`absolute left-2.5 top-2.5 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-white shadow-lg ${
                    index === 0 ? "bg-gradient-to-br from-[var(--accent)] to-violet-500" : "bg-black/60 backdrop-blur"
                  }`}
                >
                  #{index + 1}
                </motion.span>
                <div className="absolute inset-x-0 bottom-0 p-3">
                  {!still && <p className="mb-1 line-clamp-2 text-sm font-semibold leading-snug text-white">{post.content}</p>}
                  <p className="truncate text-micro font-semibold text-white/85">{authorName}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-micro text-white/60">
                    <span className="inline-flex items-center gap-1"><Heart size={11} className="text-[var(--accent)]" /> {formatCount(post._count.reactions)}</span>
                    <span className="inline-flex items-center gap-1"><MessageCircle size={11} /> {formatCount(post._count.comments)}</span>
                    {post.platform && post.platform !== "meshme" && post.platform !== "mesh" && (
                      <span className="mesh-eyebrow ">{post.platform}</span>
                    )}
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
