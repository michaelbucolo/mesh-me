import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getFeatureRequestById, setFeatureRequestVote } from "@/lib/feature-requests";
import { isSameOriginRequest } from "@/lib/request-guard";
import { rateLimit } from "@/lib/security";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`feature-vote:${user.id}`, 60, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Voting too quickly. Please slow down." }, { status: 429 });
  }

  const { requestId } = await context.params;
  const existing = await getFeatureRequestById(requestId, user.id);
  if (!existing) {
    return NextResponse.json({ error: "Feature request not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = body.action === "remove" ? "remove" : "upvote";
  const request = await setFeatureRequestVote(requestId, user.id, action === "upvote");

  return NextResponse.json({ request });
}
