// OAuth configuration for all supported platforms
// Each platform uses environment variables for client ID/secret

export interface OAuthConfig {
  platform: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scopes: string[];
  clientIdEnv: string;
  clientSecretEnv: string;
  clientIdEnvAliases?: string[];
  clientSecretEnvAliases?: string[];
  // How to extract username from profile response
  usernameField: string;
  // How to extract the platform user id from profile response
  idField?: string;
  // Some platforms use different param names
  clientIdParam?: string; // defaults to "client_id", TikTok uses "client_key"
  scopeDelimiter?: string;
  tokenAuthMethod?: "client_secret_post" | "client_secret_basic";
  // Extra auth params
  extraAuthParams?: Record<string, string>;
  // Extra token params
  extraTokenParams?: Record<string, string>;
  // Whether profile response nests data (e.g. { data: { ... } })
  profileDataPath?: string;
  // Exchange the short-lived token for a long-lived one after the code exchange
  longLivedTokenExchange?: "facebook" | "instagram";
  // Endpoint used to revoke tokens when the user disconnects the account
  revokeUrl?: string;
}

// Re-exported so existing importers keep working; the value itself now has a
// single definition in app-url.ts.
export { PRODUCTION_APP_URL } from "./app-url";
import { resolveServerOrigin } from "./app-url";

// Descriptive User-Agent for outbound calls to platform APIs. Reddit's API
// Terms require a unique, descriptive User-Agent (generic ones are aggressively
// rate-limited), and GitHub requires a User-Agent identifying the app. The
// default is descriptive and contactable; set MESH_API_USER_AGENT to Reddit's
// preferred `platform:appID:version (by /u/username)` form once you have a
// Reddit developer username.
export const MESH_API_USER_AGENT =
  process.env.MESH_API_USER_AGENT?.trim() ||
  "web:app.meshs.me:v1.0 (+https://www.meshs.me)";

/**
 * The origin OAuth callbacks are built from. Server-only, which is what this
 * module is — it holds every platform's client-secret env key names.
 */
export function getBaseUrl(): string {
  return resolveServerOrigin();
}

export function getCallbackUrl(platform: string): string {
  return `${getBaseUrl()}/api/auth/${platform}/callback`;
}

