import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clearMeChatTyping, getMeChatTypingUsers, setMeChatTyping } from "@/lib/mechat-presence";
import { getCachedMeshiFor } from "@/lib/mechat-meshi-cache";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";

type RouteContext = {
  params: Promise<{ threadId: string }>;
};

async function isThreadMember(threadId: string, userId: string) {
  const membership = await prisma.threadMember.findFirst({
    where: { threadId, userId },
    select: { id: true },
  });
  return Boolean(membership);
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { threadId } = await context.params;
  if (!(await isThreadMember(threadId, user.id))) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  return NextResponse.json({ typingUsers: getMeChatTypingUsers(threadId, user.id) });
}

export async function POST(request: NextRequest, context: RouteContext) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { threadId } = await context.params;
  if (!(await isThreadMember(threadId, user.id))) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  const body = await readJsonObject(request);
  if (body.typing === false && body.viewing === true) {
    // Viewing heartbeat: the thread is open and visible, Bitmoji-style
    // presence — the member's Meshi sits quietly in the chat. Honors the
    // same per-user "Read receipts" toggle as readBy (opting out of "seen"
    // also opts out of "here right now"), plus the hide-activity-status
    // toggle, since "in the chat right now" IS activity status.
    const self = await prisma.user.findUnique({
      where: { id: user.id },
      select: { readReceipts: true, hideActivityStatus: true },
    });
    if (self?.readReceipts && !self.hideActivityStatus) {
      // The route owns the transition: a viewing beat replaces whatever state
      // came before it (typing demotes to viewing when keystrokes stop).
      setMeChatTyping(threadId, {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        meshi: await getCachedMeshiFor(user.id).catch(() => null),
      }, 25_000, "viewing");
    }
  } else if (body.typing === false) {
    clearMeChatTyping(threadId, user.id);
  } else {
    setMeChatTyping(threadId, {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      meshi: await getCachedMeshiFor(user.id).catch(() => null),
    });
  }

  return NextResponse.json({ typingUsers: getMeChatTypingUsers(threadId, user.id) });
}
