import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getConnectedAccountsDashboard } from "@/lib/connected-accounts";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const dashboard = await getConnectedAccountsDashboard(user.id);
  const oauth = dashboard.supportedPlatforms
    .filter((platform) => platform.authType === "oauth")
    .map((platform) => ({
      ...platform,
      platform: platform.id,
      auth: "oauth",
      missingEnv: platform.missingEnv,
    }));
  const manual = dashboard.supportedPlatforms
    .filter((platform) => platform.authType === "manual")
    .map((platform) => ({
      ...platform,
      platform: platform.id,
      auth: "manual",
      missingEnv: platform.missingEnv,
    }));

  return NextResponse.json(
    { oauth, manual, platforms: dashboard.supportedPlatforms, summary: dashboard.summary },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
