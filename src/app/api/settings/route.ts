import { NextResponse } from "next/server";
import { getUserSettings, getBlockedUsers } from "@/lib/queries";

export async function GET() {
  const [settings, blockedUsers] = await Promise.all([
    getUserSettings(),
    getBlockedUsers(),
  ]);

  if (!settings) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  return NextResponse.json({ settings, blockedUsers });
}
