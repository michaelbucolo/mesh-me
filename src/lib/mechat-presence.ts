import { prisma } from "@/lib/prisma";

export type TypingMeshi = {
  color: string;
  hat: string;
  face?: string;
  hair: string;
  hairColor: string;
  accessory: string;
  eyeStyle: string;
  badge: string;
  /** Server-derived via hasMeshPro() — the gold rim on MeChat's tiny Meshis. */
  isPro: boolean;
};

export type MeChatPresenceMode = "typing" | "viewing";

type TypingUser = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  meshi: TypingMeshi | null;
  /* "typing" = keystrokes in the last few seconds; "viewing" = the thread is
     open and visible (a slower heartbeat). Typing always outranks viewing. */
  mode: MeChatPresenceMode;
  expiresAt: number;
};

type MeChatPresenceGlobal = typeof globalThis & {
  __meshMeChatTyping?: Map<string, TypingUser[]>;
};

function typingStore() {
  const globalRef = globalThis as MeChatPresenceGlobal;
  if (!globalRef.__meshMeChatTyping) {
    globalRef.__meshMeChatTyping = new Map<string, TypingUser[]>();
  }
  return globalRef.__meshMeChatTyping;
}

function pruneThread(threadId: string) {
  const store = typingStore();
  const now = Date.now();
  const active = (store.get(threadId) || []).filter((entry) => entry.expiresAt > now);
  if (active.length > 0) {
    store.set(threadId, active);
  } else {
    store.delete(threadId);
  }
  return active;
}

export function setMeChatTyping(
  threadId: string,
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    meshi?: TypingMeshi | null;
  },
  ttlMs = 6500,
  mode: MeChatPresenceMode = "typing",
) {
  const store = typingStore();
  const active = pruneThread(threadId).filter((entry) => entry.userId !== user.id);
  active.push({
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    meshi: user.meshi ?? null,
    mode,
    expiresAt: Date.now() + ttlMs,
  });
  store.set(threadId, active);
}

export function clearMeChatTyping(threadId: string, userId: string) {
  const store = typingStore();
  const active = pruneThread(threadId).filter((entry) => entry.userId !== userId);
  if (active.length > 0) {
    store.set(threadId, active);
  } else {
    store.delete(threadId);
  }
}

/** Privacy is checked at read time, never borrowed from a cached heartbeat. */
export async function getMeChatActivityUserIds(threadId: string, currentUserId: string): Promise<Set<string>> {
  try {
    const members = await prisma.threadMember.findMany({
      where: {
        threadId,
        // A retained heartbeat cannot outlive either participant's membership.
        thread: { members: { some: { userId: currentUserId, user: { isSuspended: false } } } },
        user: {
          isSuspended: false,
          ghostMode: false,
          hideActivityStatus: false,
          readReceipts: true,
          blocks: { none: { blockedId: currentUserId } },
          blockedBy: { none: { blockerId: currentUserId } },
        },
      },
      select: { userId: true },
    });
    return new Set(members.map((member) => member.userId));
  } catch {
    // An unavailable privacy lookup must never expose a cached activity signal.
    return new Set();
  }
}

export async function getMeChatTypingUsers(threadId: string, currentUserId: string) {
  const visibleUserIds = await getMeChatActivityUserIds(threadId, currentUserId);
  return pruneThread(threadId)
    .filter((entry) => entry.userId !== currentUserId && visibleUserIds.has(entry.userId))
    .map((entry) => ({
      userId: entry.userId,
      username: entry.username,
      displayName: entry.displayName,
      avatarUrl: entry.avatarUrl,
      meshi: entry.meshi,
      mode: entry.mode,
    }));
}
