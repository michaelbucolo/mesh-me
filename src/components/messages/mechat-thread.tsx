"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, CheckCheck, Image as ImageIcon, Link2, MessageCircleReply, Paperclip, Pencil, Search, Send, SmilePlus, Undo2, X } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { Avatar } from "@/components/ui/avatar";
import { NativeAspectMedia } from "@/components/ui/native-aspect-media";
import { attachNormalizer } from "@/lib/audio-normalize";
import { playSound } from "@/lib/sound";
import { safeHref } from "@/lib/utils";
import { MeshiMascot, type MeshiColor, type MeshiHat, type MeshiHair, type MeshiAccessory, type MeshiEyeStyle, type MeshiBadge, type MeshiOutfit } from "@/components/meshi/meshi-mascot";
import {
  buildLinkPreview,
  normalizeAttachments,
  type MeChatAttachment,
  type MeChatAttachmentType,
  type MeChatMessageMetadata,
} from "@/lib/mechat-metadata";

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
  /** The viewer's lastRead before this visit bumped it — anchors the "New" divider. */
  initialLastReadAt?: string | null;
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
  // An optimistic bubble hasn't reached the server yet — say so instead of
  // claiming "Delivered" before the POST confirms.
  if (message.id.startsWith("optimistic-")) return "Sending";
  const readers = message.readBy.filter((reader) => reader.userId !== currentUserId);
  if (readers.length === 0) return "Delivered";
  return "Read";
}

