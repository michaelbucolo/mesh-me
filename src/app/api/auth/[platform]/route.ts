import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  OAUTH_CONFIGS,
  getCallbackUrl,
  generatePKCE,
  getOAuthClientId,
  getOAuthMissingEnv,
  isPlatformOAuth,
} from "@/lib/oauth";
import { hasSecretEncryptionKey } from "@/lib/secret-store";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const requestUrl = new URL(request.url);
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", requestUrl.origin));
  }

  const { platform } = await params;

  const connectedAccountsUrl = new URL("/connected-accounts", requestUrl.origin);

  if (!isPlatformOAuth(platform)) {
    connectedAccountsUrl.searchParams.set("error", "Platform does not support OAuth");
    connectedAccountsUrl.searchParams.set("platform", platform);
    return NextResponse.redirect(
      connectedAccountsUrl
    );
  }

  const config = OAUTH_CONFIGS[platform];

  // BOTH halves, checked BEFORE anyone is sent to the provider.
  //
  // This used to test only the client id. A deployment with the id set and the
  // secret missing therefore passed here, walked the user all the way to the
  // provider's consent screen, had them approve — and only then failed, in the
  // callback, where the secret is finally needed for the token exchange. The
  // user granted real access to their account and got an error for it.
  //
  // getOAuthMissingEnv is the same function One Account renders its "Needs
  // setup" checklist from, so the button, this route, and the page can no
  // longer disagree about whether a platform is ready.
  const missingEnv = getOAuthMissingEnv(config);
  if (missingEnv.length > 0) {
    connectedAccountsUrl.searchParams.set(
      "error",
      `${config.name} is not configured on this deployment yet. Set ${missingEnv.join(" and ")}, then redeploy.`,
    );
    connectedAccountsUrl.searchParams.set("platform", platform);
    return NextResponse.redirect(
      connectedAccountsUrl
    );
  }

  // THE THIRD PRECONDITION, AND THE ONE THAT WAS STILL COSTING PEOPLE A REAL
  // AUTHORIZATION.
  //
  // The comment above describes this exact failure for the client secret. The
  // encryption key is the same shape of problem one step further along: the
  // token exchange SUCCEEDS, and then the callback refuses to store the token
  // because it cannot encrypt it. Reported from production, on every platform:
  //
  //     "This server has no encryption key set, so we could not store the
  //      connection securely. Nothing was saved."
  //
  // That message is true and it arrives far too late. By then the person has
  // signed in at the provider and granted mesh.me real access to their account
  // — access that is now live, that we did not keep, and that they have to go
  // and revoke by hand. Every attempt leaves another dead grant behind.
  //
  // hasSecretEncryptionKey() is a pure shape check over one env var, no I/O, so
  // there is no reason this was ever discovered downstream of a consent screen.
  if (!hasSecretEncryptionKey()) {
    connectedAccountsUrl.searchParams.set(
      "error",
      "This deployment has no encryption key, so a connection could not be stored securely — " +
        "you have not been sent to " + config.name + ". An admin needs to set APP_DATA_ENCRYPTION_KEY " +
        "to a 32-byte key and redeploy.",
    );
    connectedAccountsUrl.searchParams.set("platform", platform);
    return NextResponse.redirect(connectedAccountsUrl);
  }

  // Non-null by construction: missingEnv above is empty, which means both
  // halves resolved.
  const clientId = getOAuthClientId(config) as string;

  const useSecureCookiePrefix = process.env.NODE_ENV === "production";
  const oauthStateCookie = `${useSecureCookiePrefix ? "__Host-" : ""}oauth_state_${platform}`;
  const oauthPkceCookie = `${useSecureCookiePrefix ? "__Host-" : ""}oauth_pkce_${platform}`;

  // Generate state token for CSRF protection
  const state = randomBytes(32).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(oauthStateCookie, state, {
    httpOnly: true,
    secure: useSecureCookiePrefix,
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  // Build authorization URL
  const clientIdParamName = config.clientIdParam || "client_id";
  const authParams = new URLSearchParams({
    [clientIdParamName]: clientId,
    redirect_uri: getCallbackUrl(platform),
    response_type: "code",
    state,
  });

  if (config.scopes.length > 0) {
    authParams.set("scope", config.scopes.join(config.scopeDelimiter || " "));
  }

  // Add extra platform-specific params
  if (config.extraAuthParams) {
    for (const [key, value] of Object.entries(config.extraAuthParams)) {
      if (key === "code_challenge_method" && value === "S256") {
        // Generate PKCE challenge
        const pkce = await generatePKCE();
        authParams.set("code_challenge", pkce.challenge);
        authParams.set("code_challenge_method", "S256");
        // Store verifier in cookie for callback
        cookieStore.set(oauthPkceCookie, pkce.verifier, {
          httpOnly: true,
          secure: useSecureCookiePrefix,
          sameSite: "lax",
          maxAge: 600,
          path: "/",
        });
      } else {
        authParams.set(key, value);
      }
    }
  }

  const authUrl = `${config.authUrl}?${authParams.toString()}`;
  return NextResponse.redirect(authUrl);
}
