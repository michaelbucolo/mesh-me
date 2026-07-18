// Federated identity (Sign in with Google / Apple).
// Lets people create or enter a Mesh.me account with their Google or Apple ID.
// Configuration is read from environment variables; a provider is only offered
// when its credentials are present, mirroring the platform-connect OAuth flow.

import { createSign, randomBytes } from "crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "./prisma";
import { createSession, hashPassword } from "./auth";
import { getBaseUrl } from "./oauth";

export type IdentityProvider = "google" | "apple";

export interface IdentityProviderConfig {
  provider: IdentityProvider;
  name: string;
  authUrl: string;
  tokenUrl: string;
  issuer: string;
  jwksUri: string;
  scopes: string[];
  // form_post providers (Apple) POST the result back to the callback
  responseMode?: "query" | "form_post";
  usesPkce?: boolean;
}

export const IDENTITY_PROVIDERS: Record<IdentityProvider, IdentityProviderConfig> = {
  google: {
    provider: "google",
    name: "Google",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    issuer: "https://accounts.google.com",
    jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
    scopes: ["openid", "email", "profile"],
    responseMode: "query",
    usesPkce: true,
  },
  apple: {
    provider: "apple",
    name: "Apple",
    authUrl: "https://appleid.apple.com/auth/authorize",
    tokenUrl: "https://appleid.apple.com/auth/token",
    issuer: "https://appleid.apple.com",
    jwksUri: "https://appleid.apple.com/auth/keys",
    scopes: ["name", "email"],
    responseMode: "form_post",
    usesPkce: false,
  },
};

const IDENTITY_PROVIDER_IDS = Object.keys(IDENTITY_PROVIDERS) as IdentityProvider[];

export function isIdentityProvider(value: string): value is IdentityProvider {
  return Object.hasOwn(IDENTITY_PROVIDERS, value);
}

function envValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function getIdentityClientId(provider: IdentityProvider): string | null {
  if (provider === "google") return envValue("GOOGLE_AUTH_CLIENT_ID") ?? envValue("GOOGLE_CLIENT_ID");
  return envValue("APPLE_CLIENT_ID");
}

export function getIdentityCallbackUrl(provider: IdentityProvider): string {
  return `${getBaseUrl()}/api/auth/identity/${provider}/callback`;
}

// Google uses a static client secret; Apple requires a short-lived ES256 JWT
// signed with the team's private key.
function getIdentityClientSecret(provider: IdentityProvider): string | null {
  if (provider === "google") {
    return envValue("GOOGLE_AUTH_CLIENT_SECRET") ?? envValue("GOOGLE_CLIENT_SECRET");
  }
  return buildAppleClientSecret();
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function buildAppleClientSecret(): string | null {
  const teamId = envValue("APPLE_TEAM_ID");
  const keyId = envValue("APPLE_KEY_ID");
  const clientId = envValue("APPLE_CLIENT_ID");
  const rawKey = process.env.APPLE_PRIVATE_KEY;
  if (!teamId || !keyId || !clientId || !rawKey) return null;

  // Allow the PEM to be supplied with literal "\n" sequences (common in env vars).
  const privateKey = rawKey.includes("BEGIN") ? rawKey.replace(/\\n/g, "\n") : rawKey;
  const now = Math.floor(Date.now() / 1000);

  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: teamId,
      iat: now,
      exp: now + 60 * 5,
      aud: "https://appleid.apple.com",
      sub: clientId,
    }),
  );

  const signingInput = `${header}.${payload}`;
  try {
    // JWS requires the raw r||s signature encoding for ES256.
    const signature = createSign("SHA256")
      .update(signingInput)
      .sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
    return `${signingInput}.${base64url(signature)}`;
  } catch {
    // Malformed private key — treat Apple as unconfigured rather than crashing.
    return null;
  }
}

function hasAppleCredentials(): boolean {
  return Boolean(
    envValue("APPLE_CLIENT_ID") &&
      envValue("APPLE_TEAM_ID") &&
      envValue("APPLE_KEY_ID") &&
      process.env.APPLE_PRIVATE_KEY?.trim(),
  );
}

export function isIdentityProviderConfigured(provider: IdentityProvider): boolean {
  if (provider === "google") {
    return Boolean(
      getIdentityClientId("google") &&
        (envValue("GOOGLE_AUTH_CLIENT_SECRET") ?? envValue("GOOGLE_CLIENT_SECRET")),
    );
  }
  // Apple: only check that the required env vars are present; building the
  // ES256 client secret JWT is expensive and is deferred to the token exchange.
  return hasAppleCredentials();
}

export function getConfiguredIdentityProviders(): IdentityProvider[] {
  return IDENTITY_PROVIDER_IDS.filter(isIdentityProviderConfigured);
}

export interface FederatedIdentity {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

const jwksCache = new Map<IdentityProvider, ReturnType<typeof createRemoteJWKSet>>();

function getProviderJwks(provider: IdentityProvider) {
  let jwks = jwksCache.get(provider);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(IDENTITY_PROVIDERS[provider].jwksUri));
    jwksCache.set(provider, jwks);
  }
  return jwks;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// Exchange the authorization code for tokens directly with the provider over
