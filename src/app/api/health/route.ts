import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const startedAt = Date.now();

  try {
    await prisma.$queryRawUnsafe("SELECT 1");

    return NextResponse.json(
      {
        ok: true,
        status: "ok",
        timestamp: new Date().toISOString(),
        services: {
          database: "ok",
        },
        responseTimeMs: Date.now() - startedAt,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        ok: false,
        status: "degraded",
        timestamp: new Date().toISOString(),
        services: {
          database: "error",
        },
        responseTimeMs: Date.now() - startedAt,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  }
}
