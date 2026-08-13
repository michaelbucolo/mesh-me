import { NextResponse } from "next/server";
import { getAnalyticsDashboardData } from "@/lib/analytics-dashboard";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/security";

/**
 * GET /api/analytics/series — the dashboard's raw numbers as CSV, FREE.
 *
 * This route is the greppable half of the product's raw/composed line: rows
 * are yours, composition is ours. It ships in the same change that draws the
 * Pro line, and the analytics-report gate asserts this file contains no plan
 * test at all — paywalling it is a build failure, not a debate.
 *
 * It calls the dashboard loader, so it inherits the Analytics consent gate,
 * the per-plan window, and the 30s memo without duplicating any of them.
 * Emitted: dates, numbers, platform slugs, and the user's OWN usernames —
 * no other person's anything.
 */

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function csvRows(rows: Array<Array<string | number | null | undefined>>) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  if (!rateLimit(`analytics-series:${user.id}`, 20, 10 * 60_000).allowed) {
    return NextResponse.json({ error: "Slow down" }, { status: 429 });
  }

  const data = await getAnalyticsDashboardData();
  if (!data) {
    return NextResponse.json(
      { error: "Your privacy rules say Mesh.me may not process your activity into analytics." },
      { status: 403 },
    );
  }

  const { engagement, followerGrowth, content, activity } = data.charts;
  const byDate = new Map<string, { engagement: number; followerGrowth: number; content: number; activity: number }>();
  const slot = (key: string) => {
    const row = byDate.get(key) ?? { engagement: 0, followerGrowth: 0, content: 0, activity: 0 };
    byDate.set(key, row);
    return row;
  };
  for (const point of engagement) slot(point.key).engagement = point.value;
  for (const point of followerGrowth) slot(point.key).followerGrowth = point.value;
  for (const point of content) slot(point.key).content = point.value;
  for (const point of activity) slot(point.key).activity = point.value;

  const daily = csvRows([
    ["date", "engagement", "follower_growth", "content_published", "activity"],
    ...[...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, row]) => [date, row.engagement, row.followerGrowth, row.content, row.activity]),
  ]);

  const platforms = csvRows([
    [
      "platform", "platform_username", "followers", "following", "posts", "comments", "media",
      "total_views", "total_likes", "total_comments", "total_shares", "watch_time_seconds",
      "engagement_rate", "follower_growth",
    ],
    ...data.platformComparison.map((p) => [
      p.platform,
      p.platformUsername,
      p.followerCount,
      p.followingCount,
      p.postCount,
      p.commentCount,
      p.mediaCount,
      p.totalViews,
      p.totalLikes,
      p.totalComments,
      p.totalShares,
      p.watchTimeSeconds,
      p.engagementRate,
      p.followerGrowth,
    ]),
  ]);

  const body = `${daily}\n\n${platforms}\n`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="meshme-analytics.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
