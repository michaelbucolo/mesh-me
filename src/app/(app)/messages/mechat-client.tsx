"use client";

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";
import {
  MessageCircle,
  Search,
  Plus,
  Filter,
  Globe,
  X,
  ChevronRight,
  Send,
  Wifi,
  Sparkles,
  Users,
  Link2,
  Loader2,
} from "lucide-react";

interface Thread {
  id: string;
  otherUser: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  lastMessage: {
    content: string;
    senderId: string;
    createdAt: string;
  } | null;
  platform: string;
  unread: number;
}

const PLATFORM_ICONS: Record<string, { color: string; label: string }> = {
  mesh: { color: "#3b82f6", label: "mesh.me" },
  instagram: { color: "#E4405F", label: "Instagram" },
  twitter: { color: "#1DA1F2", label: "X / Twitter" },
  youtube: { color: "#FF0000", label: "YouTube" },
  discord: { color: "#5865F2", label: "Discord" },
  spotify: { color: "#1DB954", label: "Spotify" },
};

type PlatformFilter = "all" | "mesh" | "instagram" | "twitter" | "youtube" | "discord";

type FeatureStatus = "live" | "in-progress" | "planned";

const IMESSAGE_PARITY_FEATURES: Array<{ name: string; status: FeatureStatus; note: string }> = [
  { name: "Read receipts", status: "planned", note: "Per-conversation controls and sender visibility are queued." },
  { name: "Typing indicators", status: "planned", note: "Real-time typing events are on the near-term socket backlog." },
  { name: "Message reactions", status: "in-progress", note: "Tapback-style quick reactions are being implemented." },
  { name: "Reply threading", status: "in-progress", note: "Inline replies and jump-to-context are being built." },
  { name: "Voice notes", status: "planned", note: "Audio waveform capture + playback is in product design." },
  { name: "Attachments & camera", status: "planned", note: "Photos, video, and document share flows are planned." },
  { name: "Group messaging", status: "planned", note: "Admin controls, mentions, and membership states are planned." },
  { name: "Conversation search", status: "live", note: "Thread-level search is available from the inbox." },
  { name: "Delivery reliability", status: "in-progress", note: "Retry queue and network resilience are in active work." },
];

const FEATURE_STATUS_STYLES: Record<FeatureStatus, { label: string; className: string }> = {
  live: {
    label: "Live",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  },
  "in-progress": {
    label: "In progress",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-300",
  },
  planned: {
    label: "Planned",
    className: "border-slate-500/25 bg-slate-500/10 text-slate-300",
  },
};

interface MeChatClientProps {
  threads: Thread[];
  currentUserId: string;
}

