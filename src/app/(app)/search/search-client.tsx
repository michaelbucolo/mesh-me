"use client";

import Image from "next/image";
import Link from "next/link";
import { type CSSProperties, type FormEvent, type ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, type Transition, type Variants } from "framer-motion";
import {
  CheckCircle2,
  ExternalLink,
  Globe2,
  Hash,
  Link2,
  MessageCircle,
  Rss,
  Search,
  UserRound,
  UsersRound,
} from "lucide-react";
import { publishMeshiCause } from "@/lib/meshi-bus";
import { Avatar } from "@/components/ui/avatar";
import { formatCount, formatRelativeTime, safeHref } from "@/lib/utils";

type SearchResults = {
  users: Array<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    isVerified: boolean;
    _count?: { followers: number };
  }>;
  posts: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: {
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
    _count?: { comments: number; reactions: number };
  }>;
  communities: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    _count?: { members: number };
  }>;
  platformPosts: Array<{
    id: string;
    title: string | null;
    content: string | null;
    url: string | null;
    thumbnailUrl: string | null;
    postType: string;
    likeCount: number;
    commentCount: number;
    viewCount: number;
    publishedAt: string | null;
    connectedAccount: {
      id: string;
      platform: string;
      platformUsername: string | null;
      user?: {
        username: string;
        displayName: string;
      };
    };
    media: Array<{
      id: string;
      url: string;
      thumbnailUrl: string | null;
      mediaType: string;
    }>;
  }>;
  platformPeople: Array<{
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    followerCount: number | null;
    relationshipType: string;
    profileUrl: string | null;
    connectedAccount: {
      platform: string;
      platformUsername: string | null;
    };
  }>;
  messages: Array<{
    id: string;
    content: string;
    threadId: string;
    createdAt: string;
    sender: {
      username: string;
      displayName: string;
      avatarUrl: string | null;
    };
  }>;
  wikipedia: Array<{
    id: string;
    title: string;
    extract: string;
    url: string;
    thumbnailUrl: string | null;
    source: string;
  }>;
  sourceIndex: Array<{
    id: string;
    name: string;
    description: string;
    connected: boolean;
    accountLabel: string | null;
    syncStatus: string;
    lastSyncAt: string | null;
    syncedPosts: number;
    syncedPeople: number;
    searchUrl: string;
    connectHref: string;
  }>;
};

const emptyResults: SearchResults = {
  users: [],
  posts: [],
  communities: [],
  platformPosts: [],
  platformPeople: [],
  messages: [],
  wikipedia: [],
  sourceIndex: [],
};

const tabs = [
  { id: "top", label: "Top" },
  { id: "posts", label: "Posts" },
  { id: "people", label: "People" },
  { id: "connected", label: "Platforms" },
  { id: "messages", label: "Messages" },
  { id: "web", label: "Info" },
] as const;

type TabId = (typeof tabs)[number]["id"];

// Shared sliding-indicator spring, matching Explore's 'explore-tab-pill'.
const pillSpring: Transition = { type: "spring", stiffness: 380, damping: 30 };

// Results reveal: the outer container orchestrates a top-to-bottom section
// cascade; each ResultSection springs in as a variant child.
const resultsContainer: Variants = {
  hidden: { opacity: 1 },
  show: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.03 } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } },
};

const sectionVariant: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 320, damping: 28 } },
};

// Per-row cascade beat for `.mesh-cascade-soft` (uncapped, data-driven).
const rowStyle = (index: number) => ({ ["--i" as string]: index }) as CSSProperties;

function platformLabel(value: string | null | undefined) {
  if (!value) return "Source";
  return value.toLowerCase() === "twitter" ? "X" : value[0]?.toUpperCase() + value.slice(1);
}