export const OAUTH_CONFIGS: Record<string, OAuthConfig> = {
  github: {
    platform: "github",
    name: "GitHub",
    authUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    profileUrl: "https://api.github.com/user",
    scopes: ["read:user", "user:email", "public_repo", "user:follow"],
    clientIdEnv: "GITHUB_OAUTH_CLIENT_ID",
    clientSecretEnv: "GITHUB_OAUTH_CLIENT_SECRET",
    clientIdEnvAliases: ["GITHUB_CLIENT_ID"],
    clientSecretEnvAliases: ["GITHUB_CLIENT_SECRET"],
    usernameField: "login",
  },
  discord: {
    platform: "discord",
    name: "Discord",
    authUrl: "https://discord.com/api/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    profileUrl: "https://discord.com/api/users/@me",
    scopes: ["identify", "email", "guilds"],
    clientIdEnv: "DISCORD_CLIENT_ID",
    clientSecretEnv: "DISCORD_CLIENT_SECRET",
    usernameField: "username",
  },
  spotify: {
    platform: "spotify",
    name: "Spotify",
    authUrl: "https://accounts.spotify.com/authorize",
    tokenUrl: "https://accounts.spotify.com/api/token",
    profileUrl: "https://api.spotify.com/v1/me",
    scopes: ["user-read-private", "user-read-email", "playlist-modify-public", "playlist-modify-private", "user-follow-modify"],
    clientIdEnv: "SPOTIFY_CLIENT_ID",
    clientSecretEnv: "SPOTIFY_CLIENT_SECRET",
    usernameField: "display_name",
  },
  twitter: {
    platform: "twitter",
    name: "X / Twitter",
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    profileUrl: "https://api.twitter.com/2/users/me",
    // media.write: lets a cross-post carry its photos. Tokens granted before
    // this scope was added degrade gracefully — the upload 403s and the tweet
    // goes out text-only with an honest note asking for a reconnect.
    scopes: ["tweet.read", "tweet.write", "users.read", "like.read", "like.write", "follows.read", "follows.write", "media.write", "offline.access"],
    clientIdEnv: "TWITTER_CLIENT_ID",
    clientSecretEnv: "TWITTER_CLIENT_SECRET",
    tokenAuthMethod: "client_secret_basic",
    revokeUrl: "https://api.twitter.com/2/oauth2/revoke",
    usernameField: "username",
    profileDataPath: "data",
    extraAuthParams: { code_challenge_method: "S256" },
  },
  twitch: {
    platform: "twitch",
    name: "Twitch",
    authUrl: "https://id.twitch.tv/oauth2/authorize",
    tokenUrl: "https://id.twitch.tv/oauth2/token",
    profileUrl: "https://api.twitch.tv/helix/users",
    scopes: ["user:read:email", "user:read:follows", "moderator:read:followers"],
    clientIdEnv: "TWITCH_CLIENT_ID",
    clientSecretEnv: "TWITCH_CLIENT_SECRET",
    usernameField: "login",
    profileDataPath: "data.0",
  },
  youtube: {
    platform: "youtube",
    name: "YouTube",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    scopes: ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.force-ssl"],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    usernameField: "snippet.title",
    profileDataPath: "items.0",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
    revokeUrl: "https://oauth2.googleapis.com/revoke",
  },
  instagram: {
    platform: "instagram",
    name: "Instagram",
    authUrl: "https://www.instagram.com/oauth/authorize",
    tokenUrl: "https://api.instagram.com/oauth/access_token",
    profileUrl: "https://graph.instagram.com/v21.0/me?fields=id,user_id,username",
    scopes: ["instagram_business_basic"],
    clientIdEnv: "INSTAGRAM_APP_ID",
    clientSecretEnv: "INSTAGRAM_APP_SECRET",
    clientIdEnvAliases: ["INSTAGRAM_CLIENT_ID"],
    clientSecretEnvAliases: ["INSTAGRAM_CLIENT_SECRET"],
    usernameField: "username",
    scopeDelimiter: ",",
    longLivedTokenExchange: "instagram",
  },
  facebook: {
    platform: "facebook",
    name: "Facebook",
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    profileUrl: "https://graph.facebook.com/me?fields=id,name",
    scopes: ["public_profile", "email"],
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_APP_SECRET",
    clientIdEnvAliases: ["FACEBOOK_CLIENT_ID"],
    clientSecretEnvAliases: ["FACEBOOK_CLIENT_SECRET"],
    usernameField: "name",
    longLivedTokenExchange: "facebook",
  },
  linkedin: {
    platform: "linkedin",
    name: "LinkedIn",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    profileUrl: "https://api.linkedin.com/v2/userinfo",
    scopes: ["openid", "profile", "email"],
    clientIdEnv: "LINKEDIN_CLIENT_ID",
    clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
    usernameField: "name",
  },
  reddit: {
    platform: "reddit",
    name: "Reddit",
    authUrl: "https://www.reddit.com/api/v1/authorize",
    tokenUrl: "https://www.reddit.com/api/v1/access_token",
    profileUrl: "https://oauth.reddit.com/api/v1/me",
    scopes: ["identity", "read", "vote", "submit", "edit", "subscribe"],
    clientIdEnv: "REDDIT_CLIENT_ID",
    clientSecretEnv: "REDDIT_CLIENT_SECRET",
    usernameField: "name",
    tokenAuthMethod: "client_secret_basic",
    extraAuthParams: { duration: "permanent" },
  },
  tiktok: {
    platform: "tiktok",
    name: "TikTok",
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    profileUrl: "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,username",
    scopes: ["user.info.basic"],
    clientIdEnv: "TIKTOK_CLIENT_KEY",
    clientSecretEnv: "TIKTOK_CLIENT_SECRET",
    clientIdEnvAliases: ["TIKTOK_CLIENT_ID"],
    clientIdParam: "client_key",
    usernameField: "username",
    profileDataPath: "data.user",
    scopeDelimiter: ",",
  },
  pinterest: {
    platform: "pinterest",
    name: "Pinterest",
    authUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    profileUrl: "https://api.pinterest.com/v5/user_account",
    scopes: ["user_accounts:read"],
    clientIdEnv: "PINTEREST_APP_ID",
    clientSecretEnv: "PINTEREST_APP_SECRET",
    usernameField: "username",
  },
  snapchat: {
    platform: "snapchat",
    name: "Snapchat",
    authUrl: "https://accounts.snapchat.com/accounts/oauth2/auth",
    tokenUrl: "https://accounts.snapchat.com/accounts/oauth2/token",
    profileUrl: "https://kit.snapchat.com/v1/me?query=" + encodeURIComponent("{me{displayName externalId bitmoji{avatar}}}"),
    scopes: ["https://auth.snapchat.com/oauth2/api/user.display_name", "https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar"],
    clientIdEnv: "SNAPCHAT_CLIENT_ID",
    clientSecretEnv: "SNAPCHAT_CLIENT_SECRET",
    tokenAuthMethod: "client_secret_basic",
    usernameField: "displayName",
    idField: "externalId",
    profileDataPath: "data.me",
    extraAuthParams: { code_challenge_method: "S256" },
  },
  threads: {
    platform: "threads",
    name: "Threads",
    authUrl: "https://threads.net/oauth/authorize",
    tokenUrl: "https://graph.threads.net/oauth/access_token",
    profileUrl: "https://graph.threads.net/v1.0/me?fields=id,username",
    scopes: ["threads_basic", "threads_content_publish", "threads_manage_insights", "threads_read_replies"],
    clientIdEnv: "THREADS_CLIENT_ID",
    clientSecretEnv: "THREADS_CLIENT_SECRET",
    clientIdEnvAliases: ["THREADS_APP_ID", "FACEBOOK_APP_ID"],
    clientSecretEnvAliases: ["THREADS_APP_SECRET", "FACEBOOK_APP_SECRET"],
    usernameField: "username",
    scopeDelimiter: ",",
  },
  soundcloud: {
    platform: "soundcloud",
    name: "SoundCloud",
    authUrl: "https://secure.soundcloud.com/authorize",
    tokenUrl: "https://secure.soundcloud.com/oauth/token",
    profileUrl: "https://api.soundcloud.com/me",
    scopes: [],
    clientIdEnv: "SOUNDCLOUD_CLIENT_ID",
    clientSecretEnv: "SOUNDCLOUD_CLIENT_SECRET",
    usernameField: "username",
    extraAuthParams: { code_challenge_method: "S256" },
  },
  patreon: {
    platform: "patreon",
    name: "Patreon",
    authUrl: "https://www.patreon.com/oauth2/authorize",
    tokenUrl: "https://www.patreon.com/api/oauth2/token",
    profileUrl: "https://www.patreon.com/api/oauth2/v2/identity?fields%5Buser%5D=full_name,image_url,thumb_url,url,vanity,email",
    scopes: ["identity", "identity[email]", "campaigns.posts"],
    clientIdEnv: "PATREON_CLIENT_ID",
    clientSecretEnv: "PATREON_CLIENT_SECRET",
    usernameField: "attributes.full_name",
    profileDataPath: "data",
  },
  dribbble: {
    platform: "dribbble",
    name: "Dribbble",
    authUrl: "https://dribbble.com/oauth/authorize",
    tokenUrl: "https://dribbble.com/oauth/token",
    profileUrl: "https://api.dribbble.com/v2/user",
    scopes: ["public"],
    clientIdEnv: "DRIBBBLE_CLIENT_ID",
    clientSecretEnv: "DRIBBBLE_CLIENT_SECRET",
    usernameField: "username",
  },
};

