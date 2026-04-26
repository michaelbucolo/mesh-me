import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCachedSuperAppReadinessReport } from "@/lib/super-app-readiness";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const report = await getCachedSuperAppReadinessReport(user.id);
    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: "Unable to calculate super-app readiness" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({}));
  if (payload?.action !== "refresh") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  revalidateTag(`super-app-readiness:${user.id}`);

  const report = await getCachedSuperAppReadinessReport(user.id);
  return NextResponse.json(report);
}
