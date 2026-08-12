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
  // Both live-presence signals (viewing AND typing) are activity status and
  // honor the same server-authoritative toggles: opting out of read receipts,
  // or hiding activity status, must suppress the broadcast. Typing is a
  // strictly stronger live signal than viewing, so it needs the identical gate
  // — loaded once here so the typing branch can't leak presence past the toggle.
  const self = await prisma.user.findUnique({
    where: { id: user.id },
    select: { readReceipts: true, hideActivityStatus: true, ghostMode: true },
  });
  // Ghost Mode is the strongest hide — mesh presence drops a ghosted member's
  // heartbeat outright (mesh-presence-store: `if (entry.ghostMode) continue`).
  // A live "typing…" or "in the chat now" beat is exactly that same activity
  // signal on a different surface, so Ghost Mode has to suppress it too; without
  // this line, going invisible hid you on the mesh while your keystrokes still
  // lit you up in every open DM.
  const activityVisible = Boolean(self?.readReceipts && !self.hideActivityStatus && !self.ghostMode);
  if (body.typing === false && body.viewing === true) {
    // Viewing heartbeat: the thread is open and visible, Bitmoji-style
    // presence — the member's Meshi sits quietly in the chat. Honors the
    // same per-user "Read receipts" toggle as readBy (opting out of "seen"
    // also opts out of "here right now"), plus the hide-activity-status
    // toggle, since "in the chat right now" IS activity status.
    if (activityVisible) {
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
  } else if (activityVisible) {
    setMeChatTyping(threadId, {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      meshi: await getCachedMeshiFor(user.id).catch(() => null),
    });
  } else {
    // hideActivityStatus / read-receipts-off: a keystroke must not broadcast a
    // "typing" beat. Clear any stale presence instead of publishing a new one.
    clearMeChatTyping(threadId, user.id);
  }

  return NextResponse.json({ typingUsers: getMeChatTypingUsers(threadId, user.id) });
}
