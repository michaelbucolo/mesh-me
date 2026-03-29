"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

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

interface MeChatClientProps {
  threads: Thread[];
  currentUserId: string;
}

export function MeChatClient({ threads: initialThreads, currentUserId }: MeChatClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [showNewChat, setShowNewChat] = useState(false);
  const [showPlatformFilter, setShowPlatformFilter] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; displayName: string; avatarUrl: string | null }>>([]);

  const filteredThreads = initialThreads.filter((t) => {
    if (platformFilter !== "all" && (t.platform || "mesh") !== platformFilter) return false;
    if (searchQuery && t.otherUser && !t.otherUser.displayName.toLowerCase().includes(searchQuery.toLowerCase()) && !t.otherUser.username.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

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
      // search failed
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* MeChat Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">MeChat</h1>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">All your conversations, one place</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPlatformFilter(!showPlatformFilter)}
            className="p-2 rounded-xl glass-surface text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--border-primary)] transition-colors"
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            onClick={() => setShowNewChat(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-medium hover:from-blue-500 hover:to-blue-400 transition-all"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </button>
        </div>
      </div>

      {/* Platform Filter */}
      <AnimatePresence>
        {showPlatformFilter && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="flex gap-2 flex-wrap pb-2">
              {(["all", "mesh", "instagram", "twitter", "youtube", "discord"] as PlatformFilter[]).map((p) => {
                const info = p === "all" ? { color: "#888", label: "All Platforms" } : PLATFORM_ICONS[p];
                return (
                  <button
                    key={p}
                    onClick={() => setPlatformFilter(p)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      platformFilter === p
                        ? "text-white shadow-lg"
                        : "text-[var(--text-tertiary)] glass-surface hover:border-[var(--glass-border)]"
                    }`}
                    style={platformFilter === p ? { backgroundColor: info.color } : undefined}
                  >
                    {p === "all" ? <Globe className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                    {info.label}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search conversations..."
          className="w-full pl-10 pr-4 py-2.5 glass-input rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50 transition-colors"
        />
      </div>

      {/* Connected platforms indicator */}
      <div className="flex items-center gap-2 mb-4 px-2">
        <Wifi className="h-3.5 w-3.5 text-green-500" />
        <span className="text-xs text-[var(--text-muted)]">Connected to mesh.me</span>
        <span className="text-xs text-[var(--text-muted)]">&middot;</span>
        <Link href="/settings" className="text-xs text-blue-400 hover:text-blue-300">
          Connect more platforms
        </Link>
      </div>

      {/* Threads */}
      {filteredThreads.length > 0 ? (
        <div className="space-y-1">
          {filteredThreads.map((thread) => {
            const platform = thread.platform || "mesh";
            const platformInfo = PLATFORM_ICONS[platform] || PLATFORM_ICONS.mesh;

            return (
              <Link
                key={thread.id}
                href={`/messages/${thread.id}`}
                className="flex items-center gap-3 p-3 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors group"
              >
                <div className="relative">
                  <Avatar
                    src={thread.otherUser?.avatarUrl}
                    alt={thread.otherUser?.displayName || "User"}
                    size="md"
                  />
                  <div
                    className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-zinc-950 flex items-center justify-center"
                    style={{ backgroundColor: platformInfo.color }}
                  >
                    <MessageCircle className="h-2.5 w-2.5 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {thread.otherUser?.displayName || "Unknown"}
                    </h3>
                    <div className="flex items-center gap-2">
                      {thread.lastMessage && (
                        <span className="text-xs text-[var(--text-muted)]">
                          {formatRelativeTime(thread.lastMessage.createdAt)}
                        </span>
                      )}
                      {thread.unread > 0 && (
                        <span className="h-5 min-w-5 px-1.5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center">
                          {thread.unread}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[var(--text-muted)]">{platformInfo.label}</span>
                    {thread.lastMessage && (
                      <>
                        <span className="text-[var(--text-muted)]">&middot;</span>
                        <p className="text-sm text-[var(--text-tertiary)] truncate">
                          {thread.lastMessage.senderId === currentUserId ? "You: " : ""}
                          {thread.lastMessage.content}
                        </p>
                      </>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-[var(--bg-tertiary)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="h-8 w-8 text-[var(--text-muted)]" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-2">
            {searchQuery || platformFilter !== "all" ? "No matching conversations" : "No messages yet"}
          </h3>
          <p className="text-sm text-[var(--text-muted)] mb-4">
            {searchQuery || platformFilter !== "all"
              ? "Try a different search or filter"
              : "Start a conversation by visiting someone's profile or clicking New Chat"
            }
          </p>
          {!searchQuery && platformFilter === "all" && (
            <Button variant="gradient" onClick={() => setShowNewChat(true)}>
              Start a conversation
            </Button>
          )}
        </div>
      )}

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowNewChat(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-dropdown rounded-2xl w-full max-w-md shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-primary)]">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">New Conversation</h2>
                <button onClick={() => setShowNewChat(false)} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-4">
                {/* Platform selector */}
                <div className="mb-4">
                  <p className="text-xs text-[var(--text-muted)] mb-2">Send via</p>
                  <div className="flex gap-2 flex-wrap">
                    {Object.entries(PLATFORM_ICONS).map(([key, info]) => (
                      <button
                        key={key}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[var(--text-tertiary)] bg-[var(--bg-tertiary)] border border-[var(--border-primary)] hover:border-[var(--border-secondary)] transition-colors"
                      >
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: info.color }} />
                        {info.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* User search */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={newChatSearch}
                    onChange={(e) => handleNewChatSearch(e.target.value)}
                    placeholder="Search for a person..."
                    className="w-full pl-10 pr-4 py-2.5 glass-surface rounded-xl text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-blue-500/50"
                    autoFocus
                  />
                </div>

                {/* Search results */}
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {searchResults.length > 0 ? (
                    searchResults.map((u) => (
                      <Link
                        key={u.id}
                        href={`/messages/${u.id}?new=true`}
                        onClick={() => setShowNewChat(false)}
                        className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        <Avatar src={u.avatarUrl} alt={u.displayName} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{u.displayName}</p>
                          <p className="text-xs text-[var(--text-muted)]">@{u.username}</p>
                        </div>
                        <Send className="h-4 w-4 text-[var(--text-muted)] ml-auto" />
                      </Link>
                    ))
                  ) : newChatSearch.trim() ? (
                    <p className="text-center text-sm text-[var(--text-muted)] py-8">No users found</p>
                  ) : (
                    <p className="text-center text-sm text-[var(--text-muted)] py-8">Type a name to search</p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
