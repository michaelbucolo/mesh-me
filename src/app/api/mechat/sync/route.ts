import { NextRequest, NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/request-guard";
import { syncMeChatConversationsForCurrentUser } from "@/lib/platform-sync";

export async function POST(req: NextRequest) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const result = await syncMeChatConversationsForCurrentUser();
  if ("error" in result) {
    return NextResponse.json(result, { status: result.error === "Not authenticated" ? 401 : 400 });
  }

  return NextResponse.json(result);
}
