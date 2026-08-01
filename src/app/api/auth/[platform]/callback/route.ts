import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  OAUTH_CONFIGS,
  buildTokenRequest,
  getCallbackUrl,
  getBaseUrl,
  getNestedField,
  getOAuthClientId,
  getOAuthClientSecret,
  exchangeLongLivedToken,
  resolveNestedPath,
  isPlatformOAuth,
  MESH_API_USER_AGENT,
} from "@/lib/oauth";
import { serializeScopes, syncConnectedAccountPermissions } from "@/lib/platform-permissions";
import { encryptSecret, hasSecretEncryptionKey } from "@/lib/secret-store";
import { cookies } from "next/headers";
import { timingSafeEqual } from "crypto";
import { clearMeshCache } from "@/lib/mesh-cache";

/**
 * The provider's own account of why the token exchange failed, in a form safe
 * to put in a URL a user can see.
 *
 * Reads ONLY the two fields RFC 6749 §5.2 defines (`error`, `error_description`),
 * collapses whitespace, and caps the length. A provider that returns HTML or
 * nothing useful degrades to the HTTP status rather than pasting a page into a
 * query string. `redirect_uri_mismatch` is expanded, because it is the failure
 * a first-time setup actually hits and the fix is not obvious from the code.
 */
async function describeTokenFailure(response: Response): Promise<string> {
  const raw = await response.text().catch(() => "");
  let code = "";
  let description = "";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (typeof parsed.error === "string") code = parsed.error;
    else if (parsed.error && typeof parsed.error === "object") {
      const nested = parsed.error as Record<string, unknown>;
      if (typeof nested.message === "string") description = nested.message;
    }
    if (typeof parsed.error_description === "string") description = parsed.error_description;
    else if (typeof parsed.message === "string" && !description) description = parsed.message;
  } catch {
    // Not JSON — the status line is more useful than a page of markup.
  }

  const clean = (value: string) => value.replace(/\s+/g, " ").trim().slice(0, 200);
  const parts = [clean(code), clean(description)].filter(Boolean);
  if (parts.length === 0) return `The provider returned HTTP ${response.status}.`;

  const summary = parts.join(": ");
  if (/redirect_uri/i.test(summary)) {
    return `${summary} — the redirect URI registered in the provider's developer app must exactly match this deployment's callback URL.`;
  }
  return summary;
}