function ResultEmpty({ query }: { query: string }) {
  return (
    <div className="mesh-surface rounded-2xl p-8 text-center">
      <Search className="mx-auto h-7 w-7 text-[var(--accent)]" aria-hidden="true" />
      <h2 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">
        {query.length > 1 ? "No results yet" : "Search your connected internet"}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
        {query.length > 1
          ? "Try a person, platform username, post title, message, community, creator, hashtag, or topic."
          : "Mesh.me searches native posts, public users, MeChat, synced X, Instagram, YouTube, Snapchat content, and Wikipedia."}
      </p>
      <Link href="/connected-accounts" className="mesh-action mesh-action-primary mt-5 inline-flex px-4 text-sm">
        Connect platforms
        <Link2 size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}

export function SearchClient({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim());
  const [activeTab, setActiveTab] = useState<TabId>("top");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const q = submittedQuery.trim();
    if (q.length < 2) {
      setResults(emptyResults);
      setError("");
      return;
    }

    const controller = new AbortController();
    startTransition(async () => {
      setError("");
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => emptyResults);
        if (!response.ok) throw new Error(payload.error || "Search failed");
        setResults({ ...emptyResults, ...payload });
      } catch (searchError) {
        if ((searchError as Error).name === "AbortError") return;
        setError(searchError instanceof Error ? searchError.message : "Search failed");
      }
    });

    return () => controller.abort();
  }, [submittedQuery]);

  const totals = useMemo(() => ({
    posts: results.posts.length + results.platformPosts.length,
    people: results.users.length + results.platformPeople.length,
    connected: results.platformPosts.length + results.platformPeople.length + results.sourceIndex.length,
    messages: results.messages.length,
    web: results.wikipedia.length,
    top: results.users.length + results.posts.length + results.communities.length + results.platformPosts.length + results.platformPeople.length + results.messages.length + results.wikipedia.length + results.sourceIndex.length,
  }), [results]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextQuery = query.trim();
    setSubmittedQuery(nextQuery);
    if (nextQuery) publishMeshiCause({ kind: "search:started" });
    router.replace(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search", { scroll: false });
  }

  const showNative = activeTab === "top" || activeTab === "posts";
  const showPeople = activeTab === "top" || activeTab === "people";
  const showConnected = activeTab === "top" || activeTab === "connected";
  const showMessages = activeTab === "top" || activeTab === "messages";
  const showWeb = activeTab === "top" || activeTab === "web";

  return (
    <main className="search-index-page mx-auto grid w-full max-w-[62rem] grid-cols-[minmax(0,1fr)] gap-3 animate-page-enter">
      <style>{`
        .search-row-magnetic { position: relative; }
        .search-row-magnetic::before {
          content: "";
          position: absolute;
          left: 0;
          top: 50%;
          height: 58%;
          width: 3px;
          border-radius: 0 6px 6px 0;
          background: linear-gradient(180deg, var(--accent), var(--mesh-cyan));
          transform: translateY(-50%) scaleY(0.3);
          transform-origin: center;
          opacity: 0;
          transition: opacity 200ms var(--mesh-ease-out), transform 260ms var(--mesh-spring);
          pointer-events: none;
        }
        .search-row-magnetic:hover::before,
        .search-row-magnetic:focus-visible::before { opacity: 1; transform: translateY(-50%) scaleY(1); }
        .search-result-row.search-row-magnetic:hover,
        .search-result-row.search-row-magnetic:focus-visible { transform: translateX(3px) !important; }
        @media (prefers-reduced-motion: reduce) {
          .search-result-row.search-row-magnetic:hover,
          .search-result-row.search-row-magnetic:focus-visible { transform: none !important; }
          .search-row-magnetic::before { transition: none; }
        }
      `}</style>
      <header className="sticky top-0 z-20 bg-[var(--bg-primary)]/92 pb-2 pt-1 backdrop-blur md:top-3">
        <form onSubmit={submit} className="flex min-h-12 items-center gap-3 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-input)] px-4">
          <Search className="h-5 w-5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
          <label htmlFor="mesh-search-input" className="sr-only">Search Mesh.me</label>
          <input
            id="mesh-search-input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-base font-medium text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
            placeholder="Search Mesh.me"
            type="search"
            autoComplete="off"
            suppressHydrationWarning
          />
          <button type="submit" className="mesh-action mesh-action-primary h-9 px-4 text-sm">
            Search
          </button>
        </form>
        <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-xs font-medium text-[var(--text-muted)]">
          <span>Indexing</span>
          {["X", "Instagram", "YouTube", "Snapchat", "Wikipedia"].map((source) => (
            <span key={source} className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 py-1">
              {source}
            </span>
          ))}
        </div>

        <nav className="mt-3 flex gap-1 overflow-x-auto border-b border-[var(--border-primary)]" aria-label="Search filters">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={active}
                className={`relative min-w-max px-4 py-2.5 text-sm font-semibold transition-colors ${
                  active ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                <span className="relative">{tab.label}</span>
                {totals[tab.id] > 0 && <span className="relative ml-1 text-xs text-[var(--text-muted)]">{totals[tab.id]}</span>}
                {active && (
                  <motion.span
                    layoutId="search-tab-pill"
                    transition={pillSpring}
                    className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--mesh-cyan)] shadow-[0_0_12px_-1px_var(--accent)]"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {isPending && submittedQuery.length > 1 ? (
        <div className="mesh-surface rounded-lg p-4 text-sm font-semibold text-[var(--text-secondary)]">
          Searching Mesh.me, synced social sources, MeChat, and Wikipedia...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-4 text-sm font-semibold text-red-100">
          {error}
        </div>
      ) : null}

      {totals.top === 0 && !isPending ? <ResultEmpty query={submittedQuery} /> : null}

      <AnimatePresence mode="wait">
      <motion.section
        key={`${activeTab}:${submittedQuery}:${totals.top}`}
        variants={resultsContainer}
        initial="hidden"
        animate="show"
        exit="exit"
        className="grid gap-3"
      >
        {showConnected && results.sourceIndex.length > 0 && (
          <ResultSection title="Social index sources" icon={Globe2}>
            <div className="mesh-cascade-soft grid gap-0 md:grid-cols-2">
              {results.sourceIndex.map((source, index) => (
                <div key={source.id} style={rowStyle(index)} className="search-result-row search-row-magnetic">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--border-primary)] bg-[var(--accent-subtle)] text-sm font-semibold text-[var(--accent)]">
                    {source.name.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                      {source.name}
                      {source.connected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-micro text-emerald-300">
                          <CheckCircle2 size={12} aria-hidden="true" />
                          Synced
                        </span>
                      ) : (
                        <span className="rounded-full border border-[var(--border-primary)] px-2 py-0.5 text-micro text-[var(--text-muted)]">
                          Connectable
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-xs text-[var(--text-muted)]">
                      {source.connected
                        ? `@${source.accountLabel || "connected"} - ${formatCount(source.syncedPosts)} posts - ${formatCount(source.syncedPeople)} people`
                        : "Use the official source search now, then connect it to bring results into Mesh.me."}
                    </span>
                    <span className="mt-1 block line-clamp-2 text-sm text-[var(--text-secondary)]">{source.description}</span>
                    <span className="mt-3 flex flex-wrap gap-2">
                      <a href={source.searchUrl} target="_blank" rel="noreferrer" className="mesh-action mesh-action-secondary min-h-9 px-3 text-xs">
                        Search {source.name}
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                      {!source.connected && (
                        <Link href={source.connectHref} className="mesh-action mesh-action-primary min-h-9 px-3 text-xs">
                          Connect
                          <Link2 size={13} aria-hidden="true" />
                        </Link>
                      )}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </ResultSection>
        )}

        {showPeople && results.users.length > 0 && (
          <ResultSection title="People on Mesh.me" icon={UserRound}>
            {results.users.map((user, index) => (
              <Link key={user.id} style={rowStyle(index)} href={`/profile/${user.username}`} className="search-result-row search-row-magnetic">
                <Avatar src={user.avatarUrl} alt={user.displayName} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{user.displayName}</span>
                  <span className="block truncate text-xs text-[var(--text-muted)]">@{user.username} · {formatCount(user._count?.followers || 0)} followers</span>
                  {user.bio && <span className="mt-1 block line-clamp-2 text-sm text-[var(--text-secondary)]">{user.bio}</span>}
                </span>
              </Link>
            ))}
          </ResultSection>
        )}

        {showNative && results.posts.length > 0 && (
          <ResultSection title="Mesh.me posts" icon={Rss}>
            {results.posts.map((post, index) => (
              <Link key={post.id} style={rowStyle(index)} href={`/feed/${post.id}`} className="search-result-row search-row-magnetic">
                <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">{post.author.displayName}</span>
                  <span className="block text-xs text-[var(--text-muted)]">@{post.author.username} · {formatRelativeTime(post.createdAt)}</span>
                  <span className="mt-1 block line-clamp-3 text-sm text-[var(--text-secondary)]">{post.content}</span>
                  <span className="mt-2 block text-xs font-semibold text-[var(--text-muted)]">
                    {formatCount(post._count?.reactions || 0)} likes · {formatCount(post._count?.comments || 0)} comments
                  </span>
                </span>
              </Link>
            ))}
          </ResultSection>
        )}

        {showConnected && results.platformPosts.length > 0 && (
          <ResultSection title="Connected platform posts" icon={Link2}>
            {results.platformPosts.map((post, index) => {
              const thumbnail = post.thumbnailUrl || post.media[0]?.thumbnailUrl || post.media[0]?.url || null;
              const content = (
                <>
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
                    {thumbnail ? <Image src={thumbnail} alt="" fill sizes="64px" className="object-cover" /> : <Globe2 className="m-auto mt-5 h-6 w-6 text-[var(--accent)]" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold mesh-eyebrow text-[var(--accent)]">
                      {platformLabel(post.connectedAccount.platform)} - @{post.connectedAccount.platformUsername || "connected"}
                    </span>
                    {post.connectedAccount.user && (
                      <span className="mt-1 block text-xs text-[var(--text-muted)]">
                        Indexed by {post.connectedAccount.user.displayName} on Mesh.me
                      </span>
                    )}
                    <span className="mt-1 block line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">{post.title || post.content || "Connected post"}</span>
                    {post.content && post.title && <span className="mt-1 block line-clamp-2 text-sm text-[var(--text-secondary)]">{post.content}</span>}
                    <span className="mt-2 block text-xs font-semibold text-[var(--text-muted)]">
                      {formatCount(post.likeCount)} likes · {formatCount(post.commentCount)} comments · {formatCount(post.viewCount)} views
                    </span>
                  </span>
                  <ExternalLink className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                </>
              );
              return post.url ? (
                <a key={post.id} style={rowStyle(index)} href={safeHref(post.url)} target="_blank" rel="noreferrer" className="search-result-row search-row-magnetic">
                  {content}
                </a>
              ) : (
                <div key={post.id} style={rowStyle(index)} className="search-result-row search-row-magnetic" aria-disabled="true">
                  {content}
                </div>
              );
            })}
          </ResultSection>
        )}

        {showConnected && results.platformPeople.length > 0 && (
          <ResultSection title="Connected platform people" icon={UsersRound}>
            {results.platformPeople.map((person, index) => {
              const content = (
                <>
                  <Avatar src={person.avatarUrl} alt={person.displayName || person.username || "Platform user"} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{person.displayName || person.username || "Platform user"}</span>
                    <span className="block truncate text-xs text-[var(--text-muted)]">
                      {platformLabel(person.connectedAccount.platform)} · @{person.username || person.connectedAccount.platformUsername || "connected"} · {formatCount(person.followerCount || 0)}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-[var(--accent)]">{person.relationshipType}</span>
                  </span>
                </>
              );
              return person.profileUrl ? (
                <a key={person.id} style={rowStyle(index)} href={safeHref(person.profileUrl)} target="_blank" rel="noreferrer" className="search-result-row search-row-magnetic">
                  {content}
                </a>
              ) : (
                <div key={person.id} style={rowStyle(index)} className="search-result-row search-row-magnetic" aria-disabled="true">
                  {content}
                </div>
              );
            })}
          </ResultSection>
        )}

        {showPeople && results.communities.length > 0 && (
          <ResultSection title="Communities" icon={Hash}>
            {results.communities.map((community, index) => (
              <Link key={community.id} style={rowStyle(index)} href={`/communities/${community.slug}`} className="search-result-row search-row-magnetic">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--accent-subtle)] text-lg font-semibold text-[var(--accent)]">#</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{community.name}</span>
                  <span className="block truncate text-xs text-[var(--text-muted)]">/{community.slug} · {formatCount(community._count?.members || 0)} members</span>
                  {community.description && <span className="mt-1 block line-clamp-2 text-sm text-[var(--text-secondary)]">{community.description}</span>}
                </span>
              </Link>
            ))}
          </ResultSection>
        )}

        {showMessages && results.messages.length > 0 && (
          <ResultSection title="Private MeChat matches" icon={MessageCircle}>
            {results.messages.map((message, index) => (
              <Link key={message.id} style={rowStyle(index)} href={`/messages/${message.threadId}`} className="search-result-row search-row-magnetic">
                <Avatar src={message.sender.avatarUrl} alt={message.sender.displayName} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{message.sender.displayName}</span>
                  <span className="block text-xs text-[var(--text-muted)]">@{message.sender.username} · {formatRelativeTime(message.createdAt)}</span>
                  <span className="mt-1 block line-clamp-3 text-sm text-[var(--text-secondary)]">{message.content}</span>
                </span>
              </Link>
            ))}
          </ResultSection>
        )}

        {showWeb && results.wikipedia.length > 0 && (
          <ResultSection title="Public reference" icon={Globe2}>
            {results.wikipedia.map((page, index) => (
              <a key={page.id} style={rowStyle(index)} href={safeHref(page.url)} target="_blank" rel="noreferrer" className="search-result-row search-row-magnetic">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
                  {page.thumbnailUrl ? <Image src={page.thumbnailUrl} alt="" fill sizes="56px" className="object-cover" /> : <Globe2 className="m-auto mt-4 h-6 w-6 text-[var(--accent)]" aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold mesh-eyebrow text-[var(--accent)]">{page.source}</span>
                  <span className="mt-1 block truncate text-sm font-semibold text-[var(--text-primary)]">{page.title}</span>
                  <span className="mt-1 block line-clamp-2 text-sm text-[var(--text-secondary)]">{page.extract}</span>
                </span>
                <ExternalLink className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
              </a>
            ))}
          </ResultSection>
        )}
      </motion.section>
      </AnimatePresence>
    </main>
  );
}

function ResultSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Search;
  children: ReactNode;
}) {
  return (
    <motion.section
      variants={sectionVariant}
      className="mesh-surface overflow-hidden rounded-2xl"
    >
      <header className="flex items-center gap-2 border-b border-[var(--border-primary)] px-4 py-3">
        <Icon className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      </header>
      <div className="mesh-cascade-soft divide-y divide-[var(--border-primary)]">
        {children}
      </div>
    </motion.section>
  );
}
