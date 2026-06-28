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

function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/login") || value.startsWith("/signup")) return null;
  return value;
}

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
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600,
    path: "/",
  };
  cookieStore.set(stateCookie, `${state}.${nonce}`, cookieOptions);

  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));
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
