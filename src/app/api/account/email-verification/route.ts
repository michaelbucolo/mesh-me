import { NextResponse } from "next/server";
import { requestEmailVerification } from "@/lib/actions";
import { isSameOriginRequest } from "@/lib/request-guard";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0, private",
};

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403, headers: NO_STORE_HEADERS });
  }

  const body = await request.json().catch(() => ({}));
  const formData = new FormData();
  if (body && typeof body.email === "string") {
    formData.set("email", body.email);
  }

  const result = await requestEmailVerification(formData);
  const status = result?.error === "Not authenticated" ? 401 : result?.error ? 400 : 200;
  return NextResponse.json(result, { status, headers: NO_STORE_HEADERS });
}
