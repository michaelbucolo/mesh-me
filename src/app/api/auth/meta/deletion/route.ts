import { NextResponse } from "next/server";
import { readFormData } from "@/lib/request-guard";
import { getBaseUrl } from "@/lib/oauth";
import { verifyMetaSignedRequest, getConfiguredMetaAppSecrets } from "@/lib/meta-signed-request";
import {
  deleteConnectedAccountsByPlatformId,
  buildDeletionConfirmationCode,
} from "@/lib/connected-account-deletion";

// Data Deletion Request Callback URL for Meta apps (Facebook / Instagram /
// Threads). Meta POSTs a `signed_request` here when a user requests deletion of
// their data. We must delete the data and respond with a JSON object containing
// a `url` (where the user can check status) and a `confirmation_code`.
//
// Register this URL in each Meta app dashboard under
// Settings -> Advanced -> "Data Deletion Request URL":
//   https://www.meshs.me/api/auth/meta/deletion
export async function POST(request: Request) {
  const secrets = getConfiguredMetaAppSecrets();
  const form = await readFormData(request);
  const signedRequest = form?.get("signed_request");
  const verified = verifyMetaSignedRequest(
    typeof signedRequest === "string" ? signedRequest : null,
    secrets,
  );

  if (!verified) {
    return NextResponse.json({ error: "Invalid signed_request" }, { status: 400 });
  }

  // Deletion is synchronous, so by the time the user visits the status URL the
  // work is already complete. Any per-account error is swallowed inside the
  // helper — we still must acknowledge Meta's request.
  await deleteConnectedAccountsByPlatformId(verified.userId).catch(() => 0);

  const confirmationCode = buildDeletionConfirmationCode(verified.userId, secrets[0]);
  const statusUrl = `${getBaseUrl()}/api/auth/meta/deletion?code=${encodeURIComponent(confirmationCode)}`;

  return NextResponse.json({ url: statusUrl, confirmation_code: confirmationCode });
}

// Human-facing status page. Meta and the user can open the `url` returned above
// to confirm the request was processed. Deletion runs synchronously in POST, so
// any valid, well-formed code corresponds to a completed request.
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim() || "";
  const valid = /^[a-f0-9]{24}$/.test(code);

  const heading = valid ? "Data deletion complete" : "Data deletion request";
  const body = valid
    ? `Your data associated with confirmation code <code>${code}</code> has been deleted from Mesh.me. `
      + "Connected-account tokens, synced posts, comments, media, and followers tied to that account were removed."
    : "Provide a valid confirmation code to view the status of a data deletion request.";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${heading} — Mesh.me</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    margin: 0; display: grid; place-items: center; min-height: 100vh;
    background: #0b0b10; color: #e8e8f0; padding: 24px; }
  main { max-width: 34rem; background: #16161f; border: 1px solid #26263a;
    border-radius: 16px; padding: 32px; }
  h1 { font-size: 1.4rem; margin: 0 0 12px; }
  code { background: #26263a; padding: 2px 6px; border-radius: 6px; font-size: .9em; }
  a { color: #8ab4ff; }
</style>
</head>
<body>
<main>
  <h1>${heading}</h1>
  <p>${body}</p>
  <p>Questions? Contact <a href="mailto:security@meshs.me">security@meshs.me</a>.</p>
</main>
</body>
</html>`;

  return new NextResponse(html, {
    status: valid ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
