"use client";

import Link from "next/link";
import { type Dispatch, type FormEvent, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AtSign,
  BellRing,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Crown,
  Database,
  Download,
  IdCard,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  MailCheck,
  Palette,
  Phone,
  PlugZap,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Smartphone,
  Trash2,
  UserRound,
  WandSparkles,
  Waypoints,
  type LucideIcon,
} from "lucide-react";
import { AnalyticsControls } from "@/components/analytics/analytics-controls";
import {
  MeshiMascot,
  type MeshiAccessory,
  type MeshiBadge,
  type MeshiColor,
  type MeshiEyeStyle,
  type MeshiHair,
  type MeshiHat,
  type MeshiMood,
  type MeshiOutfit,
} from "@/components/meshi/meshi-mascot";
import { updateMeshiLocalPreferences } from "@/hooks/use-meshi-preferences";
import { useTheme } from "@/components/theme-provider";
import {
  changePassword,
  requestAdultVerification,
  requestEmailVerification,
  signOut,
  updateMeshCosmetics,
  updateMeshPrivacy,
  updateMeshiPreference,
  updateNsfwPreference,
  updateNotificationPreferences,
  updatePrivacy,
  updateProfile,
} from "@/lib/actions";
import { getNsfwPolicyForRegion, isAdultVerificationActive, normalizeUsState } from "@/lib/content-safety";
import { isFreeMeshiOption } from "@/lib/mesh-pro";

type SettingsSnapshot = {
  email: string | null | undefined;
  emailVerified: boolean;
  username: string;
  displayName: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  accentColor: string;
  isPublic: boolean;
  showInDiscovery: boolean;
  hideActivityStatus: boolean;
  readReceipts: boolean;
  nsfwEnabled: boolean;
  adultVerificationStatus: string;
  adultVerifiedAt: Date | string | null;
  adultVerificationExpiresAt: Date | string | null;
  adultVerificationProvider: string | null;
  adultVerificationRegion: string | null;
  isMeshPro: boolean;
  interests: Array<{ id?: string; tag: string }>;
  connectedAccounts: Array<{
    id: string;
    platform: string;
    platformUsername: string | null;
    accountLabel: string | null;
    isActive: boolean;
    lastSyncAt: Date | string | null;
    syncStatus: string;
  }>;
  links: Array<{ id: string; label: string; url: string }>;
  notificationPreference: {
    pushEnabled: boolean;
    emailDigest: string;
    messages: boolean;
    mentions: boolean;
    comments: boolean;
    follows: boolean;
    platformAlerts: boolean;
    securityAlerts: boolean;
    productUpdates: boolean;
  };
};

type MeshPrivacySnapshot = {
  meshVisibility: string;
  branchOverrides: string;
  showConnections: boolean;
  showStats: boolean;
};

type MeshiSnapshot = {
  hatStyle: string;
  faceStyle: string;
  colorTheme: string;
  hairStyle: string;
  accessoryStyle: string;
  eyeStyle: string;
  badgeStyle: string;
  outfitStyle: string;
};

type PrivacySummary = {
  sessions: number;
  dataStored: Record<string, number>;
  connections: {
    followers: number;
    following: number;
    communities: number;
  };
};

type SettingsControlCenterProps = {
  settings: SettingsSnapshot;
  meshPrivacy: MeshPrivacySnapshot;
  meshi: MeshiSnapshot;
  meshCosmetics: Array<{ type: string; value: string; isActive: boolean }>;
  privacySummary: PrivacySummary;
};

type SettingsSectionId =
  | "account"
  | "profile"
  | "privacy"
  | "notifications"
  | "security"
  | "mesh"
  | "meshi"
  | "appearance"
  | "billing"
  | "data";

const colors = ["blue", "purple", "pink", "green", "orange", "cyan", "gold"];
const colorHex: Record<string, string> = {
  blue: "#3b82f6",
  purple: "#8b5cf6",
  pink: "#ec4899",
  green: "#22c55e",
  orange: "#f97316",
  cyan: "#06b6d4",
  gold: "#f59e0b",
};
const hats = ["none", "cap", "beanie", "beret", "headband", "bow", "flower", "party", "cowboy", "graduation", "headphones", "crown", "tophat", "wizard", "astronaut", "pirate", "chef", "halo"];
const faces = ["happy", "wink", "excited", "thinking", "cool", "celebrating", "love", "shy", "giggle", "surprised"];
const hairs = ["none", "fluffy", "bangs", "spikes", "curls"];
const eyes = ["regular", "lashes"];
const accessories = ["none", "glasses", "sunglasses", "monocle", "earrings", "bowtie", "freckles", "blush", "eyepatch", "star", "mustache", "necklace"];
const badges = ["none", "spark", "heart", "shield", "verified", "creator", "founder"];
const outfits = ["none", "scarf", "hoodie", "jacket", "overalls", "turtleneck", "varsity", "tux", "cape", "spacesuit"];
const themePresets = [
  { id: "default", label: "Clean" },
  { id: "instagram", label: "Social" },
  { id: "ocean", label: "Ocean" },
  { id: "sunset", label: "Sunset" },
  { id: "forest", label: "Forest" },
  { id: "mono", label: "Mono" },
] as const;
const meshConnectionColors = ["#3b82f6", "#22c55e", "#f97316", "#ec4899", "#8b5cf6", "#f59e0b"];
const meshNodeStyles = ["clean", "soft", "glass", "bold"] as const;
const meshMotionStyles = ["calm", "lively", "minimal"] as const;
const visibilityOptions = ["private", "friends", "public", "partial"];
const branchKeys = ["people", "communities", "interests", "platforms", "content"] as const;
type BranchKey = (typeof branchKeys)[number];
const usStates = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS",
  "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
  "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY",
];

const sectionOrder: Array<{
  id: SettingsSectionId;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
}> = [
  { id: "account", label: "Account", description: "Email, sign out, delete", icon: Settings2, keywords: ["email", "username", "sign out", "logout", "delete account", "verification"] },
  { id: "profile", label: "Profile", description: "Name, bio, links", icon: UserRound, keywords: ["display name", "bio", "location", "website", "interests", "tags", "accent color"] },
  { id: "privacy", label: "Privacy", description: "Visibility and content", icon: LockKeyhole, keywords: ["public", "private", "discovery", "activity status", "read receipts", "nsfw", "sensitive", "adult"] },
  { id: "notifications", label: "Notifications", description: "Alerts and digest", icon: BellRing, keywords: ["push", "email digest", "messages", "mentions", "comments", "follows", "alerts"] },
  { id: "security", label: "Security", description: "Verification and sessions", icon: ShieldCheck, keywords: ["password", "2fa", "two-factor", "sessions", "devices", "recovery", "phone", "passkey"] },
  { id: "mesh", label: "The Mesh", description: "Map visibility and style", icon: Waypoints, keywords: ["graph", "nodes", "connections", "branches", "visibility", "motion"] },
  { id: "meshi", label: "Meshi", description: "Your character", icon: Sparkles, keywords: ["mascot", "avatar", "hat", "hair", "outfit", "accessories", "badge", "expression"] },
  { id: "appearance", label: "Appearance", description: "Theme and mode", icon: Palette, keywords: ["dark mode", "light mode", "theme", "colors", "preset", "custom"] },
  { id: "billing", label: "Billing", description: "Mesh Pro and invoices", icon: CreditCard, keywords: ["subscription", "payment", "upgrade", "pro", "invoices", "plan"] },
  { id: "data", label: "Data", description: "Export and delete data", icon: Database, keywords: ["export", "download", "storage", "records", "analytics"] },
];

function parseBranchOverrides(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch {
    return {};
  }
}

