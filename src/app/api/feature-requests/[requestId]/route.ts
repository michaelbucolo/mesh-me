import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getFeatureRequestById, updateFeatureRequestStatus } from "@/lib/feature-requests";
import { isFeatureRequestStatus } from "@/lib/feature-request-options";
import { isSameOriginRequest } from "@/lib/request-guard";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, maxLength);
}

export async function PATCH(req: Request, context: RouteContext) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!user.isAdmin) {
    return NextResponse.json({ error: "Only admins can change request status." }, { status: 403 });
  }

  const { requestId } = await context.params;
  const existing = await getFeatureRequestById(requestId, user.id);
  if (!existing) {
    return NextResponse.json({ error: "Feature request not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const status = cleanText(body.status, 40);
  if (!isFeatureRequestStatus(status)) {
    return NextResponse.json({ error: "Choose a valid status." }, { status: 400 });
  }

  const request = await updateFeatureRequestStatus(requestId, status, user.id);
  return NextResponse.json({ request });
}