export function MeChatClient({ threads: initialThreads, currentUserId }: MeChatClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showPlatformFilter, setShowPlatformFilter] = useState(false);
  const [visibleThreadCount, setVisibleThreadCount] = useState(40);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; displayName: string; avatarUrl: string | null }>>([]);
  const meshiPrefs = useMeshiPreferences();

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const filteredThreads = useMemo(() => {
    return initialThreads.filter((thread) => {
      if (platformFilter !== "all" && (thread.platform || "mesh") !== platformFilter) return false;
      if (
        deferredSearchQuery &&
        thread.otherUser &&
        !thread.otherUser.displayName.toLowerCase().includes(deferredSearchQuery.toLowerCase()) &&
        !thread.otherUser.username.toLowerCase().includes(deferredSearchQuery.toLowerCase())
      ) {
        return false;
      }
      return true;
    });
  }, [deferredSearchQuery, initialThreads, platformFilter]);

  const visibleThreads = useMemo(
    () => filteredThreads.slice(0, visibleThreadCount),
    [filteredThreads, visibleThreadCount],
  );

  const handleNewChatSearch = async (query: string) => {
    setNewChatSearch(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const res = await fetch(`/api/search/users?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.users || []);
      }
    } catch {
      // ignore search errors
    }
  };

  const unreadThreadCount = filteredThreads.filter((thread) => thread.unread > 0).length;

  return (
    <div data-meshi-zone="messages" className="mx-auto max-w-6xl px-4 py-6 animate-page-enter">
      <section className="mb-6 rounded-[1.75rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5 shadow-[var(--shadow-md)]">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--accent-muted)] bg-[var(--accent-subtle)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              <MessageCircle className="h-3.5 w-3.5" />
              Unified communication layer
            </div>
            <div className="flex items-center gap-3">
              <MeshiMascot
                size={34}
                color={meshiPrefs.appLogo === "custom" ? meshiPrefs.color : "blue"}
                mood={meshiPrefs.appLogo === "custom" ? meshiPrefs.face : "happy"}
                hat={meshiPrefs.appLogo === "custom" ? meshiPrefs.hat : "none"}
                animate
                showGlow={false}
                bouncy
              />
              <div>
                <h1 className="text-3xl font-black text-[var(--text-primary)] md:text-4xl">MeChat</h1>
                <p className="text-sm text-[var(--text-muted)]">Every conversation. One inbox.</p>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              MeChat is the universal communication layer for Mesh.me. It is built to keep platform context visible
              while making messaging, sharing, and future group browsing feel like one coherent experience.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Visible threads</p>
              <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{filteredThreads.length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Unread threads</p>
              <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{unreadThreadCount}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/60 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">Filter</p>
              <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">
                {platformFilter === "all" ? "All platforms" : PLATFORM_ICONS[platformFilter]?.label || platformFilter}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <div className="rounded-[1.5rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4 shadow-[var(--shadow-md)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowPlatformFilter((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filter
                </button>

                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
                  <Wifi className="h-3.5 w-3.5" />
                  Connected to mesh.me
                </div>

                <Link
                  href="/connected-accounts"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--border-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Connect platforms
                </Link>
              </div>

              <button
                onClick={() => setShowNewChat(true)}
                className="brand-button inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
              >
                <Plus className="h-4 w-4" />
                New Chat
              </button>
            </div>

            <AnimatePresence>
              {showPlatformFilter && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(["all", "mesh", "instagram", "twitter", "youtube", "discord"] as PlatformFilter[]).map((platform) => {
                      const info = platform === "all" ? { color: "#888", label: "All Platforms" } : PLATFORM_ICONS[platform];
                      const active = platformFilter === platform;

                      return (
                        <button
                          key={platform}
                          onClick={() => setPlatformFilter(platform)}
                          className={
                            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all " +
                            (active
                              ? "text-white shadow-lg"
                              : "border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]")
                          }
                          style={active ? { backgroundColor: info.color } : undefined}
                        >
                          {platform === "all" ? <Globe className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                          {info.label}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="relative mt-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search conversations..."
                className="glass-input w-full rounded-xl py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
            </div>
          </div>

          {filteredThreads.length > 0 ? (
            <div className="space-y-3">
              {visibleThreads.map((thread) => {
                const platform = thread.platform || "mesh";
                const platformInfo = PLATFORM_ICONS[platform] || PLATFORM_ICONS.mesh;

                return (
                  <Link
                    key={thread.id}
                    href={`/messages/${thread.id}`}
                    className="group flex items-center gap-3 rounded-[1.5rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-4 transition hover:border-[var(--border-hover)]"
                  >
                    <div className="relative">
                      <Avatar
                        src={thread.otherUser?.avatarUrl}
                        alt={thread.otherUser?.displayName || "User"}
                        size="md"
                      />
                      <div
                        className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[var(--bg-primary)]"
                        style={{ backgroundColor: platformInfo.color }}
                      >
                        <MessageCircle className="h-2.5 w-2.5 text-white" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">
                          {thread.otherUser?.displayName || "Unknown"}
                        </h3>
                        <div className="flex items-center gap-2">
                          {thread.lastMessage && (
                            <span className="text-xs text-[var(--text-muted)]">
                              {formatRelativeTime(thread.lastMessage.createdAt)}
                            </span>
                          )}
                          {thread.unread > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs text-white" style={{ background: "var(--accent)" }}>
                              {thread.unread}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="text-xs text-[var(--text-muted)]">{platformInfo.label}</span>
                        {thread.lastMessage && (
                          <>
                            <span className="text-[var(--text-muted)]">·</span>
                            <p className="truncate text-sm text-[var(--text-secondary)]">
                              {thread.lastMessage.senderId === currentUserId ? "You: " : ""}
                              {thread.lastMessage.content}
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-[var(--text-muted)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                );
              })}
              {filteredThreads.length > visibleThreads.length && (
                <Button
                  variant="glass"
                  className="w-full rounded-xl"
                  onClick={() => setVisibleThreadCount((count) => count + 40)}
                >
                  Load more conversations
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-[1.5rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--bg-tertiary)]">
                <MessageCircle className="h-8 w-8 text-[var(--text-muted)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-secondary)]">
                {searchQuery || platformFilter !== "all" ? "No matching conversations" : "No messages yet"}
              </h3>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {searchQuery || platformFilter !== "all"
                  ? "Try a different search or platform filter."
                  : "Start with a new conversation and MeChat will keep the context in one place."}
              </p>
              {!searchQuery && platformFilter === "all" && (
                <Button variant="gradient" onClick={() => setShowNewChat(true)} className="mt-5">
                  Start a conversation
                </Button>
              )}
            </div>
          )}
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-4 space-y-4">
            <div className="rounded-[1.5rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-[var(--accent)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Group browsing future
                </p>
              </div>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                MeChat is designed to evolve beyond plain messaging into shared social browsing where everyone can react
                and interact as themselves.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Cross-platform clarity
                </p>
              </div>
              <p className="text-sm leading-6 text-[var(--text-secondary)]">
                The goal is not to erase where something came from. It is to make the conversation around it easier to follow.
              </p>
            </div>

            <div className="rounded-[1.5rem] border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5">
              <div className="mb-3 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-[var(--accent)]" />
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  iMessage parity tracker
                </p>
              </div>
              <div className="space-y-2.5">
                {IMESSAGE_PARITY_FEATURES.map((feature) => {
                  const status = FEATURE_STATUS_STYLES[feature.status];
                  return (
                    <div key={feature.name} className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)]/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{feature.name}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{feature.note}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      </section>

      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            onClick={() => setShowNewChat(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-dropdown w-full max-w-md rounded-2xl shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[var(--border-primary)] p-4">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">New Conversation</h2>
                <button
                  onClick={() => setShowNewChat(false)}
                  className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-secondary)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4">
                <div className="mb-4">
                  <p className="mb-2 text-xs text-[var(--text-muted)]">Send via</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(PLATFORM_ICONS).map(([key, info]) => (
                      <button
                        key={key}
                        className="flex items-center gap-1.5 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-tertiary)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)]"
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: info.color }} />
                        {info.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={newChatSearch}
                    onChange={(event) => void handleNewChatSearch(event.target.value)}
                    placeholder="Search for a person..."
                    className="glass-surface w-full rounded-xl py-2.5 pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                    autoFocus
                  />
                </div>

                <div className="max-h-64 space-y-1 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    searchResults.map((user) => (
                      <Link
                        key={user.id}
                        href={`/messages/${user.id}?new=true`}
                        onClick={() => setShowNewChat(false)}
                        className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-[var(--bg-tertiary)]"
                      >
                        <Avatar src={user.avatarUrl} alt={user.displayName} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{user.displayName}</p>
                          <p className="text-xs text-[var(--text-muted)]">@{user.username}</p>
                        </div>
                        <Send className="ml-auto h-4 w-4 text-[var(--text-muted)]" />
                      </Link>
                    ))
                  ) : newChatSearch.trim() ? (
                    <p className="py-8 text-center text-sm text-[var(--text-muted)]">No users found</p>
                  ) : (
                    <p className="py-8 text-center text-sm text-[var(--text-muted)]">Type a name to search</p>
                  )}
                </div>

                {newChatSearch.trim() && searchResults.length === 0 && (
                  <div className="mt-4 inline-flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Searching Mesh.me users
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
