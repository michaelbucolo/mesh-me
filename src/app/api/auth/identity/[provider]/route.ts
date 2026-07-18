import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import {
  IDENTITY_PROVIDERS,
  getIdentityCallbackUrl,
  getIdentityClientId,
  isIdentityProvider,
  isIdentityProviderConfigured,
} from "@/lib/identity-auth";
import { generatePKCE } from "@/lib/oauth";
import { safeInternalPath } from "@/lib/request-guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const requestUrl = new URL(request.url);
  const loginUrl = new URL("/login", requestUrl.origin);

  const { provider } = await params;
  if (!isIdentityProvider(provider)) {
    loginUrl.searchParams.set("error", "Unsupported sign-in provider");
    return NextResponse.redirect(loginUrl);
  }

  const config = IDENTITY_PROVIDERS[provider];
  const clientId = getIdentityClientId(provider);
  if (!clientId || !isIdentityProviderConfigured(provider)) {
    loginUrl.searchParams.set("error", `${config.name} sign-in is not available yet`);
    return NextResponse.redirect(loginUrl);
  }

  const securePrefix = process.env.NODE_ENV === "production" ? "__Host-" : "";
  const stateCookie = `${securePrefix}identity_state_${provider}`;
  const pkceCookie = `${securePrefix}identity_pkce_${provider}`;
  const nextCookie = `${securePrefix}identity_next_${provider}`;

  const state = randomBytes(32).toString("hex");
  const nonce = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  // form_post providers (Apple) return via a cross-site POST, which withholds
  // SameSite=Lax cookies. Those flows need SameSite=None (and therefore Secure).
  const crossSite = config.responseMode === "form_post";
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || crossSite,
    sameSite: crossSite ? ("none" as const) : ("lax" as const),
    maxAge: 600,
    path: "/",
  };
  cookieStore.set(stateCookie, `${state}.${nonce}`, cookieOptions);

  const nextPath = safeInternalPath(requestUrl.searchParams.get("next"), requestUrl.origin);
  if (nextPath) cookieStore.set(nextCookie, nextPath, cookieOptions);

  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getIdentityCallbackUrl(provider),
    response_type: "code",
    scope: config.scopes.join(" "),
    state,
    nonce,
  });

  if (config.responseMode === "form_post") {
    authParams.set("response_mode", "form_post");
  }

  if (config.usesPkce) {
    const pkce = await generatePKCE();
    authParams.set("code_challenge", pkce.challenge);
    authParams.set("code_challenge_method", "S256");
    cookieStore.set(pkceCookie, pkce.verifier, cookieOptions);
  }

  return NextResponse.redirect(`${config.authUrl}?${authParams.toString()}`);
}
