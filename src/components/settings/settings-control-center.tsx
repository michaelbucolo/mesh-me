"use client";

import Link from "next/link";
import { effectiveProfileVisibility } from "@/lib/profile-visibility";
import { type Dispatch, type FormEvent, type ReactNode, type SetStateAction, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Activity, AlignLeft, AtSign, AudioLines, BadgeCheck, Ban, BarChart3, BellRing, CheckCheck, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Compass, CreditCard, Crown, Database, EyeOff, Fingerprint, Flame, Ghost, Globe, Hash, IdCard, Info, KeyRound, LayoutGrid, Link as LinkIcon, Lock, LockKeyhole, LogOut, Mail, MailCheck, MapPin, Megaphone, MessageCircle, MessageSquare, Monitor, MonitorSmartphone, Moon, Palette, Phone, PlugZap, RefreshCw, Search, Settings2, ShieldAlert, ShieldCheck, ShieldOff, Sparkles, Smartphone, Sun, Trash2, UserPlus, UserRound, UsersRound, Volume2, WandSparkles, Waypoints, type LucideIcon } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { isSoundEnabled, playSound, setSoundEnabled } from "@/lib/sound";
import { isVolumeNormalizationEnabled, setVolumeNormalizationEnabled } from "@/lib/audio-normalize";
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
} from "@/components/meshi/meshi-mascot";
import { updateMeshiLocalPreferences } from "@/hooks/use-meshi-preferences";
import { useTheme } from "@/components/theme-provider";
import {
  changePassword,
  requestAdultVerification,
  requestEmailVerification,
  setGhostMode,
  signOut,
  updateMeshCosmetics,
  updateMeshPrivacy,
  updateMeshiPreference,
  updateNsfwPreference,
  updateNotificationPreferences,
  unblockUser,
  updatePrivacy,
  updateProfile,
  updateProfileVisibility,
} from "@/lib/actions";
import { getNsfwPolicyForRegion, isAdultVerificationActive, normalizeUsState } from "@/lib/content-safety";
import { broadcastGhostMode, GHOST_EVENT, readGhostMode } from "@/lib/ghost-mode";
import { broadcastWhereShare, readWhereShare, WHERE_SHARE_EVENT } from "@/lib/where-share";
import { MESH_PAPERS } from "@/components/mesh/paint/papers";
import { isFreeMeshiOption } from "@/lib/mesh-pro";
import { getDisplayNameForAnyPlatform } from "@/lib/platform-capabilities";

/* TOYBOX — the two moulded plastics this surface uses.
   `.key-lit` (globals.css:4996) reads a PINNED TRIPLE off the element: face, ink
   and plinth move together or they do not move at all. Writing the three arbitrary
   properties out is the idiom already shipped on the feed
   (feed-timeline-client.tsx:656, post-card.tsx:790/837); they are named here only
   because this surface repeats them eleven times.
   Cobalt is "this is the primary action", crimson is "this destroys something".
   Neither is a volume knob — a neutral `.key` and a lit one differ in WHICH
   plastic, never in how loud. */
const KEY_COBALT =
  "key-lit [--mould:var(--mould-cobalt)] [--mould-ink:var(--mould-cobalt-ink)] [--mould-plinth:var(--mould-cobalt-plinth)]";
const KEY_CRIMSON =
  // Red TEXT, not a red fill — see ui/button.tsx's `danger` variant for why, and
  // for why the ink is --danger (a measured pigment) rather than --mould-crimson
  // (a fill, only ever measured against its own pinned ink).
  "text-[var(--danger)]";

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
  ghostMode: boolean;
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

// Everyone this account has blocked, newest first — the review-and-undo list
// for a control that is otherwise invisible once used.
type BlockedUser = {
  id: string;
  username: string;
  displayName: string;
};

type SettingsControlCenterProps = {
  settings: SettingsSnapshot;
  meshPrivacy: MeshPrivacySnapshot;
  meshi: MeshiSnapshot;
  meshCosmetics: Array<{ type: string; value: string; isActive: boolean }>;
  privacySummary: PrivacySummary;
  blockedUsers: BlockedUser[];
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
const themePresets = [
  { id: "default", label: "Clean" },
  { id: "instagram", label: "Social" },
  { id: "ocean", label: "Ocean" },
  { id: "sunset", label: "Sunset" },
  { id: "forest", label: "Forest" },
  { id: "mono", label: "Mono" },
] as const;
const meshConnectionColors = ["#3b82f6", "#22c55e", "#f97316", "#ec4899", "#8b5cf6", "#f59e0b"];
const meshConnectionColorNames: Record<string, string> = {
  "#3b82f6": "Blue",
  "#22c55e": "Green",
  "#f97316": "Orange",
  "#ec4899": "Pink",
  "#8b5cf6": "Violet",
  "#f59e0b": "Amber",
};
const themeColorLabels: Record<string, string> = {
  accent: "Accent",
  bgPrimary: "Background",
  bgSecondary: "Elevated background",
  textPrimary: "Primary text",
  textSecondary: "Secondary text",
  borderPrimary: "Border",
};
const meshNodeStyles = ["clean", "soft", "glass", "bold"] as const;
const meshMotionStyles = ["calm", "lively", "minimal"] as const;
// The papers a mesh can be laid out on. This USED to be a second copy of the
// renderer's table — "ids must match ATMOSPHERES in the scene renderer" was
// written above it, and they had not matched for a long time. The renderer
// shipped Daylight / Botanical / Kraft / Blueprint / Sunlit on paper; this list
// still said Midnight / Aurora / Ember / Ocean / Dawn and previewed them with
// outer-space swatches. Picking "Midnight" gave you cream. It reads the one
// list now, and each swatch is derived from the paper it previews.
const visibilityOptions = ["private", "friends", "public", "partial"];
const branchKeys = ["people", "communities", "interests", "platforms", "content"] as const;
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
  // Privacy + The Mesh are the two "who can see you" sections — keep them adjacent.
  { id: "privacy", label: "Privacy", description: "Who can see you, blocked accounts, and sensitive content", icon: LockKeyhole, keywords: ["public", "private", "discovery", "activity status", "read receipts", "block", "blocked", "unblock", "nsfw", "sensitive", "adult"] },
  { id: "mesh", label: "The Mesh", description: "Map visibility and style", icon: Waypoints, keywords: ["graph", "nodes", "connections", "branches", "visibility", "motion", "atmosphere", "sky", "pro"] },
  { id: "notifications", label: "Notifications", description: "Alerts and digest", icon: BellRing, keywords: ["push", "email digest", "messages", "comments", "follows", "alerts"] },
  { id: "security", label: "Security", description: "Verification and sessions", icon: ShieldCheck, keywords: ["password", "2fa", "two-factor", "sessions", "devices", "recovery", "phone", "passkey"] },
  // Appearance + Meshi are the two "make it yours" sections — keep them adjacent.
  { id: "appearance", label: "Appearance", description: "Theme, mode, and sound", icon: Palette, keywords: ["dark mode", "light mode", "theme", "colors", "preset", "custom", "sound", "sounds", "audio", "mute"] },
  { id: "meshi", label: "Meshi", description: "Your character", icon: Sparkles, keywords: ["mascot", "avatar", "hat", "hair", "face", "eyes", "lashes", "accessories", "badge"] },
  { id: "data", label: "Data", description: "Export and delete data", icon: Database, keywords: ["export", "download", "storage", "records", "analytics"] },
  { id: "billing", label: "Billing", description: "MeshPro and invoices", icon: CreditCard, keywords: ["subscription", "payment", "upgrade", "pro", "invoices", "plan"] },
];

