"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowUp,
  CheckCheck,
  Image as ImageIcon,
  Link2,
  Loader2,
  MessageCircleReply,
  Paperclip,
  Pencil,
  Search,
  Send,
  SmilePlus,
  Undo2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { MeshiMascot, type MeshiColor, type MeshiHat, type MeshiHair, type MeshiAccessory, type MeshiEyeStyle, type MeshiBadge, type MeshiOutfit } from "@/components/meshi/meshi-mascot";
import {
  buildLinkPreview,
  normalizeAttachments,
  type MeChatAttachment,
  type MeChatAttachmentType,
  type MeChatMessageMetadata,
} from "@/lib/mechat-metadata";
import { formatRelativeTime } from "@/lib/utils";

type Person = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type MeChatSerializedMessage = {
  id: string;
  content: string;
  senderId: string;
  threadId: string;
  sourcePlatform: string;
  messageType: string;
  sourceUrl: string | null;
  sourcePostId: string | null;
  platformPostId: string | null;
  platformCommentId: string | null;
  createdAt: string;
  sender: Person;
  metadata: MeChatMessageMetadata;
  replyTo: {
    id: string;
    content: string;
    senderName: string;
  } | null;
  readBy: Array<{
    userId: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
  }>;
};

type TypingMeshi = {
  color: string;
  hat: string;
  hair: string;
  accessory: string;
  eyeStyle: string;
  badge: string;
  outfit: string;
};

type TypingUser = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  meshi: TypingMeshi | null;
};

type SharedMessageSource = {
  content: string;
  messageType?: string;
  sourcePlatform?: string;
  sourceUrl?: string;
  sourcePostId?: string;
  platformPostId?: string;
  platformCommentId?: string;
  metadata?: string;
};

type MeChatThreadProps = {
  currentUser: Person;
  initialThreadId: string | null;
  recipientId?: string;
  initialMessages: MeChatSerializedMessage[];
  initialSource?: SharedMessageSource;
  isExternalThread?: boolean;
  threadPlatform?: string;
};

const QUICK_REACTIONS = ["\u2764\uFE0F", "\uD83D\uDE02", "\uD83D\uDD25", "\uD83D\uDC4D"];

function platformDisplayName(platform: string) {
  const p = platform.toLowerCase();
  if (p === "twitter" || p === "x") return "X";
  if (p === "mesh" || p === "meshme") return "Mesh.me";
  return platform.charAt(0).toUpperCase() + platform.slice(1);
}

function safeFetchJson<T>(response: Response): Promise<T> {
  return response.json().catch(() => ({} as T));
}

function localReactionGroups(message: MeChatSerializedMessage, currentUserId: string) {
  const grouped = new Map<string, { count: number; mine: boolean }>();
  for (const reaction of message.metadata.reactions || []) {
    const current = grouped.get(reaction.emoji) || { count: 0, mine: false };
    grouped.set(reaction.emoji, {
      count: current.count + 1,
      mine: current.mine || reaction.userId === currentUserId,
    });
  }
  return [...grouped.entries()].map(([emoji, value]) => ({ emoji, ...value }));
}

function readState(message: MeChatSerializedMessage, currentUserId: string) {
  if (message.senderId !== currentUserId) return "";
  const readers = message.readBy.filter((reader) => reader.userId !== currentUserId);
  if (readers.length === 0) return "Delivered";
  return "Read";
}

function messageMatchesSearch(message: MeChatSerializedMessage, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    message.content,
    message.sender.displayName,
    message.sender.username,
    message.sourcePlatform,
    message.metadata.linkPreview?.title,
    message.metadata.linkPreview?.host,
  ].some((value) => value?.toLowerCase().includes(q));
}

// Messages from the same sender within this window read as one breath of
// conversation: avatars collapse, corners tighten, timestamps deduplicate.
const GROUP_WINDOW_MS = 5 * 60 * 1000;

function senderKey(message: MeChatSerializedMessage) {
  return message.metadata.externalSender?.name || message.senderId;
}

function sameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function attachmentLabel(type: MeChatAttachmentType) {
  if (type === "image") return "Image";
  if (type === "video") return "Video";
  if (type === "audio") return "Audio";
  if (type === "file") return "File";
  return "Link";
}

function createOptimisticMessage({
  content,
  currentUser,
  threadId,
  attachments,
  replyTo,
  source,
}: {
  content: string;
  currentUser: Person;
  threadId: string;
  attachments: MeChatAttachment[];
  replyTo: MeChatSerializedMessage | null;
  source?: SharedMessageSource;
}): MeChatSerializedMessage {
  const sourcePlatform = source?.sourcePlatform || "mesh";
  return {
    id: `optimistic-${Date.now()}`,
    content: content || (attachments.length > 0 ? "Shared media" : "Sending..."),
    senderId: currentUser.id,
    threadId,
    sourcePlatform,
    messageType: source?.messageType || (attachments.length > 0 ? "media" : "text"),
    sourceUrl: source?.sourceUrl || null,
    sourcePostId: source?.sourcePostId || null,
    platformPostId: source?.platformPostId || null,
    platformCommentId: source?.platformCommentId || null,
    createdAt: new Date().toISOString(),
    sender: currentUser,
    metadata: {
      attachments,
      replyToMessageId: replyTo?.id,
      linkPreview: buildLinkPreview(content, source?.sourceUrl, sourcePlatform),
      reactions: [],
    },
    replyTo: replyTo ? {
      id: replyTo.id,
      content: replyTo.content,
      senderName: replyTo.sender.displayName,
    } : null,
    readBy: [{
      userId: currentUser.id,
      displayName: currentUser.displayName,
      username: currentUser.username,
      avatarUrl: currentUser.avatarUrl,
    }],
  };
}

