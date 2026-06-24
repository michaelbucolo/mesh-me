"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Check,
  Link2,
  Loader2,
  MessageCircle,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  SkipForward,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MeshiBrandLockup } from "@/components/meshi/meshi-identity";
import { formatRelativeTime } from "@/lib/utils";

type Person = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

type MeChatThread = {
  id: string;
  title: string;
  threadType: string;
  memberCount: number;
  isEncrypted: boolean;
  otherUser: Person | null;
  otherUsers: Person[];
  lastMessage: {
    content: string;
    senderId: string;
    createdAt: string;
  } | null;
  platform: string;
  unread: number;
};

type MeChatVote = {
  id: string;
  userId: string;
  vote: string;
};

type MeChatItem = {
  id: string;
  sourcePlatform: string;
  sourceUrl: string | null;
  title: string | null;
  content: string | null;
  status: string;
  votes: MeChatVote[];
};

type MeChatSession = {
  id: string;
  hostId: string;
  title: string;
  status: string;
  sessionType: string;
  callMode: string;
  callStatus: string;
  currentItemId?: string | null;
  callStartedAt: string | null;
  callEndedAt: string | null;
  participants: Array<{
    id: string;
    userId: string;
    role: string;
    user: Person;
  }>;
  items: MeChatItem[];
};

type ConnectedInbox = {
  id: string;
  platform: string;
  platformUsername: string | null;
  syncStatus: string;
  messageSync: boolean;
  platformComments: number;
  platformPosts: number;
  lastSyncAt: string | null;
};

type UserSearchResult = Person;

type MeChatHomeProps = {
  currentUser: Person;
  initialThreads: MeChatThread[];
  initialSessions: MeChatSession[];
  connectedInboxes: ConnectedInbox[];
  sharedPostId?: string;
  sharedPlatformPostId?: string;
  sharedUrl?: string;
  sharedTitle?: string;
  sourcePlatform?: string;
  suggestedRoomTitle?: string;
  suggestedCallMode?: "voice" | "video";
};

function roomStatusClass(status: string) {
  if (status === "live") return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  if (status === "ended") return "border-zinc-400/25 bg-zinc-400/10 text-zinc-200";
  return "border-sky-300/30 bg-sky-300/10 text-sky-100";
}