function safeStateEquals(storedState: string, incomingState: string) {
  if (storedState.length > 256 || incomingState.length > 256) return false;
  const stored = Buffer.from(storedState);
  const incoming = Buffer.from(incomingState);
  return stored.length === incoming.length && timingSafeEqual(stored, incoming);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const baseUrl = getBaseUrl();
  const connectedAccountsUrl = `${baseUrl}/connected-accounts`;
  const encodedPlatform = encodeURIComponent(platform);

  // Handle OAuth errors
  if (error) {
    let errorDesc = url.searchParams.get("error_description") || error;
    if (platform === "youtube" && /not completed the google verification process|unverified|access blocked/i.test(errorDesc)) {
      errorDesc = "YouTube connection is restricted to approved Google OAuth test users right now. Please contact support to be added.";
    }
    return NextResponse.redirect(
      `${connectedAccountsUrl}?error=${encodeURIComponent(errorDesc)}&platform=${encodedPlatform}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${connectedAccountsUrl}?error=${encodeURIComponent("Missing authorization code")}&platform=${encodedPlatform}`
    );
  }

  if (!isPlatformOAuth(platform)) {
    return NextResponse.redirect(
      `${connectedAccountsUrl}?error=${encodeURIComponent("Invalid platform")}&platform=${encodedPlatform}`
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  const cookieStore = await cookies();
  const oauthStateCookie = `__Host-oauth_state_${platform}`;
  const legacyOauthStateCookie = `oauth_state_${platform}`;
  const oauthPkceCookie = `__Host-oauth_pkce_${platform}`;
  const legacyOauthPkceCookie = `oauth_pkce_${platform}`;

  // Verify state for CSRF protection. The unprefixed legacy cookies are only
  // honored outside production: `__Host-` gives browser-enforced integrity
  // (Secure, host-only, Path=/), and falling back to a cookie a subdomain or
  // MITM could plant would reopen the injection vector the prefix closes.
  // Mirrors readSessionId() in auth.ts.
  const allowLegacyCookies = process.env.NODE_ENV !== "production";
  const storedState =
    cookieStore.get(oauthStateCookie)?.value ||
    (allowLegacyCookies ? cookieStore.get(legacyOauthStateCookie)?.value : undefined);
  if (!storedState || !safeStateEquals(storedState, state)) {
    return NextResponse.redirect(
      `${connectedAccountsUrl}?error=${encodeURIComponent("Invalid state parameter. Please try again.")}&platform=${encodedPlatform}`
    );
  }

  // Clear the state cookies
  cookieStore.delete(oauthStateCookie);
  cookieStore.delete(legacyOauthStateCookie);

  const config = OAUTH_CONFIGS[platform];
  const clientId = getOAuthClientId(config);
  const clientSecret = getOAuthClientSecret(config);

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${connectedAccountsUrl}?error=${encodeURIComponent("OAuth not configured for this platform")}&platform=${encodedPlatform}`
    );
  }

  try {
    // Exchange authorization code for access token
    const tokenParams: Record<string, string> = {
      grant_type: "authorization_code",
      code,
      redirect_uri: getCallbackUrl(platform),
    };

    // Add PKCE verifier if needed
    const pkceVerifier =
      cookieStore.get(oauthPkceCookie)?.value ||
      (allowLegacyCookies ? cookieStore.get(legacyOauthPkceCookie)?.value : undefined);
    if (pkceVerifier) {
      tokenParams.code_verifier = pkceVerifier;
      cookieStore.delete(oauthPkceCookie);
      cookieStore.delete(legacyOauthPkceCookie);
    }

    // Add extra token params
    if (config.extraTokenParams) {
      Object.assign(tokenParams, config.extraTokenParams);
    }

    const { headers: tokenHeaders, body: tokenBody } = buildTokenRequest(config, tokenParams);

    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: tokenHeaders,
      body: tokenBody,
    });

    if (!tokenResponse.ok) {
      // SAY WHAT THE PROVIDER SAID.
      //
      // This used to report only "Failed to authenticate with X" for every
      // possible cause, which made the most common real failure — a callback
      // URL registered in the provider's developer app that does not match
      // getCallbackUrl() byte for byte — indistinguishable from a wrong secret,
      // an unapproved scope, or an expired code. Someone setting mesh.me up saw
      // one sentence and had nothing to act on.
      //
      // OAuth 2.0 (RFC 6749 §5.2) requires the provider to return `error` and
      // optionally `error_description`, and those two fields are exactly what
      // identifies the problem. Only those two are read, they are truncated,
      // and nothing from our side of the exchange is echoed — mesh.me's own
      // client secret is in the REQUEST, never in the response body.
      const detail = await describeTokenFailure(tokenResponse);
      return NextResponse.redirect(
        `${connectedAccountsUrl}?error=${encodeURIComponent(`Failed to authenticate with ${config.name}. ${detail}`)}&platform=${encodedPlatform}`
      );
    }

    const tokenData = await tokenResponse.json().catch(() => ({}));
    let accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn = tokenData.expires_in;
    let expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
    // WHAT THE PROVIDER SAID vs WHAT WE ASKED FOR.
    //
    // Most providers return the scopes they actually granted; some return
    // nothing, and this fell back to config.scopes — the REQUEST — while
    // recording the result with source "oauth_scope", i.e. "the provider told
    // us". The connected-accounts card then counted every one of them and said
    // "N permissions granted". For any provider that omits the field, that
    // number is what Mesh.me wanted, not what the user authorized, and a user
    // who unticked a scope on the consent screen was told they had granted it.
    //
    // The fallback stays — showing nothing would be its own lie — but it is
    // labelled for what it is, and the UI stops calling it confirmed.
    const providerReportedScopes = tokenData.scope || tokenData.scopes;
    const grantedScopes = serializeScopes(providerReportedScopes || config.scopes);
    const scopeSource = providerReportedScopes ? "oauth_scope" : "assumed_from_request";

    if (!accessToken) {
      return NextResponse.redirect(
        `${connectedAccountsUrl}?error=${encodeURIComponent("No access token received")}&platform=${encodedPlatform}`
      );
    }

    if (config.longLivedTokenExchange) {
      const longLived = await exchangeLongLivedToken(config, accessToken);
      if (longLived) {
        accessToken = longLived.accessToken;
        expiresAt = longLived.expiresAt ?? expiresAt;
      }
    }

    if (!hasSecretEncryptionKey()) {
      return NextResponse.redirect(
        `${connectedAccountsUrl}?error=${encodeURIComponent("Server encryption key is not configured. Please contact support.")}&platform=${encodedPlatform}`
      );
    }

    const encryptedAccessToken = encryptSecret(accessToken);
    const encryptedRefreshToken = encryptSecret(refreshToken);

    // Fetch user profile from the platform
    const profileHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    };

    // Twitch requires Client-ID header
    if (platform === "twitch") {
      profileHeaders["Client-ID"] = clientId;
    }

    // Reddit needs a unique, descriptive User-Agent per its API Terms
    if (platform === "reddit") {
      profileHeaders["User-Agent"] = MESH_API_USER_AGENT;
    }

    const profileResponse = await fetch(config.profileUrl, {
      headers: profileHeaders,
    });

    let platformUsername: string | null = null;
    let platformId: string | null = null;

    if (profileResponse.ok) {
      const profileData = await profileResponse.json().catch(() => ({}));

      // Navigate to the right data path if needed (e.g. Twitter returns {data: {...}})
      let profile = profileData;
      if (config.profileDataPath) {
        const resolved = resolveNestedPath(profileData, config.profileDataPath);
        if (resolved && typeof resolved === "object") {
          profile = resolved;
        }
      }

      // Extract username
      platformUsername = getNestedField(
        profile as Record<string, unknown>,
        config.usernameField
      );

      // Extract platform-specific ID
      const idField = getNestedField(
        profile as Record<string, unknown>,
        config.idField || "id"
      );
      if (idField) {
        platformId = idField;
      }
    }

    // Upsert the connected account
    // With multi-account support, find existing by userId + platform + platformId
    // If platformId is null (profile fetch failed), check if user has multiple accounts
    // on this platform — if so, we can't reliably determine which to update
    if (!platformId) {
      const accountCount = await prisma.connectedAccount.count({
        where: { userId: user.id, platform },
      });
      if (accountCount > 1) {
        return NextResponse.redirect(
          `${connectedAccountsUrl}?error=Could+not+identify+which+${encodedPlatform}+account+to+update.+Please+try+again.`
        );
      }
    }

    const existingAccount = await prisma.connectedAccount.findFirst({
      where: { userId: user.id, platform, ...(platformId ? { platformId } : {}) },
    });

    const connectedAccount = await prisma.$transaction(async (tx) => {
      const account = existingAccount
        ? await tx.connectedAccount.update({
            where: { id: existingAccount.id },
            data: {
              accessToken: encryptedAccessToken,
              ...(encryptedRefreshToken ? { refreshToken: encryptedRefreshToken } : {}),
              expiresAt,
              // Don't clobber previously-good identity with null when a transient
              // profile-fetch failure left these unresolved on a reconnect.
              ...(platformUsername ? { platformUsername } : {}),
              ...(platformId ? { platformId } : {}),
              scopes: grantedScopes,
              isActive: true,
              updatedAt: new Date(),
            },
          })
        : await tx.connectedAccount.create({
            data: {
              userId: user.id,
              platform,
              accessToken: encryptedAccessToken,
              refreshToken: encryptedRefreshToken,
              expiresAt,
              platformUsername,
              platformId,
              scopes: grantedScopes,
              isActive: true,
            },
          });

      await syncConnectedAccountPermissions(tx, {
        userId: user.id,
        connectedAccountId: account.id,
        platform,
        scopes: grantedScopes,
        isActive: true,
        source: scopeSource,
      });

      return account;
    });

    if (!connectedAccount.id) {
      throw new Error("Connected account was not saved");
    }

    clearMeshCache(user.id);
    return NextResponse.redirect(
      `${connectedAccountsUrl}?connected=${encodedPlatform}`
    );
  } catch {
    return NextResponse.redirect(
      `${connectedAccountsUrl}?error=${encodeURIComponent("Something went wrong. Please try again.")}&platform=${encodedPlatform}`
    );
  }
}
