"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Check,
  ChevronLeft,
  Info,
  Link2,
  Loader2,
  MessageCircle,
  Paperclip,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  SkipForward,
  Smile,
  Users,
  Video,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
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

function platformLabel(platform: string) {
  if (platform.toLowerCase() === "twitter") return "X";
  if (platform.toLowerCase() === "meshme") return "Mesh.me";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function platformBadgeClass(platform: string): string {
  const p = platform.toLowerCase();
  if (p === "twitter" || p === "x") return "bg-sky-500/20 text-sky-300";
  if (p === "instagram") return "bg-pink-500/20 text-pink-300";
  if (p === "youtube") return "bg-red-500/20 text-red-300";
  if (p === "discord") return "bg-indigo-500/20 text-indigo-300";
  if (p === "whatsapp") return "bg-emerald-500/20 text-emerald-300";
  return "bg-[var(--mesh-blue)]/20 text-[var(--mesh-blue)]";
}

function threadDisplay(thread: MeChatThread) {
  if (thread.threadType === "group") return thread.title || "MeChat group";
  return thread.otherUser?.displayName || thread.title || "Conversation";
}

function threadSubtitle(thread: MeChatThread) {
  if (thread.threadType === "group") return `${thread.memberCount} members`;
  return thread.otherUser ? `@${thread.otherUser.username}` : "Private chat";
}

function roomTypeLabel(type: string) {
  if (type === "co_browse") return "Shared scroll";
  if (type === "watch") return "Watch session";
  if (type === "voice_room") return "Voice room";
  if (type === "video_room") return "Video room";
  if (type === "collaborative_space") return "Space room";
  return type.replace(/_/g, " ");
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
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
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
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null,
    [activeSessionId, sessions],
  );

  const inboxSummary = useMemo(() => {
    const connected = connectedInboxes.length;
    const importedItems = connectedInboxes.reduce((total, inbox) => total + inbox.platformComments + inbox.platformPosts, 0);
    const nativeMessageSync = connectedInboxes.filter((inbox) => inbox.messageSync).length;
    return { connected, importedItems, nativeMessageSync };
  }, [connectedInboxes]);

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

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;

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
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error((data as Record<string, string> | null)?.error || "Could not reload room");
    updateSession(data.session);
  }

  function searchPeople() {
    if (!recipientQuery.trim()) return;
    startTransition(async () => {
      setStatus(null);
      try {
        const res = await fetch(`/api/search/users?q=${encodeURIComponent(recipientQuery.trim())}`);
        const data = await res.json().catch(() => ({ error: "Search failed" }));
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
        const data = await res.json().catch(() => ({ error: "Could not create group" }));
        if (!res.ok) throw new Error(data.error || "Could not create group");
        setGroupTitle("");
        setGroupOpeningMessage("");
        setSelectedGroupMembers([]);
        setShowNewGroup(false);
        setStatus({ type: "success", message: "MeChat group created." });
        const threadsRes = await fetch("/api/messages");
        const threadsData = await threadsRes.json().catch(() => ({}));
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
        const data = await res.json().catch(() => ({ error: "Could not create room" }));
        if (!res.ok) throw new Error(data.error || "Could not create room");
        updateSession(data.session);
        setRoomTitle("Shared browsing room");
        setRoomType("co_browse");
        setRoomUrl("");
        setShowNewRoom(false);
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
        const data = await res.json().catch(() => ({ error: "Could not update room" }));
        if (!res.ok) throw new Error(data.error || "Could not update room");
        updateSession(data.session);
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not update room" });
      }
    });
  }

  function startCallFromThread(thread: MeChatThread, mode: "voice" | "video") {
    const peerName = threadDisplay(thread);
    const sessionType = mode === "voice" ? "voice_room" : "video_room";
    startTransition(async () => {
      setStatus(null);
      try {
        const res = await fetch("/api/mechat/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: `${mode === "voice" ? "Call" : "Video"} with ${peerName}`,
            sessionType,
            callMode: mode,
            items: [],
            participantIds: thread.otherUsers.map((u) => u.id).concat(thread.otherUser?.id ? [thread.otherUser.id] : []),
          }),
        });
        const data = await res.json().catch(() => ({ error: "Could not start call" }));
        if (!res.ok) throw new Error(data.error || "Could not start call");
        updateSession(data.session);
        setStatus({ type: "success", message: `${mode === "voice" ? "Voice" : "Video"} call started with ${peerName}` });
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not start call" });
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
        const data = await res.json().catch(() => ({ error: "Could not add item" }));
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
        const data = await res.json().catch(() => ({ error: "Could not vote" }));
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
        const data = await res.json().catch(() => ({ error: "Could not sync MeChat" }));
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
    <div className="mechat-layout flex h-[calc(100dvh-3.5rem)] overflow-hidden animate-page-enter" data-view={selectedThreadId ? "thread" : activeSessionId ? "room" : "list"}>
      {/* Panel 1: Conversation list */}
      <div className={`mechat-sidebar flex w-full flex-col border-r border-[var(--mesh-border)] bg-[var(--mesh-bg)] md:w-[340px] md:shrink-0${selectedThreadId ? " mechat-sidebar-hidden" : ""}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--mesh-border)] px-4 py-3">
          <h1 className="text-lg font-bold text-[var(--mesh-text)]">MeChat</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={syncInboxes}
              disabled={isPending || connectedInboxes.length === 0}
              className="rounded-lg p-2 text-[var(--mesh-text-muted)] transition-colors hover:bg-[var(--mesh-panel)]"
              title="Sync inboxes"
            >
              {isPending ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            </button>
            <button
              type="button"
              onClick={() => setShowNewGroup(!showNewGroup)}
              className="rounded-lg p-2 text-[var(--mesh-text-muted)] transition-colors hover:bg-[var(--mesh-panel)]"
              title="New group"
            >
              <Users size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowNewRoom(!showNewRoom)}
              className="rounded-lg p-2 text-[var(--mesh-text-muted)] transition-colors hover:bg-[var(--mesh-panel)]"
              title="New room"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 py-2">
          <label className="flex items-center gap-2 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 py-2 text-sm">
            <Search size={14} className="shrink-0 text-[var(--mesh-text-muted)]" />
            <input
              value={threadQuery}
              onChange={(event) => setThreadQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
              placeholder="Search conversations"
            />
          </label>
        </div>

        {/* Connected sources badge — hidden on mobile to reduce clutter */}
        <div className="mx-3 mb-2 hidden items-center gap-2 rounded-lg bg-[var(--mesh-bg-elevated)] px-3 py-2 md:flex">
          <ShieldCheck size={13} className="shrink-0 text-[var(--mesh-green)]" />
          <span className="text-[11px] text-[var(--mesh-text-muted)]">
            {inboxSummary.connected} source{inboxSummary.connected !== 1 ? "s" : ""} connected · {inboxSummary.importedItems} items synced
          </span>
        </div>

        {/* Status messages */}
        {status && (
          <div className={`mx-3 mb-2 rounded-lg px-3 py-2 text-xs ${
            status.type === "error" ? "bg-[var(--mesh-danger)]/10 text-[var(--mesh-danger)]" : "bg-[var(--mesh-green)]/10 text-[var(--mesh-green)]"
          }`}>
            {status.message}
          </div>
        )}

        {/* New group form (inline) */}
        {showNewGroup && (
          <div className="mx-3 mb-2 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-3">
            <h3 className="mb-2 text-xs font-bold text-[var(--mesh-text)]">New Group</h3>
            <div className="flex gap-2">
              <input
                value={recipientQuery}
                onChange={(e) => setRecipientQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); searchPeople(); } }}
                className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-2 text-xs text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
                placeholder="Search people"
              />
              <button type="button" onClick={searchPeople} disabled={isPending} className="rounded-lg bg-[var(--mesh-blue)] px-2 py-1 text-xs text-white">
                <Search size={12} />
              </button>
            </div>
            {recipients.length > 0 && (
              <div className="mt-2 max-h-32 space-y-1 overflow-y-auto">
                {recipients.map((r) => {
                  const sel = selectedGroupMembers.some((m) => m.id === r.id);
                  return (
                    <button key={r.id} type="button" onClick={() => toggleGroupMember(r)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${sel ? "bg-[var(--mesh-blue)]/10" : "hover:bg-[var(--mesh-panel)]"}`}>
                      <Avatar src={r.avatarUrl} alt={r.displayName} size="sm" className="h-6 w-6" />
                      <span className="truncate text-[var(--mesh-text)]">{r.displayName}</span>
                      {sel && <Check size={12} className="ml-auto text-[var(--mesh-blue)]" />}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedGroupMembers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedGroupMembers.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-[var(--mesh-blue)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--mesh-blue)]">
                    {m.displayName}
                    <button type="button" onClick={() => toggleGroupMember(m)}><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
            <input value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} className="mt-2 h-8 w-full rounded-lg border border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-2 text-xs text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]" placeholder="Group name" />
            <button type="button" onClick={createGroupThread} disabled={isPending || selectedGroupMembers.length === 0} className="mt-2 w-full rounded-lg bg-[var(--mesh-blue)] py-1.5 text-xs font-medium text-white disabled:opacity-50">
              {isPending ? "Creating..." : "Create group"}
            </button>
          </div>
        )}

        {/* New room form (inline) */}
        {showNewRoom && (
          <div className="mx-3 mb-2 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-3">
            <h3 className="mb-2 text-xs font-bold text-[var(--mesh-text)]">New Room</h3>
            <input value={roomTitle} onChange={(e) => setRoomTitle(e.target.value)} className="h-8 w-full rounded-lg border border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-2 text-xs text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]" placeholder="Room name" />
            <select value={roomType} onChange={(e) => setRoomType(e.target.value)} className="mt-2 h-8 w-full rounded-lg border border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-2 text-xs text-[var(--mesh-text)] outline-none">
              <option value="co_browse">Shared scroll</option>
              <option value="watch">Watch session</option>
              <option value="voice_room">Voice room</option>
              <option value="video_room">Video room</option>
              <option value="collaborative_space">Collaborative space</option>
            </select>
            <input value={roomUrl} onChange={(e) => setRoomUrl(e.target.value)} className="mt-2 h-8 w-full rounded-lg border border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-2 text-xs text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]" placeholder="Optional shared URL" />
            <button type="button" onClick={createRoom} disabled={isPending || !roomTitle.trim()} className="mt-2 w-full rounded-lg bg-[var(--mesh-blue)] py-1.5 text-xs font-medium text-white disabled:opacity-50">
              {isPending ? "Creating..." : "Create room"}
            </button>
          </div>
        )}

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {/* Rooms section */}
          {sessions.length > 0 && (
            <div className="px-3 pb-1 pt-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--mesh-text-muted)]">Rooms</p>
              {sessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => setActiveSessionId(session.id)}
                  className={`mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    activeSessionId === session.id ? "bg-[var(--mesh-panel-hover)]" : "hover:bg-[var(--mesh-panel)]"
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)]">
                    <Video size={16} className="text-[var(--mesh-blue)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--mesh-text)]">{session.title}</p>
                    <p className="truncate text-xs text-[var(--mesh-text-muted)]">
                      {roomTypeLabel(session.sessionType)} · {session.participants.length} in room
                    </p>
                  </div>
                  {session.callStatus === "live" && (
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--mesh-green)]" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Conversations section */}
          <div className="px-3 pb-1 pt-2">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-[var(--mesh-text-muted)]">Messages</p>
            {filteredThreads.length > 0 ? (
              filteredThreads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/messages/${thread.id}`}
                  onClick={(e) => { e.preventDefault(); setSelectedThreadId(thread.id); }}
                  className={`mb-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    selectedThreadId === thread.id ? "bg-[var(--mesh-panel-hover)]" : "hover:bg-[var(--mesh-panel)]"
                  }`}
                >
                  {thread.threadType === "group" ? (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)]">
                      <Users size={16} className="text-[var(--mesh-text-muted)]" />
                    </div>
                  ) : (
                    <Avatar src={thread.otherUser?.avatarUrl ?? null} alt={thread.otherUser?.displayName ?? ""} size="sm" className="h-10 w-10 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="truncate text-sm font-bold text-[var(--mesh-text)]">{threadDisplay(thread)}</span>
                        {thread.platform && thread.platform !== "mesh" && (
                          <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${platformBadgeClass(thread.platform)}`}>
                            {platformLabel(thread.platform)}
                          </span>
                        )}
                      </div>
                      {thread.lastMessage && (
                        <span className="shrink-0 text-[10px] text-[var(--mesh-text-muted)]">
                          {formatRelativeTime(thread.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-[var(--mesh-text-muted)]">
                        {thread.lastMessage?.content ?? "No messages yet"}
                      </p>
                      {thread.unread > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[var(--mesh-blue)] px-1 text-[10px] font-bold text-white">
                          {thread.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--mesh-border)] px-4 py-6 text-center">
                <MessageCircle className="mx-auto mb-2 h-6 w-6 text-[var(--mesh-text-muted)]" />
                <p className="text-xs text-[var(--mesh-text-muted)]">
                  {threadQuery ? "No matching conversations." : "No conversations yet."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel 2: Active conversation / room detail */}
      <div className="mechat-thread-panel flex min-w-0 flex-1 flex-col bg-[var(--mesh-bg-deep)]">
        {selectedThread ? (
          <>
            {/* Conversation header */}
            <div className="flex items-center gap-3 border-b border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-4 py-3">
              <button type="button" onClick={() => setSelectedThreadId(null)} className="rounded-lg p-1 text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)] lg:hidden">
                <ChevronLeft size={18} />
              </button>
              {selectedThread.threadType === "group" ? (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)]">
                  <Users size={15} className="text-[var(--mesh-text-muted)]" />
                </div>
              ) : (
                <Avatar src={selectedThread.otherUser?.avatarUrl ?? null} alt={threadDisplay(selectedThread)} size="sm" className="h-9 w-9 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--mesh-text)]">{threadDisplay(selectedThread)}</p>
                <p className="text-xs text-[var(--mesh-text-muted)]">{threadSubtitle(selectedThread)}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => startCallFromThread(selectedThread, "voice")} disabled={isPending} className="rounded-lg p-2 text-[var(--mesh-text-muted)] transition-colors hover:bg-[var(--mesh-panel)] disabled:opacity-40" title="Voice call">
                  <Phone size={16} />
                </button>
                <button type="button" onClick={() => startCallFromThread(selectedThread, "video")} disabled={isPending} className="rounded-lg p-2 text-[var(--mesh-text-muted)] transition-colors hover:bg-[var(--mesh-panel)] disabled:opacity-40" title="Video call">
                  <Video size={16} />
                </button>
                <button type="button" onClick={() => setShowInfoPanel(!showInfoPanel)} className={`rounded-lg p-2 transition-colors ${showInfoPanel ? "bg-[var(--mesh-panel)] text-[var(--mesh-blue)]" : "text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)]"}`} title="Info">
                  <Info size={16} />
                </button>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-sm text-[var(--mesh-text-muted)]">
                  Messages with <span className="font-bold text-[var(--mesh-text)]">{threadDisplay(selectedThread)}</span>
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
                  <ShieldCheck size={12} />
                  End-to-end encrypted
                </div>
                {selectedThread.lastMessage ? (
                  <div className="mt-8 space-y-4">
                    <div className="flex justify-start">
                      <div className="max-w-[70%] rounded-2xl rounded-tl-sm bg-[var(--mesh-bg-elevated)] border border-[var(--mesh-border)] px-4 py-3">
                        <p className="text-sm text-[var(--mesh-text)]">{selectedThread.lastMessage.content}</p>
                        <p className="mt-1 text-right text-[10px] text-[var(--mesh-text-muted)]">
                          {formatRelativeTime(selectedThread.lastMessage.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-6 text-xs text-[var(--mesh-text-muted)]">Send the first message to start the conversation.</p>
                )}
              </div>
            </div>

            {/* Compose bar */}
            <div className="border-t border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-4 py-3">
              <div className="flex items-center gap-2">
                <button type="button" className="shrink-0 rounded-lg p-2 text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)]">
                  <Paperclip size={18} />
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-4 py-2.5">
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
                    placeholder="Type a message..."
                  />
                  <button type="button" className="text-[var(--mesh-text-muted)] hover:text-[var(--mesh-text)]">
                    <Smile size={18} />
                  </button>
                </div>
                <button type="button" className="shrink-0 rounded-xl bg-[var(--mesh-blue)] p-2.5 text-white transition-colors hover:bg-[var(--mesh-blue)]/90">
                  <Send size={16} />
                </button>
              </div>
            </div>
          </>
        ) : activeSession ? (
          <>
            {/* Room header */}
            <div className="flex items-center gap-3 border-b border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-4 py-3">
              <button type="button" onClick={() => setActiveSessionId("")} className="rounded-lg p-1 text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)] md:hidden">
                <ChevronLeft size={18} />
              </button>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--mesh-blue)]/10">
                <Video size={15} className="text-[var(--mesh-blue)]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[var(--mesh-text)]">{activeSession.title}</p>
                <p className="text-xs text-[var(--mesh-text-muted)]">
                  {roomTypeLabel(activeSession.sessionType)} · {activeSession.participants.length} participant{activeSession.participants.length !== 1 ? "s" : ""}
                  {activeSession.callStatus === "live" && " · Call live"}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {activeSession.callStatus !== "live" ? (
                  <>
                    <button type="button" onClick={() => patchRoom(activeSession.id, "start-call", "voice")} disabled={isPending || activeSession.status === "ended"} className="rounded-lg p-2 text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)]" title="Voice call">
                      <Phone size={16} />
                    </button>
                    <button type="button" onClick={() => patchRoom(activeSession.id, "start-call", "video")} disabled={isPending || activeSession.status === "ended"} className="rounded-lg p-2 text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)]" title="Video call">
                      <Video size={16} />
                    </button>
                  </>
                ) : activeSession.hostId === currentUser.id ? (
                  <button type="button" onClick={() => patchRoom(activeSession.id, "end-call")} disabled={isPending} className="rounded-lg bg-[var(--mesh-danger)]/10 px-3 py-1.5 text-xs font-medium text-[var(--mesh-danger)]">
                    End call
                  </button>
                ) : null}
                <button type="button" onClick={() => setShowInfoPanel(!showInfoPanel)} className={`rounded-lg p-2 transition-colors ${showInfoPanel ? "bg-[var(--mesh-panel)] text-[var(--mesh-blue)]" : "text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)]"}`}>
                  <Info size={16} />
                </button>
              </div>
            </div>

            {/* Room content */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Participant strip */}
              <div className="mb-4 flex items-center gap-3 overflow-x-auto pb-2">
                {activeSession.participants.map((p) => (
                  <div key={p.id} className="flex shrink-0 flex-col items-center gap-1">
                    <Avatar src={p.user.avatarUrl} alt={p.user.displayName} size="sm" className="h-10 w-10" />
                    <span className="text-[10px] font-medium text-[var(--mesh-text-muted)]">{p.user.displayName.split(" ")[0]}</span>
                    <span className="text-[9px] text-[var(--mesh-text-muted)] capitalize">{p.role}</span>
                  </div>
                ))}
              </div>

              {/* Room controls */}
              {activeSession.hostId === currentUser.id && (
                <div className="mb-4 flex gap-2">
                  {activeSession.status !== "live" && activeSession.status !== "ended" && (
                    <button type="button" onClick={() => patchRoom(activeSession.id, "start")} disabled={isPending} className="rounded-xl bg-[var(--mesh-blue)] px-4 py-2 text-sm font-medium text-white">
                      Start Room
                    </button>
                  )}
                  {activeSession.status !== "ended" && (
                    <button type="button" onClick={() => patchRoom(activeSession.id, "end")} disabled={isPending} className="rounded-xl border border-[var(--mesh-border)] px-4 py-2 text-sm font-medium text-[var(--mesh-text)]">
                      End Room
                    </button>
                  )}
                </div>
              )}

              {/* Items / Queue */}
              <div className="space-y-3">
                {activeSession.items.length > 0 ? (
                  activeSession.items.map((item) => {
                    const keeps = item.votes.filter((v) => v.vote === "keep").length;
                    const skips = item.votes.filter((v) => v.vote === "skip").length;
                    const myVote = item.votes.find((v) => v.userId === currentUser.id)?.vote;

                    return (
                      <div key={item.id} className="rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${platformBadgeClass(item.sourcePlatform)}`}>
                              {platformLabel(item.sourcePlatform)}
                            </span>
                            <h4 className="mt-1.5 text-sm font-bold text-[var(--mesh-text)]">{item.title || "Shared item"}</h4>
                            {item.content && <p className="mt-1 text-xs text-[var(--mesh-text-secondary)] line-clamp-3">{item.content}</p>}
                            {item.sourceUrl && (
                              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[var(--mesh-blue)] hover:underline">
                                <Link2 size={12} />
                                Open source
                              </a>
                            )}
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => vote(activeSession.id, item.id, "keep")}
                              disabled={isPending}
                              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                myVote === "keep" ? "bg-[var(--mesh-green)]/20 text-[var(--mesh-green)]" : "border border-[var(--mesh-border)] text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)]"
                              }`}
                            >
                              <Check size={12} /> {keeps}
                            </button>
                            <button
                              type="button"
                              onClick={() => vote(activeSession.id, item.id, "skip")}
                              disabled={isPending}
                              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                myVote === "skip" ? "bg-[var(--mesh-danger)]/20 text-[var(--mesh-danger)]" : "border border-[var(--mesh-border)] text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)]"
                              }`}
                            >
                              <SkipForward size={12} /> {skips}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--mesh-border)] px-6 py-10 text-center">
                    <Plus className="h-8 w-8 text-[var(--mesh-text-muted)]" />
                    <p className="text-sm text-[var(--mesh-text-muted)]">No shared items yet. Add a link or share a post.</p>
                  </div>
                )}
              </div>

              {/* Add item */}
              <div className="mt-4 flex gap-2 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg)] p-3">
                <input value={itemTitle} onChange={(e) => setItemTitle(e.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 text-xs text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]" placeholder="Item title" />
                <input value={itemUrl} onChange={(e) => setItemUrl(e.target.value)} className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 text-xs text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]" placeholder="URL (optional)" />
                <button type="button" onClick={() => addItem(activeSession.id)} disabled={isPending || (!itemTitle.trim() && !itemUrl.trim())} className="shrink-0 rounded-lg bg-[var(--mesh-blue)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">
                  <Plus size={14} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--mesh-blue)]/10">
              <MessageCircle className="h-8 w-8 text-[var(--mesh-blue)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--mesh-text)]">Welcome to MeChat</h2>
            <p className="max-w-sm text-sm text-[var(--mesh-text-muted)]">
              Every conversation, share, and watch party in one inbox. Select a conversation or create a new room to get started.
            </p>
          </div>
        )}
      </div>

      {/* Panel 3: Info panel (collapsible) */}
      {showInfoPanel && (selectedThread || activeSession) && (
        <div className="mechat-detail-panel hidden w-[320px] shrink-0 flex-col border-l border-[var(--mesh-border)] bg-[var(--mesh-bg)] xl:flex">
          <div className="flex items-center justify-between border-b border-[var(--mesh-border)] px-4 py-3">
            <h3 className="text-sm font-bold text-[var(--mesh-text)]">Details</h3>
            <button type="button" onClick={() => setShowInfoPanel(false)} className="rounded-lg p-1 text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)]">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {selectedThread ? (
              <div className="space-y-5">
                <div className="flex flex-col items-center text-center">
                  {selectedThread.threadType === "group" ? (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)]">
                      <Users size={24} className="text-[var(--mesh-text-muted)]" />
                    </div>
                  ) : (
                    <Avatar src={selectedThread.otherUser?.avatarUrl ?? null} alt={threadDisplay(selectedThread)} size="lg" className="h-16 w-16" />
                  )}
                  <h4 className="mt-3 text-base font-bold text-[var(--mesh-text)]">{threadDisplay(selectedThread)}</h4>
                  <p className="text-xs text-[var(--mesh-text-muted)]">{threadSubtitle(selectedThread)}</p>
                  {selectedThread.isEncrypted && (
                    <div className="mt-2 inline-flex items-center gap-1 text-[10px] text-emerald-400">
                      <ShieldCheck size={11} /> End-to-end encrypted
                    </div>
                  )}
                </div>

                {selectedThread.threadType === "group" && selectedThread.otherUsers.length > 0 && (
                  <div>
                    <h5 className="mb-2 text-xs font-bold text-[var(--mesh-text-muted)]">Members ({selectedThread.memberCount})</h5>
                    <div className="space-y-2">
                      {selectedThread.otherUsers.map((u) => (
                        <Link key={u.id} href={`/profile/${u.username}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--mesh-panel)]">
                          <Avatar src={u.avatarUrl} alt={u.displayName} size="sm" className="h-8 w-8" />
                          <div className="min-w-0">
                            <p className="truncate text-xs font-bold text-[var(--mesh-text)]">{u.displayName}</p>
                            <p className="truncate text-[10px] text-[var(--mesh-text-muted)]">@{u.username}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h5 className="mb-2 text-xs font-bold text-[var(--mesh-text-muted)]">Actions</h5>
                  <div className="space-y-1">
                    <Link href={`/messages/${selectedThread.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--mesh-text-secondary)] transition-colors hover:bg-[var(--mesh-panel)]">
                      <MessageCircle size={14} /> Open full conversation
                    </Link>
                    <button type="button" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-[var(--mesh-text-secondary)] transition-colors hover:bg-[var(--mesh-panel)]">
                      <Settings size={14} /> Notification settings
                    </button>
                  </div>
                </div>
              </div>
            ) : activeSession ? (
              <div className="space-y-5">
                <div className="flex flex-col items-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--mesh-blue)]/10">
                    <Video size={24} className="text-[var(--mesh-blue)]" />
                  </div>
                  <h4 className="mt-3 text-base font-bold text-[var(--mesh-text)]">{activeSession.title}</h4>
                  <p className="text-xs text-[var(--mesh-text-muted)]">{roomTypeLabel(activeSession.sessionType)} · {activeSession.status}</p>
                </div>

                <div>
                  <h5 className="mb-2 text-xs font-bold text-[var(--mesh-text-muted)]">Participants ({activeSession.participants.length})</h5>
                  <div className="space-y-2">
                    {activeSession.participants.map((p) => (
                      <div key={p.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
                        <Avatar src={p.user.avatarUrl} alt={p.user.displayName} size="sm" className="h-8 w-8" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-[var(--mesh-text)]">{p.user.displayName}</p>
                          <p className="truncate text-[10px] text-[var(--mesh-text-muted)]">@{p.user.username}</p>
                        </div>
                        <span className="rounded-md bg-[var(--mesh-panel)] px-1.5 py-0.5 text-[9px] font-bold capitalize text-[var(--mesh-text-muted)]">{p.role}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="mb-2 text-xs font-bold text-[var(--mesh-text-muted)]">Queue ({activeSession.items.length})</h5>
                  <div className="space-y-1.5">
                    {activeSession.items.map((item, i) => (
                      <div key={item.id} className="flex items-center gap-2 rounded-lg border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3 py-2">
                        <span className="text-[10px] font-bold text-[var(--mesh-text-muted)]">{i + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-[var(--mesh-text)]">{item.title || "Shared item"}</p>
                          <p className="text-[10px] text-[var(--mesh-text-muted)]">{platformLabel(item.sourcePlatform)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {connectedInboxes.length > 0 && (
                  <div>
                    <h5 className="mb-2 text-xs font-bold text-[var(--mesh-text-muted)]">Connected Sources</h5>
                    <div className="space-y-1.5">
                      {connectedInboxes.map((inbox) => (
                        <div key={inbox.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-xs">
                          <span className="font-medium text-[var(--mesh-text)]">{platformLabel(inbox.platform)}</span>
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${inbox.messageSync ? "bg-emerald-500/10 text-emerald-400" : "bg-[var(--mesh-panel)] text-[var(--mesh-text-muted)]"}`}>
                            {inbox.messageSync ? "DM sync" : "activity"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