// TLS and read the identity from the returned id_token.
export async function exchangeIdentityCode(
  provider: IdentityProvider,
  code: string,
  options: { codeVerifier?: string | null; nonce?: string | null } = {},
): Promise<FederatedIdentity> {
  const config = IDENTITY_PROVIDERS[provider];
  const clientId = getIdentityClientId(provider);
  const clientSecret = getIdentityClientSecret(provider);
  if (!clientId || !clientSecret) {
    throw new Error(`${config.name} sign-in is not configured`);
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: getIdentityCallbackUrl(provider),
  });
  if (config.usesPkce && options.codeVerifier) {
    body.set("code_verifier", options.codeVerifier);
  }

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(`${config.name} token exchange failed`);
  }

  const tokens = (await response.json()) as { id_token?: string };
  if (!tokens.id_token) {
    throw new Error(`${config.name} did not return an identity token`);
  }

  // Verify the id_token signature against the provider's JWKS and validate the
  // issuer/audience so a forged or mis-issued token cannot grant access.
  const { payload: claims } = await jwtVerify(tokens.id_token, getProviderJwks(provider), {
    issuer: config.issuer,
    audience: clientId,
  });

  // Replay protection: the nonce in the token must match the one we issued.
  if (options.nonce && claims.nonce !== options.nonce) {
    throw new Error(`${config.name} sign-in could not be verified`);
  }

  const providerAccountId = asString(claims.sub);
  if (!providerAccountId) {
    throw new Error(`${config.name} identity token is missing a subject`);
  }

  const emailVerifiedClaim = claims.email_verified;
  const emailVerified = emailVerifiedClaim === true || emailVerifiedClaim === "true";

  return {
    providerAccountId,
    email: asString(claims.email)?.toLowerCase() ?? null,
    emailVerified,
    name: asString(claims.name),
  };
}

function sanitizeUsernameSeed(seed: string): string {
  return seed
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
}

async function generateUniqueUsername(seed: string): Promise<string> {
  let base = sanitizeUsernameSeed(seed);
  if (base.length < 3) base = `mesh${base}`;
  base = base.slice(0, 20);

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`.slice(0, 30);
    const existing = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!existing) return candidate;
  }

  return `mesh_${Date.now().toString(36)}`;
}

export interface IdentitySignInResult {
  userId: string;
  onboarded: boolean;
  created: boolean;
}

// Resolve the federated identity to a Mesh.me account, creating one on first
// use, and open a session. Existing accounts are matched first by a prior
// identity link, then by verified email.
export async function signInWithIdentity(
  provider: IdentityProvider,
  identity: FederatedIdentity,
): Promise<IdentitySignInResult> {
  const existingLink = await prisma.authIdentity.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: identity.providerAccountId } },
    select: { user: { select: { id: true, onboarded: true, isSuspended: true } } },
  });

  if (existingLink?.user) {
    if (existingLink.user.isSuspended) throw new Error("This account is unavailable");
    await createSession(existingLink.user.id);
    return { userId: existingLink.user.id, onboarded: existingLink.user.onboarded, created: false };
  }

  if (identity.email && identity.emailVerified) {
    const byEmail = await prisma.user.findUnique({
      where: { email: identity.email },
      select: { id: true, onboarded: true, isSuspended: true, emailVerified: true },
    });
    if (byEmail) {
      if (byEmail.isSuspended) throw new Error("This account is unavailable");
      // Account pre-hijacking guard: only auto-link when the *local* account's
      // email is itself verified. Signup creates users with emailVerified=false,
      // so without this an attacker could pre-register victim@example.com
      // (unverified), then have the victim's real Google/Apple login silently
      // attach to — and log into — the attacker's account. If the collision is
      // unverified, refuse and require the owner to verify via password sign-in
      // first, then link the provider from settings.
      if (!byEmail.emailVerified) {
        throw new Error(
          "An account already uses this email. Sign in with your password and verify your email, then link this provider from Settings.",
        );
      }
      await prisma.authIdentity.create({
        data: { userId: byEmail.id, provider, providerAccountId: identity.providerAccountId, email: identity.email },
      });
      await createSession(byEmail.id);
      return { userId: byEmail.id, onboarded: byEmail.onboarded, created: false };
    }
  }

  const usernameSeed = identity.email?.split("@")[0] ?? identity.name ?? provider;
  const username = await generateUniqueUsername(usernameSeed);
  const displayName = identity.name?.trim() || username;
  // Federated accounts have no password; store an unusable hash of high-entropy
  // random bytes so the column stays populated and password sign-in can never
  // succeed for them.
  const passwordHash = await hashPassword(randomBytes(48).toString("hex"));
  const email = identity.email ?? `${username}@${provider}.mesh.local`;

  const user = await prisma.user.create({
    data: {
      email,
      username,
      displayName,
      passwordHash,
      emailVerified: Boolean(identity.email && identity.emailVerified),
      isPublic: false,
      showInDiscovery: false,
      hideActivityStatus: true,
      readReceipts: false,
      nsfwEnabled: false,
      adultVerificationStatus: "unverified",
      emails: identity.email
        ? { create: { email: identity.email, isPrimary: true, isVerified: identity.emailVerified } }
        : undefined,
      meshPrivacy: {
        create: { meshVisibility: "private", showConnections: false, showStats: false },
      },
      authIdentities: {
        create: { provider, providerAccountId: identity.providerAccountId, email: identity.email },
      },
    },
    select: { id: true, onboarded: true },
  });

  await createSession(user.id);
  return { userId: user.id, onboarded: user.onboarded, created: true };
}
