"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  Check,
  Loader2,
  MessageCircle,
  Music,
  PenSquare,
  Plus,
  Search,
  Users,
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

type MeChatHomeProps = {
  currentUser: Person;
  initialThreads: MeChatThread[];
  initialNotes: MeChatNoteEntry[];
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

export function MeChatHome({ currentUser, initialThreads, initialNotes }: MeChatHomeProps) {
  const router = useRouter();
  const [threads, setThreads] = useState(initialThreads);
  const [threadQuery, setThreadQuery] = useState("");
  const [recipientQuery, setRecipientQuery] = useState("");
  const [recipients, setRecipients] = useState<UserSearchResult[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<UserSearchResult[]>([]);
  const [groupTitle, setGroupTitle] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [notes, setNotes] = useState<MeChatNoteEntry[]>(initialNotes);
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSong, setNoteSong] = useState("");
  const [activeNote, setActiveNote] = useState<MeChatNoteEntry | null>(null);
  const [isPending, startTransition] = useTransition();

  const myNote = useMemo(() => notes.find((note) => note.userId === currentUser.id) ?? null, [notes, currentUser.id]);
  const friendNotes = useMemo(() => notes.filter((note) => note.userId !== currentUser.id), [notes, currentUser.id]);

  const filteredThreads = useMemo(() => {
    const q = threadQuery.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) =>
      [threadDisplay(thread), thread.otherUser?.username, thread.lastMessage?.content].some((value) =>
        value?.toLowerCase().includes(q),
      ),
    );
  }, [threadQuery, threads]);

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
        setNotes((current) => [data.note, ...current.filter((n) => n.userId !== currentUser.id)]);
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
        setNotes((current) => current.filter((n) => n.userId !== currentUser.id));
        setShowNoteComposer(false);
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not clear note" });
      }
    });
  }

  function openCompose() {
    setRecipientQuery("");
    setRecipients([]);
    setSelectedMembers([]);
    setGroupTitle("");
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
            title: isGroup ? groupTitle.trim() || selectedMembers.map((m) => m.displayName).join(", ") : undefined,
            memberIds: selectedMembers.map((member) => member.id),
          }),
        });
        const data = await res.json().catch(() => ({ error: "Could not start chat" }));
        if (!res.ok) throw new Error(data.error || "Could not start chat");
        const threadsRes = await fetch("/api/messages");
        const threadsData = await threadsRes.json().catch(() => ({}));
        if (threadsRes.ok && Array.isArray(threadsData.threads)) {
          setThreads(threadsData.threads);
        }
        setShowCompose(false);
        router.push(`/messages/${data.thread.id}`);
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Could not start chat" });
      }
    });
  }

  return (
    <div className="mechat-layout mx-auto flex h-[calc(100dvh-3.5rem)] w-full max-w-xl flex-col overflow-hidden bg-[var(--mesh-bg)] animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="text-xl font-bold text-[var(--mesh-text)]">{currentUser.displayName}</h1>
        <button
          type="button"
          onClick={openCompose}
          className="rounded-lg p-2 text-[var(--mesh-text)] transition-colors hover:bg-[var(--mesh-panel)]"
          title="New message"
          aria-label="New message"
        >
          <PenSquare size={20} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pb-2">
        <label className="flex items-center gap-2 rounded-xl bg-[var(--mesh-bg-elevated)] px-3 py-2 text-sm">
          <Search size={15} className="shrink-0 text-[var(--mesh-text-muted)]" />
          <input
            value={threadQuery}
            onChange={(event) => setThreadQuery(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
            placeholder="Search"
          />
        </label>
      </div>

      {status && (
        <div
          className={`mx-3 mb-2 rounded-lg px-3 py-2 text-xs ${
            status.type === "error" ? "bg-[var(--mesh-danger)]/10 text-[var(--mesh-danger)]" : "bg-[var(--mesh-green)]/10 text-[var(--mesh-green)]"
          }`}
        >
          {status.message}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {/* Notes & stories strip */}
        <div className="px-3 py-3">
          <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {/* Your note */}
            <button
              type="button"
              onClick={() => {
                setNoteText(myNote?.text ?? "");
                setNoteSong(myNote?.songTitle ?? "");
                setShowNoteComposer(true);
              }}
              className="flex w-16 shrink-0 flex-col items-center gap-1.5"
            >
              <div className="relative">
                <Avatar src={currentUser.avatarUrl} alt={currentUser.displayName} size="md" className="h-16 w-16" />
                {myNote ? (
                  <span className="absolute -top-2 left-1/2 max-w-[72px] -translate-x-1/2 truncate rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-2 py-0.5 text-[9px] text-[var(--mesh-text)] shadow-sm">
                    {myNote.songTitle ? <Music size={8} className="mr-0.5 inline" /> : null}
                    {myNote.text || myNote.songTitle}
                  </span>
                ) : (
                  <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--mesh-bg)] bg-[var(--mesh-blue)] text-white">
                    <Plus size={11} />
                  </span>
                )}
              </div>
              <span className="w-full truncate text-center text-[11px] text-[var(--mesh-text-muted)]">
                {myNote ? "Your note" : "Your note"}
              </span>
            </button>

            {/* Friends' notes */}
            {friendNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => setActiveNote(note)}
                className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              >
                <div className="relative">
                  <span className="absolute -top-2 left-1/2 z-10 max-w-[72px] -translate-x-1/2 truncate rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-2 py-0.5 text-[9px] text-[var(--mesh-text)] shadow-sm">
                    {note.songTitle ? <Music size={8} className="mr-0.5 inline" /> : null}
                    {note.text || note.songTitle}
                  </span>
                  <Avatar src={note.user.avatarUrl} alt={note.user.displayName} size="md" className="h-16 w-16" />
                </div>
                <span className="w-full truncate text-center text-[11px] text-[var(--mesh-text-muted)]">
                  {note.user.displayName?.split(" ")[0] || note.user.username}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Conversations */}
        <div className="px-1 pb-2">
          <p className="px-3 pb-1 pt-1 text-sm font-bold text-[var(--mesh-text)]">Messages</p>
          {filteredThreads.length > 0 ? (
            filteredThreads.map((thread) => (
              <Link
                key={thread.id}
                href={`/messages/${thread.id}`}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--mesh-panel)]"
              >
                {thread.threadType === "group" ? (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)]">
                    <Users size={20} className="text-[var(--mesh-text-muted)]" />
                  </div>
                ) : (
                  <Avatar src={thread.otherUser?.avatarUrl ?? null} alt={thread.otherUser?.displayName ?? ""} size="md" className="h-14 w-14 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="truncate text-sm font-semibold text-[var(--mesh-text)]">{threadDisplay(thread)}</span>
                    {thread.platform && thread.platform !== "mesh" && (
                      <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${platformBadgeClass(thread.platform)}`}>
                        {platformLabel(thread.platform)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <p className={`truncate text-xs ${thread.unread > 0 ? "font-semibold text-[var(--mesh-text)]" : "text-[var(--mesh-text-muted)]"}`}>
                      {thread.lastMessage?.content ?? "No messages yet"}
                    </p>
                    {thread.lastMessage && (
                      <span className="shrink-0 text-[11px] text-[var(--mesh-text-muted)]">· {formatRelativeTime(thread.lastMessage.createdAt)}</span>
                    )}
                  </div>
                </div>
                {thread.unread > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--mesh-blue)]" />}
              </Link>
            ))
          ) : (
            <div className="mx-3 rounded-xl border border-dashed border-[var(--mesh-border)] px-4 py-8 text-center">
              <MessageCircle className="mx-auto mb-2 h-6 w-6 text-[var(--mesh-text-muted)]" />
              <p className="text-xs text-[var(--mesh-text-muted)]">
                {threadQuery ? "No matching conversations." : "No messages yet. Tap the pencil to start one."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New message composer */}
      {showCompose && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setShowCompose(false)}>
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--mesh-border)] px-4 py-3">
              <h3 className="text-sm font-bold text-[var(--mesh-text)]">New message</h3>
              <button type="button" onClick={() => setShowCompose(false)} className="rounded-lg p-1 text-[var(--mesh-text-muted)] hover:bg-[var(--mesh-panel)]">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-[var(--mesh-border)] px-4 py-2">
              <span className="text-sm font-medium text-[var(--mesh-text-muted)]">To:</span>
              <input
                value={recipientQuery}
                onChange={(e) => setRecipientQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    searchPeople();
                  }
                }}
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
                placeholder="Search people"
              />
              <button type="button" onClick={searchPeople} disabled={isPending} className="shrink-0 rounded-lg p-1.5 text-[var(--mesh-blue)] hover:bg-[var(--mesh-panel)]">
                {isPending ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </div>

            {selectedMembers.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b border-[var(--mesh-border)] px-4 py-2">
                {selectedMembers.map((m) => (
                  <span key={m.id} className="inline-flex items-center gap-1 rounded-full bg-[var(--mesh-blue)]/10 px-2 py-0.5 text-xs font-medium text-[var(--mesh-blue)]">
                    {m.displayName}
                    <button type="button" onClick={() => toggleMember(m)}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="min-h-[120px] flex-1 overflow-y-auto p-2">
              {recipients.length > 0 ? (
                recipients.map((r) => {
                  const sel = selectedMembers.some((m) => m.id === r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleMember(r)}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--mesh-panel)]"
                    >
                      <Avatar src={r.avatarUrl} alt={r.displayName} size="sm" className="h-10 w-10" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[var(--mesh-text)]">{r.displayName}</p>
                        <p className="truncate text-xs text-[var(--mesh-text-muted)]">@{r.username}</p>
                      </div>
                      {sel && <Check size={16} className="text-[var(--mesh-blue)]" />}
                    </button>
                  );
                })
              ) : (
                <p className="px-3 py-6 text-center text-xs text-[var(--mesh-text-muted)]">Search for people to start a conversation.</p>
              )}
            </div>

            {selectedMembers.length > 1 && (
              <div className="border-t border-[var(--mesh-border)] px-4 py-2">
                <input
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  className="h-9 w-full rounded-lg border border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-3 text-sm text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
                  placeholder="Group name (optional)"
                />
              </div>
            )}

            <div className="border-t border-[var(--mesh-border)] p-3">
              <button
                type="button"
                onClick={startConversation}
                disabled={isPending || selectedMembers.length === 0}
                className="w-full rounded-xl bg-[var(--mesh-blue)] py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {isPending ? "Starting..." : "Chat"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Note composer */}
      {showNoteComposer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowNoteComposer(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-3">
              <Avatar src={currentUser.avatarUrl} alt={currentUser.displayName} size="md" className="h-12 w-12" />
              <div>
                <p className="text-sm font-bold text-[var(--mesh-text)]">Share a note</p>
                <p className="text-xs text-[var(--mesh-text-muted)]">Disappears after 24 hours</p>
              </div>
            </div>
            <input
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              maxLength={60}
              autoFocus
              placeholder="Share a thought..."
              className="h-10 w-full rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-3 text-sm text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
            />
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--mesh-border)] bg-[var(--mesh-bg)] px-3">
              <Music size={14} className="shrink-0 text-[var(--mesh-text-muted)]" />
              <input
                value={noteSong}
                onChange={(e) => setNoteSong(e.target.value)}
                maxLength={120}
                placeholder="Add a song (optional)"
                className="h-10 w-full bg-transparent text-sm text-[var(--mesh-text)] outline-none placeholder:text-[var(--mesh-text-muted)]"
              />
            </div>
            <div className="mt-4 flex items-center gap-2">
              {myNote && (
                <button type="button" onClick={clearNote} disabled={isPending} className="rounded-xl px-3 py-2 text-xs font-medium text-[var(--mesh-text-muted)] hover:text-red-400 disabled:opacity-50">
                  Clear note
                </button>
              )}
              <button type="button" onClick={saveNote} disabled={isPending} className="ml-auto rounded-xl bg-[var(--mesh-blue)] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                {isPending ? "Sharing..." : "Share"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Friend note viewer */}
      {activeNote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setActiveNote(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <Avatar src={activeNote.user.avatarUrl} alt={activeNote.user.displayName} size="md" className="h-12 w-12" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[var(--mesh-text)]">{activeNote.user.displayName}</p>
                <p className="truncate text-xs text-[var(--mesh-text-muted)]">@{activeNote.user.username}</p>
              </div>
            </div>
            {activeNote.text && <p className="mt-4 text-sm text-[var(--mesh-text)]">{activeNote.text}</p>}
            {activeNote.songTitle && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--mesh-panel)] px-3 py-2 text-xs text-[var(--mesh-text)]">
                <Music size={14} className="shrink-0 text-[var(--mesh-blue)]" />
                <span className="truncate">
                  {activeNote.songTitle}
                  {activeNote.songArtist ? ` — ${activeNote.songArtist}` : ""}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
