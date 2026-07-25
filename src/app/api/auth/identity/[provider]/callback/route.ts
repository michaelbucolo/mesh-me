import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  IDENTITY_PROVIDERS,
  exchangeIdentityCode,
  isIdentityProvider,
  signInWithIdentity,
  IDENTITY_USER_FACING_ERRORS,
  type FederatedIdentity,
} from "@/lib/identity-auth";
import { safeInternalPath } from "@/lib/request-guard";

function securePrefix() {
  return process.env.NODE_ENV === "production" ? "__Host-" : "";
}

function clearFlowCookies(
  store: Awaited<ReturnType<typeof cookies>>,
  provider: string,
) {
  const prefix = securePrefix();
  store.delete(`${prefix}identity_state_${provider}`);
  store.delete(`${prefix}identity_pkce_${provider}`);
  store.delete(`${prefix}identity_next_${provider}`);
}

async function handleCallback(
  request: Request,
  provider: string,
  params: { code: string | null; state: string | null; userJson: string | null },
) {
  const origin = new URL(request.url).origin;
  const loginUrl = new URL("/login", origin);

  if (!isIdentityProvider(provider)) {
    loginUrl.searchParams.set("error", "Unsupported sign-in provider");
    return NextResponse.redirect(loginUrl);
  }

  const config = IDENTITY_PROVIDERS[provider];
  const cookieStore = await cookies();
  const prefix = securePrefix();
  const storedState = cookieStore.get(`${prefix}identity_state_${provider}`)?.value ?? null;
  const codeVerifier = cookieStore.get(`${prefix}identity_pkce_${provider}`)?.value ?? null;
  // The cookie was written with this same check, but cookies are
  // client-controllable, so re-validate against our own origin before trusting it.
  const nextPath = safeInternalPath(cookieStore.get(`${prefix}identity_next_${provider}`)?.value ?? null, origin);
  const expectedNonce = storedState?.split(".")[1] ?? null;

  const failure = (message: string) => {
    clearFlowCookies(cookieStore, provider);
    loginUrl.searchParams.set("error", message);
    return NextResponse.redirect(loginUrl);
  };

  if (!params.code || !params.state) {
    return failure(`Could not complete ${config.name} sign-in`);
  }

  // CSRF: the returned state must match the one we issued.
  const expectedState = storedState?.split(".")[0];
  if (!expectedState || expectedState !== params.state) {
    return failure(`${config.name} sign-in expired. Please try again.`);
  }

  let identity: FederatedIdentity;
  try {
    identity = await exchangeIdentityCode(provider, params.code, { codeVerifier, nonce: expectedNonce });
  } catch {
    return failure(`Could not verify your ${config.name} account`);
  }

  // Apple only sends the user's name on the very first authorization.
  if (!identity.name && params.userJson) {
    try {
      const parsed = JSON.parse(params.userJson) as { name?: { firstName?: string; lastName?: string } };
      const full = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(" ").trim();
      if (full) identity = { ...identity, name: full };
    } catch {
      // Ignore malformed name payloads.
    }
  }

  try {
    const result = await signInWithIdentity(provider, identity);
    clearFlowCookies(cookieStore, provider);
    const destination = result.onboarded ? nextPath || "/mesh" : "/onboarding";
    return NextResponse.redirect(new URL(destination, origin));
  } catch (error) {
    // `failure` puts this string in `?error=` and /login renders it to the
    // visitor. signInWithIdentity throws two KINDS of Error: deliberate,
    // written-for-a-human refusals ("An account already uses this email…"), and
    // whatever the database happened to raise. Forwarding `error.message`
    // unconditionally shipped the second kind to the login screen — on
    // production's remote libSQL, a UserEmail collision arrives as a raw
    // DriverAdapterError, so the visitor was shown driver internals for a
    // situation they could do nothing about.
    //
    // Only messages this module authored are safe to show, so they are the ones
    // that get shown. Anything else is logged and reported generically.
    const message = error instanceof Error ? error.message : "";
    if (IDENTITY_USER_FACING_ERRORS.has(message)) return failure(message);
    console.error(`[identity:${provider}] sign-in failed`, error);
    return failure(`Could not sign in with ${config.name}`);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const url = new URL(request.url);
  return handleCallback(request, provider, {
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    userJson: url.searchParams.get("user"),
  });
}

// Apple uses response_mode=form_post and POSTs the result back.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const formData = await request.formData();
  return handleCallback(request, provider, {
    code: (formData.get("code") as string | null) ?? null,
    state: (formData.get("state") as string | null) ?? null,
    userJson: (formData.get("user") as string | null) ?? null,
  });
}
