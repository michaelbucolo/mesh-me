import { NextResponse } from "next/server";
import { getAnalyticsReport } from "@/lib/analytics-report-loader";
import { renderReportHtml } from "@/lib/analytics-report-html";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/security";

/**
 * GET /api/analytics/report?period=2026-07 | ?period=2025
 *
 * The Mesh Report as one self-contained HTML document — printable, offline,
 * nothing loaded from anywhere. Free accounts get a plain 403 sentence (the
 * trail precedent), never a teaser render; the loader owns consent and the
 * MeshPro adjudication, this route owns the status codes.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Composing a report is two full period scans; meter it in-handler.
  if (!rateLimit(`report:${user.id}`, 10, 10 * 60_000).allowed) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const result = await getAnalyticsReport(searchParams.get("period"));

  switch (result.status) {
    case "unauthenticated":
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    case "consent-withheld":
      return NextResponse.json(
        { error: "Your privacy rules say Mesh.me may not process your activity into analytics." },
        { status: 403 },
      );
    case "not-pro":
      return NextResponse.json({ error: "The Mesh Report is a MeshPro document." }, { status: 403 });
    case "invalid-period":
      return NextResponse.json(
        { error: "Reports cover a fully ended month (period=2026-07) or year (period=2025)." },
        { status: 400 },
      );
  }

  return new NextResponse(renderReportHtml(result.report, { displayName: user.displayName, username: user.username }), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // A personal document: never cached in anything shared.
      "Cache-Control": "private, no-store",
    },
  });
}
