import { NextResponse } from "next/server";
import { cronSecretMatches } from "@/lib/cron-secret";
import { pruneExpiredSecurityData } from "@/lib/security-maintenance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!cronSecretMatches(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  try {
    const removed = await pruneExpiredSecurityData();
    return NextResponse.json({ ok: true, removed });
  } catch {
    console.error("Expired security data maintenance failed");
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
