import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { OAUTH_CONFIGS, getCallbackUrl, generatePKCE, getOAuthClientId, isPlatformOAuth } from "@/lib/oauth";
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
  const clientId = getOAuthClientId(config);

  if (!clientId) {
    connectedAccountsUrl.searchParams.set("error", `OAuth not configured for ${config.name}`);
    connectedAccountsUrl.searchParams.set("platform", platform);
    return NextResponse.redirect(
      connectedAccountsUrl
    );
  }

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
