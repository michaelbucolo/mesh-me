import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getMessageThreads } from "@/lib/queries";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const threads = await getMessageThreads();

  const serializedThreads = threads.map((t) => ({
    id: t.id,
    otherUser: t.otherUser || null,
    lastMessage: t.lastMessage
      ? { content: t.lastMessage.content, senderId: t.lastMessage.senderId, createdAt: String(t.lastMessage.createdAt) }
      : null,
    platform: "mesh",
    unread: 0,
  }));

  return NextResponse.json({ threads: serializedThreads, currentUserId: user.id });
}