// Platforms that use manual username entry instead of OAuth
// (no standard OAuth API available or API is deprecated)
const MANUAL_PLATFORMS = [
  "bluesky",
  "applemusic",
  "mastodon",
  "substack",
  "medium",
  "devto",
  "behance",
  "whatsapp",
  "telegram",
  "signal",
  "line",
  "kakao",
  "viber",
  "wechat",
  "messenger",
  "tumblr",
];

const OAUTH_PLATFORM_IDS = Object.keys(OAUTH_CONFIGS);
export const MANUAL_PLATFORM_IDS = [...MANUAL_PLATFORMS];
export const ALL_PLATFORM_IDS = Array.from(new Set([...OAUTH_PLATFORM_IDS, ...MANUAL_PLATFORM_IDS]));

export function isPlatformOAuth(platform: string): boolean {
  return Object.hasOwn(OAUTH_CONFIGS, platform);
}


export function isSupportedPlatform(platform: string): boolean {
  return ALL_PLATFORM_IDS.includes(platform);
}

export function resolveEnvValue(primaryName: string, aliases: string[] = []): string | null {
  const names = [primaryName, ...aliases];
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return null;
}

export function getOAuthClientId(config: OAuthConfig): string | null {
  return resolveEnvValue(config.clientIdEnv, config.clientIdEnvAliases);
}

export function getOAuthClientSecret(config: OAuthConfig): string | null {
  return resolveEnvValue(config.clientSecretEnv, config.clientSecretEnvAliases);
}

export function getOAuthMissingEnv(config: OAuthConfig): string[] {
  const missing: string[] = [];
  if (!getOAuthClientId(config)) missing.push(config.clientIdEnv);
  if (!getOAuthClientSecret(config)) missing.push(config.clientSecretEnv);
  return missing;
}

