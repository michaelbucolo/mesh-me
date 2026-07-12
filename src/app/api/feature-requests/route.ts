import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createFeatureRequest, listFeatureRequests } from "@/lib/feature-requests";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
import { rateLimit, sanitizeForDisplay } from "@/lib/security";

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return sanitizeForDisplay(value.replace(/\u0000/g, "").trim()).slice(0, maxLength);
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({ requests: await listFeatureRequests(user.id) });
}

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`feature-request:${user.id}`, 8, 10 * 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many ideas submitted. Please slow down." }, { status: 429 });
  }

  const body = await readJsonObject(req);
  const title = cleanText(body.title, 120);
  const description = cleanText(body.description, 1200);

  if (title.length < 4) {
    return NextResponse.json({ error: "Give the idea a clear title." }, { status: 400 });
  }

  if (description.length < 12) {
    return NextResponse.json({ error: "Describe the request in at least 12 characters." }, { status: 400 });
  }

  const request = await createFeatureRequest({
    title,
    description,
    authorId: user.id,
    authorUsername: user.username,
    authorDisplayName: user.displayName,
  });

  return NextResponse.json({ request }, { status: 201 });
}
