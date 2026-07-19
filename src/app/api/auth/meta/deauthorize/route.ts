import { NextResponse } from "next/server";
import { readFormData } from "@/lib/request-guard";
import { verifyMetaSignedRequest, getConfiguredMetaAppSecrets } from "@/lib/meta-signed-request";
import { deleteConnectedAccountsByPlatformId } from "@/lib/connected-account-deletion";

// Deauthorize Callback URL for Meta apps (Facebook / Instagram / Threads).
// Meta POSTs a `signed_request` here when a user removes the app from their
// account. We verify the signature and remove the matching connected accounts.
//
// Register this URL in each Meta app dashboard under
// Settings -> Advanced -> "Deauthorize Callback URL":
//   https://www.meshs.me/api/auth/meta/deauthorize
export async function POST(request: Request) {
  const secrets = getConfiguredMetaAppSecrets();
  if (secrets.length === 0) {
    // No Meta app configured — acknowledge so Meta does not retry indefinitely.
    return NextResponse.json({ ok: true });
  }

  const form = await readFormData(request);
  const signedRequest = form?.get("signed_request");
  const verified = verifyMetaSignedRequest(
    typeof signedRequest === "string" ? signedRequest : null,
    secrets,
  );

  if (!verified) {
    return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
  }

  await deleteConnectedAccountsByPlatformId(verified.userId).catch(() => 0);

  return NextResponse.json({ ok: true });
}
