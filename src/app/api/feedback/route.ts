import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-guard";
import { rateLimit } from "@/lib/security";

export async function POST(req: Request) {
  try {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = rateLimit(`feedback:${user.id}`, 6, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many feedback submissions. Please try again later." }, { status: 429 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const { type, subject, message, email, rating, page } = body;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: "Message too long" }, { status: 400 });
    }

    // Store feedback in AdminLog for now (lightweight — no schema migration needed)
    await prisma.adminLog.create({
      data: {
        action: "feedback",
        details: JSON.stringify({
          type: type || "general",
          subject: subject || "",
          message: message.trim(),
          email: email || "",
          rating: rating || 0,
          page: page || "",
          userId: user.id,
          username: user.username,
          timestamp: new Date().toISOString(),
        }),
        adminId: user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}
