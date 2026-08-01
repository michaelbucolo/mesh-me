import {
  ALL_PLATFORM_IDS,
  MANUAL_PLATFORM_IDS,
  OAUTH_CONFIGS,
  getCallbackUrl,
  getOAuthMissingEnv,
  isPlatformOAuth,
} from "@/lib/oauth";
import { getPlatformCapability, getPlatformMessagingCapability, normalizePlatformId } from "@/lib/platform-capabilities";

// No longer exported: the connect page grouped twelve platforms behind a row of
// category tabs, and the tabs were the only importer. Twelve logos fit on one
// screen — filtering a set you can already see whole is a control that costs a
// tap and returns nothing. The field stays on the adapter (it is a true fact
// about a platform, and a future surface may sort by it); only the tab row and
// its import are gone.
type PlatformAdapterCategory =
  | "social"
  | "video"
  | "messaging"
  | "creator"
  | "music"
  | "community"
  | "portfolio";

type PlatformPermissionMode = "oauth_scope" | "manual_reference" | "derived";

export type PlatformPermissionDefinition = {
  key: string;
  label: string;
  description: string;
  mode: PlatformPermissionMode;
  required: boolean;
};

export type PlatformAdapterCapabilityKey =
  | "profile"
  | "content"
  | "messages"
  | "notifications"
  | "analytics"
  | "posting"
  | "actions";

export type SupportedPlatformAdapter = {
  id: string;
  name: string;
  authType: "oauth" | "manual";
  category: PlatformAdapterCategory;
  configured: boolean;
  missingEnv: string[];
  connectHref: string | null;
  callbackUrl: string | null;
  scopes: string[];
  permissions: PlatformPermissionDefinition[];
  capabilities: Record<PlatformAdapterCapabilityKey, boolean>;
  canSync: boolean;
  syncType: "api" | "manual";
  syncCadence: string;
  docsUrl: string | null;
  policyUrl: string | null;
  notes: string;
  compliance: {
    officialApiOnly: boolean;
    noScraping: boolean;
    noCredentialCollection: boolean;
    userInitiatedWritesOnly: boolean;
  };
};

// Derived from lib/platforms.ts so this cannot drift from what the product
// offers. The literal map below is retained only for platforms whose category
// differs from the allow-list's, and is filtered by it at the bottom.
const CATEGORY_BY_PLATFORM: Record<string, PlatformAdapterCategory> = {
  applemusic: "music",
  behance: "portfolio",
  bluesky: "social",
  devto: "portfolio",
  discord: "messaging",
  dribbble: "portfolio",
  facebook: "social",
  github: "portfolio",
  instagram: "social",
  kakao: "messaging",
  line: "messaging",
  linkedin: "social",
  mastodon: "social",
  medium: "creator",
  messenger: "messaging",
  patreon: "creator",
  pinterest: "social",
  reddit: "community",
  signal: "messaging",
  snapchat: "social",
  soundcloud: "music",
  spotify: "music",
  substack: "creator",
  telegram: "messaging",
  threads: "social",
  tiktok: "video",
  tumblr: "social",
  twitch: "video",
  twitter: "social",
  viber: "messaging",
  wechat: "messaging",
  whatsapp: "messaging",
  youtube: "video",
};

const SCOPE_LABELS: Record<string, string> = {
  "campaigns.posts": "Read creator posts",
  email: "Read email",
  guilds: "Read Discord servers",
  identify: "Read profile identity",
  identity: "Read account identity",
  "identity[email]": "Read account email",
  "moderator:read:followers": "Read channel followers",
  openid: "OpenID identity",
  profile: "Read profile",
  public: "Read public profile",
  read: "Read content",
  public_profile: "Read public profile",
  "read:user": "Read user profile",
  "threads_basic": "Read Threads profile",
  "threads_content_publish": "Publish Threads content",
  "threads_manage_insights": "Read Threads insights",
  "threads_read_replies": "Read Threads replies",
  "tweet.read": "Read posts",
  "user.info.basic": "Read basic profile",
  "user:read:email": "Read email",
  "user:read:follows": "Read follows",
  "user_accounts:read": "Read account profile",
  "user-read-email": "Read email",
  "user-read-private": "Read private profile",
  "users.read": "Read users",
  "offline.access": "Keep connection active",
  "pages_show_list": "Read page connections",
  "instagram_basic": "Read Instagram profile",
};

