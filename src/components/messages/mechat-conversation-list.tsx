"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { BadgeCheck, Check, MessageCircle, Music, PenSquare, Plus, Search, Users, X } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { Avatar } from "@/components/ui/avatar";
import { Modal } from "@/components/ui/modal";
import { useContactPresence } from "./use-contact-presence";
import { formatRelativeTime } from "@/lib/utils";

type Person = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified?: boolean;
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

type UserSearchResult = Person;

type MeChatNoteEntry = {
  id: string;
  userId: string;
  text: string;
  songTitle: string | null;
  songArtist: string | null;
  createdAt: string;
  expiresAt: string;
  user: Person;
};

type MeChatConversationListProps = {
  currentUser: Person;
  initialThreads: MeChatThread[];
  initialNotes: MeChatNoteEntry[];
  variant?: "rail" | "page";
  className?: string;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "direct", label: "Direct" },
  { key: "groups", label: "Groups" },
  { key: "channels", label: "Channels" },
  { key: "synced", label: "Synced" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

// Shared overlay physics: mobile sheets ride up on it, desktop panels scale-fade.

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
  return "bg-[var(--accent)]/20 text-[var(--accent)]";
}

function threadDisplay(thread: MeChatThread) {
  if (thread.threadType === "group" || thread.threadType === "community") return thread.title || "MeChat group";
  return thread.otherUser?.displayName || thread.title || "Conversation";
}

function threadTypeKey(thread: MeChatThread): FilterKey {
  if (thread.threadType === "group") return "groups";
  if (thread.threadType === "community") return "channels";
  return "direct";
}

function isSyncedThread(thread: MeChatThread) {
  return Boolean(thread.platform) && thread.platform.toLowerCase() !== "mesh" && thread.platform.toLowerCase() !== "meshme";
}

function buildShareQuery(searchParams: ReturnType<typeof useSearchParams>) {
  const shareParams = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (key === "compose") continue;
    if (key === "sharePostId" || key === "sharePlatformPostId" || key === "shareUrl" || key === "shareTitle" || key === "sourcePlatform") {
      shareParams.set(key, value);
    }
  }
  return shareParams.toString();
}