export function MeChatThread({
  currentUser,
  initialThreadId,
  recipientId,
  initialMessages,
  initialSource,
  isExternalThread = false,
  threadPlatform = "mesh",
}: MeChatThreadProps) {
  const router = useRouter();
  const [activeThreadId, setActiveThreadId] = useState(initialThreadId);
  const [messages, setMessages] = useState(initialMessages);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [draft, setDraft] = useState(initialSource?.content || "");
  const [pendingSource, setPendingSource] = useState(initialSource);
  const [replyTo, setReplyTo] = useState<MeChatSerializedMessage | null>(null);
  const [showMediaTools, setShowMediaTools] = useState(false);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentType, setAttachmentType] = useState<MeChatAttachmentType>("image");
  const [attachments, setAttachments] = useState<MeChatAttachment[]>([]);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  // Which bubble's action bar is pinned open (tap on touch, since there's no hover).
  const [actionsFor, setActionsFor] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<number | null>(null);

  const visibleMessages = useMemo(
    () => messages.filter((message) => messageMatchesSearch(message, searchQuery)),
    [messages, searchQuery],
  );

  // Read receipts belong on the latest thing you said, not under every bubble.
  const lastOwnMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].senderId === currentUser.id && !messages[i].metadata.externalSender) return messages[i].id;
    }
    return null;
  }, [messages, currentUser.id]);

  const searchCount = searchQuery.trim() ? visibleMessages.length : 0;

  const loadThread = useCallback(async (threadId: string) => {
    const response = await fetch(`/api/messages/${threadId}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const data = await safeFetchJson<{
      messages?: MeChatSerializedMessage[];
      typingUsers?: TypingUser[];
      error?: string;
    }>(response);
    if (!response.ok) throw new Error(data.error || "Could not load messages");
    // Polling identical data every few seconds shouldn't re-render the
    // thread — only apply state when something actually changed.
    const nextMessages = data.messages || [];
    setMessages((prev) =>
      JSON.stringify(prev) === JSON.stringify(nextMessages) ? prev : nextMessages,
    );
    const nextTyping = data.typingUsers || [];
    setTypingUsers((prev) =>
      prev.length === nextTyping.length && JSON.stringify(prev) === JSON.stringify(nextTyping)
        ? prev
        : nextTyping,
    );
  }, []);

  useEffect(() => {
    if (!activeThreadId) return;
    void loadThread(activeThreadId).catch(() => {});
    const interval = window.setInterval(() => {
      // Don't poll a tab nobody is looking at.
      if (document.visibilityState !== "visible") return;
      void loadThread(activeThreadId).catch(() => {});
    }, 5000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void loadThread(activeThreadId).catch(() => {});
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [activeThreadId, loadThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, typingUsers.length]);

  useEffect(() => {
    if (!activeThreadId) return;
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    if (!draft.trim()) {
      void fetch(`/api/messages/${activeThreadId}/typing`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typing: false }),
      }).catch(() => {});
      return;
    }

    typingTimerRef.current = window.setTimeout(() => {
      void fetch(`/api/messages/${activeThreadId}/typing`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typing: true }),
      }).catch(() => {});
    }, 250);

    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    };
  }, [activeThreadId, draft]);

  async function ensureThread() {
    if (activeThreadId) return activeThreadId;
    if (!recipientId) throw new Error("Choose a person before sending.");

    const response = await fetch("/api/messages", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberIds: [recipientId] }),
    });
    const data = await safeFetchJson<{ thread?: { id: string }; error?: string }>(response);
    if (!response.ok || !data.thread?.id) throw new Error(data.error || "Could not create conversation");
    setActiveThreadId(data.thread.id);
    return data.thread.id;
  }

  function addAttachment() {
    const normalized = normalizeAttachments([{
      id: `attachment-${Date.now()}`,
      type: attachmentType,
      url: attachmentUrl,
      name: attachmentName,
    }]);
    if (normalized.length === 0) {
      setError("Use a valid http or https media URL.");
      return;
    }
    setError("");
    setAttachments((current) => [...current, ...normalized].slice(0, 6));
    setAttachmentUrl("");
    setAttachmentName("");
  }

  function sendCurrentMessage() {
    if (isPending) return;
    if (!draft.trim() && attachments.length === 0 && !pendingSource?.sourceUrl) return;
    startTransition(async () => {
      setError("");
      let optimisticId = "";
      try {
        const threadId = await ensureThread();
        const optimistic = createOptimisticMessage({
          content: draft.trim(),
          currentUser,
          threadId,
          attachments,
          replyTo,
          source: pendingSource,
        });
        optimisticId = optimistic.id;
        setMessages((current) => [...current, optimistic]);

        const response = await fetch(`/api/messages/${threadId}`, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: draft.trim(),
            attachments,
            replyToMessageId: replyTo?.id,
            messageType: pendingSource?.messageType,
            sourcePlatform: pendingSource?.sourcePlatform,
            sourceUrl: pendingSource?.sourceUrl,
            sourcePostId: pendingSource?.sourcePostId,
            platformPostId: pendingSource?.platformPostId,
            platformCommentId: pendingSource?.platformCommentId,
          }),
        });
        const data = await safeFetchJson<{ message?: MeChatSerializedMessage; error?: string }>(response);
        if (!response.ok || !data.message) throw new Error(data.error || "Message failed");
        setDraft("");
        setReplyTo(null);
        setPendingSource(undefined);
        setAttachments([]);
        setShowMediaTools(false);
        setMessages((current) => current.map((message) => (message.id === optimistic.id ? data.message! : message)));
        await loadThread(threadId);
        if (!initialThreadId) router.replace(`/messages/${threadId}`);
      } catch (sendError) {
        if (optimisticId) {
          setMessages((current) => current.filter((message) => message.id !== optimisticId));
        }
        setError(sendError instanceof Error ? sendError.message : "Message failed");
      }
    });
  }

  function toggleReaction(messageId: string, emoji: string) {
    if (!activeThreadId) return;
    startTransition(async () => {
      setError("");
      try {
        const response = await fetch(`/api/messages/${activeThreadId}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "react", messageId, emoji }),
        });
        const data = await safeFetchJson<{ message?: MeChatSerializedMessage; error?: string }>(response);
        if (!response.ok || !data.message) throw new Error(data.error || "Could not react");
        setMessages((current) => current.map((message) => (message.id === messageId ? data.message! : message)));
      } catch (reactionError) {
        setError(reactionError instanceof Error ? reactionError.message : "Could not react");
      }
    });
  }

  function beginEdit(message: MeChatSerializedMessage) {
    setEditingId(message.id);
    setEditDraft(message.content);
  }

  function saveEdit(messageId: string) {
    if (!activeThreadId) return;
    const nextContent = editDraft.trim();
    if (!nextContent) return;
    startTransition(async () => {
      setError("");
      try {
        const response = await fetch(`/api/messages/${activeThreadId}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "edit", messageId, content: nextContent }),
        });
        const data = await safeFetchJson<{ message?: MeChatSerializedMessage; error?: string }>(response);
        if (!response.ok || !data.message) throw new Error(data.error || "Could not edit message");
        setMessages((current) => current.map((message) => (message.id === messageId ? data.message! : message)));
        setEditingId(null);
        setEditDraft("");
      } catch (editError) {
        setError(editError instanceof Error ? editError.message : "Could not edit message");
      }
    });
  }

  function unsendMessage(messageId: string) {
    if (!activeThreadId) return;
    startTransition(async () => {
      setError("");
      try {
        const response = await fetch(`/api/messages/${activeThreadId}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "unsend", messageId }),
        });
        const data = await safeFetchJson<{ message?: MeChatSerializedMessage; error?: string }>(response);
        if (!response.ok || !data.message) throw new Error(data.error || "Could not unsend message");
        setMessages((current) => current.map((message) => (message.id === messageId ? data.message! : message)));
        if (editingId === messageId) setEditingId(null);
      } catch (unsendError) {
        setError(unsendError instanceof Error ? unsendError.message : "Could not unsend message");
      }
    });
  }

  return (
    <div data-testid="mechat-thread" className="grid h-full min-h-0 grid-rows-[auto_1fr_auto]">
      <div className="border-b border-[var(--border-primary)] px-3 py-2">
        <label className="flex items-center gap-2 rounded-full bg-[var(--bg-secondary)]/60 px-3.5 py-2 text-sm transition focus-within:bg-[var(--bg-secondary)]">
          <Search size={14} className="text-[var(--text-muted)]" aria-hidden="true" />
          <input
            data-testid="mechat-search-input"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="mesh-search-input min-w-0 flex-1 bg-transparent outline-none placeholder:text-[var(--text-muted)]"
            placeholder="Search this conversation"
            suppressHydrationWarning
          />
          {searchQuery && (
            <span className="text-xs font-bold text-[var(--text-muted)]">{searchCount}</span>
          )}
        </label>
      </div>

      <div className="min-h-0 overflow-y-auto px-3 py-4 md:px-4">
        {visibleMessages.length > 0 ? (
          <div className="grid">
            {visibleMessages.map((message, index) => {
              const prevMessage = visibleMessages[index - 1];
              const nextMessage = visibleMessages[index + 1];
              const externalSender = message.metadata.externalSender;
              const isMine = message.senderId === currentUser.id && !externalSender;
              const newDay = !prevMessage || !sameDay(prevMessage.createdAt, message.createdAt);
              const groupedWithPrev = Boolean(
                !newDay &&
                  prevMessage &&
                  senderKey(prevMessage) === senderKey(message) &&
                  +new Date(message.createdAt) - +new Date(prevMessage.createdAt) < GROUP_WINDOW_MS,
              );
              const groupedWithNext = Boolean(
                nextMessage &&
                  sameDay(message.createdAt, nextMessage.createdAt) &&
                  senderKey(nextMessage) === senderKey(message) &&
                  +new Date(nextMessage.createdAt) - +new Date(message.createdAt) < GROUP_WINDOW_MS,
              );
              const readers = !isExternalThread && message.id === lastOwnMessageId ? readState(message, currentUser.id) : "";
              const groupedReactions = localReactionGroups(message, currentUser.id);
              const delivery = message.metadata.delivery;
              const showMeta = !groupedWithNext;
              const pinnedActions = actionsFor === message.id;
              const corners = isMine
                ? `rounded-[1.3rem] ${groupedWithPrev ? "rounded-tr-[0.5rem]" : ""} ${groupedWithNext ? "rounded-br-[0.5rem]" : ""}`
                : `rounded-[1.3rem] ${groupedWithPrev ? "rounded-tl-[0.5rem]" : ""} ${groupedWithNext ? "rounded-bl-[0.5rem]" : ""}`;

              return (
                <div key={message.id}>
                {newDay && (
                  <div className={`flex items-center justify-center ${index === 0 ? "mb-4" : "my-4"}`}>
                    <span className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)]/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                      {dayLabel(message.createdAt)}
                    </span>
                  </div>
                )}
                <article
                  data-testid="mechat-message-bubble"
                  className={`group flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"} ${groupedReactions.length > 0 ? "mt-4" : groupedWithPrev ? "mt-0.5" : newDay ? "" : "mt-3"}`}
                >
                  {!isMine &&
                    (groupedWithNext ? (
                      <span className="w-8 shrink-0" aria-hidden="true" />
                    ) : (
                      <Avatar
                        src={externalSender?.avatarUrl || (externalSender ? null : message.sender.avatarUrl)}
                        alt={externalSender?.name || message.sender.displayName}
                        size="sm"
                        className="mb-4 shrink-0"
                      />
                    ))}
                  <div className={`relative max-w-[86%] md:max-w-[72%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}>
                    {!isMine && !groupedWithPrev && (
                      <p className="px-2 text-[11px] font-semibold text-[var(--text-muted)]">
                        {externalSender?.name || message.sender.displayName}
                      </p>
                    )}
                    {/* Floating action bar: hover on desktop, tap-to-pin on touch */}
                    {!message.metadata.unsent && (
                      <div
                        onClick={(event) => event.stopPropagation()}
                        className={`absolute top-1/2 z-10 -translate-y-1/2 items-center gap-0.5 rounded-full border border-[var(--border-primary)] bg-[var(--bg-primary)]/95 px-1.5 py-1 shadow-lg backdrop-blur ${
                          isMine ? "right-full mr-2" : "left-full ml-2"
                        } ${pinnedActions ? "flex" : "hidden md:group-hover:flex"}`}
                      >
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              toggleReaction(message.id, emoji);
                              setActionsFor(null);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-sm transition-transform hover:scale-125"
                            aria-label={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(message);
                            setActionsFor(null);
                            draftRef.current?.focus();
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-white/10 hover:text-[var(--text-primary)]"
                          aria-label="Reply"
                          title="Reply"
                        >
                          <MessageCircleReply size={14} aria-hidden="true" />
                        </button>
                        {isMine && !isExternalThread && message.messageType === "text" && (
                          <button
                            type="button"
                            onClick={() => {
                              beginEdit(message);
                              setActionsFor(null);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-white/10 hover:text-[var(--text-primary)]"
                            aria-label="Edit"
                            title="Edit"
                          >
                            <Pencil size={13} aria-hidden="true" />
                          </button>
                        )}
                        {isMine && !isExternalThread && (
                          <button
                            type="button"
                            onClick={() => {
                              unsendMessage(message.id);
                              setActionsFor(null);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-secondary)] transition hover:bg-white/10 hover:text-red-300"
                            aria-label="Unsend"
                            title="Unsend"
                          >
                            <Undo2 size={13} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    )}
                    <div
                      onClick={() => setActionsFor((current) => (current === message.id ? null : message.id))}
                      className={`relative px-4 py-2.5 text-sm ${corners} ${
                      isMine
                        ? "mechat-bubble-mine text-white"
                        : "mechat-bubble-theirs"
                    } ${!groupedWithNext ? `mechat-tail ${isMine ? "mechat-tail-mine" : "mechat-tail-theirs"}` : ""} ${
                      message.id.startsWith("optimistic-") ? "mechat-send-in" : ""
                    }`}>
                      {groupedReactions.length > 0 && (
                        <span className={`mechat-tapbacks ${isMine ? "mechat-tapbacks-mine" : "mechat-tapbacks-theirs"}`}>
                          {groupedReactions.map((reaction) => (
                            <button
                              key={reaction.emoji}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleReaction(message.id, reaction.emoji);
                              }}
                              className={`mechat-tapback ${reaction.mine ? "is-mine" : ""}`}
                              aria-pressed={reaction.mine}
                            >
                              {reaction.emoji}
                              {reaction.count > 1 ? <span className="text-[10px] font-bold">{reaction.count}</span> : null}
                            </button>
                          ))}
                        </span>
                      )}
                      {!isExternalThread && (message.sourcePlatform !== "mesh" || message.messageType !== "text") ? (
                        <p className={`mb-2 text-[10px] font-bold uppercase tracking-[0.12em] ${isMine ? "text-white/75" : "text-[var(--text-muted)]"}`}>
                          {message.messageType.replace("_", " ")} from {message.sourcePlatform}
                        </p>
                      ) : null}

                      {message.replyTo && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery(message.replyTo?.content || "")}
                          className={`mb-2 w-full rounded-xl border-l-4 px-3 py-2 text-left text-xs ${isMine ? "border-white/60 bg-white/10 text-white/80" : "border-[var(--accent)] bg-[var(--bg-secondary)] text-[var(--text-secondary)]"}`}
                        >
                          <span className="block font-bold">{message.replyTo.senderName}</span>
                          <span className="line-clamp-2">{message.replyTo.content}</span>
                        </button>
                      )}

                      {message.metadata.unsent ? (
                        <p className={`whitespace-pre-wrap italic leading-6 ${isMine ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                          {isMine ? "You unsent a message" : "This message was unsent"}
                        </p>
                      ) : editingId === message.id ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={editDraft}
                            onChange={(event) => setEditDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                saveEdit(message.id);
                              }
                              if (event.key === "Escape") {
                                setEditingId(null);
                                setEditDraft("");
                              }
                            }}
                            rows={2}
                            autoFocus
                            className={`w-full resize-none rounded-xl px-3 py-2 text-sm outline-none ${isMine ? "bg-white/15 text-white placeholder:text-white/60" : "border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"}`}
                          />
                          <div className="flex gap-2">
                            <button type="button" onClick={() => saveEdit(message.id)} disabled={isPending} className={`rounded-full px-3 py-1 text-[11px] font-bold ${isMine ? "bg-white/20 text-white" : "bg-[var(--accent)] text-white"}`}>Save</button>
                            <button type="button" onClick={() => { setEditingId(null); setEditDraft(""); }} className={`rounded-full px-3 py-1 text-[11px] font-bold ${isMine ? "text-white/80" : "text-[var(--text-secondary)]"}`}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                      )}

                      {!message.metadata.unsent && message.metadata.attachments && message.metadata.attachments.length > 0 && (
                        <div className="mt-3 grid gap-2">
                          {message.metadata.attachments.map((attachment) => (
                            <AttachmentPreview key={attachment.id} attachment={attachment} isMine={isMine} />
                          ))}
                        </div>
                      )}

                      {message.metadata.linkPreview && (
                        <a
                          href={message.metadata.linkPreview.url}
                          target="_blank"
                          rel="noreferrer"
                          className={`mt-3 block rounded-xl border p-3 transition hover:translate-y-[-1px] ${isMine ? "border-white/20 bg-white/10 text-white" : "border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"}`}
                        >
                          <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${isMine ? "text-white/70" : "text-[var(--text-muted)]"}`}>
                            {message.metadata.linkPreview.host}
                          </span>
                          <span className="mt-1 block text-sm font-bold">{message.metadata.linkPreview.title}</span>
                          {message.metadata.linkPreview.description && (
                            <span className={`mt-1 block text-xs ${isMine ? "text-white/70" : "text-[var(--text-secondary)]"}`}>
                              {message.metadata.linkPreview.description}
                            </span>
                          )}
                        </a>
                      )}

                      {message.sourceUrl && !message.metadata.linkPreview && (
                        <a
                          href={message.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`mt-2 inline-flex items-center gap-1 text-xs font-bold underline-offset-4 hover:underline ${isMine ? "text-white" : "text-[var(--accent)]"}`}
                        >
                          <Link2 size={13} aria-hidden="true" />
                          Open source
                        </a>
                      )}
                    </div>

                    {showMeta && (
                      <div className={`flex flex-wrap items-center gap-1.5 px-2 text-[10px] text-[var(--text-muted)] ${isMine ? "justify-end" : "justify-start"}`}>
                        <span>{timeLabel(message.createdAt)}</span>
                        {delivery && (
                          <span className={delivery.status === "delivered" ? "text-[var(--mesh-green,#34d399)]" : "text-red-300"}>
                            · {delivery.status === "delivered"
                              ? `Delivered to ${platformDisplayName(delivery.platform)}`
                              : `Saved here — not delivered to ${platformDisplayName(delivery.platform)}`}
                          </span>
                        )}
                        {message.metadata.edited && !message.metadata.unsent && <span>· Edited</span>}
                        {readers && (
                          <span className="inline-flex items-center gap-1">
                            · <CheckCheck size={12} aria-hidden="true" />
                            {readers}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </article>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <MeshiMascot size={88} mood="excited" prop="envelope" animate />
            <h2 className="mt-4 text-lg font-bold">{searchQuery ? "No matching messages" : "Say hello"}</h2>
            <p className="mt-1.5 max-w-xs text-sm leading-6 text-[var(--text-secondary)]">
              {searchQuery
                ? "Try another search term."
                : "This is the very beginning of your conversation. Meshi is holding the first message — send it."}
            </p>
          </div>
        )}

        {typingUsers.length > 0 && (
          <div className="mt-3 flex items-end gap-2">
            <div className="flex -space-x-1.5">
              {typingUsers.slice(0, 3).map((user) =>
                user.meshi ? (
                  <span key={user.userId} className="mechat-typing-meshi inline-flex h-8 w-8 items-center justify-center">
                    <MeshiMascot
                      size={30}
                      prop="keyboard"
                      mood="happy"
                      color={user.meshi.color as MeshiColor}
                      hat={user.meshi.hat as MeshiHat}
                      hair={user.meshi.hair as MeshiHair}
                      accessory={user.meshi.accessory as MeshiAccessory}
                      eyeStyle={user.meshi.eyeStyle as MeshiEyeStyle}
                      badge={user.meshi.badge as MeshiBadge}
                      outfit={user.meshi.outfit as MeshiOutfit}
                    />
                  </span>
                ) : (
                  <Avatar key={user.userId} src={user.avatarUrl} alt={user.displayName} size="xs" />
                ),
              )}
            </div>
            <div
              className="rounded-[1.3rem] rounded-bl-[0.5rem] border border-[var(--border-primary)] bg-[var(--bg-primary)]/80 px-4 py-3 shadow-sm"
              aria-label={`${typingUsers.map((user) => user.displayName).join(", ")} ${typingUsers.length === 1 ? "is" : "are"} typing`}
            >
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-muted)]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-muted)] [animation-delay:140ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--text-muted)] [animation-delay:280ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      <form
        data-testid="mechat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          sendCurrentMessage();
        }}
        className="border-t border-[var(--border-primary)] bg-[var(--bg-primary)]/70 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:pb-3"
      >
        {isExternalThread && (
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-[var(--text-muted)]">
            <Link2 size={12} aria-hidden="true" />
            Replies deliver to {platformDisplayName(threadPlatform)} through your connected account.
          </p>
        )}
        {error && (
          <p className="mb-2 rounded-lg border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {error}
          </p>
        )}

        {replyTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs">
            <span className="min-w-0">
              <span className="block font-bold">Replying to {replyTo.sender.displayName}</span>
              <span className="block truncate text-[var(--text-muted)]">{replyTo.content}</span>
            </span>
            <button type="button" onClick={() => setReplyTo(null)} className="mesh-choice rounded-full p-1" aria-label="Cancel reply">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {pendingSource?.sourcePlatform && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs">
            <span className="min-w-0 font-bold text-[var(--text-secondary)]">
              Sharing from {pendingSource.sourcePlatform}. Source credit stays attached.
            </span>
            <button type="button" onClick={() => setPendingSource(undefined)} className="mesh-choice rounded-full p-1" aria-label="Remove shared source">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <button
                key={attachment.id}
                type="button"
                onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-xs font-bold text-[var(--text-secondary)]"
              >
                <Paperclip size={12} aria-hidden="true" />
                {attachment.name || attachmentLabel(attachment.type)}
                <X size={12} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}

        {showMediaTools && (
          <div className="mb-2 grid gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-2 md:grid-cols-[8rem_1fr_10rem_auto]">
            <select
              value={attachmentType}
              onChange={(event) => setAttachmentType(event.target.value as MeChatAttachmentType)}
              className="simple-input h-10 px-2 text-sm"
              aria-label="Attachment type"
            >
              <option value="image">Image</option>
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="file">File</option>
              <option value="link">Link</option>
            </select>
            <input
              value={attachmentUrl}
              onChange={(event) => setAttachmentUrl(event.target.value)}
              className="simple-input h-10 px-3 text-sm"
              placeholder="https://..."
            />
            <input
              value={attachmentName}
              onChange={(event) => setAttachmentName(event.target.value)}
              className="simple-input h-10 px-3 text-sm"
              placeholder="Name"
            />
            <button type="button" onClick={addAttachment} className="mesh-action mesh-action-secondary px-3 text-sm">
              Add
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => setShowMediaTools((current) => !current)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${
              showMediaTools
                ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-[var(--accent)]"
                : "border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
            aria-pressed={showMediaTools}
            aria-label="Add media or link"
            title="Add media or link"
          >
            <ImageIcon size={17} aria-hidden="true" />
          </button>
          <div className="flex min-w-0 flex-1 items-end rounded-[1.4rem] border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2 transition focus-within:border-[var(--accent)]/60">
            <textarea
              ref={draftRef}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                // Grow with the draft, up to ~5 lines, then scroll inside.
                const el = event.currentTarget;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendCurrentMessage();
                }
              }}
              rows={1}
              className="min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-3 text-base leading-5 text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] md:text-sm"
              placeholder={
                isExternalThread
                  ? `Reply on ${platformDisplayName(threadPlatform)}`
                  : pendingSource
                    ? "Add a note or send the shared source"
                    : "Message\u2026"
              }
            />
            <button
              type="button"
              onClick={() => {
                setDraft((current) => `${current}${current ? " " : ""}\uD83D\uDC4D`);
                draftRef.current?.focus();
              }}
              className="mb-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--text-muted)] transition hover:text-[var(--text-primary)]"
              aria-label="Add thumbs up to message"
              title="Add thumbs up"
            >
              <SmilePlus size={17} aria-hidden="true" />
            </button>
          </div>
          <button
            type="submit"
            disabled={isPending || (!draft.trim() && attachments.length === 0 && !pendingSource?.sourceUrl)}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-all duration-150 ${
              draft.trim() || attachments.length > 0 || pendingSource?.sourceUrl
                ? "scale-100 bg-[var(--accent)] hover:brightness-110 active:scale-90"
                : "scale-95 bg-[var(--bg-secondary)] text-[var(--text-muted)]"
            } disabled:cursor-not-allowed`}
            aria-label="Send message"
            title="Send"
          >
            {isPending ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function AttachmentPreview({ attachment, isMine }: { attachment: MeChatAttachment; isMine: boolean }) {
  if (attachment.type === "image") {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-black/10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={attachment.url} alt={attachment.name || "Shared image"} className="max-h-72 w-full object-cover" />
      </a>
    );
  }

  if (attachment.type === "video") {
    return (
      <video src={attachment.url} controls className="max-h-72 w-full rounded-xl border border-black/10" />
    );
  }

  if (attachment.type === "audio") {
    return (
      <audio src={attachment.url} controls className="w-full" />
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${isMine ? "border-white/20 bg-white/10 text-white" : "border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"}`}
    >
      <Paperclip size={14} aria-hidden="true" />
      <span className="min-w-0 truncate">{attachment.name || attachment.url}</span>
    </a>
  );
}
