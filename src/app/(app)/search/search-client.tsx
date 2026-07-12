"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
import { Avatar } from "@/components/ui/avatar";
import { formatCount, formatRelativeTime } from "@/lib/utils";

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

function platformLabel(value: string | null | undefined) {
  if (!value) return "Source";
  return value.toLowerCase() === "twitter" ? "X" : value[0]?.toUpperCase() + value.slice(1);
}

function ResultEmpty({ query }: { query: string }) {
  return (
    <div className="mesh-surface rounded-lg p-8 text-center">
      <Search className="mx-auto h-7 w-7 text-[var(--accent)]" aria-hidden="true" />
      <h2 className="mt-3 text-xl font-bold text-[var(--text-primary)]">
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
    router.replace(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search", { scroll: false });
  }

  const showNative = activeTab === "top" || activeTab === "posts";
  const showPeople = activeTab === "top" || activeTab === "people";
  const showConnected = activeTab === "top" || activeTab === "connected";
  const showMessages = activeTab === "top" || activeTab === "messages";
  const showWeb = activeTab === "top" || activeTab === "web";

  return (
    <main className="search-index-page mx-auto grid w-full max-w-[62rem] grid-cols-[minmax(0,1fr)] gap-3 animate-page-enter">
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
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-w-max border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "border-[var(--accent)] text-[var(--text-primary)]"
                  : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              {tab.label}
              {totals[tab.id] > 0 && <span className="ml-1 text-xs text-[var(--text-muted)]">{totals[tab.id]}</span>}
            </button>
          ))}
        </nav>
      </header>

      {isPending && submittedQuery.length > 1 ? (
        <div className="mesh-surface rounded-lg p-4 text-sm font-bold text-[var(--text-secondary)]">
          Searching Mesh.me, synced social sources, MeChat, and Wikipedia...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold text-red-100">
          {error}
        </div>
      ) : null}

      {totals.top === 0 && !isPending ? <ResultEmpty query={submittedQuery} /> : null}

      <AnimatePresence mode="wait">
      <motion.section
        key={activeTab + submittedQuery}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="grid gap-3"
      >
        {showConnected && results.sourceIndex.length > 0 && (
          <ResultSection title="Social index sources" icon={Globe2}>
            <div className="grid gap-0 md:grid-cols-2">
              {results.sourceIndex.map((source) => (
                <div key={source.id} className="search-result-row">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--border-primary)] bg-[var(--accent-subtle)] text-sm font-bold text-[var(--accent)]">
                    {source.name.slice(0, 2)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                      {source.name}
                      {source.connected ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] text-emerald-300">
                          <CheckCircle2 size={12} aria-hidden="true" />
                          Synced
                        </span>
                      ) : (
                        <span className="rounded-full border border-[var(--border-primary)] px-2 py-0.5 text-[11px] text-[var(--text-muted)]">
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
            {results.users.map((user) => (
              <Link key={user.id} href={`/profile/${user.username}`} className="search-result-row">
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
            {results.posts.map((post) => (
              <Link key={post.id} href={`/feed/${post.id}`} className="search-result-row">
                <Avatar src={post.author.avatarUrl} alt={post.author.displayName} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-[var(--text-primary)]">{post.author.displayName}</span>
                  <span className="block text-xs text-[var(--text-muted)]">@{post.author.username} · {formatRelativeTime(post.createdAt)}</span>
                  <span className="mt-1 block line-clamp-3 text-sm text-[var(--text-secondary)]">{post.content}</span>
                  <span className="mt-2 block text-xs font-bold text-[var(--text-muted)]">
                    {formatCount(post._count?.reactions || 0)} likes · {formatCount(post._count?.comments || 0)} comments
                  </span>
                </span>
              </Link>
            ))}
          </ResultSection>
        )}

        {showConnected && results.platformPosts.length > 0 && (
          <ResultSection title="Connected platform posts" icon={Link2}>
            {results.platformPosts.map((post) => {
              const thumbnail = post.thumbnailUrl || post.media[0]?.thumbnailUrl || post.media[0]?.url || null;
              const content = (
                <>
                  <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
                    {thumbnail ? <Image src={thumbnail} alt="" fill sizes="64px" className="object-cover" /> : <Globe2 className="m-auto mt-5 h-6 w-6 text-[var(--accent)]" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
                      {platformLabel(post.connectedAccount.platform)} - @{post.connectedAccount.platformUsername || "connected"}
                    </span>
                    {post.connectedAccount.user && (
                      <span className="mt-1 block text-xs text-[var(--text-muted)]">
                        Indexed by {post.connectedAccount.user.displayName} on Mesh.me
                      </span>
                    )}
                    <span className="mt-1 block line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">{post.title || post.content || "Connected post"}</span>
                    {post.content && post.title && <span className="mt-1 block line-clamp-2 text-sm text-[var(--text-secondary)]">{post.content}</span>}
                    <span className="mt-2 block text-xs font-bold text-[var(--text-muted)]">
                      {formatCount(post.likeCount)} likes · {formatCount(post.commentCount)} comments · {formatCount(post.viewCount)} views
                    </span>
                  </span>
                  <ExternalLink className="h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                </>
              );
              return post.url ? (
                <a key={post.id} href={post.url} target="_blank" rel="noreferrer" className="search-result-row">
                  {content}
                </a>
              ) : (
                <div key={post.id} className="search-result-row" aria-disabled="true">
                  {content}
                </div>
              );
            })}
          </ResultSection>
        )}

        {showConnected && results.platformPeople.length > 0 && (
          <ResultSection title="Connected platform people" icon={UsersRound}>
            {results.platformPeople.map((person) => {
              const content = (
                <>
                  <Avatar src={person.avatarUrl} alt={person.displayName || person.username || "Platform user"} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{person.displayName || person.username || "Platform user"}</span>
                    <span className="block truncate text-xs text-[var(--text-muted)]">
                      {platformLabel(person.connectedAccount.platform)} · @{person.username || person.connectedAccount.platformUsername || "connected"} · {formatCount(person.followerCount || 0)}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs font-bold text-[var(--accent)]">{person.relationshipType}</span>
                </>
              );
              return person.profileUrl ? (
                <a key={person.id} href={person.profileUrl} target="_blank" rel="noreferrer" className="search-result-row">
                  {content}
                </a>
              ) : (
                <div key={person.id} className="search-result-row" aria-disabled="true">
                  {content}
                </div>
              );
            })}
          </ResultSection>
        )}

        {showPeople && results.communities.length > 0 && (
          <ResultSection title="Communities" icon={Hash}>
            {results.communities.map((community) => (
              <Link key={community.id} href={`/communities/${community.slug}`} className="search-result-row">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[var(--accent-subtle)] text-lg font-bold text-[var(--accent)]">#</span>
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
            {results.messages.map((message) => (
              <Link key={message.id} href={`/messages/${message.threadId}`} className="search-result-row">
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
            {results.wikipedia.map((page) => (
              <a key={page.id} href={page.url} target="_blank" rel="noreferrer" className="search-result-row">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-[var(--border-primary)] bg-[var(--bg-tertiary)]">
                  {page.thumbnailUrl ? <Image src={page.thumbnailUrl} alt="" fill sizes="56px" className="object-cover" /> : <Globe2 className="m-auto mt-4 h-6 w-6 text-[var(--accent)]" aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">{page.source}</span>
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="mesh-surface overflow-hidden rounded-lg"
    >
      <header className="flex items-center gap-2 border-b border-[var(--border-primary)] px-4 py-3">
        <Icon className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h2>
      </header>
      <div className="divide-y divide-[var(--border-primary)]">
        {children}
      </div>
    </motion.section>
  );
}