export type OAuthTokenRequest = {
  headers: Record<string, string>;
  body: URLSearchParams;
};

export function buildTokenRequest(
  config: OAuthConfig,
  params: Record<string, string>,
): OAuthTokenRequest {
  const clientId = getOAuthClientId(config);
  const clientSecret = getOAuthClientSecret(config);
  if (!clientId || !clientSecret) {
    throw new Error(`OAuth credentials are not configured for ${config.name}`);
  }

  const clientIdParamName = config.clientIdParam || "client_id";
  const body = new URLSearchParams(params);
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };

  if (config.tokenAuthMethod === "client_secret_basic" || config.platform === "reddit") {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${credentials}`;
    body.delete(clientIdParamName);
    body.delete("client_secret");
  } else {
    body.set(clientIdParamName, clientId);
    body.set("client_secret", clientSecret);
  }

  return { headers, body };
}

export function usesLongLivedTokenExchange(platform: string): boolean {
  return isPlatformOAuth(platform) && Boolean(OAUTH_CONFIGS[platform].longLivedTokenExchange);
}

// Meta access tokens are short-lived by default; exchange them for long-lived
// tokens (~60 days) so connections survive beyond the initial session.
// Mode "exchange" converts a short-lived token right after the code exchange;
// mode "refresh" extends an existing long-lived token before it expires
// (Instagram uses a dedicated refresh endpoint for that case).
export async function exchangeLongLivedToken(
  config: OAuthConfig,
  accessToken: string,
  mode: "exchange" | "refresh" = "exchange",
): Promise<{ accessToken: string; expiresAt: Date | null } | null> {
  if (!config.longLivedTokenExchange) return null;
  const clientId = getOAuthClientId(config);
  const clientSecret = getOAuthClientSecret(config);
  if (!clientId || !clientSecret) return null;

  const url = config.longLivedTokenExchange === "facebook"
    ? `https://graph.facebook.com/v21.0/oauth/access_token?${new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: clientId,
        client_secret: clientSecret,
        fb_exchange_token: accessToken,
      })}`
    : mode === "refresh"
      ? `https://graph.instagram.com/refresh_access_token?${new URLSearchParams({
          grant_type: "ig_refresh_token",
          access_token: accessToken,
        })}`
      : `https://graph.instagram.com/access_token?${new URLSearchParams({
          grant_type: "ig_exchange_token",
          client_secret: clientSecret,
          access_token: accessToken,
        })}`;

  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null) as {
      access_token?: unknown;
      expires_in?: unknown;
    } | null;
    if (typeof data?.access_token !== "string" || !data.access_token) return null;
    const expiresIn = typeof data.expires_in === "number"
      ? data.expires_in
      : typeof data.expires_in === "string" ? Number(data.expires_in) : NaN;
    return {
      accessToken: data.access_token,
      expiresAt: Number.isFinite(expiresIn) && expiresIn > 0
        ? new Date(Date.now() + expiresIn * 1000)
        : null,
    };
  } catch {
    return null;
  }
}

// Revoke a platform token when the user disconnects the account, honoring
// provider policies that require revocation on disconnect.
export async function revokeOAuthToken(
  config: OAuthConfig,
  accessToken: string,
): Promise<boolean> {
  if (!config.revokeUrl) return false;
  const clientId = getOAuthClientId(config);
  const clientSecret = getOAuthClientSecret(config);

  try {
    const body = new URLSearchParams({ token: accessToken });
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };
    if (config.tokenAuthMethod === "client_secret_basic" && clientId && clientSecret) {
      headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
      body.set("token_type_hint", "access_token");
    }
    const response = await fetch(config.revokeUrl, { method: "POST", headers, body });
    return response.ok;
  } catch {
    return false;
  }
}

// Resolve a nested path in an object, returning the value at the path (may be object, string, etc.)
export function resolveNestedPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return null;
    if (typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else if (Array.isArray(current)) {
      const index = parseInt(part);
      current = current[index];
    } else {
      return null;
    }
  }
  return current ?? null;
}

// Get a nested field from an object as a string value
export function getNestedField(obj: Record<string, unknown>, path: string): string | null {
  const value = resolveNestedPath(obj, path);
  if (typeof value === "string") return value;
  if (value !== null && value !== undefined) return String(value);
  return null;
}

// Generate PKCE code verifier and challenge for platforms that require it (e.g. Twitter)
export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const verifier = Buffer.from(array).toString("base64url");

  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const challenge = Buffer.from(digest).toString("base64url");

  return { verifier, challenge };
}