/** True for anything not authored by the viewer (including synced external senders). */
function isIncomingMessage(message: MeChatSerializedMessage, currentUserId: string) {
  return message.senderId !== currentUserId || Boolean(message.metadata.externalSender);
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
  initialLastReadAt,
}: MeChatThreadProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
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
  // Auto-scroll only when you're already near the bottom, so reading history
  // isn't yanked down by an incoming message; a "New messages" pill offers the
  // jump instead.
  const scrollRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const prevLenRef = useRef(0);
  const [newBelowCount, setNewBelowCount] = useState(0);
  // Visible whenever you've scrolled up, even with nothing new — a quiet way
  // back to the latest message.
  const [showJump, setShowJump] = useState(false);
  // The "New" divider anchors to the first message you hadn't read when the
  // thread opened, and stays put for the whole visit even though polling keeps
  // bumping lastRead server-side.
  const [firstUnreadId] = useState<string | null>(() => {
    if (!initialLastReadAt) return null;
    const lastRead = +new Date(initialLastReadAt);
    const first = initialMessages.find(
      (message) => +new Date(message.createdAt) > lastRead && isIncomingMessage(message, currentUser.id),
    );
    return first?.id ?? null;
  });
  const unreadDividerRef = useRef<HTMLDivElement>(null);
  const didInitialScrollRef = useRef(false);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const typingTimerRef = useRef<number | null>(null);
  // Only real keystrokes signal "typing" — a restored draft or shared source
  // pre-filling the composer must not raise a phantom indicator for others.
  const draftTouchedRef = useRef(false);
  // Track which message ids have already been shown so only genuinely new
  // arrivals spring in — initial history and search re-filters stay calm.
  const seenIdsRef = useRef<Set<string>>(new Set(initialMessages.map((message) => message.id)));

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
    const grew = messages.length - prevLenRef.current;
    prevLenRef.current = messages.length;
    // Opening a thread with unread history lands on the "New" divider so you
    // resume where you left off; without one you start at the newest message.
    if (!didInitialScrollRef.current) {
      didInitialScrollRef.current = true;
      if (unreadDividerRef.current) {
        unreadDividerRef.current.scrollIntoView({ block: "start" });
        const el = scrollRef.current;
        if (el) {
          const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          nearBottomRef.current = near;
          setShowJump(!near);
        }
        return;
      }
    }
    // Stay pinned to the newest only if you're already there (this also keeps
    // the typing indicator in view). If you've scrolled up to read, a NEW
    // message raises the pill instead of hijacking your scroll position.
    if (nearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
      setNewBelowCount(0); // no-op when already 0
    } else if (grew > 0) {
      setNewBelowCount((count) => count + grew);
    }
  }, [messages.length, typingUsers.length]);

  // Switching threads starts you at the bottom of the new conversation.
  useEffect(() => {
    nearBottomRef.current = true;
    prevLenRef.current = 0;
    setNewBelowCount(0);
  }, [activeThreadId]);

  // Once a message has rendered it counts as "seen" — later re-mounts (search
  // filtering, reordering) then skip the entrance instead of replaying it.
  // Genuinely new arrivals from someone else also get a soft receive chime.
  useEffect(() => {
    let incoming = false;
    for (const message of messages) {
      if (seenIdsRef.current.has(message.id)) continue;
      seenIdsRef.current.add(message.id);
      if (isIncomingMessage(message, currentUser.id)) incoming = true;
    }
    if (incoming && document.visibilityState === "visible") playSound("ding");
  }, [messages, currentUser.id]);

  // A half-typed draft survives hopping between conversations — kept per
  // thread in sessionStorage so nothing lingers after the tab closes.
  const draftStorageKey = `mechat-draft:${activeThreadId || recipientId || "new"}`;

  useEffect(() => {
    if (initialSource?.content) return; // a shared source already fills the composer
    try {
      const saved = sessionStorage.getItem(draftStorageKey);
      if (saved) setDraft((current) => current || saved);
    } catch {
      // Storage may be unavailable; the composer just starts empty.
    }
  }, [draftStorageKey, initialSource]);

  useEffect(() => {
    try {
      if (draft) sessionStorage.setItem(draftStorageKey, draft.slice(0, 4000));
      else sessionStorage.removeItem(draftStorageKey);
    } catch {
      // Best-effort.
    }
  }, [draft, draftStorageKey]);

  // Auto-grow with the draft (typing, restored drafts, the thumbs-up shortcut)
  // up to ~5 lines, then scroll inside; emptying it snaps back to one line.
  useEffect(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 132)}px`;
  }, [draft]);

  // Desktop lands ready to type; touch keeps the keyboard down until asked.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) draftRef.current?.focus();
  }, []);

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
    if (!draftTouchedRef.current) return;

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
        // Sending always brings you back to the newest message, even if you
        // were reading history when you hit Enter.
        nearBottomRef.current = true;
        setMessages((current) => [...current, optimistic]);
        playSound("send");

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
        // Drop the stored draft under the pre-send key too (creating a thread
        // moves the key from recipient to thread mid-flight).
        try {
          sessionStorage.removeItem(draftStorageKey);
        } catch {
          // Best-effort.
        }
        setReplyTo(null);
        setPendingSource(undefined);
        setAttachments([]);
        setShowMediaTools(false);
        // The real message takes the optimistic bubble's place — mark it seen so
        // swapping the React key doesn't replay the send-in animation.
        seenIdsRef.current.add(data.message.id);
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
    <div data-testid="mechat-thread" className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr_auto]">
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
            <span className="text-xs font-semibold text-[var(--text-muted)]">{searchCount}</span>
          )}
        </label>
      </div>

      <div
        ref={scrollRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          const near = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
          nearBottomRef.current = near;
          if (near && newBelowCount) setNewBelowCount(0);
          setShowJump(!near); // React bails out when the value hasn't changed
        }}
        className="min-h-0 overflow-y-auto px-3 py-4 md:px-4"
      >
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
                    <span className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)]/70 px-3 py-1 text-micro font-semibold mesh-eyebrow text-[var(--text-muted)]">
                      {dayLabel(message.createdAt)}
                    </span>
                  </div>
                )}
                {/* "New" divider — where you left off last visit. Hidden while
                    searching so filtered results stay clean. */}
                {firstUnreadId === message.id && !searchQuery.trim() && (
                  <div
                    ref={unreadDividerRef}
                    role="separator"
                    aria-label="New messages"
                    className="my-4 flex scroll-mt-3 items-center gap-3"
                  >
                    <span className="h-px flex-1 bg-[var(--accent)]/40" aria-hidden="true" />
                    <span className="rounded-full border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-3 py-1 text-micro font-semibold mesh-eyebrow text-[var(--accent)]">
                      New
                    </span>
                    <span className="h-px flex-1 bg-[var(--accent)]/40" aria-hidden="true" />
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
                  <motion.div
                    initial={reduceMotion || seenIdsRef.current.has(message.id) ? false : { opacity: 0, x: isMine ? 12 : -26, y: 6, scale: 0.965 }}
                    animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.7 }}
                    className={`relative max-w-[86%] md:max-w-[72%] ${isMine ? "items-end" : "items-start"} flex flex-col gap-1`}
                  >
                    {!isMine && !groupedWithPrev && (
                      <p className="px-2 text-micro font-semibold text-[var(--text-muted)]">
                        {externalSender?.name || message.sender.displayName}
                      </p>
                    )}
                    {/* Floating action bar: hover on desktop, tap-to-pin on touch.
                        The bar itself is a plate that floats — it holds keys, it is
                        not one. It was `bg-[var(--bg-primary)]/95` + `backdrop-blur`,
                        so the four controls inside had no stable ground to carry an
                        --edge ring against; backdrop-filter is banned everywhere in
                        this system but the modal scrim, and `.glass-dropdown`
                        (globals.css:7678) is the precedent for making a transient
                        overlay opaque paper instead. */}
                    {!message.metadata.unsent && (
                      <div
                        onClick={(event) => event.stopPropagation()}
                        className={`absolute top-1/2 z-10 -translate-y-1/2 items-center gap-0.5 rounded-[var(--radius-lg)] border border-[var(--rule)] bg-[var(--paper-1)] px-1.5 py-1 shadow-[var(--shadow-float)] ${
                          isMine ? "right-full mr-2" : "left-full ml-2"
                        } ${pinnedActions ? "flex" : "hidden md:group-hover:flex"}`}
                      >
                        {/* `hover:scale-125` — the control GROWING under the pointer.
                            Growth is emission; a key answers by pressing in. Chip
                            wall, because these sit on chrome, not on the message. */}
                        {QUICK_REACTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => {
                              toggleReaction(message.id, emoji);
                              setActionsFor(null);
                            }}
                            className="mechat-key mechat-key-chip key flex h-8 w-8 items-center justify-center text-sm"
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
                          className="mechat-key mechat-key-chip key flex h-8 w-8 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                            className="mechat-key mechat-key-chip key flex h-8 w-8 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                            className="mechat-key mechat-key-chip key flex h-8 w-8 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--mesh-danger)]"
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
                    } ${!groupedWithNext ? `mechat-tail ${isMine ? "mechat-tail-mine" : "mechat-tail-theirs"}` : ""}`}>
                      {groupedReactions.length > 0 && (
                        <span className={`mechat-tapbacks ${isMine ? "mechat-tapbacks-mine" : "mechat-tapbacks-theirs"}`}>
                          {/* `whileTap={{ scale: 0.9 }}` wrote an INLINE transform, so
                              no stylesheet could have replaced the shrink with a
                              press — inline style beats every rule. The tapback is
                              moulded in the mechat block appended to globals.css;
                              the landing spring stays, the shrink goes. */}
                          {groupedReactions.map((reaction) => (
                            <motion.button
                              key={reaction.emoji}
                              type="button"
                              initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 18, mass: 0.6 }}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleReaction(message.id, reaction.emoji);
                              }}
                              className={`mechat-key mechat-tapback ${reaction.mine ? "is-mine" : ""}`}
                              aria-pressed={reaction.mine}
                            >
                              {reaction.emoji}
                              {reaction.count > 1 ? (
                                <span key={reaction.count} className="mesh-roll-in text-micro font-semibold">
                                  {reaction.count}
                                </span>
                              ) : null}
                            </motion.button>
                          ))}
                        </span>
                      )}
                      {!isExternalThread && (message.sourcePlatform !== "mesh" || message.messageType !== "text") ? (
                        <p className={`mb-2 text-micro font-semibold mesh-eyebrow ${isMine ? "text-white/75" : "text-[var(--text-muted)]"}`}>
                          {message.messageType.replace("_", " ")} from {message.sourcePlatform}
                        </p>
                      ) : null}

                      {/* A real control — it jumps you to the quoted message — drawn
                          as a translucent wash of whatever bubble it happened to
                          land in: `bg-white/10` over the accent gradient on one
                          side, --bg-secondary (the RECESS colour) on the other, and
                          no --edge ring in either. One key, one face, one pinned
                          ink, the same in both bubbles. */}
                      {message.replyTo && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery(message.replyTo?.content || "")}
                          className="mechat-key key mb-2 block w-full px-3 py-2 text-left text-xs text-[var(--text-secondary)]"
                        >
                          <span className="block font-semibold">{message.replyTo.senderName}</span>
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
                              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
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
                          {/* Save was `bg-white/20` in one bubble and an --accent fill
                              in the other; Cancel had no face at all. Neither had a
                              ring or a wall. Jade commit key, --face cancel key —
                              the same pair everywhere on this surface. */}
                          <div className="flex gap-2">
                            <button type="button" onClick={() => saveEdit(message.id)} disabled={isPending} className="mechat-key mechat-key-chip key key-lit [--mould:var(--mould-jade)] [--mould-ink:var(--mould-jade-ink)] [--mould-plinth:var(--mould-jade-plinth)] inline-flex min-h-8 items-center px-3 py-1 text-micro font-semibold disabled:opacity-50">Save</button>
                            <button type="button" onClick={() => { setEditingId(null); setEditDraft(""); }} className="mechat-key mechat-key-chip key inline-flex min-h-8 items-center px-3 py-1 text-micro font-semibold text-[var(--text-secondary)]">Cancel</button>
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

                      {/* `hover:translate-y-[-1px]` — the card LIFTING off the bubble
                          under the pointer. A control answers by pressing in, never
                          by rising. Same fix as the quoted reply above: one key with
                          a real face, so the three inks stop being white-alpha over
                          an unknown ground and become the pinned ramp. */}
                      {message.metadata.linkPreview && (
                        <a
                          href={message.metadata.linkPreview.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mechat-key key mt-3 block p-3 text-[var(--text-primary)]"
                        >
                          <span className="text-micro font-semibold mesh-eyebrow text-[var(--text-muted)]">
                            {message.metadata.linkPreview.host}
                          </span>
                          <span className="mt-1 block text-sm font-semibold">{message.metadata.linkPreview.title}</span>
                          {message.metadata.linkPreview.description && (
                            <span className="mt-1 block text-xs text-[var(--text-secondary)]">
                              {message.metadata.linkPreview.description}
                            </span>
                          )}
                        </a>
                      )}

                      {message.sourceUrl && !message.metadata.linkPreview && safeHref(message.sourceUrl) && (
                        <a
                          href={safeHref(message.sourceUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className={`mt-2 inline-flex items-center gap-1 text-xs font-semibold underline-offset-4 hover:underline ${isMine ? "text-white" : "text-[var(--accent)]"}`}
                        >
                          <Link2 size={13} aria-hidden="true" />
                          Open source
                        </a>
                      )}
                    </div>

                    {showMeta && (
                      <div className={`flex flex-wrap items-center gap-1.5 px-2 text-micro text-[var(--text-muted)] ${isMine ? "justify-end" : "justify-start"}`}>
                        <span>{timeLabel(message.createdAt)}</span>
                        {delivery && (
                          <span className={delivery.status === "delivered" ? "text-[var(--mesh-green)]" : "text-[var(--mesh-danger)]"}>
                            · {delivery.status === "delivered"
                              ? `Delivered to ${platformDisplayName(delivery.platform)}`
                              : `Saved here — not delivered to ${platformDisplayName(delivery.platform)}`}
                          </span>
                        )}
                        {message.metadata.edited && !message.metadata.unsent && <span>· Edited</span>}
                        {readers && (
                          <span className="inline-flex items-center gap-1">
                            · {readers === "Sending"
                              ? <PaperWait size="sm" />
                              : <CheckCheck size={12} aria-hidden="true" />}
                            {readers}
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                </article>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        ) : (
          <div className="flex min-h-72 flex-col items-center justify-center text-center">
            <MeshiMascot size={88} mood="excited" prop="envelope" animate />
            <h2 className="mt-4 text-lg font-semibold">{searchQuery ? "No matching messages" : "Say hello"}</h2>
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
              {typingUsers.slice(0, 3).map((user, index) =>
                user.meshi ? (
                  <span
                    key={user.userId}
                    className="mechat-typing-meshi inline-flex h-8 w-8 items-center justify-center"
                    style={{ animationDelay: `${index * 160}ms` }}
                  >
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
              role="status"
              aria-live="polite"
              className="rounded-[1.3rem] rounded-bl-[0.5rem] border border-[var(--border-primary)] bg-[var(--bg-primary)]/80 px-4 py-3 shadow-sm"
              aria-label={`${typingUsers.map((user) => user.displayName).join(", ")} ${typingUsers.length === 1 ? "is" : "are"} typing`}
            >
              <span className="mesh-typing-wave" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </div>
          </div>
        )}

        {/* "New messages" pill — appears only when you've scrolled up and a
            fresh message arrived, sticking to the bottom of the scroll port so
            it never hijacks your reading position. Tap to jump to the latest.
            With nothing new, a quieter round arrow offers the same jump.

            Both float over live message text, which is the one place a control
            MUST carry its own boundary, and neither did: an --accent fill with
            unpinned white ink, and a `bg-[var(--bg-primary)]/90` + `backdrop-blur`
            disc. Jade key for the one that reports news, --face key for the one
            that only navigates — rank by material. The arrow's target goes 36 ->
            44px on the way past. */}
        <div className="pointer-events-none sticky bottom-2 z-10 flex justify-center">
          {newBelowCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
                setNewBelowCount(0);
              }}
              className="mechat-key key key-lit [--mould:var(--mould-jade)] [--mould-ink:var(--mould-jade-ink)] [--mould-plinth:var(--mould-jade-plinth)] pointer-events-auto flex min-h-9 items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold"
            >
              {newBelowCount > 1 ? `${newBelowCount} new messages` : "New messages"}
              <ArrowDown size={14} aria-hidden="true" />
            </button>
          ) : showJump ? (
            <button
              type="button"
              onClick={() => {
                bottomRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "end" });
              }}
              className="mechat-key key pointer-events-auto flex h-11 w-11 items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label="Jump to latest"
              title="Jump to latest"
            >
              <ArrowDown size={16} aria-hidden="true" />
            </button>
          ) : null}
        </div>
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
          <p className="mb-2 flex items-center gap-1.5 text-micro font-semibold text-[var(--text-muted)]">
            <Link2 size={12} aria-hidden="true" />
            Replies deliver to {platformDisplayName(threadPlatform)} through your connected account.
          </p>
        )}
        {error && (
          <p role="alert" className="mb-2 rounded-lg border border-[var(--mesh-danger)]/30 bg-[var(--mesh-danger)]/10 px-3 py-2 text-xs text-[var(--mesh-danger)]">
            {error}
          </p>
        )}

        {replyTo && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs">
            <span className="min-w-0">
              <span className="block font-semibold">Replying to {replyTo.sender.displayName}</span>
              <span className="block truncate text-[var(--text-muted)]">{replyTo.content}</span>
            </span>
            {/* `.mesh-choice` is the old paper model and it is FLATTENED: the
                override at globals.css:4150 sets `box-shadow: none !important`, so
                this control could never have carried a wall, and :4161 lifts it 1px
                on hover. That class has call sites across the whole product, so the
                shared rule stays exactly as it is and only this site moves to
                `.key` — the same containment the feed pass used for `.mesh-action`
                (globals.css:7692). */}
            <button type="button" onClick={() => setReplyTo(null)} className="mechat-key mechat-key-chip key inline-flex h-8 w-8 items-center justify-center text-[var(--text-secondary)]" aria-label="Cancel reply">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}

        {pendingSource?.sourcePlatform && (
          <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-2 text-xs">
            <span className="min-w-0 font-semibold text-[var(--text-secondary)]">
              Sharing from {pendingSource.sourcePlatform}. Source credit stays attached.
            </span>
            <button type="button" onClick={() => setPendingSource(undefined)} className="mechat-key mechat-key-chip key inline-flex h-8 w-8 items-center justify-center text-[var(--text-secondary)]" aria-label="Remove shared source">
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
                aria-label={`Remove ${attachment.name || attachmentLabel(attachment.type)}`}
                className="mechat-key mechat-key-chip key inline-flex min-h-9 items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)]"
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
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addAttachment(); } }}
              className="simple-input h-10 px-3 text-sm"
              placeholder="https://..."
            />
            <input
              value={attachmentName}
              onChange={(event) => setAttachmentName(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addAttachment(); } }}
              className="simple-input h-10 px-3 text-sm"
              placeholder="Name"
            />
            {/* `.mesh-action mesh-action-secondary` — flattened by the same
                `box-shadow: none !important` block (globals.css:4150) and lifted
                3px on hover by `.mesh-action:hover` (:2293). Call site only. */}
            <button type="button" onClick={addAttachment} className="mechat-key key inline-flex min-h-11 items-center justify-center px-3 text-sm font-semibold text-[var(--text-primary)]">
              Add
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* ON was an --accent-subtle wash behind --accent glyph and OFF was
              --bg-secondary, the RECESS colour, on a control that is not a well.
              Neither carried a ring or a wall. ON is a material change now:
              moulded jade with its pinned ink, OFF is --face. */}
          <button
            type="button"
            onClick={() => setShowMediaTools((current) => !current)}
            className={`mechat-key key flex h-11 w-11 shrink-0 items-center justify-center ${
              showMediaTools
                ? "key-lit [--mould:var(--mould-jade)] [--mould-ink:var(--mould-jade-ink)] [--mould-plinth:var(--mould-jade-plinth)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
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
                draftTouchedRef.current = true;
                setDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                // `isComposing` guards IME/CJK input: the Enter that commits a
                // Japanese/Chinese/Korean candidate must not also send a
                // half-composed message.
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  sendCurrentMessage();
                } else if (event.key === "Escape") {
                  // Escape backs out of whatever context is open, in order.
                  if (actionsFor) setActionsFor(null);
                  else if (replyTo) setReplyTo(null);
                  else if (pendingSource) setPendingSource(undefined);
                  else if (showMediaTools) setShowMediaTools(false);
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
                draftTouchedRef.current = true;
                setDraft((current) => `${current}${current ? " " : ""}\uD83D\uDC4D`);
                draftRef.current?.focus();
              }}
              className="mechat-key mechat-key-chip key mb-1.5 flex h-9 w-9 shrink-0 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              aria-label="Add thumbs up to message"
              title="Add thumbs up"
            >
              <SmilePlus size={17} aria-hidden="true" />
            </button>
          </div>
          {/* Send is the last control in the product's most-used loop and it had
              the loudest non-material: an --accent disc under `shadow-lg`, unpinned
              white ink, `hover:brightness-110`, `active:scale-90`, and — worst —
              `scale-100` vs `scale-95` to signal readiness. Size was carrying
              state, which is Law 2 in the size dimension. Armed is a jade key with
              its pinned ink; empty is --face, and `.key:disabled` (globals.css:4984)
              already draws a key that is bottomed out with nothing left to press. */}
          <button
            type="submit"
            disabled={isPending || (!draft.trim() && attachments.length === 0 && !pendingSource?.sourceUrl)}
            className={`mechat-key key flex h-11 w-11 shrink-0 items-center justify-center disabled:cursor-not-allowed ${
              draft.trim() || attachments.length > 0 || pendingSource?.sourceUrl
                ? "key-lit [--mould:var(--mould-jade)] [--mould-ink:var(--mould-jade-ink)] [--mould-plinth:var(--mould-jade-plinth)]"
                : "text-[var(--text-muted)]"
            }`}
            aria-label="Send message"
            title="Send"
          >
            {isPending ? <PaperWait size="sm" /> : <Send size={17} aria-hidden="true" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function AttachmentPreview({ attachment, isMine }: { attachment: MeChatAttachment; isMine: boolean }) {
  // Image/video bubbles get a stable width and a reserved aspect-ratio frame
  // (native ratio clamped 4:5–16:9, extremes letterboxed over a blurred
  // self-fill) so the thread never reflows as media loads.
  if (attachment.type === "image") {
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block w-fit overflow-hidden rounded-xl border border-black/10">
        <NativeAspectMedia
          media={{ url: attachment.url, type: "image" }}
          alt={attachment.name || "Shared image"}
          sizes="320px"
          defaultRatio={4 / 3}
          className="w-[min(20rem,70vw)]"
        />
      </a>
    );
  }

  if (attachment.type === "video") {
    return (
      <NativeAspectMedia
        media={{ url: attachment.url, type: "video" }}
        videoMode="controls"
        defaultRatio={16 / 9}
        className="w-[min(20rem,70vw)] rounded-xl border border-black/10 bg-black"
      />
    );
  }

  if (attachment.type === "audio") {
    return (
      // Loudness-leveled on first play (never preload); CORS-unsafe sources
      // keep their native audio path. Video attachments get the same treatment
      // inside NativeAspectMedia's controls player.
      <audio src={attachment.url} controls onPlay={(event) => attachNormalizer(event.currentTarget)} className="w-full" />
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${isMine ? "border-white/20 bg-white/10 text-white" : "border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"}`}
    >
      <Paperclip size={14} aria-hidden="true" />
      <span className="min-w-0 truncate">{attachment.name || attachment.url}</span>
    </a>
  );
}