export function MeChatConversationList({
  currentUser,
  initialThreads,
  initialNotes,
  variant = "rail",
  className,
}: MeChatConversationListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Render the live prop directly. MessagesDataProvider polls and pushes fresh
  // threads down through this prop; snapshotting it into useState (as before)
  // froze the list at mount so new conversations, latest-message previews, and
  // unread counts never updated without a full reload.
  const threads = initialThreads;
  // Same live presence that animates Meshi on the mesh — here it's the
  // "active now" dot on conversations.
  const onlineContacts = useContactPresence();
  const [threadQuery, setThreadQuery] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipients, setRecipients] = useState<UserSearchResult[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<UserSearchResult[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [notes, setNotes] = useState(initialNotes);
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSong, setNoteSong] = useState("");
  const [activeNote, setActiveNote] = useState<MeChatNoteEntry | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [isPending, startTransition] = useTransition();

  const shareQuery = useMemo(() => buildShareQuery(searchParams), [searchParams]);
  const shouldOpenCompose = searchParams.get("compose") === "true" || shareQuery.length > 0;

  useEffect(() => {
    if (shouldOpenCompose) {
      setRecipientQuery("");
      setRecipients([]);
      setSelectedMembers([]);
      setGroupTitle("");
      setStatus(null);
      setShowCompose(true);
    }
  }, [shouldOpenCompose]);

  const myNote = useMemo(() => notes.find((note) => note.userId === currentUser.id) ?? null, [notes, currentUser.id]);
  const friendNotes = useMemo(() => notes.filter((note) => note.userId !== currentUser.id), [notes, currentUser.id]);

  const filteredThreads = useMemo(() => {
    const q = threadQuery.trim().toLowerCase();
    return threads.filter((thread) => {
      const matchesSearch = !q || [threadDisplay(thread), thread.otherUser?.username, thread.lastMessage?.content].some((value) =>
        value?.toLowerCase().includes(q),
      );
      const matchesFilter = activeFilter === "all"
        || (activeFilter === "synced" ? isSyncedThread(thread) : threadTypeKey(thread) === activeFilter);
      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, threadQuery, threads]);

  const filterCounts = useMemo(() => {
    const counts = { all: threads.length, direct: 0, groups: 0, channels: 0, synced: 0 };
    for (const thread of threads) {
      counts[threadTypeKey(thread)] += 1;
      if (isSyncedThread(thread)) counts.synced += 1;
    }
    return counts;
  }, [threads]);

  function openCompose() {
    setRecipientQuery("");
    setRecipients([]);
    setSelectedMembers([]);
    setGroupTitle("");
    setStatus(null);
    setShowCompose(true);
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

  function toggleMember(person: UserSearchResult) {
    setSelectedMembers((current) => {
      if (current.some((member) => member.id === person.id)) {
        return current.filter((member) => member.id !== person.id);
      }
      return [...current, person].slice(0, 49);
    });
  }

  function startConversation() {
    if (selectedMembers.length === 0) {
      setStatus({ type: "error", message: "Choose at least one person." });
      return;
    }
    const isGroup = selectedMembers.length > 1;
    startTransition(async () => {
      setStatus(null);
      try {
        const res = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: isGroup ? groupTitle.trim() || selectedMembers.map((member) => member.displayName).join(", ") : undefined,
            memberIds: selectedMembers.map((member) => member.id),
          }),
        });
        const data = await res.json().catch(() => ({ error: "Could not start chat" }));
        if (!res.ok) throw new Error(data.error || "Could not start chat");
        const nextUrl = shareQuery ? `/messages/${data.thread.id}?${shareQuery}` : `/messages/${data.thread.id}`;
        setShowCompose(false);
        router.push(nextUrl);
        router.refresh();
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not start chat" });
      }
    });
  }

  function saveNote() {
    if (!noteText.trim() && !noteSong.trim()) {
      setShowNoteComposer(false);
      return;
    }
    startTransition(async () => {
      setStatus(null);
      try {
        const res = await fetch("/api/mechat/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: noteText.trim(), songTitle: noteSong.trim() }),
        });
        const data = await res.json().catch(() => ({ error: "Could not save note" }));
        if (!res.ok) throw new Error(data.error || "Could not save note");
        setNotes((current) => [data.note, ...current.filter((note) => note.userId !== currentUser.id)]);
        setNoteText("");
        setNoteSong("");
        setShowNoteComposer(false);
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not save note" });
      }
    });
  }

  function clearNote() {
    startTransition(async () => {
      try {
        const res = await fetch("/api/mechat/notes", { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Could not clear note" }));
          throw new Error(data.error || "Could not clear note");
        }
        setNotes((current) => current.filter((note) => note.userId !== currentUser.id));
        setShowNoteComposer(false);
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not clear note" });
      }
    });
  }

  const rootClassName =
    variant === "rail"
      ? "flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-[var(--mesh-border)] bg-[var(--mesh-panel)]"
      : "flex h-[calc(100dvh-3.5rem)] min-h-0 w-full flex-col overflow-hidden bg-[var(--mesh-bg)] pb-[env(safe-area-inset-bottom)]";

  return (
    <div className={`${rootClassName} ${className || ""} animate-page-enter`}>
      {/* One calm row: find a conversation or start one. The top bar already
          names the surface — no need to say "MeChat" twice. */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-3">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-3.5 py-2.5 text-sm transition focus-within:border-[var(--accent)]/50">
          <Search size={15} className="shrink-0 text-[var(--mesh-text-muted)]" />
          <input
            value={threadQuery}
            onChange={(event) => setThreadQuery(event.target.value)}
            className="mesh-search-input min-w-0 flex-1 bg-transparent text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
            placeholder="Search conversations"
            suppressHydrationWarning
          />
        </label>
        {/* Compose is the primary action of the whole surface and it had no
            material: `.mesh-pressable` lifts on hover, the fill was raw --accent
            under an emitting `0 4px 18px var(--accent-glow)`, and the press was
            `active:scale-95`. Moulded from jade — --domain-messages, tokens.css:102
            — with the pinned ink `.key-lit` carries. */}
        <button
          type="button"
          onClick={openCompose}
          className="mechat-key key key-lit [--mould:var(--mould-jade)] [--mould-ink:var(--mould-jade-ink)] [--mould-plinth:var(--mould-jade-plinth)] inline-flex h-11 w-11 shrink-0 items-center justify-center"
          aria-label="Compose new message"
          title="Compose new message"
        >
          <PenSquare size={17} />
        </button>
      </div>

      <div className="px-3 pb-2">
        <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((filter) => {
            const selected = activeFilter === filter.key;
            const count = filter.key === "all" ? filterCounts.all : filterCounts[filter.key];
            return (
              // SELECTED is a material change, not a tint. It was an --accent fill
              // plus an emitting `0 2px 12px var(--accent-glow)` — brightness
              // carrying "which one", which Law 2 forbids. Both states are keys;
              // the selected one is moulded from jade and the unselected one keeps
              // --face. Chip wall (2px), not the 3px object wall: a filter strip is
              // chrome and must stay quieter than the conversations under it.
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(filter.key)}
                className={`mechat-key mechat-key-chip key inline-flex min-h-8 items-center gap-1.5 px-3 py-1 text-xs font-semibold ${
                  selected
                    ? "key-lit [--mould:var(--mould-jade)] [--mould-ink:var(--mould-jade-ink)] [--mould-plinth:var(--mould-jade-plinth)]"
                    : "text-[var(--mesh-text-secondary)]"
                }`}
              >
                <span>{filter.label}</span>
                {count > 0 && (
                  <span className={`text-micro ${selected ? "" : "text-[var(--mesh-text-muted)]"}`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {status && (
        <div
          className={`mx-3 mt-3 rounded-xl px-3 py-2 text-xs ${
            status.type === "error"
              ? "bg-[var(--mesh-danger)]/10 text-[var(--mesh-danger)]"
              : "bg-[var(--mesh-green)]/10 text-[var(--mesh-green)]"
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <div className="px-1 py-4">
          <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => {
                setNoteText(myNote?.text ?? "");
                setNoteSong(myNote?.songTitle ?? "");
                setShowNoteComposer(true);
              }}
              className="mesh-pressable flex w-16 shrink-0 flex-col items-center gap-1.5 transition active:scale-95"
            >
              <div className="relative">
                <Avatar src={currentUser.avatarUrl} alt={currentUser.displayName} size="md" className="h-16 w-16 ring-2 ring-[var(--accent)]/20" />
                {myNote ? (
                  <span className="absolute -top-2 left-1/2 max-w-[90px] -translate-x-1/2 truncate rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-2 py-0.5 text-micro text-[var(--mesh-text)] shadow-sm">
                    {myNote.songTitle ? <Music size={8} className="mr-0.5 inline" /> : null}
                    {myNote.text || myNote.songTitle}
                  </span>
                ) : (
                  <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--mesh-bg)] bg-[var(--accent)] text-[var(--accent-contrast)] shadow-lg">
                    <Plus size={11} />
                  </span>
                )}
              </div>
              <span className="w-full truncate text-center text-micro text-[var(--mesh-text-secondary)]">
                {myNote ? "Your note" : "Add note"}
              </span>
            </button>

            {friendNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => setActiveNote(note)}
                className="mesh-pressable flex w-16 shrink-0 flex-col items-center gap-1.5 transition active:scale-95"
              >
                <div className="relative">
                  <span className="absolute -top-2 left-1/2 z-10 max-w-[90px] -translate-x-1/2 truncate rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-2 py-0.5 text-micro text-[var(--mesh-text)] shadow-sm">
                    {note.songTitle ? <Music size={8} className="mr-0.5 inline" /> : null}
                    {note.text || note.songTitle}
                  </span>
                  <span className="mesh-aurora-ring block rounded-full bg-gradient-to-tr from-[var(--accent)] to-[var(--accent-hover)] p-[2px] shadow-[0_0_24px_var(--accent-glow)]">
                    <Avatar src={note.user.avatarUrl} alt={note.user.displayName} size="md" className="h-16 w-16 border-2 border-[var(--mesh-bg)]" />
                  </span>
                </div>
                <span className="w-full truncate text-center text-micro text-[var(--mesh-text-secondary)]">
                  {note.user.displayName?.split(" ")[0] || note.user.username}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="px-1 pb-2">
          {filteredThreads.length > 0 ? (
            <div className="grid gap-0.5">
              {filteredThreads.map((thread) => {
                const active = pathname === `/messages/${thread.id}` || pathname.startsWith(`/messages/${thread.id}/`);
                const isGroup = thread.threadType === "group" || thread.threadType === "community";
                const isVerified = !isGroup && thread.otherUser?.isVerified;
                const unread = thread.unread > 0;
                const mineLast = thread.lastMessage?.senderId === currentUser.id;

                return (
                  <Link
                    key={thread.id}
                    href={`/messages/${thread.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex min-h-[4.25rem] min-w-0 items-center gap-3 rounded-2xl px-3 py-2 text-left transition active:scale-[0.99] ${
                      active
                        ? "bg-[var(--accent)]/12"
                        : "hover:bg-[var(--mesh-panel-hover)]"
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-[var(--accent)]" aria-hidden="true" />
                    )}
                    <div className="relative shrink-0">
                      {isGroup ? (
                        <div className="flex h-[52px] w-[52px] items-center justify-center overflow-hidden rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] text-[var(--mesh-text-secondary)]">
                          {thread.otherUsers.length > 0 ? (
                            <div className="relative h-9 w-9">
                              {thread.otherUsers.slice(0, 3).map((member, index) => (
                                <Avatar
                                  key={member.id}
                                  src={member.avatarUrl}
                                  alt={member.displayName}
                                  size="xs"
                                  className={`absolute h-5 w-5 border-2 border-[var(--mesh-bg)] ${index === 0 ? "left-0 top-2" : index === 1 ? "right-0 top-0" : "bottom-0 left-1/2 -translate-x-1/2"}`}
                                />
                              ))}
                            </div>
                          ) : (
                            <Users size={18} />
                          )}
                        </div>
                      ) : (
                        <Avatar
                          src={thread.otherUser?.avatarUrl ?? null}
                          alt={thread.otherUser?.displayName ?? thread.title}
                          size="md"
                          className="h-[52px] w-[52px]"
                        />
                      )}
                      {!isGroup && thread.otherUser && onlineContacts.has(thread.otherUser.id) && (
                        <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5" aria-label="Active now">
                          <span className="mesh-presence-ping block h-full w-full rounded-full border-2 border-[var(--mesh-bg)] bg-[var(--mesh-green)] text-[var(--mesh-green)]" />
                        </span>
                      )}
                      {unread && thread.unread > 1 && (
                        <span className="absolute -right-1 -top-0.5 rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-micro font-semibold text-[var(--accent-contrast)] shadow-lg">
                          {thread.unread > 99 ? "99+" : thread.unread}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`truncate text-sm ${unread ? "font-semibold text-[var(--mesh-text)]" : "font-semibold text-[var(--mesh-text)]"}`}>
                          {threadDisplay(thread)}
                        </span>
                        {isVerified && <BadgeCheck size={14} className="shrink-0 self-center text-[var(--accent)]" />}
                        {isSyncedThread(thread) && (
                          <span className={`shrink-0 self-center rounded px-1 py-0.5 text-micro font-semibold ${platformBadgeClass(thread.platform)}`}>
                            {platformLabel(thread.platform)}
                          </span>
                        )}
                        {thread.lastMessage && (
                          <span className="ml-auto shrink-0 text-micro text-[var(--mesh-text-muted)]">
                            {formatRelativeTime(thread.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <p className={`truncate text-xs ${unread ? "font-semibold text-[var(--mesh-text)]" : "text-[var(--mesh-text-secondary)]"}`}>
                          {thread.lastMessage ? `${mineLast ? "You: " : ""}${thread.lastMessage.content}` : "No messages yet"}
                        </p>
                        {unread && (
                          <span className="ml-auto h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--accent)]" aria-label="Unread" />
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="mx-3 rounded-2xl border border-dashed border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-4 py-8 text-center">
              <MessageCircle className="mx-auto mb-2 h-6 w-6 text-[var(--mesh-text-muted)]" />
              <p className="text-xs text-[var(--mesh-text-secondary)]">
                {threadQuery ? "No matching conversations." : "No messages yet. Tap Compose to start one."}
              </p>
            </div>
          )}
        </div>
      </div>

      {showCompose && (
        <Modal
          open={showCompose}
          onClose={() => setShowCompose(false)}
          title={shareQuery ? "Send to" : "New message"}
          className="max-w-md"
        >

            {status?.type === "error" && (
              <div className="rounded-lg bg-[var(--mesh-danger)]/10 px-3 py-2 text-xs text-[var(--mesh-danger)]">
                {status.message}
              </div>
            )}

            <div className="-mx-5 flex items-center gap-2 border-b border-[var(--mesh-border)] px-5 py-2">
              <span className="text-sm font-medium text-[var(--mesh-text-secondary)]">To:</span>
              <input
                value={recipientQuery}
                onChange={(event) => setRecipientQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    searchPeople();
                  }
                }}
                autoFocus
                className="mesh-search-input min-w-0 flex-1 bg-transparent text-sm text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
                placeholder="Search people"
                suppressHydrationWarning
              />
              {/* Was a bare `rounded-lg p-1.5` with an inline colour: no face, no
                  --edge ring, no wall and a ~26px target. Same chip mould the
                  filter strip wears. */}
              <button
                type="button"
                onClick={searchPeople}
                disabled={isPending}
                aria-label="Search people"
                className="mechat-key mechat-key-chip key inline-flex h-9 w-9 shrink-0 items-center justify-center text-[var(--mesh-text)] disabled:opacity-50"
              >
                {isPending ? <PaperWait size="sm" /> : <Search size={16} />}
              </button>
            </div>

            {selectedMembers.length > 0 && (
              <div className="-mx-5 flex flex-wrap gap-1.5 border-b border-[var(--mesh-border)] px-5 py-2">
                {selectedMembers.map((member) => (
                  <span
                    key={member.id}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--accent)]/10 px-2 py-0.5 text-xs font-medium text-[var(--accent)]"
                  >
                    {member.displayName}
                    <button type="button" onClick={() => toggleMember(member)}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="min-h-[120px] flex-1 overflow-y-auto p-2">
              {recipients.length > 0 ? (
                recipients.map((recipient) => {
                  const selected = selectedMembers.some((member) => member.id === recipient.id);
                  return (
                    <button
                      key={recipient.id}
                      type="button"
                      onClick={() => toggleMember(recipient)}
                      className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition-colors hover:bg-[var(--mesh-panel)]"
                    >
                      <Avatar src={recipient.avatarUrl} alt={recipient.displayName} size="sm" className="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--mesh-text)]">{recipient.displayName}</p>
                        <p className="truncate text-xs text-[var(--mesh-text-secondary)]">@{recipient.username}</p>
                      </div>
                      {selected && <Check size={16} className="text-[var(--accent)]" />}
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-6 text-center text-xs text-[var(--mesh-text-secondary)]">Search for people to start a conversation.</p>
              )}
            </div>

            {selectedMembers.length > 1 && (
              <div className="-mx-5 border-t border-[var(--mesh-border)] px-5 py-2">
                <input
                  value={groupTitle}
                  onChange={(event) => setGroupTitle(event.target.value)}
                  className="h-9 w-full rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-3 text-sm text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
                  placeholder="Group name (optional)"
                />
              </div>
            )}

            <div className="-mx-5 border-t border-[var(--mesh-border)] px-5 pt-3">
              {/* The modal's commit action: an --accent fill with unpinned white
                  ink, no --edge ring, no wall, and "hover:opacity-90" as its only
                  answer to a pointer. Jade key, pinned ink. */}
              <button
                type="button"
                onClick={startConversation}
                disabled={isPending || selectedMembers.length === 0}
                className="mechat-key key key-lit [--mould:var(--mould-jade)] [--mould-ink:var(--mould-jade-ink)] [--mould-plinth:var(--mould-jade-plinth)] flex min-h-11 w-full items-center justify-center py-2.5 text-sm font-semibold disabled:opacity-40"
              >
                {isPending ? "Starting..." : "Chat"}
              </button>
            </div>
        </Modal>
      )}

      {showNoteComposer && (
        <Modal
          open={showNoteComposer}
          onClose={() => setShowNoteComposer(false)}
          title="Share a note"
          description="Disappears after 24 hours"
          className="max-w-sm"
        >
          <div className="mb-3 flex items-center gap-3">
            <Avatar src={currentUser.avatarUrl} alt={currentUser.displayName} size="md" className="h-12 w-12" />
            <p className="text-sm font-semibold text-[var(--mesh-text)]">{currentUser.displayName}</p>
          </div>
          <input
            value={noteText}
            onChange={(event) => setNoteText(event.target.value)}
            maxLength={60}
            autoFocus
            placeholder="Share a thought..."
            className="h-10 w-full rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-3 text-sm text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
          />
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-3">
            <Music size={14} className="shrink-0 text-[var(--mesh-text-muted)]" />
            <input
              value={noteSong}
              onChange={(event) => setNoteSong(event.target.value)}
              maxLength={120}
              placeholder="Add a song (optional)"
              className="h-10 w-full bg-transparent text-sm text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
            />
          </div>
          {/* Two bare rectangles: one with no face at all, one an --accent fill on
              unpinned white with no ring and no wall. Secondary is --face, primary
              is jade — rank comes from material, not from saturation. */}
          <div className="mt-4 flex items-center gap-2">
            {myNote && (
              <button
                type="button"
                onClick={clearNote}
                disabled={isPending}
                className="mechat-key key inline-flex min-h-11 items-center px-3 py-2 text-xs font-semibold text-[var(--mesh-text-secondary)] hover:text-[var(--mesh-danger)] disabled:opacity-50"
              >
                Clear note
              </button>
            )}
            <button
              type="button"
              onClick={saveNote}
              disabled={isPending}
              className="mechat-key key key-lit [--mould:var(--mould-jade)] [--mould-ink:var(--mould-jade-ink)] [--mould-plinth:var(--mould-jade-plinth)] ml-auto inline-flex min-h-11 items-center px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {isPending ? "Sharing..." : "Share"}
            </button>
          </div>
        </Modal>
      )}

      {activeNote && (
        <Modal
          open={Boolean(activeNote)}
          onClose={() => setActiveNote(null)}
          title={activeNote.user.displayName}
          description={`@${activeNote.user.username}`}
          className="max-w-sm"
        >
          <div className="mb-3 flex items-center gap-3">
            <Avatar src={activeNote.user.avatarUrl} alt={activeNote.user.displayName} size="md" className="h-12 w-12" />
            <p className="text-sm font-semibold text-[var(--mesh-text)]">{activeNote.user.displayName}</p>
          </div>
          <p className="text-sm leading-6 text-[var(--mesh-text-secondary)]">{activeNote.text || "No note text"}</p>
          {activeNote.songTitle && (
            <p className="mt-3 text-xs font-medium text-[var(--accent)]">{activeNote.songTitle}</p>
          )}
        </Modal>
      )}
    </div>
  );
}
