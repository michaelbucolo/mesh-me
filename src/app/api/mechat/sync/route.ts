import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/request-guard";
import { syncMeChatConversationsForCurrentUser } from "@/lib/platform-sync";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/security";

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`mechat-sync:${user.id}`, 30, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Sync is running too often. Try again shortly." }, { status: 429 });
  }

  const result = await syncMeChatConversationsForCurrentUser();
  if ("error" in result) {
    return NextResponse.json(result, { status: result.error === "Not authenticated" ? 401 : 400 });
  }

  return NextResponse.json(result);
}
