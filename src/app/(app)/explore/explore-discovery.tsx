"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
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
  Sparkles,
  UserCheck,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { PageIntro } from "@/components/ui/signature-art";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type FormEvent } from "react";
import { EASE_OUT, SPRING_PANEL } from "@/lib/motion";

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

const spring = SPRING_PANEL;
const MotionLink = motion.create(Link);

// The Mesh "decisive glide" easing as a framer cubic-bezier tuple.

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

type ExploreTab = "foryou" | "latest" | "people" | "communities";
type MediaFilter = "all" | "media" | "photos" | "videos" | "text";

/**
 * ONE ROW. IT WAS FOUR.
 *
 * Photographed on the running build at 1440×900, Explore put roughly 520px of
 * chrome above the first piece of content, and 23 controls in the top 340px:
 *
 *   a second search field, 90px under the top bar's own "Search your Mesh"
 *   Feed · People · Communities
 *   All · Media · Photos · Videos · Text   |   Top · Latest
 *   eleven topic chips, overflowing off the right edge mid-word
 *
 * Three of those rows are the same question asked three ways — how should this
 * one feed be narrowed? — and X, which the brief names, asks it once: a row of
 * tabs, then posts. No media-type filter. No sort toggle. No chip cloud.
 *
 * So the sort's two values ARE two of the tabs now, which is exactly the
 * For-you / Trending shape, and they are two genuinely different rankings
 * rather than one ranking twice. (That distinction is not theoretical: the row
 * this replaces once shipped a Trending button producing byte-identical output
 * to For you, because both resolved to the same sort.)
 *
 * Content type and topic are NARROWINGS, not destinations, so they move in
 * beside the platform narrowing behind the Filters disclosure — where nothing
 * is lost and nothing is in the way.
 */
const TABS: { id: ExploreTab; label: string; icon: typeof Compass }[] = [
  { id: "foryou", label: "For you", icon: Sparkles },
  { id: "latest", label: "Latest", icon: Clock },
  { id: "people", label: "People", icon: UsersRound },
  { id: "communities", label: "Communities", icon: MessagesSquare },
];

/**
 * TWO FACTS, TWO ROWS — AND A THIRD ROW THAT WAS NEITHER.
 *
 * Explore narrowed its feed with a `FeedMode` row (For you / Trending / Media)
 * sitting above a collapsed panel holding a `MediaFilter` row and a sort. That
 * mode row was not a fact of its own; its three values were spread across the
 * other two, and the seams showed:
 *
 *   - `sortMode` defaults to "top", and the sort read
 *     `if (feedMode === "trending" || sortMode === "top")`. So on load, "For
 *     you" and "Trending" produced BYTE-IDENTICAL output. Verified in a browser:
 *     same four posts, same order. Pressing Trending lit the button and changed
 *     nothing on screen.
 *   - `feedMode === "media"` kept posts with media; `mediaFilter === "text"`
 *     kept posts WITHOUT media. Together: the empty set, always. That was
 *     handled by withdrawing the Text button whenever Media was chosen — a
 *     control removing another control to avoid contradicting it.
 *
 * So the mode row is gone and its meanings went home. "Trending" is the sort
 * being Top, which it already was. "Media" is a content type, so it is a value
 * of the content row, where it is mutually exclusive with Text by construction
 * rather than by withdrawal. "For you" is what you get with neither set.
 *
 * The two rows that remain are two genuinely different questions — WHAT kind of
 * post, and in WHAT order — so both are always visible and every value on each
 * is one click. Only the platform narrowing, which is a long list and secondary,
 * still lives behind the Filters disclosure.
 */
