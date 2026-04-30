import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/request-guard";
import { rateLimit } from "@/lib/security";
import { createSupportTicketRecord, saveSupportTicket } from "@/lib/support-tickets";
import { isSupportCategory, isSupportPriority } from "@/lib/support-ticket-options";

export const runtime = "nodejs";

const MAX_MESSAGE_LENGTH = 4000;
const MAX_BROWSER_INFO_LENGTH = 2000;
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;
const allowedScreenshotTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

function readText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "";
  return value.replace(/\u0000/g, "").trim();
}

function cleanText(value: FormDataEntryValue | null, maxLength: number) {
  return readText(value).slice(0, maxLength);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function requestBrowserInfo(req: Request, clientBrowserInfo: string) {
  const details = {
    client: clientBrowserInfo,
    userAgent: req.headers.get("user-agent") || "",
    language: req.headers.get("accept-language") || "",
    referer: req.headers.get("referer") || "",
  };

  return JSON.stringify(details).slice(0, MAX_BROWSER_INFO_LENGTH);
}

export async function POST(req: Request) {
  try {
    if (!isSameOriginRequest(req)) {
      return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
    }

    const formData = await req.formData();
    const accountEmail = cleanText(formData.get("accountEmail"), 254).toLowerCase();
    const category = cleanText(formData.get("category"), 64);
    const priority = cleanText(formData.get("priority"), 64);
    const rawMessage = readText(formData.get("message"));
    const message = rawMessage.slice(0, MAX_MESSAGE_LENGTH);
    const browserInfo = cleanText(formData.get("browserInfo"), MAX_BROWSER_INFO_LENGTH);

    if (!isValidEmail(accountEmail)) {
      return NextResponse.json({ error: "Enter a valid account email." }, { status: 400 });
    }

    if (!isSupportCategory(category)) {
      return NextResponse.json({ error: "Choose a support category." }, { status: 400 });
    }

    if (!isSupportPriority(priority)) {
      return NextResponse.json({ error: "Choose a priority." }, { status: 400 });
    }

    if (message.length < 10) {
      return NextResponse.json({ error: "Tell support what happened in at least 10 characters." }, { status: 400 });
    }

    if (rawMessage.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json({ error: "Message must be 4000 characters or fewer." }, { status: 400 });
    }

    const forwardedFor = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const rl = rateLimit(`support:${forwardedFor}:${accountEmail}`, 5, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many support requests. Please try again later." }, { status: 429 });
    }

    const screenshot = formData.get("screenshot");
    let screenshotName: string | null = null;
    let screenshotType: string | null = null;
    let screenshotSize: number | null = null;
    let screenshotDataUrl: string | null = null;

    if (screenshot instanceof File && screenshot.size > 0) {
      if (!allowedScreenshotTypes.has(screenshot.type)) {
        return NextResponse.json({ error: "Screenshot must be PNG, JPG, WebP, or GIF." }, { status: 400 });
      }

      if (screenshot.size > MAX_SCREENSHOT_BYTES) {
        return NextResponse.json({ error: "Screenshot must be smaller than 2 MB." }, { status: 400 });
      }

      const bytes = await screenshot.arrayBuffer();
      screenshotName = screenshot.name.replace(/[^\w.\- ()]/g, "").slice(0, 120) || "screenshot";
      screenshotType = screenshot.type;
      screenshotSize = screenshot.size;
      screenshotDataUrl = `data:${screenshot.type};base64,${Buffer.from(bytes).toString("base64")}`;
    }

    const user = await getCurrentUser().catch(() => null);
    const ticket = createSupportTicketRecord({
      accountEmail,
      category,
      priority,
      message,
      browserInfo: requestBrowserInfo(req, browserInfo),
      screenshotName,
      screenshotType,
      screenshotSize,
      screenshotDataUrl,
      userId: user?.id || null,
      username: user?.username || null,
    });

    await saveSupportTicket(ticket);

    return NextResponse.json({
      success: true,
      ticketNumber: ticket.ticketNumber,
    });
  } catch (error) {
    console.error("Support ticket submission failed", error);
    return NextResponse.json({ error: "Support ticket could not be submitted. Please try again." }, { status: 500 });
  }
}
