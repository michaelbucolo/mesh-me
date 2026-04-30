import { NextResponse } from "next/server";
import { getPublicSystemStatus } from "@/lib/system-status";

export async function GET() {
  const status = await getPublicSystemStatus();

  return NextResponse.json(status, {
    status: status.overallStatus === "degraded" ? 503 : 200,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
