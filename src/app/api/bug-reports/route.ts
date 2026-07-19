import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createBugReportRecord, saveBugReport } from "@/lib/bug-reports";
import { meshAppVersion } from "@/lib/app-info";
import { getTrustedClientIp } from "@/lib/client-ip";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";
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

    const parsed = await readJsonObject(req);
    if (Object.keys(parsed).length === 0) {
      return NextResponse.json({ error: "Invalid bug report." }, { status: 400 });
    }
    const payload = parsed as BugReportPayload;

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

    // Key only on the proxy-derived client IP: attacker-controlled values
    // (spoofed forwarded headers, arbitrary page URLs) must never mint fresh
    // rate-limit buckets. A global backstop caps aggregate abuse across IPs.
    const clientIp = getTrustedClientIp(req.headers);
    const rl = rateLimit(`bug:${clientIp}`, 8, 10 * 60 * 1000);
    const globalRl = rateLimit("bug:global", 200, 10 * 60 * 1000);
    if (!rl.allowed || !globalRl.allowed) {
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