function platformLabel(platform: string) {
  if (platform.toLowerCase() === "twitter") return "X";
  if (platform.toLowerCase() === "meshme") return "Mesh.me";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function roomTypeLabel(type: string) {
  if (type === "co_browse") return "Shared scroll";
  if (type === "watch") return "Watch session";
  if (type === "voice_room") return "Voice room";
  if (type === "video_room") return "Video room";
  if (type === "collaborative_space") return "Space room";
  return type.replace(/_/g, " ");
}

function buildShareQuery({
  sharedPostId,
  sharedPlatformPostId,
  sharedUrl,
  sharedTitle,
  sourcePlatform,
}: {
  sharedPostId?: string;
  sharedPlatformPostId?: string;
  sharedUrl?: string;
  sharedTitle?: string;
  sourcePlatform?: string;
}) {
  const params = new URLSearchParams({ new: "true" });
  if (sharedPostId) params.set("sharePostId", sharedPostId);
  if (sharedPlatformPostId) params.set("sharePlatformPostId", sharedPlatformPostId);
  if (sharedUrl) params.set("shareUrl", sharedUrl);
  if (sharedTitle) params.set("shareTitle", sharedTitle);
  if (sourcePlatform) params.set("sourcePlatform", sourcePlatform);
  return params.toString();
}

function threadDisplay(thread: MeChatThread) {
  if (thread.threadType === "group") return thread.title || "MeChat group";
  return thread.otherUser?.displayName || thread.title || "Conversation";
}

function threadSubtitle(thread: MeChatThread) {
  if (thread.threadType === "group") {
    return `${thread.memberCount} members`;
  }
  return thread.otherUser ? `@${thread.otherUser.username}` : "Private chat";
}

export function MeChatHome({
  currentUser,
  initialThreads,
  initialSessions,
  connectedInboxes,
  sharedPostId,
  sharedPlatformPostId,
  sharedUrl,
  sharedTitle,
  sourcePlatform,
  suggestedRoomTitle,
  suggestedCallMode,
}: MeChatHomeProps) {
  const router = useRouter();
  const [threads, setThreads] = useState(initialThreads);
  const [sessions, setSessions] = useState(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState(initialSessions[0]?.id ?? "");
  const [threadQuery, setThreadQuery] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipients, setRecipients] = useState<UserSearchResult[]>([]);
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<UserSearchResult[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [groupOpeningMessage, setGroupOpeningMessage] = useState("");
  const [roomTitle, setRoomTitle] = useState(
    suggestedRoomTitle || (sharedTitle ? `${sharedTitle.slice(0, 54)} room` : sharedPostId || sharedPlatformPostId || sharedUrl ? "Shared post room" : "Shared browsing room"),
  );
  const [roomType, setRoomType] = useState(suggestedCallMode === "voice" ? "voice_room" : suggestedCallMode === "video" ? "video_room" : "co_browse");
  const [roomUrl, setRoomUrl] = useState(sharedPlatformPostId ? "" : sharedUrl ?? "");
  const [itemTitle, setItemTitle] = useState("");
  const [itemUrl, setItemUrl] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null,
    [activeSessionId, sessions],
  );

  const directShareQuery = useMemo(
    () => buildShareQuery({ sharedPostId, sharedPlatformPostId, sharedUrl, sharedTitle, sourcePlatform }),
    [sharedPostId, sharedPlatformPostId, sharedTitle, sharedUrl, sourcePlatform],
  );

  const inboxSummary = useMemo(() => {
    const connected = connectedInboxes.length;
    const importedItems = connectedInboxes.reduce((total, inbox) => total + inbox.platformComments + inbox.platformPosts, 0);
    const nativeMessageSync = connectedInboxes.filter((inbox) => inbox.messageSync).length;
    return { connected, importedItems, nativeMessageSync };
  }, [connectedInboxes]);

  const communicationsSummary = useMemo(() => {
    const groups = threads.filter((thread) => thread.threadType === "group").length;
    const direct = threads.length - groups;
    const liveCalls = sessions.filter((session) => session.callStatus === "live").length;
    return { direct, groups, rooms: sessions.length, liveCalls };
  }, [sessions, threads]);

  const filteredThreads = useMemo(() => {
    const q = threadQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => [
      threadDisplay(thread),
      threadSubtitle(thread),
      thread.lastMessage?.content,
      thread.threadType,
    ].some((value) => value?.toLowerCase().includes(q)));
  }, [threadQuery, threads]);

  function updateSession(updated: MeChatSession) {
    setSessions((current) => {
      const exists = current.some((session) => session.id === updated.id);
      return exists
        ? current.map((session) => (session.id === updated.id ? updated : session))
        : [updated, ...current];
    });
    setActiveSessionId(updated.id);
  }

  async function loadSession(sessionId: string) {
    const res = await fetch(`/api/mechat/sessions/${sessionId}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not reload room");
    updateSession(data.session);
  }

  function searchPeople() {
    if (!recipientQuery.trim()) return;
    startTransition(async () => {
      setStatus(null);
      try {
        const res = await fetch(`/api/search/users?q=${encodeURIComponent(recipientQuery.trim())}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Search failed");
        setRecipients(data.users || []);
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Search failed" });
      }
    });
  }

  function toggleGroupMember(person: UserSearchResult) {
    setSelectedGroupMembers((current) => {
      if (current.some((member) => member.id === person.id)) {
        return current.filter((member) => member.id !== person.id);
      }
      return [...current, person].slice(0, 49);
    });
  }

  function createGroupThread() {
    if (selectedGroupMembers.length === 0) {
      setStatus({ type: "error", message: "Choose at least one person for the group." });
      return;
    }

    startTransition(async () => {
      setStatus(null);
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: groupTitle.trim() || selectedGroupMembers.map((member) => member.displayName).join(", "),
            memberIds: selectedGroupMembers.map((member) => member.id),
            openingMessage: groupOpeningMessage.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not create group");
        setGroupTitle("");
        setGroupOpeningMessage("");
        setSelectedGroupMembers([]);
        setStatus({ type: "success", message: "MeChat group created." });
        const threadsRes = await fetch("/api/messages");
        const threadsData = await threadsRes.json();
        if (threadsRes.ok && Array.isArray(threadsData.threads)) {
          setThreads(threadsData.threads);
        }
        router.push(`/messages/${data.thread.id}`);
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not create group" });
      }
    });
  }

  function createRoom() {
    if (!roomTitle.trim()) return;
    startTransition(async () => {
      setStatus(null);
      try {
        const items = [];
        if (sharedPlatformPostId) {
          items.push({
            sourcePlatform: sourcePlatform || "platform",
            sourceUrl: sharedUrl || undefined,
            title: sharedTitle || "Shared platform post",
            platformPostId: sharedPlatformPostId,
          });
        } else if (sharedPostId) {
          items.push({ sourcePlatform: "mesh", postId: sharedPostId, title: sharedTitle || "Shared Mesh.me post" });
        }
        if (roomUrl.trim()) {
          items.push({ sourcePlatform: "web", sourceUrl: roomUrl.trim(), title: sharedTitle || "Shared link" });
        } else if (sharedUrl && !sharedPlatformPostId) {
          items.push({ sourcePlatform: sourcePlatform || "web", sourceUrl: sharedUrl, title: sharedTitle || "Shared link" });
        }

        const res = await fetch("/api/mechat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: roomTitle.trim(),
            sessionType: roomType,
            callMode: suggestedCallMode || (roomType === "voice_room" ? "voice" : roomType === "video_room" ? "video" : "none"),
            items,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not create room");
        updateSession(data.session);
        setRoomTitle("Shared browsing room");
        setRoomType("co_browse");
        setRoomUrl("");
        setStatus({ type: "success", message: "Shared room created." });
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not create room" });
      }
    });
  }

  function patchRoom(sessionId: string, action: "start" | "end" | "start-call" | "end-call", callMode?: "voice" | "video") {
    startTransition(async () => {
      setStatus(null);
      try {
        const res = await fetch(`/api/mechat/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, callMode }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not update room");
        updateSession(data.session);
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not update room" });
      }
    });
  }

  function addItem(sessionId: string) {
    if (!itemTitle.trim() && !itemUrl.trim()) return;
    startTransition(async () => {
      setStatus(null);
      try {
        const res = await fetch(`/api/mechat/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "add-item",
            sourcePlatform: itemUrl.trim() ? "web" : "mesh",
            sourceUrl: itemUrl.trim() || undefined,
            title: itemTitle.trim() || "Shared item",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not add item");
        await loadSession(sessionId);
        setItemTitle("");
        setItemUrl("");
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not add item" });
      }
    });
  }

  function vote(sessionId: string, itemId: string, value: "keep" | "skip") {
    startTransition(async () => {
      setStatus(null);
      try {
        const res = await fetch(`/api/mechat/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "vote", itemId, vote: value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not vote");
        await loadSession(sessionId);
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not vote" });
      }
    });
  }

  function syncInboxes() {
    startTransition(async () => {
      setStatus(null);
      try {
        const res = await fetch("/api/mechat/sync", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not sync MeChat");
        setStatus({
          type: "success",
          message: `Checked ${data.accounts} connected inbox source${data.accounts === 1 ? "" : "s"} and imported ${data.imported} conversation item${data.imported === 1 ? "" : "s"}.`,
        });
        router.refresh();
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not sync MeChat" });
      }
    });
  }

  return (
    <main className="simple-page grid gap-5">
      <header className="mesh-surface mesh-pop-in rounded-xl p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MeshiBrandLockup size={36} label="MeChat" subtitle="One private inbox" useUserMeshi />
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/8 px-3 py-1.5 text-xs font-medium text-emerald-200">
            <ShieldCheck size={14} aria-hidden="true" />
            Source-aware and account-only
          </div>
        </div>
        <div className="mt-5 max-w-3xl">
          <h1 className="text-2xl font-bold leading-tight md:text-4xl">Every conversation, share, and watch party in one inbox.</h1>
          <p className="mt-2.5 text-sm leading-6 text-[var(--text-secondary)] md:text-base">
            MeChat combines native messages with authorized platform activity, shared posts, voice/video session state, and group browsing where every participant acts as themselves.
          </p>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-4">
          {[
            { label: "Direct chats", value: communicationsSummary.direct },
            { label: "Groups", value: communicationsSummary.groups },
            { label: "Rooms", value: communicationsSummary.rooms },
            { label: "Live calls", value: communicationsSummary.liveCalls },
          ].map((metric) => (
            <div key={metric.label} className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3">
              <strong className="block text-xl text-[var(--text-primary)]">{metric.value}</strong>
              <span className="text-xs font-semibold text-[var(--text-muted)]">{metric.label}</span>
            </div>
          ))}
        </div>
      </header>

      {status && (
        <div className={`rounded-md border px-4 py-3 text-sm ${
          status.type === "error"
            ? "border-red-400/25 bg-red-500/10 text-red-100"
            : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
        }`}>
          {status.message}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="grid h-fit gap-4">
          <div className="mesh-surface rounded-lg p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-bold">
                <RefreshCcw size={17} aria-hidden="true" />
                Connected inboxes
              </h2>
              <button type="button" onClick={syncInboxes} disabled={isPending || connectedInboxes.length === 0} className="mesh-action mesh-action-secondary px-3 text-xs">
                {isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RefreshCcw size={14} aria-hidden="true" />}
                Sync
              </button>
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
              Provider-approved DM APIs are used when available. Otherwise Mesh.me imports authorized comments, shares, and source-linked activity without bypassing platform rules.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-2">
                <strong className="block text-base text-[var(--text-primary)]">{inboxSummary.connected}</strong>
                sources
              </div>
              <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-2">
                <strong className="block text-base text-[var(--text-primary)]">{inboxSummary.importedItems}</strong>
                items
              </div>
              <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-2">
                <strong className="block text-base text-[var(--text-primary)]">{inboxSummary.nativeMessageSync}</strong>
                DM APIs
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              {connectedInboxes.length > 0 ? (
                connectedInboxes.map((inbox) => (
                  <div key={inbox.id} className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">{platformLabel(inbox.platform)}</p>
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          {inbox.platformUsername ? `@${inbox.platformUsername}` : "Connected account"}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                        inbox.messageSync
                          ? "bg-emerald-300/10 text-emerald-100"
                          : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                      }`}>
                        {inbox.messageSync ? "DM sync" : "activity sync"}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--text-muted)]">
                      {inbox.platformComments} comments, {inbox.platformPosts} posts
                      {inbox.lastSyncAt ? ` - ${formatRelativeTime(inbox.lastSyncAt)}` : ""}
                    </p>
                  </div>
                ))
              ) : (
                <Link href="/connected-accounts" className="mesh-link-row rounded-md px-3 py-3 text-sm">
                  Connect accounts to unify source-aware conversations.
                </Link>
              )}
            </div>
          </div>

          <div className="mesh-surface rounded-lg p-4">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <MessageCircle size={17} aria-hidden="true" />
              Direct MeChats
            </h2>
            <div className="mt-3 flex gap-2">
              <input
                value={recipientQuery}
                onChange={(event) => setRecipientQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    searchPeople();
                  }
                }}
                className="simple-input h-11 min-w-0 flex-1 px-3 text-sm"
                placeholder="Search people"
              />
              <button type="button" onClick={searchPeople} disabled={isPending} className="mesh-action mesh-action-secondary px-3 text-sm">
                <Search size={15} aria-hidden="true" />
              </button>
            </div>

            {recipients.length > 0 && (
              <div className="mt-3 grid gap-2">
                {recipients.map((recipient) => {
                  const selected = selectedGroupMembers.some((member) => member.id === recipient.id);
                  return (
                    <div key={recipient.id} className="mesh-link-row flex items-center justify-between gap-2 rounded-md px-3 py-2">
                      <Link href={`/messages/${recipient.id}?${directShareQuery}`} className="flex min-w-0 flex-1 items-center gap-2">
                        <Avatar src={recipient.avatarUrl} alt={recipient.displayName} size="sm" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold">{recipient.displayName}</span>
                          <span className="block truncate text-xs text-[var(--text-muted)]">@{recipient.username}</span>
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => toggleGroupMember(recipient)}
                        className={`mesh-action px-2 text-xs ${selected ? "mesh-action-primary" : "mesh-action-secondary"}`}
                        aria-pressed={selected}
                      >
                        {selected ? <Check size={13} aria-hidden="true" /> : <UserPlus size={13} aria-hidden="true" />}
                        Group
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-4 grid gap-2">
              <label className="flex items-center gap-2 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 px-3 py-2 text-sm">
                <Search size={14} className="text-[var(--text-muted)]" aria-hidden="true" />
                <input
                  value={threadQuery}
                  onChange={(event) => setThreadQuery(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--text-muted)]"
                  placeholder="Search conversations"
                />
              </label>
              {filteredThreads.length > 0 ? (
                filteredThreads.map((thread) => (
                  <Link key={thread.id} href={`/messages/${thread.id}`} className="mesh-link-row rounded-md px-3 py-3">
                    <div className="flex items-center gap-2">
                      {thread.threadType === "group" ? (
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/70">
                          <Users size={15} aria-hidden="true" />
                        </span>
                      ) : (
                        <Avatar src={thread.otherUser?.avatarUrl ?? null} alt={thread.otherUser?.displayName ?? "Conversation"} size="sm" />
                      )}
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-bold">
                          <span className="truncate">{threadDisplay(thread)}</span>
                          {thread.unread > 0 && (
                            <span className="rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] text-white">{thread.unread}</span>
                          )}
                        </p>
                        <p className="truncate text-xs text-[var(--text-muted)]">
                          {thread.lastMessage?.content ?? "No messages yet"}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] font-semibold text-[var(--text-muted)]">{threadSubtitle(thread)}</p>
                    {thread.lastMessage && (
                      <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                        {formatRelativeTime(thread.lastMessage.createdAt)}
                      </p>
                    )}
                  </Link>
                ))
              ) : (
                <p className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3 text-sm text-[var(--text-secondary)]">
                  {threadQuery ? "No matching conversations." : "Search for someone to start the first secure thread."}
                </p>
              )}
            </div>
          </div>

          <div className="mesh-surface rounded-lg p-4">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Users size={17} aria-hidden="true" />
              Group MeChats
            </h2>
            <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
              Build WhatsApp-style groups inside Mesh.me. Search people above, tap Group, then create the conversation.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedGroupMembers.length > 0 ? (
                selectedGroupMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleGroupMember(member)}
                    className="inline-flex items-center gap-1 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/70 px-2.5 py-1.5 text-xs font-bold text-[var(--text-secondary)]"
                  >
                    {member.displayName}
                    <X size={12} aria-hidden="true" />
                  </button>
                ))
              ) : (
                <span className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 px-3 py-2 text-xs text-[var(--text-muted)]">
                  No group members selected.
                </span>
              )}
            </div>
            <div className="mt-3 grid gap-2">
              <input
                value={groupTitle}
                onChange={(event) => setGroupTitle(event.target.value)}
                className="simple-input h-11 px-3 text-sm"
                placeholder="Group name"
              />
              <input
                value={groupOpeningMessage}
                onChange={(event) => setGroupOpeningMessage(event.target.value)}
                className="simple-input h-11 px-3 text-sm"
                placeholder="Optional first message"
              />
              <button
                type="button"
                onClick={createGroupThread}
                disabled={isPending || selectedGroupMembers.length === 0}
                className="mesh-action mesh-action-primary px-4 text-sm"
              >
                {isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Users size={15} aria-hidden="true" />}
                Create group
              </button>
            </div>
          </div>

          <div className="mesh-surface rounded-lg p-4">
            <h2 className="flex items-center gap-2 text-base font-bold">
              <Plus size={17} aria-hidden="true" />
              New room
            </h2>
            <div className="mt-3 grid gap-2">
              <input value={roomTitle} onChange={(event) => setRoomTitle(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="Room name" />
              <select value={roomType} onChange={(event) => setRoomType(event.target.value)} className="simple-input h-11 px-3 text-sm">
                <option value="co_browse">Shared scroll</option>
                <option value="watch">Watch session</option>
                <option value="voice_room">Voice room</option>
                <option value="video_room">Video room</option>
                <option value="collaborative_space">Collaborative space</option>
              </select>
              <input value={roomUrl} onChange={(event) => setRoomUrl(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="Optional shared URL" />
              <button type="button" onClick={createRoom} disabled={isPending || !roomTitle.trim()} className="mesh-action mesh-action-primary px-4 text-sm">
                {isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Users size={15} aria-hidden="true" />}
                Create room
              </button>
            </div>
          </div>
        </aside>

        <section className="grid gap-4">
          <div className="mesh-surface rounded-lg p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">Rooms, calls, and shared scrolls</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Browse, watch, call, vote, and still like or comment from your own connected account.</p>
              </div>
              <span className="rounded-full border border-[var(--border-primary)] px-3 py-1.5 text-xs font-bold text-[var(--text-secondary)]">
                {sessions.length} room{sessions.length === 1 ? "" : "s"}
              </span>
            </div>

            {sessions.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setActiveSessionId(session.id)}
                    className={`mesh-choice shrink-0 rounded-md px-3 py-2 text-left text-sm ${
                      activeSession?.id === session.id
                        ? "border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--bg-primary)]"
                        : "text-[var(--text-secondary)]"
                    }`}
                  >
                    <span className="block font-bold">{session.title}</span>
                    <span className="block text-xs opacity-80">
                      {roomTypeLabel(session.sessionType)} - {session.status}{session.callStatus === "live" ? ` - ${session.callMode} call` : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {activeSession ? (
            <article className="mesh-surface rounded-lg p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold ${roomStatusClass(activeSession.status)}`}>
                    {activeSession.status}
                  </div>
                  <h3 className="mt-3 text-2xl font-bold">{activeSession.title}</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {activeSession.participants.length} participant{activeSession.participants.length === 1 ? "" : "s"}.
                    {" "}Every action stays tied to the person who made it.
                  </p>
                  {activeSession.callStatus === "live" && (
                    <p className="mt-2 inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-100">
                      {activeSession.callMode === "video" ? <Video size={13} aria-hidden="true" /> : <Phone size={13} aria-hidden="true" />}
                      {activeSession.callMode} call live{activeSession.callStartedAt ? ` since ${formatRelativeTime(activeSession.callStartedAt)}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeSession.callStatus !== "live" ? (
                    <>
                      <button type="button" onClick={() => patchRoom(activeSession.id, "start-call", "voice")} disabled={isPending || activeSession.status === "ended"} className="mesh-action mesh-action-secondary px-3 text-sm">
                        <Phone size={15} aria-hidden="true" />
                        Voice
                      </button>
                      <button type="button" onClick={() => patchRoom(activeSession.id, "start-call", "video")} disabled={isPending || activeSession.status === "ended"} className="mesh-action mesh-action-secondary px-3 text-sm">
                        <Video size={15} aria-hidden="true" />
                        Video
                      </button>
                    </>
                  ) : (
                    activeSession.hostId === currentUser.id && (
                      <button type="button" onClick={() => patchRoom(activeSession.id, "end-call")} disabled={isPending} className="mesh-action mesh-action-secondary px-3 text-sm">
                        End call
                      </button>
                    )
                  )}
                  {activeSession.hostId === currentUser.id && (
                    <>
                      {activeSession.status !== "live" && (
                        <button type="button" onClick={() => patchRoom(activeSession.id, "start")} disabled={isPending || activeSession.status === "ended"} className="mesh-action mesh-action-primary px-4 text-sm">
                          Start
                        </button>
                      )}
                      {activeSession.status !== "ended" && (
                        <button type="button" onClick={() => patchRoom(activeSession.id, "end")} disabled={isPending} className="mesh-action mesh-action-secondary px-4 text-sm">
                          End
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-2 rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3 md:grid-cols-[1fr_1fr_auto]">
                <input value={itemTitle} onChange={(event) => setItemTitle(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="Item title" />
                <input value={itemUrl} onChange={(event) => setItemUrl(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="Optional URL" />
                <button type="button" onClick={() => addItem(activeSession.id)} disabled={isPending || (!itemTitle.trim() && !itemUrl.trim())} className="mesh-action mesh-action-secondary px-4 text-sm">
                  <Plus size={15} aria-hidden="true" />
                  Add
                </button>
              </div>

              <div className="mt-4 grid gap-3">
                {activeSession.items.length > 0 ? (
                  activeSession.items.map((item) => {
                    const keeps = item.votes.filter((voteItem) => voteItem.vote === "keep").length;
                    const skips = item.votes.filter((voteItem) => voteItem.vote === "skip").length;
                    const myVote = item.votes.find((voteItem) => voteItem.userId === currentUser.id)?.vote;

                    return (
                      <div key={item.id} className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                              {platformLabel(item.sourcePlatform)}
                            </p>
                            <h4 className="mt-1 truncate text-base font-bold">{item.title || "Shared item"}</h4>
                            {item.content && <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{item.content}</p>}
                            {item.sourceUrl && (
                              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">
                                <Link2 size={13} aria-hidden="true" />
                                Open source
                              </a>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => vote(activeSession.id, item.id, "keep")}
                              disabled={isPending}
                              className={`mesh-action px-3 text-sm ${myVote === "keep" ? "mesh-action-primary" : "mesh-action-secondary"}`}
                            >
                              <Check size={14} aria-hidden="true" />
                              {keeps}
                            </button>
                            <button
                              type="button"
                              onClick={() => vote(activeSession.id, item.id, "skip")}
                              disabled={isPending}
                              className={`mesh-action px-3 text-sm ${myVote === "skip" ? "border-red-300/30 bg-red-500/10 text-red-100" : "mesh-action-secondary"}`}
                            >
                              <SkipForward size={14} aria-hidden="true" />
                              {skips}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-md border border-[var(--border-primary)] bg-[var(--bg-primary)]/60 p-6 text-center">
                    <X className="mx-auto h-6 w-6 text-[var(--text-muted)]" aria-hidden="true" />
                    <h4 className="mt-2 font-bold">No shared items yet</h4>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">Add a link or share a post into this room.</p>
                  </div>
                )}
              </div>
            </article>
          ) : (
            <div className="mesh-surface rounded-lg p-8 text-center">
              <h3 className="text-xl font-bold">Create the first room.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
                Shared scrolling turns social media into a group activity while preserving each person as themselves.
              </p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
