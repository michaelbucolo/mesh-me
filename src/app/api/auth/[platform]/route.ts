import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { OAUTH_CONFIGS, getBaseUrl, getCallbackUrl, generatePKCE, isPlatformOAuth } from "@/lib/oauth";
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

  if (!isPlatformOAuth(platform)) {
    return NextResponse.json({ error: "Platform does not support OAuth" }, { status: 400 });
  }

  const config = OAUTH_CONFIGS[platform];
  const clientId = process.env[config.clientIdEnv];

  if (!clientId) {
    return NextResponse.json(
      { error: `OAuth not configured for ${config.name}. Missing ${config.clientIdEnv} environment variable.` },
      { status: 503 }
    );
  }

  // Generate state token for CSRF protection
  const state = uuidv4();
  const cookieStore = await cookies();
  cookieStore.set(`oauth_state_${platform}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  // Build authorization URL
  const authParams = new URLSearchParams({
    client_id: clientId,
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
        cookieStore.set(`oauth_pkce_${platform}`, pkce.verifier, {
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