function humanizePermissionKey(key: string) {
  const cleaned = key
    .replace(/^https:\/\/www\.googleapis\.com\/auth\//, "")
    .replace(/^https:\/\/auth\.snapchat\.com\/oauth2\/api\//, "")
    .replace(/[._:/[\]-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "Permission";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function describeScope(scope: string, platformName: string) {
  if (scope.includes("readonly") || scope.includes(".read") || scope.includes(":read") || scope.includes("read:")) {
    return `Allows Mesh.me to read ${platformName} data you authorize.`;
  }

  if (scope.includes("publish") || scope.includes("write") || scope.includes("manage")) {
    return `Allows user-initiated ${platformName} actions only when the provider approves the app and scope.`;
  }

  if (scope.includes("offline")) {
    return `Allows Mesh.me to refresh this ${platformName} connection without asking you to reconnect every session.`;
  }

  return `Allows Mesh.me to use this ${platformName} OAuth scope only for your connected account.`;
}

function buildScopePermissions(scopes: string[], platformName: string): PlatformPermissionDefinition[] {
  if (scopes.length === 0) {
    return [
      {
        key: "oauth_profile",
        label: "Read profile",
        description: `Allows Mesh.me to verify your ${platformName} account identity after OAuth.`,
        mode: "derived",
        required: true,
      },
    ];
  }

  return scopes.map((scope) => ({
    key: scope,
    label: SCOPE_LABELS[scope] ?? humanizePermissionKey(scope),
    description: describeScope(scope, platformName),
    mode: "oauth_scope" as const,
    required: true,
  }));
}

function buildManualPermissions(platformName: string): PlatformPermissionDefinition[] {
  return [
    {
      key: "manual_profile_reference",
      label: "Profile reference",
      description: `Stores the ${platformName} username or handle you typed. Mesh.me does not collect your password.`,
      mode: "manual_reference",
      required: true,
    },
    {
      key: "manual_source_label",
      label: "Source label",
      description: `Shows ${platformName} as the source when this account appears in your Mesh.`,
      mode: "manual_reference",
      required: true,
    },
  ];
}

function getCategory(platform: string): PlatformAdapterCategory {
  return CATEGORY_BY_PLATFORM[platform] ?? "social";
}

function getCapabilities(platform: string): Record<PlatformAdapterCapabilityKey, boolean> {
  const capability = getPlatformCapability(platform);

  return {
    profile: true,
    content: Boolean(capability?.importContent),
    // Read from the messaging table rather than a second boolean kept beside
    // it. There used to be a `messageSync` flag here, and it said `false` for
    // X and Reddit while `syncDirectMessagesIntoMeChat` was actively mirroring
    // their DMs — because the sync path gates on the messaging table and this
    // badge gated on the flag. Two sources of truth, disagreeing, and the one
    // the user could see was the wrong one. There is now only the table.
    messages: getPlatformMessagingCapability(platform).supported,
    notifications: Boolean(capability?.notificationSync),
    analytics: Boolean(capability?.importContent),
    posting: Boolean(capability?.crossPost),
    actions: Boolean(capability?.interactionSync),
  };
}

export function getSupportedPlatformAdapter(platform: string): SupportedPlatformAdapter | null {
  const id = normalizePlatformId(platform);
  const capability = getPlatformCapability(id);
  const config = isPlatformOAuth(id) ? OAUTH_CONFIGS[id] : null;
  const authType = config ? "oauth" : "manual";
  const name = config?.name ?? capability?.name ?? id.charAt(0).toUpperCase() + id.slice(1);
  const missingEnv = config ? getOAuthMissingEnv(config) : [];
  const scopes = config?.scopes ?? [];
  const capabilities = getCapabilities(id);

  if (!config && !MANUAL_PLATFORM_IDS.includes(id)) return null;

  return {
    id,
    name,
    authType,
    category: getCategory(id),
    configured: authType === "manual" || missingEnv.length === 0,
    missingEnv,
    connectHref: authType === "oauth" ? `/api/auth/${id}` : null,
    callbackUrl: authType === "oauth" ? getCallbackUrl(id) : null,
    scopes,
    permissions: authType === "oauth" ? buildScopePermissions(scopes, name) : buildManualPermissions(name),
    capabilities,
    canSync: capabilities.content || capabilities.analytics,
    syncType: authType === "oauth" ? "api" : "manual",
    syncCadence: authType === "oauth" ? "User-triggered API sync" : "Manual profile reference",
    docsUrl: capability?.developerDocsUrl ?? null,
    policyUrl: capability?.developerPolicyUrl ?? null,
    notes: capability?.notes ?? "Manual source tracking only. Mesh.me does not scrape or impersonate this service.",
    compliance: {
      officialApiOnly: true,
      noScraping: true,
      // Neither flow collects the user's password: OAuth is a redirect/token
      // exchange and manual is a public-profile reference. (Was inverted —
      // reporting that OAuth connections collect credentials.)
      noCredentialCollection: true,
      userInitiatedWritesOnly: true,
    },
  };
}

export function getSupportedPlatformAdapters() {
  return ALL_PLATFORM_IDS
    .map((platform) => getSupportedPlatformAdapter(platform))
    .filter((adapter): adapter is SupportedPlatformAdapter => Boolean(adapter))
    .sort((a, b) => {
      if (a.category !== b.category) return a.category.localeCompare(b.category);
      return a.name.localeCompare(b.name);
    });
}

export function getDefaultPermissionKeysForPlatform(platform: string) {
  const adapter = getSupportedPlatformAdapter(platform);
  return adapter?.permissions.map((permission) => permission.key) ?? [];
}

export function getPermissionDefinition(platform: string, key: string) {
  const adapter = getSupportedPlatformAdapter(platform);
  return adapter?.permissions.find((permission) => permission.key === key) ?? null;
}
