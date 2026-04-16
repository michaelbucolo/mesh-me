import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncPlatform } from "@/lib/platform-sync";

// POST — automatically sync all connected accounts that haven't been synced recently
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const accounts = await prisma.connectedAccount.findMany({
      where: { userId: user.id, isActive: true },
      select: {
        id: true,
        platform: true,
        lastSyncAt: true,
        syncStatus: true,
        accessToken: true,
      },
    });

    // Only sync accounts that have access tokens and haven't synced in the last 5 minutes
    const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
    const staleAccounts = accounts.filter(
      (a) => a.accessToken && a.syncStatus !== "syncing" && (!a.lastSyncAt || a.lastSyncAt < staleThreshold),
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
          const result = await syncPlatform(account.id, "posts");
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

    return NextResponse.json({
      synced: results.filter((r) => r.success).length,
      total: staleAccounts.length,
      results,
    });
  } catch {
    return NextResponse.json({ error: "Auto-sync failed" }, { status: 500 });
  }
}
