import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { clearMeChatTyping, getMeChatTypingUsers, setMeChatTyping } from "@/lib/mechat-presence";
import { getUserMeshiPreference } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";

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

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  if (body.typing === false) {
    clearMeChatTyping(threadId, user.id);
  } else {
    const pref = await getUserMeshiPreference(user.id);
    setMeChatTyping(threadId, {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      meshi: pref
        ? {
            color: pref.colorTheme,
            hat: pref.hatStyle,
            hair: pref.hairStyle,
            accessory: pref.accessoryStyle,
            eyeStyle: pref.eyeStyle,
            badge: pref.badgeStyle,
            outfit: pref.outfitStyle,
          }
        : null,
    });
  }

  return NextResponse.json({ typingUsers: getMeChatTypingUsers(threadId, user.id) });
}