function getSettingsSectionFromHash(hash: string): SettingsSectionId | null {
  const sectionId = hash.replace(/^#/, "");
  const exists = sectionOrder.some((section) => section.id === sectionId);
  return exists ? (sectionId as SettingsSectionId) : null;
}

export function SettingsControlCenter({
  settings,
  meshPrivacy,
  meshi,
  meshCosmetics,
  privacySummary,
}: SettingsControlCenterProps) {
  const router = useRouter();
  const { mode, setMode, preset, setPreset, customTheme, setCustomTheme, clearCustomTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("account");
  const [profile, setProfile] = useState({
    displayName: settings.displayName,
    bio: settings.bio ?? "",
    location: settings.location ?? "",
    website: settings.website ?? "",
    accentColor: settings.accentColor,
    interestTags: settings.interests.map((interest) => interest.tag).join(", "),
  });
  const [privacy, setPrivacy] = useState({
    isPublic: settings.isPublic,
    showInDiscovery: settings.showInDiscovery,
    hideActivityStatus: settings.hideActivityStatus,
    readReceipts: settings.readReceipts,
  });
  const [notifications, setNotifications] = useState({
    pushEnabled: settings.notificationPreference.pushEnabled,
    emailDigest: settings.notificationPreference.emailDigest,
    messages: settings.notificationPreference.messages,
    mentions: settings.notificationPreference.mentions,
    comments: settings.notificationPreference.comments,
    follows: settings.notificationPreference.follows,
    platformAlerts: settings.notificationPreference.platformAlerts,
    securityAlerts: settings.notificationPreference.securityAlerts,
    productUpdates: settings.notificationPreference.productUpdates,
  });
  const [sensitive, setSensitive] = useState({
    nsfwEnabled: settings.nsfwEnabled,
    adultVerificationRegion: settings.adultVerificationRegion ?? "",
    adultVerificationStatus: settings.adultVerificationStatus,
    adultVerificationExpiresAt: settings.adultVerificationExpiresAt,
  });
  const [mesh, setMesh] = useState({
    meshVisibility: meshPrivacy.meshVisibility,
    showConnections: meshPrivacy.showConnections,
    showStats: meshPrivacy.showStats,
    branches: {
      people: "private",
      communities: "private",
      interests: "private",
      platforms: "private",
      content: "private",
      ...parseBranchOverrides(meshPrivacy.branchOverrides),
    } as Record<BranchKey, string>,
  });
  const [meshiState, setMeshiState] = useState({
    colorTheme: meshi.colorTheme,
    hatStyle: meshi.hatStyle,
    faceStyle: meshi.faceStyle,
    hairStyle: meshi.hairStyle,
    accessoryStyle: meshi.accessoryStyle,
    eyeStyle: meshi.eyeStyle,
    badgeStyle: meshi.badgeStyle,
    outfitStyle: meshi.outfitStyle,
  });
  const [meshVisuals, setMeshVisuals] = useState({
    connectionColor: meshCosmetics.find((cosmetic) => cosmetic.type === "connectionColor")?.value ?? "#3b82f6",
    nodeStyle: meshCosmetics.find((cosmetic) => cosmetic.type === "nodeStyle")?.value ?? "clean",
    motionStyle: meshCosmetics.find((cosmetic) => cosmetic.type === "motionStyle")?.value ?? "calm",
  });
  const [themeDraft, setThemeDraft] = useState({
    accent: customTheme?.accent ?? "#3b82f6",
    bgPrimary: customTheme?.bgPrimary ?? "#0f141b",
    bgSecondary: customTheme?.bgSecondary ?? "#151c26",
    textPrimary: customTheme?.textPrimary ?? "#f8fafc",
    textSecondary: customTheme?.textSecondary ?? "#b6c2d2",
    borderPrimary: customTheme?.borderPrimary ?? "#2d3848",
  });
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectSection = useCallback((sectionId: SettingsSectionId) => {
    setActiveSection(sectionId);
    setMobileDetailOpen(true);
    if (typeof window === "undefined") return;

    const nextHash = `#${sectionId}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", `${window.location.pathname}${nextHash}`);
    }
  }, []);

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(null), status.type === "success" ? 3200 : 7000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    const syncSectionFromHash = () => {
      const sectionId = getSettingsSectionFromHash(window.location.hash);
      if (sectionId) {
        setActiveSection(sectionId);
        setMobileDetailOpen(true);
      } else {
        setMobileDetailOpen(false);
      }
    };

    syncSectionFromHash();
    window.addEventListener("hashchange", syncSectionFromHash);
    return () => window.removeEventListener("hashchange", syncSectionFromHash);
  }, []);

  const activeSectionMeta = useMemo(
    () => sectionOrder.find((section) => section.id === activeSection) ?? sectionOrder[0],
    [activeSection],
  );
  const visibleSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sectionOrder;
    return sectionOrder.filter((section) =>
      [section.label, section.description, ...section.keywords].some((text) => text.toLowerCase().includes(query)),
    );
  }, [searchQuery]);
  const storedTotal = Object.values(privacySummary.dataStored).reduce((sum, value) => sum + value, 0);
  const adultVerified = isAdultVerificationActive({
    nsfwEnabled: sensitive.nsfwEnabled,
    adultVerificationStatus: sensitive.adultVerificationStatus,
    adultVerificationExpiresAt: sensitive.adultVerificationExpiresAt,
  });
  const nsfwPolicy = getNsfwPolicyForRegion(sensitive.adultVerificationRegion);
  const connectedCount = settings.connectedAccounts.filter((account) => account.isActive).length;

  const showMobileSectionList = useCallback(() => {
    setMobileDetailOpen(false);
    if (typeof window === "undefined" || !window.location.hash) return;
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  function runSave(label: string, task: () => Promise<unknown>) {
    startTransition(async () => {
      setStatus(null);
      try {
        const result = await task();
        if (result && typeof result === "object" && "error" in result) {
          setStatus({ type: "error", message: String((result as { error: unknown }).error) });
          return;
        }
        setStatus({ type: "success", message: `${label} saved.` });
        router.refresh();
      } catch (error) {
        setStatus({ type: "error", message: error instanceof Error ? error.message : "Save failed." });
      }
    });
  }

  function saveProfile(event: FormEvent) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("displayName", profile.displayName);
    formData.set("bio", profile.bio);
    formData.set("location", profile.location);
    formData.set("website", profile.website);
    formData.set("accentColor", profile.accentColor);
    formData.set("interests", profile.interestTags);
    runSave("Profile", () => updateProfile(formData));
  }

  function applyPrivacy(next: typeof privacy) {
    setPrivacy(next);
    const formData = new FormData();
    formData.set("isPublic", String(next.isPublic));
    formData.set("showInDiscovery", String(next.showInDiscovery));
    formData.set("hideActivityStatus", String(next.hideActivityStatus));
    formData.set("readReceipts", String(next.readReceipts));
    runSave("Privacy", () => updatePrivacy(formData));
  }

  function applyNotifications(next: typeof notifications) {
    setNotifications(next);
    const formData = new FormData();
    formData.set("pushEnabled", String(next.pushEnabled));
    formData.set("emailDigest", next.emailDigest);
    formData.set("messages", String(next.messages));
    formData.set("mentions", String(next.mentions));
    formData.set("comments", String(next.comments));
    formData.set("follows", String(next.follows));
    formData.set("platformAlerts", String(next.platformAlerts));
    formData.set("productUpdates", String(next.productUpdates));
    runSave("Notifications", () => updateNotificationPreferences(formData));
  }

  function applySensitive(next: typeof sensitive) {
    setSensitive(next);
    const formData = new FormData();
    formData.set("nsfwEnabled", String(next.nsfwEnabled && adultVerified));
    formData.set("adultVerificationRegion", normalizeUsState(next.adultVerificationRegion));
    runSave("Sensitive content", () => updateNsfwPreference(formData));
  }

  function applyMeshPrivacy(next: typeof mesh) {
    setMesh(next);
    runSave("Mesh visibility", () => updateMeshPrivacy({
      meshVisibility: next.meshVisibility,
      branchOverrides: next.branches,
      showConnections: next.showConnections,
      showStats: next.showStats,
    }));
  }

  function applyMeshVisuals(next: typeof meshVisuals) {
    setMeshVisuals(next);
    runSave("Mesh visuals", () => updateMeshCosmetics([
      { type: "connectionColor", value: next.connectionColor, isActive: true },
      { type: "nodeStyle", value: next.nodeStyle, isActive: true },
      { type: "motionStyle", value: next.motionStyle, isActive: true },
    ]));
  }

  function saveMeshi(event: FormEvent) {
    event.preventDefault();
    updateMeshiLocalPreferences({
      color: meshiState.colorTheme as MeshiColor,
      hat: meshiState.hatStyle as MeshiHat,
      face: meshiState.faceStyle as MeshiMood,
      hair: meshiState.hairStyle as MeshiHair,
      accessory: meshiState.accessoryStyle as MeshiAccessory,
      eye: meshiState.eyeStyle as MeshiEyeStyle,
      badge: meshiState.badgeStyle as MeshiBadge,
      outfit: meshiState.outfitStyle as MeshiOutfit,
    });
    runSave("Meshi", () => updateMeshiPreference({
      colorTheme: meshiState.colorTheme,
      hatStyle: meshiState.hatStyle,
      faceStyle: meshiState.faceStyle,
      hairStyle: meshiState.hairStyle,
      accessoryStyle: meshiState.accessoryStyle,
      eyeStyle: meshiState.eyeStyle,
      badgeStyle: meshiState.badgeStyle,
      outfitStyle: meshiState.outfitStyle,
    }));
  }

  function applyCustomTheme(event: FormEvent) {
    event.preventDefault();
    if (!settings.isMeshPro) {
      setStatus({ type: "error", message: "Mesh Pro is required for custom themes." });
      return;
    }
    setCustomTheme(themeDraft);
    setStatus({ type: "success", message: "Custom theme applied." });
  }

  function startAdultVerification() {
    const formData = new FormData();
    formData.set("adultVerificationRegion", normalizeUsState(sensitive.adultVerificationRegion));
    startTransition(async () => {
      setStatus(null);
      const result = await requestAdultVerification(formData);
      if (result && typeof result === "object" && "redirectUrl" in result && typeof result.redirectUrl === "string") {
        window.location.href = result.redirectUrl;
        return;
      }
      if (result && typeof result === "object" && "error" in result) {
        setSensitive((current) => ({ ...current, nsfwEnabled: false, adultVerificationStatus: "pending" }));
        setStatus({ type: "error", message: String(result.error) });
        router.refresh();
        return;
      }
      setStatus({ type: "success", message: "Adult verification started." });
      router.refresh();
    });
  }

  function sendEmailVerification() {
    const formData = new FormData();
    if (settings.email) formData.set("email", settings.email);
    startTransition(async () => {
      setStatus(null);
      const result = await requestEmailVerification(formData);
      if (result && typeof result === "object" && "error" in result) {
        setStatus({ type: "error", message: String(result.error) });
        return;
      }
      setStatus({
        type: "success",
        message: result && typeof result === "object" && "alreadyVerified" in result
          ? "Email is already verified."
          : "Verification email sent.",
      });
      router.refresh();
    });
  }

  function meshiLocked(group: Parameters<typeof isFreeMeshiOption>[0], value: string) {
    return !settings.isMeshPro && !isFreeMeshiOption(group, value);
  }

  return (
    <main className="settings-traditional flex min-h-0 flex-col lg:h-full lg:overflow-hidden animate-page-enter">
      <header className="settings-traditional-header shrink-0 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <MeshiMascot
              size={52}
              color={meshiState.colorTheme as MeshiColor}
              hat={meshiState.hatStyle as MeshiHat}
              mood={meshiState.faceStyle as MeshiMood}
              hair={meshiState.hairStyle as MeshiHair}
              accessory={meshiState.accessoryStyle as MeshiAccessory}
              eyeStyle={meshiState.eyeStyle as MeshiEyeStyle}
              badge={meshiState.badgeStyle as MeshiBadge}
              outfit={meshiState.outfitStyle as MeshiOutfit}
              showGlow={false}
              animate
              interactive
            />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-[var(--text-primary)] md:text-2xl">{settings.displayName || settings.username}</h1>
              <p className="truncate text-sm text-[var(--text-muted)]">@{settings.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/connected-accounts" className="settings-quick-link">
              <PlugZap size={15} aria-hidden="true" />
              Connections
            </Link>
            <form action={signOut}>
              <button type="submit" className="settings-quick-link settings-quick-link-primary w-full">
                <LogOut size={15} aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryPill label="Email" value={settings.emailVerified ? "Verified" : "Needs review"} icon={MailCheck} />
          <SummaryPill label="Platforms" value={`${connectedCount} connected`} icon={PlugZap} />
          <SummaryPill label="Privacy" value={settings.isPublic ? "Public profile" : "Private profile"} icon={LockKeyhole} />
          <SummaryPill label="Plan" value={settings.isMeshPro ? "Mesh Pro" : "Free"} icon={Crown} />
        </div>
      </header>

      {status && (
        <div
          className={`settings-status-toast ${
            status.type === "success"
              ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-700 dark:text-emerald-100"
              : "border-red-400/25 bg-red-500/10 text-red-700 dark:text-red-100"
          }`}
          role="status"
        >
          <div className="flex items-center gap-2">
            {status.type === "success" ? <CheckCircle2 size={15} aria-hidden="true" /> : <ShieldAlert size={15} aria-hidden="true" />}
            {status.message}
          </div>
        </div>
      )}

      <section className="settings-traditional-grid mt-3 grid min-h-0 flex-1 gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <aside className={`settings-traditional-nav overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-[var(--shadow-sm)] lg:min-h-0 ${mobileDetailOpen ? "hidden lg:block" : "block"}`}>
          <div className="settings-search px-2 pt-2">
            <div className="relative">
              <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search settings"
                aria-label="Search settings"
                className="simple-input h-10 w-full pl-9 pr-3 text-sm"
              />
            </div>
          </div>
          <nav className="settings-nav-scroll flex flex-col gap-1 overflow-x-hidden p-2 lg:grid lg:overflow-y-auto lg:overflow-x-hidden" aria-label="Settings sections">
            {visibleSections.length === 0 && (
              <p className="px-3 py-4 text-sm text-[var(--text-muted)]">No settings match &ldquo;{searchQuery.trim()}&rdquo;.</p>
            )}
            {visibleSections.map((section) => {
              const Icon = section.icon;
              const active = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => selectSection(section.id)}
                  className={`settings-nav-item w-full min-w-0 shrink-0 ${active ? "settings-nav-item-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-semibold">{section.label}</span>
                    <span className="block truncate text-xs text-[var(--text-muted)]">{section.description}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                </button>
              );
            })}
          </nav>
        </aside>

        <section className={`settings-panel rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] shadow-[var(--shadow-sm)] lg:min-h-0 lg:overflow-hidden ${mobileDetailOpen ? "block" : "hidden lg:block"}`}>
          <div className="settings-panel-heading flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-primary)] px-4 py-4">
            <div className="w-full">
              <button
                type="button"
                onClick={showMobileSectionList}
                className="mb-3 inline-flex items-center gap-1 text-sm font-bold text-[var(--accent)] lg:hidden"
              >
                <span aria-hidden="true" className="text-lg leading-none">‹</span>
                Settings
              </button>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Mesh.me settings</p>
              <h2 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{activeSectionMeta.label}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{activeSectionMeta.description}</p>
            </div>
          </div>
          <div className="settings-panel-scroll overflow-x-hidden px-4 py-4 lg:min-h-0 lg:overflow-y-auto">
            {activeSection === "account" && (
              <AccountSection
                settings={settings}
                privacySummary={privacySummary}
                storedTotal={storedTotal}
                sendEmailVerification={sendEmailVerification}
                isPending={isPending}
              />
            )}
            {activeSection === "profile" && (
              <ProfileSection
                settings={settings}
                profile={profile}
                setProfile={setProfile}
                saveProfile={saveProfile}
                isPending={isPending}
              />
            )}
            {activeSection === "privacy" && (
              <PrivacySection
                privacy={privacy}
                applyPrivacy={applyPrivacy}
                sensitive={sensitive}
                applySensitive={applySensitive}
                adultVerified={adultVerified}
                nsfwPolicy={nsfwPolicy}
                startAdultVerification={startAdultVerification}
                isPending={isPending}
              />
            )}
            {activeSection === "notifications" && (
              <NotificationsSection
                notifications={notifications}
                applyNotifications={applyNotifications}
              />
            )}
            {activeSection === "security" && (
              <SecuritySection
                settings={settings}
                privacySummary={privacySummary}
                sendEmailVerification={sendEmailVerification}
                runSave={runSave}
                isPending={isPending}
              />
            )}
            {activeSection === "mesh" && (
              <MeshSection
                mesh={mesh}
                applyMeshPrivacy={applyMeshPrivacy}
                meshVisuals={meshVisuals}
                applyMeshVisuals={applyMeshVisuals}
                isMeshPro={settings.isMeshPro}
              />
            )}
            {activeSection === "meshi" && (
              <MeshiSection
                meshiState={meshiState}
                setMeshiState={setMeshiState}
                saveMeshi={saveMeshi}
                meshiLocked={meshiLocked}
                isPending={isPending}
              />
            )}
            {activeSection === "appearance" && (
              <AppearanceSection
                mode={mode}
                setMode={setMode}
                preset={preset}
                setPreset={setPreset}
                themeDraft={themeDraft}
                setThemeDraft={setThemeDraft}
                applyCustomTheme={applyCustomTheme}
                clearCustomTheme={clearCustomTheme}
                hasCustomTheme={Boolean(customTheme)}
                isMeshPro={settings.isMeshPro}
              />
            )}
            {activeSection === "billing" && (
              <BillingSection isMeshPro={settings.isMeshPro} />
            )}
            {activeSection === "data" && (
              <DataSection privacySummary={privacySummary} storedTotal={storedTotal} />
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function AccountSection({
  settings,
  privacySummary,
  storedTotal,
  sendEmailVerification,
  isPending,
}: {
  settings: SettingsSnapshot;
  privacySummary: PrivacySummary;
  storedTotal: number;
  sendEmailVerification: () => void;
  isPending: boolean;
}) {
  return (
    <div className="settings-section-stack">
      <SettingsCard title="Account details" icon={Settings2}>
        <div className="settings-list">
          <SettingsRow label="Username" value={`@${settings.username}`} />
          <SettingsRow label="Email" value={settings.email || "No email on file"} />
          <SettingsRow label="Email verification" value={settings.emailVerified ? "Verified" : "Not verified"} />
          <SettingsRow label="Mesh Pro" value={settings.isMeshPro ? "Active" : "Free"} />
        </div>
        {!settings.emailVerified && (
          <button
            type="button"
            onClick={sendEmailVerification}
            disabled={isPending || !settings.email}
            className="mesh-action mesh-action-primary mt-4 px-4 text-sm disabled:opacity-50"
          >
            {isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <MailCheck size={15} aria-hidden="true" />}
            Send verification email
          </button>
        )}
      </SettingsCard>

      <SettingsCard title="Quick actions" icon={LogOut}>
        <div className="grid gap-2 sm:grid-cols-2">
          <form action={signOut}>
            <button type="submit" className="settings-action-row w-full">
              <span className="inline-flex items-center gap-2">
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </span>
              <span className="text-xs text-[var(--text-muted)]">This device</span>
            </button>
          </form>
          <Link href="/account/delete" className="settings-action-row settings-action-danger">
            <span className="inline-flex items-center gap-2">
              <Trash2 size={16} aria-hidden="true" />
              Delete account
            </span>
            <span className="text-xs">Permanent</span>
          </Link>
        </div>
      </SettingsCard>

      <SettingsCard title="Account snapshot" icon={Database}>
        <div className="grid gap-2 sm:grid-cols-3">
          <MetricTile label="Sessions" value={privacySummary.sessions.toLocaleString()} />
          <MetricTile label="Stored records" value={storedTotal.toLocaleString()} />
          <MetricTile label="Connections" value={(privacySummary.connections.followers + privacySummary.connections.following).toLocaleString()} />
        </div>
      </SettingsCard>
    </div>
  );
}

function ProfileSection({
  settings,
  profile,
  setProfile,
  saveProfile,
  isPending,
}: {
  settings: SettingsSnapshot;
  profile: {
    displayName: string;
    bio: string;
    location: string;
    website: string;
    accentColor: string;
    interestTags: string;
  };
  setProfile: Dispatch<SetStateAction<{
    displayName: string;
    bio: string;
    location: string;
    website: string;
    accentColor: string;
    interestTags: string;
  }>>;
  saveProfile: (event: FormEvent) => void;
  isPending: boolean;
}) {
  const visibleTags = profile.interestTags.split(/[,\n]/).map((tag) => tag.trim()).filter(Boolean).slice(0, 8);

  return (
    <form onSubmit={saveProfile} className="settings-section-stack">
      <SettingsCard title="Public profile" icon={UserRound}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Display name">
            <input
              value={profile.displayName}
              onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))}
              className="simple-input h-11 px-3 text-sm"
              maxLength={80}
            />
          </Field>
          <Field label="Accent color">
            <span className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2">
              <input
                type="color"
                value={profile.accentColor}
                onChange={(event) => setProfile((current) => ({ ...current, accentColor: event.target.value }))}
                className="simple-input h-11 w-full cursor-pointer p-1"
                aria-label="Accent color picker"
              />
              <input
                value={profile.accentColor}
                onChange={(event) => setProfile((current) => ({ ...current, accentColor: event.target.value }))}
                className="simple-input h-11 px-3 text-sm"
                placeholder="#3b82f6"
              />
            </span>
          </Field>
          <Field label="Bio" wide>
            <textarea
              value={profile.bio}
              onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
              rows={3}
              className="simple-input resize-none px-3 py-3 text-sm"
              maxLength={280}
            />
          </Field>
          <Field label="Location">
            <input
              value={profile.location}
              onChange={(event) => setProfile((current) => ({ ...current, location: event.target.value }))}
              className="simple-input h-11 px-3 text-sm"
              maxLength={80}
            />
          </Field>
          <Field label="Website">
            <input
              value={profile.website}
              onChange={(event) => setProfile((current) => ({ ...current, website: event.target.value }))}
              className="simple-input h-11 px-3 text-sm"
              placeholder="https://example.com"
            />
          </Field>
          <Field label="Interest tags" wide>
            <input
              value={profile.interestTags}
              onChange={(event) => setProfile((current) => ({ ...current, interestTags: event.target.value }))}
              className="simple-input h-11 px-3 text-sm"
              placeholder="music, creators, gaming"
            />
          </Field>
        </div>
        <SaveButton label="Save profile" pending={isPending} />
      </SettingsCard>

      <SettingsCard title="Profile preview" icon={AtSign}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="settings-muted-box">
            <p className="settings-mini-label">Public handle</p>
            <p className="mt-1 truncate text-sm font-bold">@{settings.username}</p>
            <Link href={`/profile/${settings.username}`} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[var(--accent)]">
              <LinkIcon size={13} aria-hidden="true" />
              View profile
            </Link>
          </div>
          <div className="settings-muted-box">
            <p className="settings-mini-label">Visible tags</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(visibleTags.length ? visibleTags : ["No tags yet"]).map((tag) => (
                <span key={tag} className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-bold text-[var(--text-secondary)]">
                  {tag === "No tags yet" ? tag : `#${tag.replace(/^#/, "")}`}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="settings-muted-box mt-3">
          <div className="flex items-center justify-between gap-3">
            <p className="inline-flex items-center gap-2 text-sm font-bold">
              <PlugZap size={16} aria-hidden="true" />
              Connected platforms
            </p>
            <Link href="/connected-accounts" className="text-xs font-bold text-[var(--accent)]">Manage</Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {settings.connectedAccounts.length > 0 ? settings.connectedAccounts.map((account) => (
              <span key={account.id} className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-bold capitalize text-[var(--text-secondary)]">
                {account.platform}
                {account.platformUsername ? ` @${account.platformUsername}` : ""}
              </span>
            )) : (
              <span className="text-xs text-[var(--text-muted)]">No connected platforms yet.</span>
            )}
          </div>
        </div>
      </SettingsCard>
    </form>
  );
}

function PrivacySection({
  privacy,
  applyPrivacy,
  sensitive,
  applySensitive,
  adultVerified,
  nsfwPolicy,
  startAdultVerification,
  isPending,
}: {
  privacy: { isPublic: boolean; showInDiscovery: boolean; hideActivityStatus: boolean; readReceipts: boolean };
  applyPrivacy: (next: { isPublic: boolean; showInDiscovery: boolean; hideActivityStatus: boolean; readReceipts: boolean }) => void;
  sensitive: { nsfwEnabled: boolean; adultVerificationRegion: string; adultVerificationStatus: string; adultVerificationExpiresAt: Date | string | null };
  applySensitive: (next: { nsfwEnabled: boolean; adultVerificationRegion: string; adultVerificationStatus: string; adultVerificationExpiresAt: Date | string | null }) => void;
  adultVerified: boolean;
  nsfwPolicy: { reason: string; minAge: number };
  startAdultVerification: () => void;
  isPending: boolean;
}) {
  return (
    <div className="settings-section-stack">
      <SettingsCard title="Profile privacy" icon={LockKeyhole}>
        <p className="mb-3 text-sm text-[var(--text-secondary)]">Changes save automatically.</p>
        <div className="settings-toggle-grid">
          <Toggle label="Public profile" description="Anyone can view your profile" value={privacy.isPublic} onChange={(value) => applyPrivacy({ ...privacy, isPublic: value })} />
          <Toggle label="Show in discovery" description="Appear in search and suggestions" value={privacy.showInDiscovery} onChange={(value) => applyPrivacy({ ...privacy, showInDiscovery: value })} />
          <Toggle label="Hide activity status" description="Others can't see when you're online" value={privacy.hideActivityStatus} onChange={(value) => applyPrivacy({ ...privacy, hideActivityStatus: value })} />
          <Toggle label="Read receipts" description="Let people know you've seen messages" value={privacy.readReceipts} onChange={(value) => applyPrivacy({ ...privacy, readReceipts: value })} />
        </div>
      </SettingsCard>

      <SettingsCard title="Sensitive content" icon={ShieldAlert}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
          <Field label="U.S. state for policy">
            <select
              value={sensitive.adultVerificationRegion}
              onChange={(event) => {
                const adultVerificationRegion = normalizeUsState(event.target.value);
                applySensitive({
                  ...sensitive,
                  adultVerificationRegion,
                  nsfwEnabled: adultVerified ? sensitive.nsfwEnabled : false,
                });
              }}
              className="simple-input h-11 px-3 text-sm"
            >
              <option value="">Choose state</option>
              {usStates.map((state) => <option key={state} value={state}>{state}</option>)}
            </select>
          </Field>
          <div className="settings-muted-box">
            <p className="settings-mini-label">Verification</p>
            <p className="mt-1 text-sm font-bold capitalize">{adultVerified ? "Verified" : sensitive.adultVerificationStatus || "Unverified"}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <Toggle
            label="Show NSFW content"
            description={adultVerified ? "Show sensitive content in feeds" : "Requires adult verification first"}
            value={sensitive.nsfwEnabled && adultVerified}
            disabled={!adultVerified}
            onChange={(value) => applySensitive({ ...sensitive, nsfwEnabled: adultVerified ? value : false })}
          />
          <button type="button" onClick={startAdultVerification} disabled={isPending} className="settings-action-row text-left">
            <span>
              <span className="block text-sm font-bold">Verify adult access</span>
              <span className="mt-1 block text-xs text-[var(--text-muted)]">Third-party ID check. Mesh.me stores status only.</span>
            </span>
            {isPending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <IdCard size={16} aria-hidden="true" />}
          </button>
        </div>
        <div className="settings-muted-box mt-3 text-xs leading-5 text-[var(--text-secondary)]">
          {nsfwPolicy.reason} Minimum age: {nsfwPolicy.minAge}. NSFW stays hidden until this account is verified and the setting is explicitly turned on.
        </div>
      </SettingsCard>
    </div>
  );
}

type NotificationsState = {
  pushEnabled: boolean;
  emailDigest: string;
  messages: boolean;
  mentions: boolean;
  comments: boolean;
  follows: boolean;
  platformAlerts: boolean;
  securityAlerts: boolean;
  productUpdates: boolean;
};

function NotificationsSection({
  notifications,
  applyNotifications,
}: {
  notifications: NotificationsState;
  applyNotifications: (next: NotificationsState) => void;
}) {
  return (
    <div className="settings-section-stack">
      <SettingsCard title="Notification delivery" icon={BellRing}>
        <p className="mb-3 text-sm text-[var(--text-secondary)]">Changes save automatically.</p>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
          <Toggle
            label="Push notifications"
            description="Get alerts on this device"
            value={notifications.pushEnabled}
            onChange={(value) => applyNotifications({ ...notifications, pushEnabled: value })}
          />
          <Field label="Email digest">
            <select
              value={notifications.emailDigest}
              onChange={(event) => applyNotifications({ ...notifications, emailDigest: event.target.value })}
              className="simple-input h-11 px-3 text-sm capitalize"
            >
              <option value="off">Off</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
          </Field>
        </div>
      </SettingsCard>

      <SettingsCard title="What reaches you" icon={BellRing}>
        <div className="settings-toggle-grid">
          <Toggle label="Messages" description="New direct messages" value={notifications.messages} onChange={(value) => applyNotifications({ ...notifications, messages: value })} />
          <Toggle label="Mentions" description="When someone mentions you" value={notifications.mentions} onChange={(value) => applyNotifications({ ...notifications, mentions: value })} />
          <Toggle label="Comments" description="Replies to your posts" value={notifications.comments} onChange={(value) => applyNotifications({ ...notifications, comments: value })} />
          <Toggle label="Follows" description="New followers and friend requests" value={notifications.follows} onChange={(value) => applyNotifications({ ...notifications, follows: value })} />
          <Toggle label="Platform alerts" description="Connected platform activity" value={notifications.platformAlerts} onChange={(value) => applyNotifications({ ...notifications, platformAlerts: value })} />
          <Toggle label="Product updates" description="News and feature announcements" value={notifications.productUpdates} onChange={(value) => applyNotifications({ ...notifications, productUpdates: value })} />
          <Toggle label="Security alerts" description="Always on to keep your account safe" value={notifications.securityAlerts} disabled onChange={() => undefined} />
        </div>
      </SettingsCard>
    </div>
  );
}

function SecuritySection({
  settings,
  privacySummary,
  sendEmailVerification,
  runSave,
  isPending,
}: {
  settings: SettingsSnapshot;
  privacySummary: PrivacySummary;
  sendEmailVerification: () => void;
  runSave: (label: string, task: () => Promise<unknown>) => void;
  isPending: boolean;
}) {
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  function savePassword(event: FormEvent) {
    event.preventDefault();
    const formData = new FormData();
    formData.set("currentPassword", passwords.currentPassword);
    formData.set("newPassword", passwords.newPassword);
    formData.set("confirmPassword", passwords.confirmPassword);
    runSave("Password", async () => {
      const result = await changePassword(formData);
      if (!result || !("error" in result)) {
        setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }
      return result;
    });
  }

  return (
    <div className="settings-section-stack">
      <SettingsCard title="Security status" icon={ShieldCheck}>
        <div className="settings-list">
          <SettingsRow label="Email verification" value={settings.emailVerified ? "Verified" : "Not verified"} />
          <SettingsRow label="Active sessions" value={privacySummary.sessions.toLocaleString()} />
          <SettingsRow label="Activity status" value={settings.hideActivityStatus ? "Hidden" : "Visible"} />
          <SettingsRow label="Sensitive content" value={settings.nsfwEnabled ? "Allowed after verification" : "Off"} />
        </div>
        {!settings.emailVerified && (
          <button
            type="button"
            onClick={sendEmailVerification}
            disabled={isPending || !settings.email}
            className="mesh-action mesh-action-primary mt-4 px-4 text-sm disabled:opacity-50"
          >
            {isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <MailCheck size={15} aria-hidden="true" />}
            Send verification email
          </button>
        )}
      </SettingsCard>

      <form onSubmit={savePassword}>
        <SettingsCard title="Change password" icon={KeyRound}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Current password">
              <input
                type="password"
                value={passwords.currentPassword}
                onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))}
                className="simple-input h-11 px-3 text-sm"
                autoComplete="current-password"
              />
            </Field>
            <Field label="New password">
              <input
                type="password"
                value={passwords.newPassword}
                onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))}
                className="simple-input h-11 px-3 text-sm"
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm password">
              <input
                type="password"
                value={passwords.confirmPassword}
                onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))}
                className="simple-input h-11 px-3 text-sm"
                autoComplete="new-password"
              />
            </Field>
          </div>
          <SaveButton label="Update password" pending={isPending} />
        </SettingsCard>
      </form>

      <SecurityDevices />
      <RecoveryMethods />
      <TwoFactorMethods />

      <SettingsCard title="Security shortcuts" icon={LockKeyhole}>
        <div className="grid gap-2 sm:grid-cols-3">
          <Link href="/privacy-controls" className="settings-action-row">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={16} aria-hidden="true" />
              Privacy controls
            </span>
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/connected-accounts" className="settings-action-row">
            <span className="inline-flex items-center gap-2">
              <PlugZap size={16} aria-hidden="true" />
              Connected apps
            </span>
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
          <form action={signOut}>
            <button type="submit" className="settings-action-row w-full">
              <span className="inline-flex items-center gap-2">
                <LogOut size={16} aria-hidden="true" />
                Sign out
              </span>
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </form>
        </div>
      </SettingsCard>
    </div>
  );
}

