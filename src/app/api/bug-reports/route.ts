import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createBugReportRecord, saveBugReport } from "@/lib/bug-reports";
import { meshAppVersion } from "@/lib/app-info";
import { isSameOriginRequest } from "@/lib/request-guard";
import { rateLimit } from "@/lib/security";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 2000;

type BugReportPayload = {
  message?: unknown;
  contactEmail?: unknown;
  pageUrl?: unknown;
  deviceType?: unknown;
  browser?: unknown;
  screenSize?: unknown;
  appVersion?: unknown;
  userAgent?: unknown;
};

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function isSameHostPageUrl(value: string, req: Request) {
  const host = req.headers.get("host")?.toLowerCase();
  if (!host) return false;

  try {
    const parsed = new URL(value);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.host.toLowerCase() === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }

    const payload = (await req.json().catch(() => null)) as BugReportPayload | null;
    if (!payload) {
      return NextResponse.json({ error: "Invalid bug report." }, { status: 400 });
    }

    const message = cleanText(payload.message, MAX_MESSAGE_LENGTH);
    const contactEmail = cleanText(payload.contactEmail, 254).toLowerCase();
    const pageUrl = cleanText(payload.pageUrl, 2048);
    const deviceType = cleanText(payload.deviceType, 48) || "Unknown device";
    const browser = cleanText(payload.browser, 80) || "Unknown browser";
    const screenSize = cleanText(payload.screenSize, 80) || "Unknown screen";
    const appVersion = cleanText(payload.appVersion, 80) || meshAppVersion;
    const userAgent = cleanText(payload.userAgent, 500) || req.headers.get("user-agent") || "";

    if (message.length < 8) {
      return NextResponse.json({ error: "Describe the bug in at least 8 characters." }, { status: 400 });
    }

    if (contactEmail && !isValidEmail(contactEmail)) {
      return NextResponse.json({ error: "Enter a valid email or leave contact blank." }, { status: 400 });
    }

    if (!isSameHostPageUrl(pageUrl, req)) {
      return NextResponse.json({ error: "Page URL was missing or invalid." }, { status: 400 });
    }

    const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const rl = rateLimit(`bug:${forwardedFor}:${pageUrl.slice(0, 160)}`, 8, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many bug reports. Please try again later." }, { status: 429 });
    }

    const user = await getCurrentUser().catch(() => null);
    const report = createBugReportRecord({
      message,
      contactEmail: contactEmail || user?.email || null,
      pageUrl,
      deviceType,
      browser,
      screenSize,
      appVersion,
      userAgent,
      userId: user?.id || null,
      username: user?.username || null,
    });

    await saveBugReport(report);

    return NextResponse.json({
      success: true,
      reportNumber: report.reportNumber,
    });
  } catch (error) {
    console.error("Bug report submission failed", error);
    return NextResponse.json({ error: "Bug report could not be submitted. Please try again." }, { status: 500 });
  }
}
