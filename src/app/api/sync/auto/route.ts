import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncPlatform } from "@/lib/platform-sync";
import { isSameOriginRequest } from "@/lib/request-guard";
import { canImportFromPlatform } from "@/lib/platform-capabilities";
import { clearMeshCache } from "@/lib/mesh-cache";

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed", allowedMethods: ["POST"] },
    {
      status: 405,
      headers: { Allow: "POST" },
    },
  );
}

// POST — automatically sync all connected accounts that haven't been synced recently
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const accounts = await prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true, accessToken: { not: null } },
      select: {
        id: true,
        platform: true,
        lastSyncAt: true,
        syncStatus: true,
      },
    });

    // Keep accounts close to real-time by syncing anything older than 45 seconds.
    const staleThreshold = new Date(Date.now() - 45 * 1000);
    const staleAccounts = accounts.filter(
      (a) => canImportFromPlatform(a.platform) && a.syncStatus !== "syncing" && (!a.lastSyncAt || a.lastSyncAt < staleThreshold),
    );

    if (staleAccounts.length === 0) {
      return NextResponse.json({ synced: 0, message: "All accounts up to date" });
    }

    // Sync stale accounts in parallel (limit to 3 concurrent)
    const results: Array<{ platform: string; success: boolean; error?: string }> = [];
    const batches: typeof staleAccounts[] = [];
    for (let i = 0; i < staleAccounts.length; i += 3) {
      batches.push(staleAccounts.slice(i, i + 3));
    }

    for (const batch of batches) {
      const batchResults = await Promise.allSettled(
        batch.map(async (account) => {
          const result = await syncPlatform(account.id, "full");
          return { platform: account.platform, success: !result.error, error: result.error };
        }),
      );

      for (const r of batchResults) {
        if (r.status === "fulfilled") {
          results.push(r.value);
        } else {
          results.push({ platform: "unknown", success: false, error: String(r.reason) });
        }
      }
    }

    const syncedCount = results.filter((r) => r.success).length;
    // Invalidate the 45s-TTL mesh cache so freshly synced content shows up.
    if (syncedCount > 0) clearMeshCache(user.id);

    return NextResponse.json({
      synced: syncedCount,
      total: staleAccounts.length,
      results,
    });
  } catch {
    return NextResponse.json({ error: "Auto-sync failed" }, { status: 500 });
  }
}
