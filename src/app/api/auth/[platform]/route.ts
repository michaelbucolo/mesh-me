import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { OAUTH_CONFIGS, getBaseUrl, getCallbackUrl, generatePKCE, getOAuthClientId, isPlatformOAuth } from "@/lib/oauth";
import { cookies } from "next/headers";
import { v4 as uuidv4 } from "uuid";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", getBaseUrl()));
  }

  const { platform } = await params;

  const connectedAccountsUrl = `${getBaseUrl()}/connected-accounts`;
  const encodedPlatform = encodeURIComponent(platform);

  if (!isPlatformOAuth(platform)) {
    return NextResponse.redirect(
      `${connectedAccountsUrl}?error=${encodeURIComponent("Platform does not support OAuth")}&platform=${encodedPlatform}`
    );
  }

  const config = OAUTH_CONFIGS[platform];
  const clientId = getOAuthClientId(config);

  if (!clientId) {
    return NextResponse.redirect(
      `${connectedAccountsUrl}?error=${encodeURIComponent(`OAuth not configured for ${config.name}`)}&platform=${encodedPlatform}`
    );
  }

  const oauthStateCookie = `__Host-oauth_state_${platform}`;
  const oauthPkceCookie = `__Host-oauth_pkce_${platform}`;

  // Generate state token for CSRF protection
  const state = uuidv4();
  const cookieStore = await cookies();
  cookieStore.set(oauthStateCookie, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
    scope: config.scopes.join(config.scopeDelimiter || " "),
  });

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
          secure: process.env.NODE_ENV === "production",
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