const MEDIA_FILTERS: { id: MediaFilter; label: string; icon: typeof Compass }[] = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "photos", label: "Photos", icon: ImageIcon },
  { id: "videos", label: "Videos", icon: Play },
  { id: "text", label: "Text", icon: MessageCircle },
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
  const reduce = useReducedMotion();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<ExploreTab>("foryou");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activePlatform, setActivePlatform] = useState<string | null>(null);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  // Derived, never stored: the tab IS the order. A second piece of state
  // saying the same thing is how "Trending" and "For you" ended up rendering
  // the same list — two places stating one fact, again.
  const [showFilters, setShowFilters] = useState(false);

  const trimmedQuery = query.trim().toLowerCase();

  // Both DERIVED from the tab, and declared before the memo that reads them —
  // a `const` used above its declaration is a temporal-dead-zone crash, not a
  // hoisted convenience.
  const isPostTab = tab === "foryou" || tab === "latest";
  const sortMode: "top" | "latest" = tab === "latest" ? "latest" : "top";

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

    // One control, so the values are mutually exclusive by construction. "media"
    // is any attachment; "text" is the absence of one. They can no longer be
    // asked for together, which is what made the old pair produce nothing.
    if (mediaFilter === "media") result = result.filter((post) => post.media.length > 0);
    else if (mediaFilter === "photos") result = result.filter(isPhotoPost);
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

    if (sortMode === "top") {
      result = [...result].sort((a, b) => postScore(b) - postScore(a));
    } else {
      result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [posts, activeTag, activePlatform, mediaFilter, sortMode, trimmedQuery]);

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
  const activeFilterCount = Number(Boolean(activeTag)) + Number(Boolean(activePlatform)) + Number(mediaFilter !== "all");
  // Only the platform narrowing is behind the disclosure now, so the disclosure
  // has no reason to exist when there is at most one platform to narrow to.
  const canNarrowByPlatform = availablePlatforms.length > 1;
  const activeContentFilter = MEDIA_FILTERS.find((filter) => filter.id === mediaFilter) ?? MEDIA_FILTERS[0];

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
    <div className="mesh-explore-page mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6">
      <PageIntro className="mesh-explore-intro" heading="h1" eyebrow="Explore" title={<>Find your next <em>spark.</em></>} description="People, ideas, and moments worth finding."
        action={<Link href="/flow" data-feedback="navigate" className="mesh-action px-4 text-sm"><Play size={15} aria-hidden="true" /> Step into Flow <ArrowUpRight size={14} aria-hidden="true" /></Link>} />
      <div className="mesh-explore-controls sticky top-0 z-20 space-y-3">
        <motion.form
          onSubmit={submitSearch}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="glass-card flex items-center gap-3 rounded-2xl px-4 py-3"
        >
          <Search className="h-4.5 w-4.5 shrink-0 text-[var(--text-muted)]" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={tab === "people" ? "Find people and interests" : tab === "communities" ? "Find your community" : "Search posts, people, and ideas"}
            maxLength={120}
            className="min-w-0 flex-1 bg-transparent text-base text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] sm:text-sm [&::-webkit-search-cancel-button]:hidden"
            aria-label="Search Explore"
            suppressHydrationWarning
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="key explore-chip -my-1 inline-flex h-11 w-11 shrink-0 items-center justify-center text-[var(--text-muted)]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          )}
          {query.trim() && (
            <button
              type="submit"
              className="key key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)] inline-flex min-h-11 shrink-0 items-center gap-1 px-3 py-1.5 text-xs font-semibold"
              aria-label="Search all of Mesh"
            >
              <span className="hidden sm:inline">Search all</span> <ArrowUpRight className="h-4 w-4" aria-hidden />
            </button>
          )}
        </motion.form>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.05 }}
          /* No tray. This was a `glass-card` box around a row of keys — a box in
             a box, and the only chip rail in the app with its own material
             (MeChat's sits straight on the page). The keys are the material;
             the py-1 keeps their plinth shadows clear of the overflow clip. */
          className="rail-fade flex items-center gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
        {/* A TABLIST MAY OWN ONLY TABS. The Filters disclosure sat inside this
            one, which axe-core flags as aria-required-children and which would
            have forced any roving-tabindex implementation to special-case a
            child that is not a tab. It is a sibling now; the tablist wraps only
            the four tabs. */}
        <div role="tablist" aria-label="Explore sections" className="mesh-explore-tabs flex items-center gap-1">
          {/* ROVING TABINDEX AND ARROW KEYS, because role="tab" promises both.
              These four were four separate Tab stops with dead arrow keys, so
              the roles described a widget that was not there — which is worse
              than plain buttons, since plain buttons behave as announced.
              APG: one stop for the set, Left/Right to move, Home/End to the
              ends, and focus follows selection. */}
          {TABS.map((item) => {
            const selected = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                id={`explore-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="explore-tabpanel"
                tabIndex={selected ? 0 : -1}
                onKeyDown={(event) => {
                  const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
                  let next: ExploreTab | null = null;
                  if (delta !== 0) {
                    const at = TABS.findIndex((t) => t.id === tab);
                    next = TABS[(at + delta + TABS.length) % TABS.length].id;
                  } else if (event.key === "Home") next = TABS[0].id;
                  else if (event.key === "End") next = TABS[TABS.length - 1].id;
                  if (!next) return;
                  event.preventDefault();
                  setTab(next);
                  document.getElementById(`explore-tab-${next}`)?.focus();
                }}
                onClick={() => setTab(item.id)}
                className="mesh-explore-tab relative inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3.5 py-2 text-sm font-medium"
              >
                {selected && <motion.span layoutId={reduce ? undefined : "explore-selection"} className="mesh-explore-selection" transition={spring} aria-hidden="true" />}
                <Icon className="relative h-3.5 w-3.5" aria-hidden />
                <span className="relative">{item.label}</span>
              </button>
            );
          })}
          </div>
          {isPostTab && (
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className={`key ml-auto inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3 py-2 text-xs font-semibold ${
                showFilters
                  ? "key-selected"
                  : "text-[var(--text-secondary)]"
              }`}
              aria-pressed={showFilters}
              aria-expanded={showFilters}
              aria-controls="explore-filters"
              aria-label={activeFilterCount ? `Filters, ${activeFilterCount} active` : "Filters"}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
              Filters
              {hasActiveFilters && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent-subtle)] px-1 text-micro text-[var(--accent-text)]" aria-hidden>{activeFilterCount}</span>}
            </button>
          )}
        </motion.div>
      </div>

      {isPostTab && hasActiveFilters && (
        <div className="mesh-explore-filter-summary mt-3 flex flex-wrap items-center gap-2" aria-label="Active filters">
          {mediaFilter !== "all" && (
            <button type="button" onClick={() => setMediaFilter("all")} className="key explore-chip inline-flex min-h-9 items-center gap-1.5 px-3 text-xs" aria-label={`Remove ${activeContentFilter.label.toLowerCase()} filter`}>
              {activeContentFilter.label}<X size={12} aria-hidden="true" />
            </button>
          )}
          {activePlatform && (
            <button type="button" onClick={() => setActivePlatform(null)} className="key explore-chip inline-flex min-h-9 items-center gap-1.5 px-3 text-xs" aria-label={`Remove ${PLATFORM_CHIP[activePlatform]?.label || activePlatform} filter`}>
              {PLATFORM_CHIP[activePlatform]?.label || activePlatform}<X size={12} aria-hidden="true" />
            </button>
          )}
          {activeTag && (
            <button type="button" onClick={() => setActiveTag(null)} className="key explore-chip inline-flex min-h-9 items-center gap-1.5 px-3 text-xs" aria-label={`Remove ${activeTag} topic filter`}>
              #{activeTag}<X size={12} aria-hidden="true" />
            </button>
          )}
          <button type="button" onClick={clearFilters} className="min-h-9 px-2 text-xs text-[var(--text-secondary)] underline decoration-[var(--rule)] underline-offset-4">Clear all</button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {isPostTab && showFilters && (
          <motion.div
            id="explore-filters"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
            className="overflow-hidden"
          >
            <div className="glass-card mt-3 space-y-4 rounded-2xl p-4 sm:p-5">
              <fieldset className="min-w-0">
                <legend className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Content type</legend>
                <div className="flex flex-wrap gap-2">
                  {MEDIA_FILTERS.map((filter) => {
                    const selected = mediaFilter === filter.id;
                    const Icon = filter.icon;
                    return (
                      <button key={filter.id} type="button" aria-pressed={selected} onClick={() => setMediaFilter(filter.id)} className={`key explore-chip inline-flex min-h-10 items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${selected ? "key-selected" : "text-[var(--text-secondary)]"}`}>
                        <Icon className="h-3.5 w-3.5" aria-hidden /><span>{filter.label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {canNarrowByPlatform && (
                <fieldset className="min-w-0">
                  <legend className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Platform</legend>
                  <div className="flex flex-wrap gap-2">
                    {availablePlatforms.map((platform) => {
                      const chip = PLATFORM_CHIP[platform];
                      const selected = activePlatform === platform;
                      return (
                        <button key={platform} type="button" onClick={() => setActivePlatform(selected ? null : platform)} aria-pressed={selected} className={`key explore-chip inline-flex min-h-10 items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${selected ? "key-selected" : "text-[var(--text-secondary)]"}`}>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: chip.color }} aria-hidden />{chip.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
              {trendingTags.length > 0 && (
                <fieldset className="min-w-0">
                  <legend className="mb-2 text-xs font-semibold text-[var(--text-secondary)]">Popular topics</legend>
                  <div className="flex flex-wrap gap-2">
                    {trendingTags.map((tag) => {
                      const selected = activeTag === tag.tag;
                      return (
                        <button key={tag.tag} type="button" onClick={() => setActiveTag(selected ? null : tag.tag)} aria-pressed={selected} className={`key explore-chip inline-flex min-h-10 max-w-full items-center gap-1 px-3 py-1.5 text-xs font-medium ${selected ? "key-selected" : "text-[var(--text-secondary)]"}`}>
                          <Hash className="h-3 w-3 shrink-0" aria-hidden /><span className="truncate">{tag.tag}</span><span className="ml-1 tabular-nums text-[var(--text-muted)]">{formatCount(tag.count)}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isPostTab && (
        <section className="mt-5" role="tabpanel"
          id="explore-tabpanel"
          aria-labelledby={`explore-tab-${tab}`}
          tabIndex={0}
          aria-label="Discover content">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
              {/* The heading now says what the one control says, because there
                  is only one thing left for it to disagree with. */}
              {activeTag ? `#${activeTag}` : mediaFilter !== "all" ? activeContentFilter.label : sortMode === "top" ? "For you" : "Latest"}
            </h2>
            <span className="text-xs text-[var(--text-muted)]">
              {filteredPosts.length} {filteredPosts.length === 1 ? "post" : "posts"}
            </span>
          </div>
          {filteredPosts.length === 0 ? (
            <EmptyState
              title={hasActiveFilters || trimmedQuery ? "A little too specific" : "Your next discovery starts here"}
              message={
                hasActiveFilters || trimmedQuery
                  ? "Try a different search or remove a filter to see more."
                  : "Meet people and find communities with something in common."
              }
              onClear={hasActiveFilters || trimmedQuery ? () => { clearFilters(); setQuery(""); } : () => setTab("people")}
              actionLabel={hasActiveFilters || trimmedQuery ? "Reset search" : "Discover people"}
            />
          ) : (
            <div className="mesh-discovery-grid">
              {filteredPosts.map((post, index) => (
                <ExploreTile key={post.id} post={post} index={index} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "people" && (
        <section className="mt-6" role="tabpanel" id="explore-tabpanel" aria-labelledby={`explore-tab-${tab}`} tabIndex={0} aria-label="People to follow">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">People to follow</h2>
            <span className="text-xs text-[var(--text-muted)]">
              {filteredUsers.length} {filteredUsers.length === 1 ? "mesh" : "meshes"}
            </span>
          </div>
          {filteredUsers.length === 0 ? (
            // Blame the search only when there IS one — with no query this
            // section is simply out of suggestions, and an empty state that
            // accuses a search nobody made reads as a bug (journey audit,
            // observed by two independent journeys).
            <EmptyState
              title={trimmedQuery ? "No people found" : "Good company takes a little discovery"}
              message={
                trimmedQuery
                  ? "No meshes match your search."
                  : "No suggestions right now — follow people from posts you like and more appear here."
              }
              onClear={trimmedQuery ? () => setQuery("") : undefined}
              actionLabel="Clear search"
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredUsers.map((user, index) => (
                <ExplorePersonCard key={user.id} user={user} currentUserId={currentUserId} index={index} fullWidth signedOut={signedOut} />
              ))}
            </div>
          )}
        </section>
      )}

      {tab === "communities" && (
        <section className="mt-6" role="tabpanel" id="explore-tabpanel" aria-labelledby={`explore-tab-${tab}`} tabIndex={0} aria-label="Communities">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-[var(--text-primary)]">Communities</h2>
            <span className="text-xs text-[var(--text-muted)]">
              {filteredCommunities.length} {filteredCommunities.length === 1 ? "community" : "communities"}
            </span>
          </div>
          {filteredCommunities.length === 0 ? (
            <EmptyState title={trimmedQuery ? "No communities found" : "Find your people"} message={trimmedQuery ? "Try another name or interest." : "Communities bring shared interests together. Browse them to get started."} onClear={trimmedQuery ? () => setQuery("") : () => router.push("/communities")} actionLabel={trimmedQuery ? "Clear search" : "Browse communities"} />
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

function EmptyState({ title, message, onClear, actionLabel = "Clear filters" }: { title: string; message: string; onClear?: () => void; actionLabel?: string }) {
  return (
    <div className="glass-card flex flex-col items-center rounded-2xl px-6 py-12 text-center sm:py-16">
      <span className="mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-[var(--rule)] bg-[var(--paper-0)]"><Compass className="h-6 w-6 text-[var(--accent-text)]" aria-hidden /></span>
      <h3 className="text-lg font-medium tracking-tight text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--text-secondary)]">{message}</p>
      {onClear && (
        <Button size="sm" variant="secondary" className="mt-5" onClick={onClear}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

function CommunityCard({ community, index, compact }: { community: SuggestedCommunity; index: number; compact?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.025 * Math.min(index, 8) }}
      className={compact ? "shrink-0" : ""}
    >
      <Link
        href={`/communities/${community.slug}`}
        className={`glass-card group flex flex-col gap-2 rounded-2xl p-4 transition-[color,background-color,border-color,box-shadow,transform,opacity] hover:border-[var(--border-primary)] ${
          compact ? "w-56 shrink-0" : "h-full"
        }`}
      >
        <div className="flex items-center gap-3">
          <Avatar src={community.iconUrl} alt={community.name} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-text)]">
              {community.name}
            </p>
            <p className="flex items-center gap-2 text-micro text-[var(--text-muted)]">
              <span className="flex items-center gap-1">
                <UsersRound className="h-3 w-3" aria-hidden />
                {formatCount(community.memberCount)} {community.memberCount === 1 ? "member" : "members"}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" aria-hidden />
                {formatCount(community.postCount)} {community.postCount === 1 ? "post" : "posts"}
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
  const reduce = useReducedMotion();
  const { addToast } = useToast();
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
        if (result && "error" in result) {
          setIsFollowing(previous);
          addToast(result.error || "Could not update your follow. Try again.", "error");
        }
      } catch {
        setIsFollowing(previous);
        addToast("Could not update your follow. Try again.", "error");
      }
    });
  };

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.04 * Math.min(index, 12) }}
      className={`glass-card group flex flex-col rounded-2xl p-5 text-center transition-[color,background-color,border-color,box-shadow,transform,opacity] hover:border-[var(--border-primary)] ${
        fullWidth ? "w-full" : "w-44 shrink-0"
      }`}
    >
      <Link href={`/profile/${user.username}`} className="mb-4 block flex-1">
        <Avatar src={user.avatarUrl} alt={user.displayName} size="lg" className="mx-auto mb-2.5" />
        <p className="flex items-center justify-center gap-1 truncate text-sm font-semibold text-[var(--text-primary)] transition-colors group-hover:text-[var(--accent-text)]">
          <span className="truncate">{user.displayName}</span>
          {user.isVerified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[var(--accent-text)]" aria-label="Verified" />}
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
        <p className="mt-2 text-micro text-[var(--text-muted)]">{formatCount(user.followerCount)} {user.followerCount === 1 ? "follower" : "followers"}</p>
      </Link>
      {currentUserId !== user.id && (
        <Button
          size="sm"
          variant={isFollowing ? "secondary" : "default"}
          onClick={handleFollow}
          disabled={isPending}
          className="w-full"
          aria-label={isFollowing ? `Unfollow ${user.displayName}` : `Follow ${user.displayName}`}
          aria-pressed={isFollowing}
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
  const reduce = useReducedMotion();
  const [mediaFailed, setMediaFailed] = useState(false);
  const media = mediaFailed ? undefined : post.media.find((item) => item.type === "image" || VIDEO_TYPES.includes(item.type.toLowerCase()));
  const isVideo = media && VIDEO_TYPES.includes(media.type.toLowerCase());
  const platform = (post.platform || "meshme").toLowerCase();
  const chip = PLATFORM_CHIP[platform];
  const authorName = post.externalAuthor?.name || post.author.displayName;

  return (
    <MotionLink
      href={`/feed/${encodeURIComponent(post.id)}`}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...spring, delay: 0.02 * Math.min(index, 16) }}
      data-feedback="navigate"
      className="glass-card group relative block w-full overflow-hidden rounded-2xl text-left transition-[color,background-color,border-color,box-shadow,transform,opacity] hover:border-[var(--border-primary)] mesh-explore-tile"
      // NO aria-label. It OVERRIDES name-from-contents, so everything inside
      // this button became unreachable: the media alt built by getPostMediaAlt
      // below, and — for a text-only tile — the whole post body. Content inside
      // a button is not separately navigable in NVDA/JAWS browse mode, so a
      // screen reader user arrowing through this grid heard "Open post by Alex
      // in the Flow, button" for every tile and could not tell them apart or
      // read any of them.
      //
      // The name comes from the contents now, which is what the contents are
      // for. The purpose is carried by a visually-hidden prefix instead of by
      // replacing everything.
    >
      <span className="sr-only">{`Open post by ${authorName}: `}</span>
      {media ? (
        <div className="relative aspect-[4/3]">
          {isVideo && !media.posterUrl ? (
            <video src={media.url} muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true" onError={() => setMediaFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={isVideo ? media.posterUrl : media.url} alt={getPostMediaAlt(post, authorName)} loading="lazy" decoding="async" onError={() => setMediaFailed(true)} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
          )}
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
        <div className="mesh-discovery-note">
          <div className="mesh-discovery-byline mb-4 flex items-center gap-2.5">
            <div className="shrink-0" aria-hidden="true"><Avatar src={post.externalAuthor?.avatarUrl || post.author.avatarUrl} alt={authorName} size="sm" /></div>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{authorName}</span>
              <span className="mt-0.5 block truncate text-xs text-[var(--text-muted)]">
                @{post.externalAuthor?.username || post.author.username} <span aria-hidden="true">·</span>{" "}
                {/* One calendar date on the server and client, independent of
                    browser timezone or time elapsed before hydration. */}
                <time dateTime={new Date(post.createdAt).toISOString()}>
                  {new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}
                </time>
              </span>
            </span>
          </div>
          <p className="line-clamp-5 whitespace-pre-wrap text-[.9375rem] leading-relaxed text-[var(--text-primary)]">{post.content || (isVideo ? "Watch this video" : "Open this post")}</p>
          <div className="mesh-discovery-footer mt-5">
            <TileMeta post={post} authorName="Read post" chip={chip} />
          </div>
        </div>
      )}

    </MotionLink>
  );
}

function TileMeta({ post, authorName, chip, overlay }: { post: FeedCardPost; authorName: string; chip?: { label: string; color: string }; overlay?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className={`inline-flex min-w-0 items-center gap-1 truncate font-medium ${overlay ? "text-white/90" : "text-[var(--text-secondary)]"}`}>{authorName}{!overlay && <ArrowUpRight size={12} aria-hidden="true" />}</span>
      <span className={`flex shrink-0 items-center gap-2 ${overlay ? "text-white/80" : "text-[var(--text-secondary)]"}`}>
        {chip && chip.label !== "mesh.me" && (
          <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-micro font-medium ${overlay ? "bg-black/55 text-white" : "text-[var(--text-secondary)]"}`}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: chip.color }} aria-hidden="true" />{chip.label}
          </span>
        )}
        <span className="flex items-center gap-1" aria-label={`${post._count.reactions} likes`}>
          <Heart className="h-3 w-3" aria-hidden /> {formatCount(post._count.reactions)}
        </span>
        <span className="flex items-center gap-1" aria-label={`${post._count.comments} comments`}>
          <MessageCircle className="h-3 w-3" aria-hidden /> {formatCount(post._count.comments)}
        </span>
      </span>
    </div>
  );
}
