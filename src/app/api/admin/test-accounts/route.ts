import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { deleteVerifiedTestAccount, reviewTestAccounts } from "@/lib/fixture-cleanup";
import { isSameOriginRequest } from "@/lib/request-guard";
import { durableRateLimit } from "@/lib/durable-rate-limit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  return NextResponse.json({ accounts: await reviewTestAccounts() }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(req: Request) {
  if (!isSameOriginRequest(req)) return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user?.isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const limit = await durableRateLimit(`fixture-cleanup:${user.id}`, 20, 3600000);
  if (!limit.allowed) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== "string" || body.id.length > 200 || typeof body.username !== "string" || body.username.length > 64) {
    return NextResponse.json({ error: "Review the account and type its exact username." }, { status: 400 });
  }
  try {
    const result = await deleteVerifiedTestAccount(body.id, body.username, user.id);
    if ("error" in result) return NextResponse.json(result, { status: 409 });
    for (const path of ["/admin", "/explore", "/feed", "/search", `/profile/${body.username}`]) revalidatePath(path);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fixture cleanup failed", error);
    return NextResponse.json({ error: "The account could not be removed. Review its current state and try again." }, { status: 409 });
  }
}
