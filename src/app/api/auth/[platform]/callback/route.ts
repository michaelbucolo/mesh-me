import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OAUTH_CONFIGS, getCallbackUrl, getBaseUrl, getNestedField, resolveNestedPath, isPlatformOAuth } from "@/lib/oauth";
import { cookies } from "next/headers";

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
    const errorDesc = url.searchParams.get("error_description") || error;
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

  // Verify state for CSRF protection
  const storedState = cookieStore.get(`oauth_state_${platform}`)?.value;
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      `${connectedAccountsUrl}?error=${encodeURIComponent("Invalid state parameter. Please try again.")}&platform=${encodedPlatform}`
    );
  }

  // Clear the state cookie
  cookieStore.delete(`oauth_state_${platform}`);

  const config = OAUTH_CONFIGS[platform];
  const clientId = process.env[config.clientIdEnv];
  const clientSecret = process.env[config.clientSecretEnv];

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
      client_id: clientId,
      client_secret: clientSecret,
    };

    // Add PKCE verifier if needed
    const pkceVerifier = cookieStore.get(`oauth_pkce_${platform}`)?.value;
    if (pkceVerifier) {
      tokenParams.code_verifier = pkceVerifier;
      cookieStore.delete(`oauth_pkce_${platform}`);
    }

    // Add extra token params
    if (config.extraTokenParams) {
      Object.assign(tokenParams, config.extraTokenParams);
    }

    const tokenHeaders: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };

    // Reddit uses HTTP Basic Auth for token exchange
    if (platform === "reddit") {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      tokenHeaders.Authorization = `Basic ${credentials}`;
      delete tokenParams.client_id;
      delete tokenParams.client_secret;
    }

    const tokenResponse = await fetch(config.tokenUrl, {
      method: "POST",
      headers: tokenHeaders,
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`Token exchange failed for ${platform}:`, errorText);
      return NextResponse.redirect(
        `${connectedAccountsUrl}?error=${encodeURIComponent("Failed to authenticate with " + config.name)}&platform=${encodedPlatform}`
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresIn = tokenData.expires_in;
    const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

    if (!accessToken) {
      return NextResponse.redirect(
        `${connectedAccountsUrl}?error=${encodeURIComponent("No access token received")}&platform=${encodedPlatform}`
      );
    }

    // Fetch user profile from the platform
    const profileHeaders: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    };

    // Twitch requires Client-ID header
    if (platform === "twitch") {
      profileHeaders["Client-ID"] = clientId;
    }

    // Reddit needs a custom User-Agent
    if (platform === "reddit") {
      profileHeaders["User-Agent"] = "mesh.me/1.0";
    }

    const profileResponse = await fetch(config.profileUrl, {
      headers: profileHeaders,
    });

    let platformUsername: string | null = null;
    let platformId: string | null = null;

    if (profileResponse.ok) {
      const profileData = await profileResponse.json();

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
      const idField = (profile as Record<string, unknown>).id;
      if (idField) {
        platformId = String(idField);
      }
    }

    // Upsert the connected account
    await prisma.connectedAccount.upsert({
      where: {
        userId_platform: { userId: user.id, platform },
      },
      update: {
        accessToken,
        refreshToken,
        expiresAt,
        platformUsername,
        platformId,
        isActive: true,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        platform,
        accessToken,
        refreshToken,
        expiresAt,
        platformUsername,
        platformId,
        isActive: true,
      },
    });

    return NextResponse.redirect(
      `${connectedAccountsUrl}?connected=${encodedPlatform}`
    );
  } catch (err) {
    console.error(`OAuth callback error for ${platform}:`, err);
    return NextResponse.redirect(
      `${connectedAccountsUrl}?error=${encodeURIComponent("Something went wrong. Please try again.")}&platform=${encodedPlatform}`
    );
  }
}
