import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildAppMigrationPlan, getSupportedLegacyApps, type LegacyAppKey } from "@/lib/super-app-migration";
import { getCachedSuperAppReadinessReport } from "@/lib/super-app-readiness";

export async function GET() {
  return NextResponse.json({ apps: getSupportedLegacyApps() });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  const selectedApps = Array.isArray(payload?.apps) ? payload.apps.filter((value: unknown): value is LegacyAppKey => typeof value === "string") : [];

  if (selectedApps.length === 0) {
    return NextResponse.json({ error: "Select at least one app" }, { status: 400 });
  }

  const report = await getCachedSuperAppReadinessReport(user.id);
  const plan = buildAppMigrationPlan(selectedApps, report);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    overallScore: report.overallScore,
    plan,
  });
}