type SessionRow = {
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
};

function SecurityDevices() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/account/sessions", { cache: "no-store" });
      const payload = await response.json().catch(() => ({ error: "Could not load sessions." }));
      if (!response.ok) throw new Error(payload.error || "Could not load sessions.");
      setSessions(payload.sessions ?? []);
      setTotalSessions(payload.totalSessions ?? 0);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load sessions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  async function revokeOtherSessions() {
    setBusy(true);
    try {
      const response = await fetch("/api/account/sessions", { method: "DELETE" });
      const payload = await response.json().catch(() => ({ error: "Could not revoke sessions." }));
      if (!response.ok) throw new Error(payload.error || "Could not revoke sessions.");
      setMessage(`Signed out ${payload.deletedCount ?? 0} other session${payload.deletedCount === 1 ? "" : "s"}.`);
      await loadSessions();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not revoke sessions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsCard title="Devices and sessions" icon={Smartphone}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-secondary)]">
          {loading ? "Checking active sessions..." : `${totalSessions.toLocaleString()} active session${totalSessions === 1 ? "" : "s"}.`}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadSessions()} disabled={loading || busy} className="mesh-action mesh-action-secondary px-3 text-sm disabled:opacity-50">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden="true" />
            Refresh
          </button>
          <button type="button" onClick={revokeOtherSessions} disabled={busy || totalSessions <= 1} className="mesh-action mesh-action-primary px-3 text-sm disabled:opacity-50">
            {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <LogOut size={15} aria-hidden="true" />}
            Sign out other devices
          </button>
        </div>
      </div>
      {message && <p className="mt-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]">{message}</p>}
      <div className="mt-4 grid gap-2">
        {sessions.length > 0 ? sessions.slice(0, 4).map((session) => (
          <div key={`${session.createdAt}-${session.expiresAt}-${session.isCurrent ? "current" : "other"}`} className="settings-row">
            <span>{session.isCurrent ? "Current device" : "Other device"}</span>
            <strong>{new Date(session.expiresAt).toLocaleDateString()}</strong>
          </div>
        )) : (
          <p className="text-sm text-[var(--text-muted)]">No sessions found.</p>
        )}
      </div>
    </SettingsCard>
  );
}