// Sections whose controls persist on every change (no explicit save button).
const autosaveSections = new Set<SettingsSectionId>(["privacy", "notifications", "mesh"]);
const branchIcons: Record<(typeof branchKeys)[number], LucideIcon> = {
  people: UserRound,
  communities: UsersRound,
  interests: Hash,
  platforms: PlugZap,
  content: LayoutGrid,
};
const twoFactorIcons: Record<string, LucideIcon> = {
  email: Mail,
  sms: Smartphone,
  totp: KeyRound,
  passkey: Fingerprint,
};

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
  blockedUsers,
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
  // Ghost Mode persists via its own action (not the privacy FormData) and is
  // also flippable from the header pill, so it tracks its own state and stays
  // in lockstep with that control via the shared same-tab event.
  const [ghostMode, setGhostModeState] = useState(settings.ghostMode);
  useEffect(() => {
    const sync = () => setGhostModeState(readGhostMode());
    window.addEventListener(GHOST_EVENT, sync);
    return () => window.removeEventListener(GHOST_EVENT, sync);
  }, []);
  const [notifications, setNotifications] = useState({
    pushEnabled: settings.notificationPreference.pushEnabled,
    emailDigest: settings.notificationPreference.emailDigest,
    messages: settings.notificationPreference.messages,
    comments: settings.notificationPreference.comments,
    follows: settings.notificationPreference.follows,
    platformAlerts: settings.notificationPreference.platformAlerts,
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
    // Only real, stored per-branch overrides. Unset branches are ABSENT so they
    // inherit meshVisibility (queries.ts). Hardcoding 'private' here used to be
    // persisted verbatim on any mesh-settings save, silently hiding every branch
    // of an otherwise-public mesh.
    branches: parseBranchOverrides(meshPrivacy.branchOverrides) as Record<string, string>,
  });
  const [meshiState, setMeshiState] = useState({
    colorTheme: meshi.colorTheme,
    hatStyle: meshi.hatStyle,
    faceStyle: meshi.faceStyle,
    hairStyle: meshi.hairStyle,
    accessoryStyle: meshi.accessoryStyle,
    eyeStyle: meshi.eyeStyle,
    badgeStyle: meshi.badgeStyle,
  });
  const [meshVisuals, setMeshVisuals] = useState({
    connectionColor: meshCosmetics.find((cosmetic) => cosmetic.type === "connectionColor")?.value ?? "#3b82f6",
    nodeStyle: meshCosmetics.find((cosmetic) => cosmetic.type === "nodeStyle")?.value ?? "clean",
    motionStyle: meshCosmetics.find((cosmetic) => cosmetic.type === "motionStyle")?.value ?? "calm",
    atmosphere: meshCosmetics.find((cosmetic) => cosmetic.type === "atmosphere")?.value ?? "midnight",
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
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
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
    const queued = saveQueueRef.current.then(task, task);
    saveQueueRef.current = queued.then(() => undefined, () => undefined);
    startTransition(async () => {
      setStatus(null);
      try {
        const result = await queued;
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

  function applyGhostMode(next: boolean) {
    setGhostModeState(next);
    // Mirror the header pill: localStorage + same-tab event + live heartbeat.
    broadcastGhostMode(next);
    // Persist to the account (cross-device) with the standard save-status pill.
    runSave("Ghost Mode", () => setGhostMode(next));
  }

  function applyNotifications(next: typeof notifications) {
    setNotifications(next);
    const formData = new FormData();
    formData.set("pushEnabled", String(next.pushEnabled));
    formData.set("emailDigest", next.emailDigest);
    formData.set("messages", String(next.messages));
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

  // One control owns "who can see your profile". isPublic (profile gate) and
  // meshVisibility (mesh + branch gate) used to be edited separately and could
  // drift — a Private mesh still leaked because isPublic=true overrode it. This
  // persists BOTH atomically via a single server action (updateProfileVisibility),
  // so a partial failure can't strand the profile public. It never touches
  // branchOverrides, so existing per-branch choices survive and unset branches
  // keep inheriting meshVisibility.
  function applyProfileVisibility(level: "private" | "friends" | "public") {
    setPrivacy({ ...privacy, isPublic: level === "public" });
    setMesh({ ...mesh, meshVisibility: level });
    runSave("Profile visibility", () => updateProfileVisibility(level));
  }

  // Reflect the ACTUAL effective gate (mirrors canViewProfile, privacy-policy.ts):
  // access is public when isPublic !== false OR meshVisibility === "public".
  // Otherwise friends vs private comes from meshVisibility ("partial" with
  // isPublic=false is hidden by canViewProfile, so it reads as private here).
  // The one definition lives beside canViewProfile in privacy-policy.ts, so a
  // label can never drift from the gate it describes. This was a local copy.
  const profileVisibilityLevel = effectiveProfileVisibility(privacy.isPublic, mesh.meshVisibility);

  function applyMeshVisuals(next: typeof meshVisuals) {
    setMeshVisuals(next);
    runSave("Mesh visuals", () => updateMeshCosmetics([
      { type: "connectionColor", value: next.connectionColor, isActive: true },
      { type: "nodeStyle", value: next.nodeStyle, isActive: true },
      { type: "motionStyle", value: next.motionStyle, isActive: true },
      { type: "atmosphere", value: next.atmosphere, isActive: true },
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
    });
    runSave("Meshi", () => updateMeshiPreference({
      colorTheme: meshiState.colorTheme,
      hatStyle: meshiState.hatStyle,
      faceStyle: meshiState.faceStyle,
      hairStyle: meshiState.hairStyle,
      accessoryStyle: meshiState.accessoryStyle,
      eyeStyle: meshiState.eyeStyle,
      badgeStyle: meshiState.badgeStyle,
    }));
  }

  function applyCustomTheme(event: FormEvent) {
    event.preventDefault();
    if (!settings.isMeshPro) {
      setStatus({ type: "error", message: "MeshPro is required for custom themes." });
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
    <main className="settings-traditional flex flex-col animate-page-enter">
      <header className="settings-traditional-header plate shrink-0 p-4 md:p-5">
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
              // Meshi picks up the tool for whatever you're adjusting —
              // a small companion moment on every section change.
              prop={
                activeSection === "privacy" || activeSection === "security"
                  ? "shield"
                  : activeSection === "notifications"
                    ? "bell"
                    : activeSection === "meshi" || activeSection === "appearance"
                      ? "paintbrush"
                      : activeSection === "mesh"
                        ? "compass"
                        : activeSection === "data"
                          ? "clipboard"
                          : "none"
              }
              showGlow={false}
              animate
              interactive
            />
            <div className="min-w-0">
              {/* The topbar's "Settings" is this page's h1. The account name is
                  content — whose settings these are — not a second title. */}
              <p className="truncate text-xl font-semibold text-[var(--text-primary)] md:text-2xl">{settings.displayName || settings.username}</p>
              <p className="truncate text-sm text-[var(--text-muted)]">@{settings.username}</p>
            </div>
          </div>
          {/* Both header controls were bare `.settings-quick-link`, which is layout
              only (globals.css:4427 — display, height, padding, colour). No face, no
              --edge ring, no side wall: two of the three most-reached buttons on the
              page had no material at all. They are keys now; `.key` (globals.css:4942)
              carries all three. `.settings-quick-link-primary` goes with the change —
              it was deleted from the stylesheet at :4441 and rendered here only, so it
              was styling nothing; cobalt is what makes this one primary. */}
          <div className="flex items-center gap-2">
            <Link href="/connected-accounts" className="key settings-quick-link">
              <PlugZap size={15} aria-hidden="true" />
              One Account
            </Link>
            <form action={signOut}>
              {/* NOT the page's primary. This was a filled cobalt, competing with
                  the filled "Send verification email" below it — two fills, and
                  neither told you which mattered. Signing out is a mundane exit,
                  not the action Settings wants pressed; the one filled control
                  on this page is the verification prompt, which is the only
                  thing here the user is actually being asked to do. */}
              <button type="submit" className="key settings-quick-link w-full">
                <LogOut size={15} aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryPill label="Email" value={settings.emailVerified ? "Verified" : "Needs review"} icon={MailCheck} />
          <SummaryPill label="Platforms" value={`${connectedCount} connected`} icon={PlugZap} />
          {/* Reads the EFFECTIVE gate, not the raw isPublic column.
              canViewProfile (privacy-policy.ts) returns true when
              `isPublic !== false || meshVisibility === "public"`, so a profile
              with isPublic=false and mesh visibility "public" is world-readable
              — and this pill said "Private profile" over it. That state is one
              click away: /privacy-controls writes User.isPublic and
              MeshPrivacy.meshVisibility through two independent actions, so
              choosing "public" for the mesh alone produces it, and the schema
              default for isPublic is false.
              profileVisibilityLevel (computed above, and already feeding the
              "Who can see your profile" picker on this same screen) mirrors the
              real gate — so the header pill and the picker stop disagreeing. */}
          <SummaryPill
            label="Privacy"
            value={
              profileVisibilityLevel === "public"
                ? "Public profile"
                : profileVisibilityLevel === "friends"
                  ? "Friends only"
                  : "Private profile"
            }
            icon={LockKeyhole}
          />
          <SummaryPill label="Plan" value={settings.isMeshPro ? "MeshPro" : "Free"} icon={Crown} />
        </div>
      </header>

      {status && typeof document !== "undefined" && createPortal(
        <div
          className={`settings-status-toast ${
            status.type === "success"
              ? "border-emerald-300/25 bg-emerald-300/10 text-[var(--success)] dark:text-[var(--success)]"
              : "border-red-400/25 bg-red-500/10 text-[var(--danger)] dark:text-[var(--danger)]"
          }`}
          role="status"
        >
          <div className="flex items-center gap-2">
            {status.type === "success" ? <CheckCircle2 size={15} aria-hidden="true" /> : <ShieldAlert size={15} aria-hidden="true" />}
            {status.message}
          </div>
        </div>,
        document.body,
      )}

      <section className="settings-traditional-grid mt-3 grid gap-3 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
        <aside className={`settings-traditional-nav plate flex-col lg:sticky lg:top-3 lg:max-h-[calc(100dvh-2rem)] lg:overflow-hidden ${mobileDetailOpen ? "hidden lg:flex" : "block lg:flex"}`}>
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
          <nav className="settings-nav-scroll flex flex-col gap-1 p-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto" aria-label="Settings sections">
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

        {/* Not a `.plate`. The detail side of a split view is the BACKGROUND
            that grouped sections sit on — iOS puts the inset cards straight on
            the grouped background and never wraps them in another card. While
            this carried `plate`, every section rendered as a card inside a card
            of the identical fill, 1px rule and 20px radius. */}
        <section className={`settings-panel ${mobileDetailOpen ? "block" : "hidden lg:block"}`}>
          <div className="settings-panel-heading flex shrink-0 items-start justify-between gap-3 border-b border-[var(--border-primary)] px-4 py-3">
            <div className="w-full">
              <button
                type="button"
                onClick={showMobileSectionList}
                className="mb-2 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[var(--accent-text)] lg:hidden"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Settings
              </button>
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">{activeSectionMeta.label}</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {activeSectionMeta.description}
                {autosaveSections.has(activeSection) && " · Changes save automatically"}
              </p>
            </div>
          </div>
          <div className="settings-panel-scroll px-4 py-4">
            {activeSection === "account" && (
              <AccountSection
                settings={settings}
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
                ghostMode={ghostMode}
                applyGhostMode={applyGhostMode}
                profileVisibilityLevel={profileVisibilityLevel}
                applyProfileVisibility={applyProfileVisibility}
                sensitive={sensitive}
                applySensitive={applySensitive}
                adultVerified={adultVerified}
                nsfwPolicy={nsfwPolicy}
                startAdultVerification={startAdultVerification}
                blockedUsers={blockedUsers}
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
  sendEmailVerification,
  isPending,
}: {
  settings: SettingsSnapshot;
  sendEmailVerification: () => void;
  isPending: boolean;
}) {
  return (
    <div className="settings-section-stack">
      <SettingsCard title="Account details" icon={Settings2}>
        <div className="settings-list">
          <SettingsRow icon={AtSign} label="Username" value={`@${settings.username}`} />
          <SettingsRow icon={Mail} label="Email" value={settings.email || "No email on file"} />
          <SettingsRow icon={MailCheck} label="Email verification" value={settings.emailVerified ? "Verified" : "Not verified"} />
          <SettingsRow icon={Crown} label="MeshPro" value={settings.isMeshPro ? "Active" : "Free"} />
        </div>
        {/* `.mesh-action` is the OLD paper model: it LIFTS on hover (globals.css:2293,
            and again at :4130), presses by SHRINKING away from the finger (:2298),
            and in its primary form is painted with a hardcoded `#ffffff` ink over an
            !important accent fill (:4114). No --edge ring, no side wall. The feed
            retired the pair at its two call sites for exactly this reason
            (globals.css:7687); this surface had nine of them, six primary. `.key`
            supplies the material, the utilities supply the geometry `.mesh-action`
            used to — min-height 2.75rem is min-h-11, the 44px touch target. */}
        {!settings.emailVerified && (
          <button
            type="button"
            onClick={sendEmailVerification}
            disabled={isPending || !settings.email}
            className={`key ${KEY_COBALT} mt-3 inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-50`}
          >
            {isPending ? <PaperWait size="sm" /> : <MailCheck size={15} aria-hidden="true" />}
            Send verification email
          </button>
        )}
        {/* `.settings-action-row` (globals.css:4485) is layout only too. Where the row
            is a <button> or a <Link> it is a real control and gets the wall; the one
            row on this page that is a <div> stays flat, because a plinth means you
            can press THIS thing. Delete account keeps `.settings-action-danger`
            (:4508), which pins the crimson triple `.key-lit` reads — the same pairing
            ui/button.tsx uses for variant="danger". */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <form action={signOut}>
            <button type="submit" className="key settings-action-row w-full">
              <span className="flex min-w-0 items-center gap-2.5">
                <IconTile icon={LogOut} />
                Sign out
              </span>
              <span className="text-xs text-[var(--text-muted)]">This device</span>
            </button>
          </form>
          <Link href="/account/delete" className="key settings-action-row settings-action-danger">
            <span className="flex min-w-0 items-center gap-2.5">
              <IconTile icon={Trash2} danger />
              Delete account
            </span>
            <span className="text-xs">Permanent</span>
          </Link>
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
  return (
    <form onSubmit={saveProfile} className="settings-section-stack">
      <SettingsCard title="Public profile" icon={UserRound}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field icon={UserRound} label="Display name">
            <input
              value={profile.displayName}
              onChange={(event) => setProfile((current) => ({ ...current, displayName: event.target.value }))}
              className="simple-input h-11 px-3 text-sm"
              maxLength={80}
            />
          </Field>
          <Field icon={Palette} label="Accent color">
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
          <Field icon={AlignLeft} label="Bio" wide>
            <textarea
              value={profile.bio}
              onChange={(event) => setProfile((current) => ({ ...current, bio: event.target.value }))}
              rows={3}
              className="simple-input resize-none px-3 py-3 text-sm"
              maxLength={280}
            />
          </Field>
          <Field icon={MapPin} label="Location">
            <input
              value={profile.location}
              onChange={(event) => setProfile((current) => ({ ...current, location: event.target.value }))}
              className="simple-input h-11 px-3 text-sm"
              maxLength={80}
            />
          </Field>
          <Field icon={LinkIcon} label="Website">
            <input
              value={profile.website}
              onChange={(event) => setProfile((current) => ({ ...current, website: event.target.value }))}
              className="simple-input h-11 px-3 text-sm"
              placeholder="https://example.com"
            />
          </Field>
          <Field icon={Hash} label="Interest tags" wide>
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

      <SettingsCard title="Preview" icon={AtSign}>
        <div className="grid gap-2">
          {/* A row you can open is a key; see the AccountSection note above. */}
          <Link href={`/profile/${settings.username}`} className="key settings-action-row">
            <span className="flex min-w-0 items-center gap-2.5">
              <IconTile icon={AtSign} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">@{settings.username}</span>
                <span className="block text-xs text-[var(--text-muted)]">View public profile</span>
              </span>
            </span>
            <ChevronRight size={15} className="shrink-0" aria-hidden="true" />
          </Link>
          <div className="settings-muted-box">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2.5 text-sm font-semibold">
                <IconTile icon={PlugZap} />
                Connected platforms
              </span>
              <Link href="/connected-accounts" className="text-xs font-semibold text-[var(--accent-text)]">Manage</Link>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {settings.connectedAccounts.length > 0 ? settings.connectedAccounts.map((account) => (
                <span key={account.id} className="rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--text-secondary)]">
                  {getDisplayNameForAnyPlatform(account.platform)}
                  {account.platformUsername ? ` @${account.platformUsername}` : ""}
                </span>
              )) : (
                <span className="text-xs text-[var(--text-muted)]">No connected platforms yet.</span>
              )}
            </div>
          </div>
        </div>
      </SettingsCard>
    </form>
  );
}

function PrivacySection({
  privacy,
  applyPrivacy,
  ghostMode,
  applyGhostMode,
  profileVisibilityLevel,
  applyProfileVisibility,
  sensitive,
  applySensitive,
  adultVerified,
  nsfwPolicy,
  startAdultVerification,
  blockedUsers,
  isPending,
}: {
  privacy: { isPublic: boolean; showInDiscovery: boolean; hideActivityStatus: boolean; readReceipts: boolean };
  applyPrivacy: (next: { isPublic: boolean; showInDiscovery: boolean; hideActivityStatus: boolean; readReceipts: boolean }) => void;
  ghostMode: boolean;
  applyGhostMode: (next: boolean) => void;
  profileVisibilityLevel: "private" | "friends" | "public";
  applyProfileVisibility: (level: "private" | "friends" | "public") => void;
  sensitive: { nsfwEnabled: boolean; adultVerificationRegion: string; adultVerificationStatus: string; adultVerificationExpiresAt: Date | string | null };
  applySensitive: (next: { nsfwEnabled: boolean; adultVerificationRegion: string; adultVerificationStatus: string; adultVerificationExpiresAt: Date | string | null }) => void;
  adultVerified: boolean;
  nsfwPolicy: { reason: string; minAge: number };
  startAdultVerification: () => void;
  blockedUsers: BlockedUser[];
  isPending: boolean;
}) {
  return (
    <div className="settings-section-stack">
      <SettingsCard title="Visibility" icon={LockKeyhole}>
        <div className="grid gap-2">
          <PickerGroup label="Who can see your profile">
            <ChoiceButton icon={Globe} active={profileVisibilityLevel === "public"} onClick={() => applyProfileVisibility("public")}>Public</ChoiceButton>
            <ChoiceButton icon={UsersRound} active={profileVisibilityLevel === "friends"} onClick={() => applyProfileVisibility("friends")}>Friends</ChoiceButton>
            <ChoiceButton icon={Lock} active={profileVisibilityLevel === "private"} onClick={() => applyProfileVisibility("private")}>Private</ChoiceButton>
          </PickerGroup>
          <p className="text-xs text-[var(--text-muted)]">
            {profileVisibilityLevel === "public"
              ? "Everyone on mesh.me can open your profile and Mesh."
              : profileVisibilityLevel === "friends"
                ? "Only people you're connected with can open your profile and Mesh."
                : "Only you can open your profile and Mesh."}
          </p>
        </div>
        <div className="settings-toggle-grid mt-3">
          <Toggle icon={Compass} label="Show me in discovery" description="People can find you in search, suggestions, and the public feed." value={privacy.showInDiscovery} onChange={(value) => applyPrivacy({ ...privacy, showInDiscovery: value })} />
        </div>
      </SettingsCard>

      <SettingsCard title="Presence" icon={Activity}>
        <div className="settings-toggle-grid">
          <Toggle
            icon={Ghost}
            label="Ghost Mode"
            description="Invisible in live rooms, cursors, and active status — your own feeds, chats, and Mesh keep working."
            value={ghostMode}
            onChange={applyGhostMode}
          />
          <Toggle icon={EyeOff} label="Hide when you're online" description="Others won't see your online status or last active time." value={privacy.hideActivityStatus} onChange={(value) => applyPrivacy({ ...privacy, hideActivityStatus: value })} />
          <ShareWhereToggle />
          <Toggle icon={CheckCheck} label="Read receipts" description="Let people see when you've read their messages." value={privacy.readReceipts} onChange={(value) => applyPrivacy({ ...privacy, readReceipts: value })} />
        </div>
        <HintDetails label="About Ghost Mode">
          Your Meshi disappears from live rooms and cursors and you stop showing as active — while your own feeds, chats, and Mesh keep working normally.
          Ghost Mode follows you across devices, and you can flip it anytime from the ghost button in the top bar.
        </HintDetails>
      </SettingsCard>

      <BlockedAccountsCard blockedUsers={blockedUsers} />

      <SettingsCard title="Sensitive content" icon={Flame}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
          <Field icon={MapPin} label="Your U.S. state">
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
            <p className="mt-1 text-sm font-semibold capitalize">{adultVerified ? "Verified" : sensitive.adultVerificationStatus || "Unverified"}</p>
          </div>
        </div>
        <div className="settings-toggle-grid mt-3">
          <Toggle
            icon={Flame}
            label="Show sensitive content"
            description={adultVerified ? "Show 18+ content in your feeds." : "Verify your age first to turn this on."}
            value={sensitive.nsfwEnabled && adultVerified}
            disabled={!adultVerified}
            onChange={(value) => applySensitive({ ...sensitive, nsfwEnabled: adultVerified ? value : false })}
          />
          <button type="button" onClick={startAdultVerification} disabled={isPending} className="key settings-action-row text-left">
            <span className="flex min-w-0 items-center gap-2.5">
              <IconTile icon={IdCard} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Verify your age</span>
                <span className="block text-xs text-[var(--text-muted)]">A third-party ID check. Mesh.me only stores whether you passed.</span>
              </span>
            </span>
            {isPending ? <PaperWait size="sm" className="shrink-0" /> : <ChevronRight size={15} className="shrink-0" aria-hidden="true" />}
          </button>
        </div>
        <HintDetails label="Why verification is required">
          {nsfwPolicy.reason} Minimum age: {nsfwPolicy.minAge}. Sensitive content stays hidden until you verify your age and turn this on.
        </HintDetails>
      </SettingsCard>
    </div>
  );
}

/**
 * Review-and-undo for blocks. A block is deliberately silent everywhere else in
 * the product — the blocked account simply stops existing for you — so this is
 * the only place the list can be seen and reversed. Rows disappear optimistically
 * and come back if the server refuses.
 */
function BlockedAccountsCard({ blockedUsers }: { blockedUsers: BlockedUser[] }) {
  const [blocked, setBlocked] = useState(blockedUsers);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function unblock(user: BlockedUser) {
    setPendingId(user.id);
    setError(null);
    startTransition(async () => {
      const result = await unblockUser(user.id);
      setPendingId(null);
      if (result && "error" in result) {
        setError(String(result.error));
        return;
      }
      setBlocked((current) => current.filter((entry) => entry.id !== user.id));
    });
  }

  return (
    <SettingsCard title="Blocked accounts" icon={Ban}>
      {blocked.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">
          You haven&apos;t blocked anyone. Block someone from their profile or the &ldquo;…&rdquo; menu on any of their posts.
        </p>
      ) : (
        <div className="settings-toggle-grid">
          {blocked.map((user) => (
            /* The row itself is the one `.settings-action-row` on this page that is a
               <div>. It stays flat deliberately — it is a place, and the thing you
               press is the button inside it. */
            <div key={user.id} className="settings-action-row">
              <span className="flex min-w-0 items-center gap-2.5">
                <IconTile icon={UserRound} danger />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{user.displayName}</span>
                  <span className="block truncate text-xs text-[var(--text-muted)]">@{user.username}</span>
                </span>
              </span>
              <button
                type="button"
                onClick={() => unblock(user)}
                disabled={pendingId === user.id}
                className="key inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50"
              >
                {pendingId === user.id
                  ? <PaperWait size="sm" />
                  : <ShieldOff size={14} aria-hidden="true" />}
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
      {error && <p className="mt-3 text-xs font-semibold text-[var(--ds-danger)]">{error}</p>}
      <HintDetails label="What blocking does">
        Blocked accounts can&apos;t see your posts, profile, or Mesh, can&apos;t message you, and don&apos;t appear in your feed, search, or live rooms — in both directions.
        Blocking also removes any follow between you, in both directions. Unblocking does not restore those follows, and no one is ever told they were blocked.
      </HintDetails>
    </SettingsCard>
  );
}

type NotificationsState = {
  pushEnabled: boolean;
  emailDigest: string;
  messages: boolean;
  comments: boolean;
  follows: boolean;
  platformAlerts: boolean;
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
      <SettingsCard title="Delivery and alerts" icon={BellRing}>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_12rem]">
          <Toggle
            icon={BellRing}
            label="Push notifications"
            description="Get alerts on this device"
            value={notifications.pushEnabled}
            onChange={(value) => applyNotifications({ ...notifications, pushEnabled: value })}
          />
          <Field icon={Mail} label="Email digest">
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
        <p className="settings-mini-label mt-4">What reaches you</p>
        <div className="settings-toggle-grid mt-2">
          <Toggle icon={MessageSquare} label="Messages" description="New direct messages" value={notifications.messages} onChange={(value) => applyNotifications({ ...notifications, messages: value })} />
          <Toggle icon={MessageCircle} label="Comments" description="Replies to your posts" value={notifications.comments} onChange={(value) => applyNotifications({ ...notifications, comments: value })} />
          <Toggle icon={UserPlus} label="Follows" description="New followers and friend requests" value={notifications.follows} onChange={(value) => applyNotifications({ ...notifications, follows: value })} />
          <Toggle icon={PlugZap} label="Platform alerts" description="Connected platform activity" value={notifications.platformAlerts} onChange={(value) => applyNotifications({ ...notifications, platformAlerts: value })} />
          <Toggle icon={Megaphone} label="Product updates" description="News and feature announcements" value={notifications.productUpdates} onChange={(value) => applyNotifications({ ...notifications, productUpdates: value })} />
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <ShieldCheck size={13} aria-hidden="true" />
          Security alerts are always on to protect your account.
        </p>
      </SettingsCard>
    </div>
  );
}

function SecuritySection({
  settings,
  privacySummary,
  runSave,
  isPending,
}: {
  settings: SettingsSnapshot;
  privacySummary: PrivacySummary;
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
          <SettingsRow icon={MailCheck} label="Email verification" value={settings.emailVerified ? "Verified" : "Not verified"} />
          <SettingsRow icon={Smartphone} label="Active sessions" value={privacySummary.sessions.toLocaleString()} />
          <SettingsRow icon={Activity} label="Activity status" value={settings.hideActivityStatus ? "Hidden" : "Visible"} />
          <SettingsRow icon={Flame} label="Sensitive content" value={settings.nsfwEnabled ? "Allowed after verification" : "Off"} />
        </div>
        {!settings.emailVerified && (
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Not verified yet — send a verification email from Account settings.
          </p>
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
        <div className="grid gap-2 sm:grid-cols-2">
          <Link href="/trust" className="key settings-action-row">
            <span className="flex min-w-0 items-center gap-2.5">
              <IconTile icon={BadgeCheck} />
              Verify your identity
            </span>
            <ChevronRight size={15} className="shrink-0" aria-hidden="true" />
          </Link>
          <Link href="/privacy-controls" className="key settings-action-row">
            <span className="flex min-w-0 items-center gap-2.5">
              <IconTile icon={ShieldCheck} />
              Privacy controls
            </span>
            <ChevronRight size={15} className="shrink-0" aria-hidden="true" />
          </Link>
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
          {/* Secondary keys stay in --face; only the destructive-adjacent primary is
              moulded. Rank is which plastic and how deep the wall, never saturation. */}
          <button type="button" onClick={() => void loadSessions()} disabled={loading || busy} className="key inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-50">
            {loading ? <PaperWait size="sm" /> : <RefreshCw size={15} aria-hidden="true" />}
            Refresh
          </button>
          <button type="button" onClick={revokeOtherSessions} disabled={busy || totalSessions <= 1} className={`key ${KEY_COBALT} inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-semibold disabled:opacity-50`}>
            {busy ? <PaperWait size="sm" /> : <LogOut size={15} aria-hidden="true" />}
            Sign out other devices
          </button>
        </div>
      </div>
      {message && <p className="mt-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">{message}</p>}
      <div className="settings-list mt-3">
        {sessions.length > 0 ? sessions.slice(0, 4).map((session) => (
          <SettingsRow
            key={`${session.createdAt}-${session.expiresAt}-${session.isCurrent ? "current" : "other"}`}
            icon={session.isCurrent ? Smartphone : Monitor}
            label={session.isCurrent ? "Current device" : "Other device"}
            value={new Date(session.expiresAt).toLocaleDateString()}
          />
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
          <button type="submit" disabled={busy === "email" || !email.trim()} className={`key ${KEY_COBALT} mt-3 inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-semibold disabled:opacity-50`}>
            {busy === "email" ? <PaperWait size="sm" /> : <Mail size={15} aria-hidden="true" />}
            Add email
          </button>
        </form>
        <form onSubmit={(event) => void addMethod("phone", event)} className="settings-muted-box">
          <Field label="Add recovery phone">
            <input value={phone} onChange={(event) => setPhone(event.target.value)} className="simple-input h-11 px-3 text-sm" placeholder="+15551234567" type="tel" />
          </Field>
          <button type="submit" disabled={busy === "phone" || !phone.trim()} className={`key ${KEY_COBALT} mt-3 inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-semibold disabled:opacity-50`}>
            {busy === "phone" ? <PaperWait size="sm" /> : <Phone size={15} aria-hidden="true" />}
            Add phone
          </button>
        </form>
      </div>
      {message && <p className="mt-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">{message}</p>}
      <div className="settings-list mt-3">
        {loading ? <p className="text-sm text-[var(--text-muted)]">Loading recovery methods...</p> : null}
        {[...emails.map((item) => ({ ...item, kind: "email" as const, label: item.email })), ...phones.map((item) => ({ ...item, kind: "phone" as const, label: item.phone }))].map((item) => (
          <div key={`${item.kind}-${item.id}`} className="settings-row leaf">
            <span className="flex min-w-0 items-center gap-2.5">
              <IconTile icon={item.kind === "email" ? Mail : Phone} />
              <span className="min-w-0 truncate">{item.label}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <strong>{item.isVerified ? "Verified" : "Unverified"}</strong>
              {!item.isPrimary && (
                /* Was `text-red-500` on `hover:bg-red-500/10` — a raw Tailwind palette
                   red, unmeasured against either theme's paper, on a naked 40px box
                   with no face, no ring and no wall. Removal is destruction, so it is
                   moulded from crimson, whose ink is pinned at 6.37:1 on its own face. */
                <button type="button" onClick={() => void removeMethod(item.kind, item.id)} disabled={busy === item.id} className={`key ${KEY_CRIMSON} grid h-10 w-10 place-items-center disabled:opacity-50`} aria-label={`Remove ${item.label}`}>
                  {busy === item.id ? <PaperWait size="sm" /> : <Trash2 size={15} aria-hidden="true" />}
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
      <div className="flex flex-wrap gap-2">
        {(["email", "sms", "totp", "passkey"] as const).map((method) => {
          const MethodIcon = twoFactorIcons[method] ?? ShieldCheck;
          return (
            <button
              key={method}
              type="button"
              disabled={busy !== null || configured.has(method)}
              onClick={() => void addTwoFactor(method)}
              className="key inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-semibold capitalize text-[var(--text-primary)] disabled:opacity-50"
            >
              {busy === method ? <PaperWait size="sm" /> : <MethodIcon size={15} aria-hidden="true" />}
              {configured.has(method) ? `${method} added` : `Add ${method}`}
            </button>
          );
        })}
      </div>
      {message && <p className="mt-3 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">{message}</p>}
      <div className="settings-list mt-3">
        {loading ? <p className="text-sm text-[var(--text-muted)]">Loading 2FA methods...</p> : null}
        {methods.length > 0 ? methods.map((item) => (
          <div key={item.id} className="settings-row leaf">
            <span className="flex min-w-0 items-center gap-2.5">
              <IconTile icon={twoFactorIcons[item.method] ?? ShieldCheck} />
              <span className="min-w-0 truncate capitalize">{item.label || item.method}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <strong>{item.isEnabled ? "Enabled" : "Pending"}</strong>
              <button type="button" onClick={() => void removeTwoFactor(item.id)} disabled={busy === item.id} className={`key ${KEY_CRIMSON} grid h-10 w-10 place-items-center disabled:opacity-50`} aria-label={`Remove ${item.label || item.method}`}>
                {busy === item.id ? <PaperWait size="sm" /> : <Trash2 size={15} aria-hidden="true" />}
              </button>
            </span>
          </div>
        )) : (
          <p className="text-sm text-[var(--text-muted)]">No 2FA methods enrolled.</p>
        )}
      </div>
      <HintDetails label="How enrollment works">
        2FA enrollment is shown here, but the server will only enable methods when challenge verification is available.
      </HintDetails>
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
  mesh: { meshVisibility: string; showConnections: boolean; showStats: boolean; branches: Record<string, string> };
  applyMeshPrivacy: (next: { meshVisibility: string; showConnections: boolean; showStats: boolean; branches: Record<string, string> }) => void;
  meshVisuals: { connectionColor: string; nodeStyle: string; motionStyle: string; atmosphere: string };
  applyMeshVisuals: (next: { connectionColor: string; nodeStyle: string; motionStyle: string; atmosphere: string }) => void;
  isMeshPro: boolean;
}) {
  // A branch with no explicit override inherits the overall mesh visibility.
  // Show that inherited value in the picker (public/partial -> public) instead of
  // a misleading hardcoded default.
  const branchInherit = mesh.meshVisibility === "private" ? "private" : mesh.meshVisibility === "friends" ? "friends" : "public";
  return (
    <div className="settings-section-stack">
      <SettingsCard title="Mesh visibility" icon={Waypoints}>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Overall visibility follows <span className="font-semibold">Who can see your profile</span> in Privacy.
        </p>
        <div className="settings-toggle-grid">
          <Toggle icon={UsersRound} label="Show connections" description="Display who you're connected to" value={mesh.showConnections} onChange={(value) => applyMeshPrivacy({ ...mesh, showConnections: value })} />
          <Toggle icon={BarChart3} label="Show stats" description="Display counts on your mesh" value={mesh.showStats} onChange={(value) => applyMeshPrivacy({ ...mesh, showStats: value })} />
        </div>
        <p className="settings-mini-label mt-4">Per-branch visibility</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {branchKeys.map((key) => {
            const BranchIcon = branchIcons[key];
            return (
              <label key={key} className="settings-muted-box grid gap-1.5 text-xs font-semibold capitalize">
                <span className="inline-flex items-center gap-1.5">
                  <BranchIcon size={13} className="text-[var(--accent-text)]" aria-hidden="true" />
                  {key}
                </span>
                <select
                  value={mesh.branches[key] ?? branchInherit}
                  onChange={(event) => applyMeshPrivacy({
                    ...mesh,
                    branches: { ...mesh.branches, [key]: event.target.value },
                  })}
                  className="simple-input h-10 px-2 text-sm capitalize"
                >
                  {visibilityOptions.slice(0, 3).map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            );
          })}
        </div>
      </SettingsCard>

      <SettingsCard title="Mesh visuals" icon={WandSparkles}>
        {!isMeshPro && (
          <div className="settings-muted-box mb-3 flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold">
              <Crown size={15} aria-hidden="true" />
              MeshPro customization
            </span>
            <Link href="/meshpro" className="text-xs font-semibold text-[var(--accent-text)]">Upgrade</Link>
          </div>
        )}
        {/* `.mesh-choice` (globals.css:2338) is a 1px outline on a fill one step from
            the card, with a hover LIFT (:2354) and a shrink-press (:2358) — the paper
            model, not the moulded one. Every picker on this surface is a key now, and
            SELECTED is a change of plastic rather than a 12% accent wash: the same
            move the feed's chips made at globals.css:7333. */}
        <PickerGroup label="Atmosphere — your mesh's sky">
          {MESH_PAPERS.map((sky) => (
            <button
              key={sky.id}
              type="button"
              disabled={!isMeshPro}
              onClick={() => applyMeshVisuals({ ...meshVisuals, atmosphere: sky.id })}
              className={`key inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold ${meshVisuals.atmosphere === sky.id ? KEY_COBALT : "text-[var(--text-primary)]"} ${!isMeshPro ? "opacity-55" : ""}`}
              aria-pressed={meshVisuals.atmosphere === sky.id}
            >
              <span
                className="h-4 w-4 rounded-full border border-white/20"
                style={{ background: `linear-gradient(135deg, ${sky.swatch[0]} 45%, ${sky.swatch[1]})` }}
              />
              {sky.label}
            </button>
          ))}
        </PickerGroup>
        <PickerGroup label="Connection color" className="mt-3">
          {meshConnectionColors.map((color) => (
            <button
              key={color}
              type="button"
              disabled={!isMeshPro}
              onClick={() => applyMeshVisuals({ ...meshVisuals, connectionColor: color })}
              className={`key inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold ${meshVisuals.connectionColor === color ? KEY_COBALT : "text-[var(--text-primary)]"} ${!isMeshPro ? "opacity-55" : ""}`}
              aria-pressed={meshVisuals.connectionColor === color}
            >
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: color }} />
              {meshConnectionColorNames[color]}
            </button>
          ))}
        </PickerGroup>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
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
  };
  setMeshiState: Dispatch<SetStateAction<{
    colorTheme: string;
    hatStyle: string;
    faceStyle: string;
    hairStyle: string;
    accessoryStyle: string;
    eyeStyle: string;
    badgeStyle: string;
  }>>;
  saveMeshi: (event: FormEvent) => void;
  meshiLocked: (group: Parameters<typeof isFreeMeshiOption>[0], value: string) => boolean;
  isPending: boolean;
}) {
  return (
    <form onSubmit={saveMeshi} className="settings-section-stack">
      <SettingsCard title="Customize Meshi" icon={Sparkles}>
        <div className="settings-meshi-preview">
          <MeshiMascot
            size={96}
            color={meshiState.colorTheme as MeshiColor}
            hat={meshiState.hatStyle as MeshiHat}
            mood={meshiState.faceStyle as MeshiMood}
            hair={meshiState.hairStyle as MeshiHair}
            accessory={meshiState.accessoryStyle as MeshiAccessory}
            eyeStyle={meshiState.eyeStyle as MeshiEyeStyle}
            badge={meshiState.badgeStyle as MeshiBadge}
            showGlow={false}
            animate
            interactive
          />
          <p className="text-sm text-[var(--text-secondary)]">
            One Meshi follows you across Mesh.me — customize it below.
          </p>
        </div>
        <div className="settings-picker-stack mt-4">
          <PickerGroup label="Color">
            {colors.map((color) => {
              const locked = meshiLocked("colors", color);
              return (
                <button
                  key={color}
                  type="button"
                  disabled={locked}
                  onClick={() => setMeshiState((current) => ({ ...current, colorTheme: color }))}
                  className={`key inline-flex min-h-10 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${meshiState.colorTheme === color ? KEY_COBALT : "text-[var(--text-primary)]"} ${locked ? "cursor-not-allowed opacity-55" : ""}`}
                  aria-pressed={meshiState.colorTheme === color}
                >
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: colorHex[color] || "#3b82f6" }} />
                  {color}
                  {locked && <span className="text-micro text-[var(--text-muted)]">Pro</span>}
                </button>
              );
            })}
          </PickerGroup>
          <MeshiOptionGroup title="Hat" group="hats" values={hats} current={meshiState.hatStyle} meshiState={meshiState} locked={meshiLocked} onPick={(value) => setMeshiState((current) => ({ ...current, hatStyle: value }))} />
          <MeshiOptionGroup title="Hair" group="hairs" values={hairs} current={meshiState.hairStyle} meshiState={meshiState} locked={meshiLocked} onPick={(value) => setMeshiState((current) => ({ ...current, hairStyle: value }))} />
          <MeshiOptionGroup title="Eyes" group="eyes" values={eyes} current={meshiState.eyeStyle} meshiState={meshiState} locked={meshiLocked} onPick={(value) => setMeshiState((current) => ({ ...current, eyeStyle: value }))} />
          <MeshiOptionGroup title="Face" group="faces" values={faces} current={meshiState.faceStyle} meshiState={meshiState} locked={meshiLocked} onPick={(value) => setMeshiState((current) => ({ ...current, faceStyle: value }))} />
          <MeshiOptionGroup title="Accessories" group="accessories" values={accessories} current={meshiState.accessoryStyle} meshiState={meshiState} locked={meshiLocked} onPick={(value) => setMeshiState((current) => ({ ...current, accessoryStyle: value }))} />
          <MeshiOptionGroup title="Badges" group="badges" values={badges} current={meshiState.badgeStyle} meshiState={meshiState} locked={meshiLocked} onPick={(value) => setMeshiState((current) => ({ ...current, badgeStyle: value }))} />
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
  const [soundsOn, setSoundsOn] = useState(() => isSoundEnabled());
  const [normalizeOn, setNormalizeOn] = useState(() => isVolumeNormalizationEnabled());
  const modeIcons: Record<"system" | "light" | "dark", LucideIcon> = { system: MonitorSmartphone, light: Sun, dark: Moon };
  return (
    <div className="settings-section-stack">
      <SettingsCard title="Theme and sound" icon={Palette}>
        <div className="grid gap-3 md:grid-cols-2">
          <PickerGroup label="Mode">
            {(["system", "light", "dark"] as const).map((themeMode) => (
              <ChoiceButton key={themeMode} icon={modeIcons[themeMode]} active={mode === themeMode} onClick={() => setMode(themeMode)}>
                {themeMode}
              </ChoiceButton>
            ))}
          </PickerGroup>
          <PickerGroup label="Preset">
            {themePresets.map((themePreset) => (
              <ChoiceButton key={themePreset.id} active={preset === themePreset.id} onClick={() => setPreset(themePreset.id)}>
                {themePreset.label}
              </ChoiceButton>
            ))}
          </PickerGroup>
        </div>
        <div className="settings-toggle-grid mt-3">
          <Toggle
            icon={Volume2}
            label="Interface sounds"
            description="Soft pops and chimes for likes, arrivals, messages, and travel"
            value={soundsOn}
            onChange={(value) => {
              setSoundsOn(value);
              setSoundEnabled(value);
              if (value) playSound("chime");
            }}
          />
          <Toggle
            icon={AudioLines}
            label="Normalize volume"
            description="Even out loudness across videos and audio from every platform"
            value={normalizeOn}
            onChange={(value) => {
              setNormalizeOn(value);
              setVolumeNormalizationEnabled(value);
            }}
          />
        </div>
      </SettingsCard>

      <form onSubmit={applyCustomTheme}>
        <SettingsCard title="Custom theme" icon={Crown}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[var(--text-muted)]">
              MeshPro unlocks full color tuning — light/dark mode stays available to everyone.
            </p>
            {!isMeshPro && <Link href="/meshpro" className="text-xs font-semibold text-[var(--accent-text)]">Upgrade</Link>}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(themeDraft).map(([key, value]) => (
              <label key={key} className="grid gap-1.5 text-xs font-semibold text-[var(--text-secondary)]">
                {themeColorLabels[key] ?? key}
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
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" disabled={!isMeshPro} className={`key ${KEY_COBALT} inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-50`}>
              Apply custom theme
            </button>
            <button type="button" disabled={!isMeshPro || !hasCustomTheme} onClick={clearCustomTheme} className="key inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold text-[var(--text-primary)] disabled:opacity-50">
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
      <SettingsCard title="MeshPro" icon={Crown}>
        <p className="text-xs text-[var(--text-muted)]">
          {isMeshPro
            ? "MeshPro is active. Billing and payment methods are managed from the billing page."
            : "MeshPro unlocks deeper analytics, custom Mesh visuals, Meshi cosmetics, badges, and themes."}
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Link href="/meshpro" className="key settings-action-row">
            <span className="flex min-w-0 items-center gap-2.5">
              <IconTile icon={Crown} />
              {isMeshPro ? "View Pro features" : "Upgrade to MeshPro"}
            </span>
            <ChevronRight size={15} className="shrink-0" aria-hidden="true" />
          </Link>
          <Link href="/billing" className="key settings-action-row">
            <span className="flex min-w-0 items-center gap-2.5">
              <IconTile icon={CreditCard} />
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
      <SettingsCard title="Your data" icon={Database}>
        <p className="mb-3 text-xs text-[var(--text-muted)]">
          Export your Mesh.me data or remove imported platform data. Permanent account deletion stays in Account.
        </p>
        <AnalyticsControls />
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <MetricTile label="Stored records" value={storedTotal.toLocaleString()} />
          <MetricTile label="Followers" value={privacySummary.connections.followers.toLocaleString()} />
          <MetricTile label="Following" value={privacySummary.connections.following.toLocaleString()} />
        </div>
        <Link href="/privacy-controls" className="key settings-action-row mt-3">
          <span className="flex min-w-0 items-center gap-2.5">
            <IconTile icon={ShieldCheck} />
            Privacy control center
          </span>
          <ChevronRight size={15} className="shrink-0" aria-hidden="true" />
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
              animate={false}
              showGlow={false}
            />
          </GraphicOptionButton>
        );
      })}
    </PickerGroup>
  );
}

/* An inset grouped section: a plain header on the background, then ONE
   container holding the rows. The header used to live inside the container,
   which made this a titled box rather than a section — and since the panel
   around it was a `.plate` too, the built page showed a white bordered card
   17px inside another white bordered card. Only the inner one is a card now. */
function SettingsCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="settings-group">
      <div className="settings-card-heading">
        <Icon size={14} aria-hidden="true" />
        <h3>{title}</h3>
      </div>
      <div className="settings-card plate">{children}</div>
    </section>
  );
}

// Small accent-tinted icon tile — the leading visual of every settings row.
function IconTile({ icon: Icon, danger = false }: { icon: LucideIcon; danger?: boolean }) {
  return (
    <span className={`settings-icon-tile ${danger ? "settings-icon-tile-danger" : ""}`} aria-hidden="true">
      <Icon size={15} />
    </span>
  );
}

// Verbose helper copy folds behind this native disclosure so rows stay dense.
function HintDetails({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="settings-hint">
      <summary>
        <Info size={13} aria-hidden="true" />
        {label}
        <ChevronDown size={13} className="settings-hint-chevron" aria-hidden="true" />
      </summary>
      <div className="settings-hint-body">{children}</div>
    </details>
  );
}

function SummaryPill({ label, value, icon: Icon }: { label: string; value: string; icon: LucideIcon }) {
  return (
    <div className="settings-summary-pill">
      <Icon size={15} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate text-micro font-semibold mesh-eyebrow text-[var(--text-muted)]">{label}</span>
        <span className="block truncate text-sm font-semibold text-[var(--text-primary)]">{value}</span>
      </span>
    </div>
  );
}

function SettingsRow({ label, value, icon }: { label: string; value: string; icon?: LucideIcon }) {
  return (
    <div className="settings-row leaf">
      <span className="flex min-w-0 items-center gap-2.5">
        {icon && <IconTile icon={icon} />}
        <span className="min-w-0 truncate">{label}</span>
      </span>
      <strong>{value}</strong>
    </div>
  );
}

function Field({ label, icon: Icon, children, wide = false }: { label: string; icon?: LucideIcon; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`grid gap-1.5 text-sm font-semibold ${wide ? "md:col-span-2" : ""}`}>
      <span className="inline-flex items-center gap-1.5">
        {Icon && <Icon size={13} className="text-[var(--accent-text)]" aria-hidden="true" />}
        {label}
      </span>
      {children}
    </label>
  );
}

/* The submit key for three forms — profile, password, Meshi. One call site, so
   moulding it here moulds all three. */
function SaveButton({ label, pending, disabled = false }: { label: string; pending: boolean; disabled?: boolean }) {
  return (
    <button type="submit" disabled={pending || disabled} className={`key ${KEY_COBALT} mt-4 inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-semibold disabled:opacity-50`}>
      {pending && <PaperWait size="sm" />}
      {label}
    </button>
  );
}

/** The where-chip OPT-IN ("in Ana's mesh", "watching the Flow"). Off by
 * default; a per-device flag like Ghost Mode's local half. The server
 * redacts location for anyone who hasn't opted in, so this toggle is the
 * ONLY way connections ever see where you're browsing. */
function ShareWhereToggle() {
  const [shareWhere, setShareWhere] = useState(false);
  useEffect(() => {
    const sync = () => setShareWhere(readWhereShare());
    sync();
    window.addEventListener(WHERE_SHARE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WHERE_SHARE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return (
    <Toggle
      icon={MapPin}
      label="Share where you browse"
      description="Connections may see which mesh or corner of mesh.me you're exploring. Off, they only see that you're online."
      value={shareWhere}
      onChange={(value) => {
        setShareWhere(value);
        broadcastWhereShare(value);
      }}
    />
  );
}

function Toggle({
  icon,
  label,
  description,
  value,
  onChange,
  disabled = false,
  locked = false,
}: {
  icon?: LucideIcon;
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  locked?: boolean;
}) {
  /* Fourteen real switches, and the row they sit in had no material: a
     `.settings-toggle` (globals.css:4514) is display, height and padding. It is a
     key now — face, --edge ring, and a wall that bottoms out when you flip it.
     `settings-toggle-on` goes: the stylesheet deleted that rule at :4526 (it was
     an 8% accent wash carrying the state of a privacy switch, a ~1% luminance
     shift doing a boolean's job) and this was its only call site, so it has been
     styling nothing since. The SWITCH carries the state, as jade plastic —
     `.settings-switch-on` at :4563, untouched below. */
  return (
    <button
      type="button"
      role="switch"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`key settings-toggle ${disabled ? "cursor-not-allowed opacity-65" : ""}`}
      aria-checked={value}
    >
      {icon && <IconTile icon={icon} />}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{label}</span>
          {locked && <Lock size={12} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />}
        </span>
        {description && <span className="block text-xs leading-4 text-[var(--text-muted)]">{description}</span>}
      </span>
      <span className={`settings-switch ${value ? "settings-switch-on" : ""}`} aria-hidden="true">
        <span className="settings-switch-knob" />
      </span>
    </button>
  );
}

function PickerGroup({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className ? `grid gap-1.5 ${className}` : "grid gap-1.5"}>
      <p className="text-xs font-semibold text-[var(--text-secondary)]">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function ChoiceButton({
  active,
  onClick,
  children,
  disabled = false,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`key inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold capitalize ${active ? KEY_COBALT : "text-[var(--text-primary)]"} ${disabled ? "opacity-55" : ""}`}
      aria-pressed={active}
    >
      {Icon && <Icon size={14} aria-hidden="true" />}
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
      className={`key grid min-w-[4.75rem] justify-items-center gap-1 rounded-md px-3 py-2 text-xs font-semibold capitalize ${
        active ? KEY_COBALT : "text-[var(--text-primary)]"
      } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
      aria-pressed={active}
    >
      {children}
      <span>{label}</span>
      {note && <span className="text-micro font-semibold mesh-eyebrow text-[var(--text-muted)]">{note}</span>}
    </button>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-muted-box">
      <p className="settings-mini-label">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-[var(--text-primary)]">{value}</p>
    </div>
  );
}
