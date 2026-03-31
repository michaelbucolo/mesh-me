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
  // How to extract username from profile response
  usernameField: string;
  // Some platforms use different param names
  scopeDelimiter?: string;
  // Extra auth params
  extraAuthParams?: Record<string, string>;
  // Extra token params
  extraTokenParams?: Record<string, string>;
  // Whether profile response nests data (e.g. { data: { ... } })
  profileDataPath?: string;
}

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
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
    scopes: ["read:user", "user:email"],
    clientIdEnv: "GITHUB_OAUTH_CLIENT_ID",
    clientSecretEnv: "GITHUB_OAUTH_CLIENT_SECRET",
    usernameField: "login",
  },
  discord: {
    platform: "discord",
    name: "Discord",
    authUrl: "https://discord.com/api/oauth2/authorize",
    tokenUrl: "https://discord.com/api/oauth2/token",
    profileUrl: "https://discord.com/api/users/@me",
    scopes: ["identify", "email"],
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
    scopes: ["user-read-private", "user-read-email"],
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
    scopes: ["tweet.read", "users.read", "offline.access"],
    clientIdEnv: "TWITTER_CLIENT_ID",
    clientSecretEnv: "TWITTER_CLIENT_SECRET",
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
    scopes: ["user:read:email"],
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
    scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    usernameField: "snippet.title",
    profileDataPath: "items.0",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  instagram: {
    platform: "instagram",
    name: "Instagram",
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    profileUrl: "https://graph.instagram.com/me?fields=id,username",
    scopes: ["instagram_basic", "pages_show_list"],
    clientIdEnv: "FACEBOOK_APP_ID",
    clientSecretEnv: "FACEBOOK_APP_SECRET",
    usernameField: "username",
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
    usernameField: "name",
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
    scopes: ["identity"],
    clientIdEnv: "REDDIT_CLIENT_ID",
    clientSecretEnv: "REDDIT_CLIENT_SECRET",
    usernameField: "name",
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
    profileUrl: "https://kit.snapchat.com/v1/me",
    scopes: ["https://auth.snapchat.com/oauth2/api/user.display_name", "https://auth.snapchat.com/oauth2/api/user.bitmoji.avatar"],
    clientIdEnv: "SNAPCHAT_CLIENT_ID",
    clientSecretEnv: "SNAPCHAT_CLIENT_SECRET",
    usernameField: "me.displayName",
  },
};

// Platforms that use manual username entry instead of OAuth
// (no standard OAuth API available or API is deprecated)
export const MANUAL_PLATFORMS = ["soundcloud", "bluesky", "threads"];

export function isPlatformOAuth(platform: string): boolean {
  return platform in OAUTH_CONFIGS;
}

export function isPlatformManual(platform: string): boolean {
  return MANUAL_PLATFORMS.includes(platform);
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