type RecoveryEmail = { id: string; email: string; isPrimary?: boolean; isVerified: boolean };
type RecoveryPhone = { id: string; phone: string; isPrimary?: boolean; isVerified: boolean };

function RecoveryMethods() {
  const [emails, setEmails] = useState<RecoveryEmail[]>([]);
  const [phones, setPhones] = useState<RecoveryPhone[]>([]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadMethods = useCallback(async () => {
    setLoading(true);
    try {
      const [emailResponse, phoneResponse] = await Promise.all([
        fetch("/api/account/emails", { cache: "no-store" }),
        fetch("/api/account/phones", { cache: "no-store" }),
      ]);
      const [emailPayload, phonePayload] = await Promise.all([emailResponse.json().catch(() => ({})), phoneResponse.json().catch(() => ({}))]);
      if (!emailResponse.ok) throw new Error(emailPayload.error || "Could not load recovery emails.");
      if (!phoneResponse.ok) throw new Error(phonePayload.error || "Could not load recovery phones.");
      setEmails(emailPayload.emails ?? []);
      setPhones(phonePayload.phones ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load recovery methods.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  async function addMethod(type: "email" | "phone", event: FormEvent) {
    event.preventDefault();
    const value = type === "email" ? email.trim() : phone.trim();
    if (!value) return;
    setBusy(type);
    try {
      const response = await fetch(type === "email" ? "/api/account/emails" : "/api/account/phones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(type === "email" ? { email: value } : { phone: value }),
      });
      const payload = await response.json().catch(() => ({ error: `Could not add ${type}.` }));
      if (!response.ok) throw new Error(payload.error || `Could not add ${type}.`);
      if (type === "email") setEmail("");
      else setPhone("");
      setMessage(`${type === "email" ? "Recovery email" : "Recovery phone"} added.`);
      await loadMethods();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not add ${type}.`);
    } finally {
      setBusy(null);
    }
  }

  async function removeMethod(type: "email" | "phone", id: string) {
    setBusy(id);
    try {
      const response = await fetch(type === "email" ? "/api/account/emails" : "/api/account/phones", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(type === "email" ? { emailId: id } : { phoneId: id }),
      });
      const payload = await response.json().catch(() => ({ error: `Could not remove ${type}.` }));
      if (!response.ok) throw new Error(payload.error || `Could not remove ${type}.`);
      setMessage(`${type === "email" ? "Recovery email" : "Recovery phone"} removed.`);
      await loadMethods();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Could not remove ${type}.`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <SettingsCard title="Recovery methods" icon={Mail}>
      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={(event) => void addMethod("email", event)} className="settings-muted-box">
          <Field label="Add recovery email">
            <input value={email} onChange={(event) => setEmail(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="you@example.com" type="email" />
          </Field>
          <button type="submit" disabled={busy === "email" || !email.trim()} className="mesh-action mesh-action-primary mt-3 px-3 text-sm disabled:opacity-50">
            {busy === "email" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Mail size={15} aria-hidden="true" />}
            Add email
          </button>
        </form>
        <form onSubmit={(event) => void addMethod("phone", event)} className="settings-muted-box">
          <Field label="Add recovery phone">
            <input value={phone} onChange={(event) => setPhone(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="+15551234567" type="tel" />
          </Field>
          <button type="submit" disabled={busy === "phone" || !phone.trim()} className="mesh-action mesh-action-primary mt-3 px-3 text-sm disabled:opacity-50">
            {busy === "phone" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Phone size={15} aria-hidden="true" />}
            Add phone
          </button>
        </form>
      </div>
      {message && <p className="mt-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]">{message}</p>}
      <div className="mt-4 grid gap-2">
        {loading ? <p className="text-sm text-[var(--text-muted)]">Loading recovery methods...</p> : null}
        {[...emails.map((item) => ({ ...item, kind: "email" as const, label: item.email })), ...phones.map((item) => ({ ...item, kind: "phone" as const, label: item.phone }))].map((item) => (
          <div key={`${item.kind}-${item.id}`} className="settings-row">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="flex shrink-0 items-center gap-2">
              <strong>{item.isVerified ? "Verified" : "Unverified"}</strong>
              {!item.isPrimary && (
                <button type="button" onClick={() => void removeMethod(item.kind, item.id)} disabled={busy === item.id} className="rounded-md p-1 text-red-500 transition hover:bg-red-500/10 disabled:opacity-50" aria-label={`Remove ${item.label}`}>
                  {busy === item.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </SettingsCard>
  );
}

type TwoFactorMethod = { id: string; method: string; label: string | null; isEnabled: boolean };

function TwoFactorMethods() {
  const [methods, setMethods] = useState<TwoFactorMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadTwoFactor = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/account/two-factor", { cache: "no-store" });
      const payload = await response.json().catch(() => ({ error: "Could not load 2FA methods." }));
      if (!response.ok) throw new Error(payload.error || "Could not load 2FA methods.");
      setMethods(payload.methods ?? []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load 2FA methods.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTwoFactor();
  }, [loadTwoFactor]);

  async function addTwoFactor(method: string) {
    setBusy(method);
    try {
      const response = await fetch("/api/account/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const payload = await response.json().catch(() => ({ error: "Could not add 2FA method." }));
      if (!response.ok) throw new Error(payload.error || "Could not add 2FA method.");
      setMessage("Two-factor method added.");
      await loadTwoFactor();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add 2FA method.");
    } finally {
      setBusy(null);
    }
  }

  async function removeTwoFactor(methodId: string) {
    setBusy(methodId);
    try {
      const response = await fetch("/api/account/two-factor", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ methodId }),
      });
      const payload = await response.json().catch(() => ({ error: "Could not remove 2FA method." }));
      if (!response.ok) throw new Error(payload.error || "Could not remove 2FA method.");
      setMessage("Two-factor method removed.");
      await loadTwoFactor();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove 2FA method.");
    } finally {
      setBusy(null);
    }
  }

  const configured = new Set(methods.map((item) => item.method));

  return (
    <SettingsCard title="Two-factor authentication" icon={ShieldCheck}>
      <p className="text-sm leading-6 text-[var(--text-secondary)]">
        2FA enrollment is shown here, but the server will only enable methods when challenge verification is available.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["email", "sms", "totp", "passkey"] as const).map((method) => (
          <button
            key={method}
            type="button"
            disabled={busy !== null || configured.has(method)}
            onClick={() => void addTwoFactor(method)}
            className="mesh-action mesh-action-secondary px-3 text-sm capitalize disabled:opacity-50"
          >
            {busy === method ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ShieldCheck size={15} aria-hidden="true" />}
            {configured.has(method) ? `${method} added` : `Add ${method}`}
          </button>
        ))}
      </div>
      {message && <p className="mt-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-bold text-[var(--text-secondary)]">{message}</p>}
      <div className="mt-4 grid gap-2">
        {loading ? <p className="text-sm text-[var(--text-muted)]">Loading 2FA methods...</p> : null}
        {methods.length > 0 ? methods.map((item) => (
          <div key={item.id} className="settings-row">
            <span className="capitalize">{item.label || item.method}</span>
            <span className="flex items-center gap-2">
              <strong>{item.isEnabled ? "Enabled" : "Pending"}</strong>
              <button type="button" onClick={() => void removeTwoFactor(item.id)} disabled={busy === item.id} className="rounded-md p-1 text-red-500 transition hover:bg-red-500/10 disabled:opacity-50" aria-label={`Remove ${item.label || item.method}`}>
                {busy === item.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
              </button>
            </span>
          </div>
        )) : (
          <p className="text-sm text-[var(--text-muted)]">No 2FA methods enrolled.</p>
        )}
      </div>
    </SettingsCard>
  );
}

function MeshSection({
  mesh,
  applyMeshPrivacy,
  meshVisuals,
  applyMeshVisuals,
  isMeshPro,
}: {
  mesh: { meshVisibility: string; showConnections: boolean; showStats: boolean; branches: Record<BranchKey, string> };
  applyMeshPrivacy: (next: { meshVisibility: string; showConnections: boolean; showStats: boolean; branches: Record<BranchKey, string> }) => void;
  meshVisuals: { connectionColor: string; nodeStyle: string; motionStyle: string };
  applyMeshVisuals: (next: { connectionColor: string; nodeStyle: string; motionStyle: string }) => void;
  isMeshPro: boolean;
}) {
  return (
    <div className="settings-section-stack">
      <SettingsCard title="Mesh visibility" icon={Waypoints}>
        <p className="mb-3 text-sm text-[var(--text-secondary)]">Changes save automatically.</p>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="Overall visibility">
            <select
              value={mesh.meshVisibility}
              onChange={(event) => applyMeshPrivacy({ ...mesh, meshVisibility: event.target.value })}
              className="simple-input h-11 px-3 text-sm capitalize"
            >
              {visibilityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </Field>
          <Toggle label="Show connections" description="Display who you're connected to" value={mesh.showConnections} onChange={(value) => applyMeshPrivacy({ ...mesh, showConnections: value })} />
          <Toggle label="Show stats" description="Display counts on your mesh" value={mesh.showStats} onChange={(value) => applyMeshPrivacy({ ...mesh, showStats: value })} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {branchKeys.map((key) => (
            <label key={key} className="settings-muted-box grid gap-2 text-xs font-bold capitalize">
              {key}
              <select
                value={mesh.branches[key] ?? "friends"}
                onChange={(event) => applyMeshPrivacy({
                  ...mesh,
                  branches: { ...mesh.branches, [key]: event.target.value },
                })}
                className="simple-input h-10 px-2 text-sm capitalize"
              >
                {visibilityOptions.slice(0, 3).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard title="Mesh visuals" icon={WandSparkles}>
        {!isMeshPro && (
          <div className="settings-muted-box mb-4 flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-bold">
              <Crown size={15} aria-hidden="true" />
              Mesh Pro customization
            </span>
            <Link href="/meshpro" className="text-xs font-bold text-[var(--accent)]">Upgrade</Link>
          </div>
        )}
        <PickerGroup label="Connection color">
          {meshConnectionColors.map((color) => (
            <button
              key={color}
              type="button"
              disabled={!isMeshPro}
              onClick={() => applyMeshVisuals({ ...meshVisuals, connectionColor: color })}
              className={`mesh-choice flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${meshVisuals.connectionColor === color ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : ""} ${!isMeshPro ? "opacity-55" : ""}`}
              aria-pressed={meshVisuals.connectionColor === color}
            >
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: color }} />
              {color}
            </button>
          ))}
        </PickerGroup>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <PickerGroup label="Node style">
            {meshNodeStyles.map((style) => (
              <ChoiceButton key={style} active={meshVisuals.nodeStyle === style} disabled={!isMeshPro} onClick={() => applyMeshVisuals({ ...meshVisuals, nodeStyle: style })}>
                {style}
              </ChoiceButton>
            ))}
          </PickerGroup>
          <PickerGroup label="Motion">
            {meshMotionStyles.map((style) => (
              <ChoiceButton key={style} active={meshVisuals.motionStyle === style} disabled={!isMeshPro} onClick={() => applyMeshVisuals({ ...meshVisuals, motionStyle: style })}>
                {style}
              </ChoiceButton>
            ))}
          </PickerGroup>
        </div>
      </SettingsCard>
    </div>
  );
}

function MeshiSection({
  meshiState,
  setMeshiState,
  saveMeshi,
  meshiLocked,
  isPending,
}: {
  meshiState: {
    colorTheme: string;
    hatStyle: string;
    faceStyle: string;
    hairStyle: string;
    accessoryStyle: string;
    eyeStyle: string;
    badgeStyle: string;
    outfitStyle: string;
  };
  setMeshiState: Dispatch<SetStateAction<{
    colorTheme: string;
    hatStyle: string;
    faceStyle: string;
    hairStyle: string;
    accessoryStyle: string;
    eyeStyle: string;
    badgeStyle: string;
    outfitStyle: string;
  }>>;
  saveMeshi: (event: FormEvent) => void;
  meshiLocked: (group: Parameters<typeof isFreeMeshiOption>[0], value: string) => boolean;
  isPending: boolean;
}) {
  return (
    <form onSubmit={saveMeshi} className="settings-section-stack">
      <SettingsCard title="Meshi preview" icon={Sparkles}>
        <div className="settings-meshi-preview">
          <MeshiMascot
            size={116}
            color={meshiState.colorTheme as MeshiColor}
            hat={meshiState.hatStyle as MeshiHat}
            mood={meshiState.faceStyle as MeshiMood}
            hair={meshiState.hairStyle as MeshiHair}
            accessory={meshiState.accessoryStyle as MeshiAccessory}
            eyeStyle={meshiState.eyeStyle as MeshiEyeStyle}
            badge={meshiState.badgeStyle as MeshiBadge}
            outfit={meshiState.outfitStyle as MeshiOutfit}
            showGlow={false}
            animate
            interactive
          />
          <div>
            <h3 className="text-lg font-bold">Meshi represents you.</h3>
            <p className="mt-1 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
              Customize the same single Meshi that follows you across Mesh.me.
            </p>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard title="Customize Meshi" icon={Palette}>
        <div className="settings-picker-stack">
          <PickerGroup label="Color">
            {colors.map((color) => {
              const locked = meshiLocked("colors", color);
              return (
                <button
                  key={color}
                  type="button"
                  disabled={locked}
                  onClick={() => setMeshiState((current) => ({ ...current, colorTheme: color }))}
                  className={`mesh-choice flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold capitalize ${meshiState.colorTheme === color ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : ""} ${locked ? "cursor-not-allowed opacity-55" : ""}`}
                  aria-pressed={meshiState.colorTheme === color}
                >
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: colorHex[color] || "#3b82f6" }} />
                  {color}
                  {locked && <span className="text-[10px] text-[var(--text-muted)]">Pro</span>}
                </button>
              );
            })}
          </PickerGroup>
          <MeshiOptionGroup title="Hat" group="hats" values={hats} current={meshiState.hatStyle} meshiState={meshiState} locked={meshiLocked} onPick={(value) => setMeshiState((current) => ({ ...current, hatStyle: value }))} />
          <MeshiOptionGroup title="Hair" group="hairs" values={hairs} current={meshiState.hairStyle} meshiState={meshiState} locked={meshiLocked} onPick={(value) => setMeshiState((current) => ({ ...current, hairStyle: value }))} />
          <MeshiOptionGroup title="Eyes" group="eyes" values={eyes} current={meshiState.eyeStyle} meshiState={meshiState} locked={meshiLocked} onPick={(value) => setMeshiState((current) => ({ ...current, eyeStyle: value }))} />
          <MeshiOptionGroup title="Expression" group="faces" values={faces} current={meshiState.faceStyle} meshiState={meshiState} locked={meshiLocked} onPick={(value) => setMeshiState((current) => ({ ...current, faceStyle: value }))} />
          <MeshiOptionGroup title="Accessories" group="accessories" values={accessories} current={meshiState.accessoryStyle} meshiState={meshiState} locked={meshiLocked} onPick={(value) => setMeshiState((current) => ({ ...current, accessoryStyle: value }))} />
          <MeshiOptionGroup title="Badges" group="badges" values={badges} current={meshiState.badgeStyle} meshiState={meshiState} locked={meshiLocked} onPick={(value) => setMeshiState((current) => ({ ...current, badgeStyle: value }))} />
          <MeshiOptionGroup title="Outfits" group="outfits" values={outfits} current={meshiState.outfitStyle} meshiState={meshiState} locked={meshiLocked} onPick={(value) => setMeshiState((current) => ({ ...current, outfitStyle: value }))} />
        </div>
        <SaveButton label="Save Meshi" pending={isPending} />
      </SettingsCard>
    </form>
  );
}

function AppearanceSection({
  mode,
  setMode,
  preset,
  setPreset,
  themeDraft,
  setThemeDraft,
  applyCustomTheme,
  clearCustomTheme,
  hasCustomTheme,
  isMeshPro,
}: {
  mode: "system" | "light" | "dark";
  setMode: (mode: "system" | "light" | "dark") => void;
  preset: (typeof themePresets)[number]["id"];
  setPreset: (preset: (typeof themePresets)[number]["id"]) => void;
  themeDraft: Record<string, string>;
  setThemeDraft: Dispatch<SetStateAction<{
    accent: string;
    bgPrimary: string;
    bgSecondary: string;
    textPrimary: string;
    textSecondary: string;
    borderPrimary: string;
  }>>;
  applyCustomTheme: (event: FormEvent) => void;
  clearCustomTheme: () => void;
  hasCustomTheme: boolean;
  isMeshPro: boolean;
}) {
  return (
    <div className="settings-section-stack">
      <SettingsCard title="Appearance" icon={Palette}>
        <PickerGroup label="Mode">
          {(["system", "light", "dark"] as const).map((themeMode) => (
            <ChoiceButton key={themeMode} active={mode === themeMode} onClick={() => setMode(themeMode)}>
              {themeMode}
            </ChoiceButton>
          ))}
        </PickerGroup>
        <div className="mt-4">
          <PickerGroup label="Preset">
            {themePresets.map((themePreset) => (
              <ChoiceButton key={themePreset.id} active={preset === themePreset.id} onClick={() => setPreset(themePreset.id)}>
                {themePreset.label}
              </ChoiceButton>
            ))}
          </PickerGroup>
        </div>
      </SettingsCard>

      <form onSubmit={applyCustomTheme}>
        <SettingsCard title="Custom theme colors" icon={Crown}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
              Mesh Pro unlocks full color tuning while system light/dark mode stays available to everyone.
            </p>
            {!isMeshPro && <Link href="/meshpro" className="text-xs font-bold text-[var(--accent)]">Upgrade</Link>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(themeDraft).map(([key, value]) => (
              <label key={key} className="grid gap-2 text-xs font-bold capitalize text-[var(--text-secondary)]">
                {key.replace(/[A-Z]/g, " $&")}
                <input
                  type="color"
                  value={value}
                  disabled={!isMeshPro}
                  onChange={(event) => setThemeDraft((current) => ({ ...current, [key]: event.target.value }))}
                  className="simple-input h-11 w-full cursor-pointer p-1 disabled:opacity-50"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={!isMeshPro} className="mesh-action mesh-action-primary px-4 text-sm disabled:opacity-50">
              Apply custom theme
            </button>
            <button type="button" disabled={!isMeshPro || !hasCustomTheme} onClick={clearCustomTheme} className="mesh-action mesh-action-secondary px-4 text-sm disabled:opacity-50">
              Reset custom colors
            </button>
          </div>
        </SettingsCard>
      </form>
    </div>
  );
}

function BillingSection({ isMeshPro }: { isMeshPro: boolean }) {
  return (
    <div className="settings-section-stack">
      <SettingsCard title="Mesh Pro" icon={Crown}>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">
          {isMeshPro
            ? "Mesh Pro is active. Billing and payment methods are managed from the billing page."
            : "Mesh Pro unlocks deeper analytics, custom Mesh visuals, Meshi cosmetics, badges, and themes."}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link href="/meshpro" className="settings-action-row">
            <span className="inline-flex items-center gap-2">
              <Crown size={16} aria-hidden="true" />
              {isMeshPro ? "View Pro features" : "Upgrade to Mesh Pro"}
            </span>
            <ChevronRight size={15} aria-hidden="true" />
          </Link>
          <Link href="/billing" className="settings-action-row">
            <span className="inline-flex items-center gap-2">
              <CreditCard size={16} aria-hidden="true" />
              Billing
            </span>
            <span className="text-xs text-[var(--text-muted)]">{isMeshPro ? "Active" : "Free"}</span>
          </Link>
        </div>
      </SettingsCard>
    </div>
  );
}

function DataSection({ privacySummary, storedTotal }: { privacySummary: PrivacySummary; storedTotal: number }) {
  return (
    <div className="settings-section-stack">
      <SettingsCard title="Data controls" icon={Download}>
        <p className="text-sm leading-6 text-[var(--text-secondary)]">
          Export your Mesh.me data or remove imported platform data. Permanent account deletion stays in Account.
        </p>
        <div className="mt-4">
          <AnalyticsControls />
        </div>
      </SettingsCard>
      <SettingsCard title="Data snapshot" icon={Database}>
        <div className="grid gap-2 sm:grid-cols-3">
          <MetricTile label="Stored records" value={storedTotal.toLocaleString()} />
          <MetricTile label="Followers" value={privacySummary.connections.followers.toLocaleString()} />
          <MetricTile label="Following" value={privacySummary.connections.following.toLocaleString()} />
        </div>
        <Link href="/privacy-controls" className="mesh-action mesh-action-primary mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm">
          <ShieldCheck size={16} aria-hidden="true" />
          Privacy control center
        </Link>
      </SettingsCard>
    </div>
  );
}

function MeshiOptionGroup({
  title,
  group,
  values,
  current,
  meshiState,
  locked,
  onPick,
}: {
  title: string;
  group: Parameters<typeof isFreeMeshiOption>[0];
  values: string[];
  current: string;
  meshiState: {
    colorTheme: string;
    hatStyle: string;
    faceStyle: string;
    hairStyle: string;
    accessoryStyle: string;
    eyeStyle: string;
    badgeStyle: string;
    outfitStyle: string;
  };
  locked: (group: Parameters<typeof isFreeMeshiOption>[0], value: string) => boolean;
  onPick: (value: string) => void;
}) {
  return (
    <PickerGroup label={title}>
      {values.map((value) => {
        const disabled = locked(group, value);
        const preview = {
          color: meshiState.colorTheme as MeshiColor,
          hat: group === "hats" ? value as MeshiHat : meshiState.hatStyle as MeshiHat,
          mood: group === "faces" ? value as MeshiMood : meshiState.faceStyle as MeshiMood,
          hair: group === "hairs" ? value as MeshiHair : meshiState.hairStyle as MeshiHair,
          accessory: group === "accessories" ? value as MeshiAccessory : meshiState.accessoryStyle as MeshiAccessory,
          eyeStyle: group === "eyes" ? value as MeshiEyeStyle : meshiState.eyeStyle as MeshiEyeStyle,
          badge: group === "badges" ? value as MeshiBadge : meshiState.badgeStyle as MeshiBadge,
          outfit: group === "outfits" ? value as MeshiOutfit : meshiState.outfitStyle as MeshiOutfit,
        };

        return (
          <GraphicOptionButton key={value} active={current === value} label={value} note={disabled ? "Pro" : undefined} disabled={disabled} onClick={() => onPick(value)}>
            <MeshiMascot
              size={44}
              color={preview.color}
              hat={preview.hat}
              mood={preview.mood}
              hair={preview.hair}
              accessory={preview.accessory}
              eyeStyle={preview.eyeStyle}
              badge={preview.badge}
              outfit={preview.outfit}
              animate={false}
              showGlow={false}
            />
          </GraphicOptionButton>
        );
      })}
    </PickerGroup>
  );
}

function SettingsCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="settings-card rounded-xl border border-[var(--border-primary)] bg-[var(--bg-primary)] p-4">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          <Icon className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
        </span>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function SummaryPill({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="settings-summary-pill">
      <Icon size={15} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</span>
        <span className="block truncate text-sm font-bold text-[var(--text-primary)]">{value}</span>
      </span>
    </div>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`grid gap-2 text-sm font-bold ${wide ? "md:col-span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}

function SaveButton({ label, pending, disabled = false }: { label: string; pending: boolean; disabled?: boolean }) {
  return (
    <button type="submit" disabled={pending || disabled} className="mesh-action mesh-action-primary mt-4 px-4 text-sm disabled:opacity-50">
      {pending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
      {label}
    </button>
  );
}

function Toggle({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`settings-toggle ${value ? "settings-toggle-on" : ""} ${disabled ? "cursor-not-allowed opacity-65" : ""}`}
      aria-checked={value}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-bold">{label}</span>
        <span className="block text-xs text-[var(--text-muted)]">{description ?? (value ? "On" : "Off")}</span>
      </span>
      <span className={`settings-switch ${value ? "settings-switch-on" : ""}`} aria-hidden="true">
        <span className="settings-switch-knob" />
      </span>
    </button>
  );
}

function PickerGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-bold">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`mesh-choice rounded-md px-3 py-2 text-sm font-bold capitalize ${active ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : ""} ${disabled ? "opacity-55" : ""}`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function GraphicOptionButton({
  active,
  label,
  onClick,
  children,
  disabled = false,
  note,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  note?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`mesh-choice grid min-w-[4.75rem] justify-items-center gap-1 rounded-md px-3 py-2 text-xs font-bold capitalize ${
        active ? "border-[var(--accent)] bg-[var(--accent-subtle)]" : ""
      } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
      aria-pressed={active}
    >
      {children}
      <span>{label}</span>
      {note && <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">{note}</span>}
    </button>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-muted-box">
      <p className="settings-mini-label">{label}</p>
      <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
