"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import {
  updateProfile,
  signOut,
  changePassword,
  deleteAccount,
  toggleBlock,
  updatePrivacy,
  updateUserLinks,
  updateUserInterests,
  updateMeshiPreference,
  checkAndAwardAchievements,
  setActiveTitle,
  updateMeshPrivacy,
  optIntoGlobalMesh,
  optOutOfGlobalMesh,
  updateGlobalMeshBranches,
} from "@/lib/actions";
import { getMeshPrivacy, getGlobalMeshStatus } from "@/lib/queries";
import { useState, useTransition, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings,
  User,
  Shield,
  Bell,
  Lock,
  LogOut,
  Trash2,
  Plus,
  X,
  Palette,
  AlertTriangle,
  Check,
  UserX,
  Crown,
  Sparkles,
  Zap,
  Eye,
  Globe,
  Paintbrush,
  Layout,
  Fingerprint,
  Search,
  FileText,
  Video,
  MessageSquare,
  ExternalLink,
  Mail,
  Phone,
  UserCheck,
  ShieldCheck,
  Activity,
  BarChart3,
  TrendingUp,
  Users,
  Heart,
  Scan,
  Trophy,
  Award,
} from "lucide-react";
import { INTEREST_TAGS } from "@/lib/utils";
import { MeshiMascot, type MeshiMood, type MeshiHat, type MeshiColor } from "@/components/meshi/meshi-mascot";
import { MeshiSettingsTip } from "@/components/meshi/meshi-guide";
import { AchievementList } from "@/components/achievements/achievement-badges";

const ACCENT_COLORS = [
  "#3b82f6", "#2563eb", "#1d4ed8", "#06b6d4", "#0891b2",
  "#8b5cf6", "#7c3aed", "#a855f7", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#6d28d9",
];

const FEED_LAYOUTS = [
  { id: "card", label: "Card", desc: "Twitter/X style" },
  { id: "grid", label: "Grid", desc: "Instagram style" },
  { id: "vertical", label: "Vertical", desc: "TikTok/Reels style" },
  { id: "compact", label: "Compact", desc: "Reddit style" },
];

const THEME_OPTIONS = [
  { id: "midnight", label: "Midnight", bg: "#09090b", accent: "#3b82f6" },
  { id: "deep-ocean", label: "Deep Ocean", bg: "#0c1222", accent: "#06b6d4" },
  { id: "dark-violet", label: "Dark Violet", bg: "#0f0720", accent: "#8b5cf6" },
  { id: "charcoal", label: "Charcoal", bg: "#171717", accent: "#3b82f6" },
];

interface SettingsData {
  id: string;
  email?: string | null;
  username: string;
  displayName: string;
  bio: string | null;
  location: string | null;
  website: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  accentColor: string | null;
  isPublic: boolean;
  interests: { id: string; tag: string }[];
  links: { id: string; label: string; url: string }[];
}

interface BlockedUser {
  id: string;
  blocked: { id: string; username: string; displayName: string; avatarUrl: string | null };
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile fields
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [accentColor, setAccentColor] = useState("#3b82f6");

  // Links
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);
  // Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Privacy
  const [isPublic, setIsPublic] = useState(true);

  // Notifications toggles
  const [notifFollowers, setNotifFollowers] = useState(true);
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifCommunity, setNotifCommunity] = useState(true);
  const [notifAISummary, setNotifAISummary] = useState(true);

  // Customization
  const [selectedTheme, setSelectedTheme] = useState("midnight");
  const [selectedLayout, setSelectedLayout] = useState("card");

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setBlockedUsers(data.blockedUsers || []);
        if (data.settings) {
          setDisplayName(data.settings.displayName || "");
          setBio(data.settings.bio || "");
          setLocation(data.settings.location || "");
          setWebsite(data.settings.website || "");
          setAccentColor(data.settings.accentColor || "#3b82f6");
          setIsPublic(data.settings.isPublic !== false);
          setSelectedInterests(data.settings.interests?.map((i: { tag: string }) => i.tag) || []);
          setLinks(data.settings.links?.map((l: { label: string; url: string }) => ({ label: l.label, url: l.url })) || []);
        }
      }
    } catch {
      // Settings will render with defaults
    } finally {
      setLoading(false);
    }
  }, []);

  const searchParams = useSearchParams();

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Handle URL tab parameter (e.g. /settings?tab=meshi)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabs.some((t) => t.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Load achievements when tab is active
  useEffect(() => {
    if (activeTab === "achievements") {
      setAchievementLoading(true);
      checkAndAwardAchievements().then((result) => {
        if (result && "awarded" in result) {
          // Refresh achievement list
          fetch("/api/settings").then((r) => r.json()).then((data) => {
            if (data.settings?.achievements) {
              setUnlockedSlugs(data.settings.achievements.map((a: { slug: string }) => a.slug));
            }
            if (data.settings?.activeTitle) {
              setUserActiveTitle(data.settings.activeTitle);
            }
          }).catch(() => {});
        }
        setAchievementLoading(false);
      }).catch(() => setAchievementLoading(false));
    }
  }, [activeTab]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError("");
    setTimeout(() => setSuccess(""), 3000);
  };

  const showError = (msg: string) => {
    setError(msg);
    setSuccess("");
    setTimeout(() => setError(""), 5000);
  };

  // Meshi customization state
  const [meshiHat, setMeshiHat] = useState<MeshiHat>("none");
  const [meshiFace, setMeshiFace] = useState<MeshiMood>("happy");
  const [meshiColor, setMeshiColor] = useState<MeshiColor>("blue");
  const [meshiEnabled, setMeshiEnabled] = useState(true);

  // Load Meshi enabled state from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("meshiEnabled");
      if (stored === "false") setMeshiEnabled(false);
    }
  }, []);

  // Achievements state
  const [unlockedSlugs, setUnlockedSlugs] = useState<string[]>([]);
  const [userActiveTitle, setUserActiveTitle] = useState<string | null>(null);
  const [achievementLoading, setAchievementLoading] = useState(false);

  // Mesh Privacy state
  const [meshVisibility, setMeshVisibility] = useState<string>("friends");
  const [branchOverrides, setBranchOverrides] = useState<Record<string, string>>({});
  const [showConnections, setShowConnections] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [globalMeshActive, setGlobalMeshActive] = useState(false);
  const [globalMeshBranches, setGlobalMeshBranches] = useState<string[]>([]);
  const [meshPrivacyLoaded, setMeshPrivacyLoaded] = useState(false);

  // Load mesh privacy settings
  useEffect(() => {
    if (activeTab === "mesh-privacy" && !meshPrivacyLoaded) {
      Promise.all([getMeshPrivacy(), getGlobalMeshStatus()]).then(([privacy, globalStatus]) => {
        if (privacy) {
          setMeshVisibility(privacy.meshVisibility);
          setBranchOverrides(typeof privacy.branchOverrides === "string" ? JSON.parse(privacy.branchOverrides) : privacy.branchOverrides || {});
          setShowConnections(privacy.showConnections);
          setShowStats(privacy.showStats);
        }
        if (globalStatus) {
          setGlobalMeshActive(globalStatus.isActive);
          setGlobalMeshBranches(typeof globalStatus.sharedBranches === "string" ? JSON.parse(globalStatus.sharedBranches) : globalStatus.sharedBranches || []);
        }
        setMeshPrivacyLoaded(true);
      }).catch(() => setMeshPrivacyLoaded(true));
    }
  }, [activeTab, meshPrivacyLoaded]);

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "interests", label: "Interests & Links", icon: Palette },
    { id: "customize", label: "Customize", icon: Paintbrush },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy & Safety", icon: Shield },
    { id: "mesh-privacy", label: "Mesh Privacy", icon: Globe },
    { id: "security", label: "Security", icon: Lock },
    { id: "security-hub", label: "Security Hub", icon: ShieldCheck },
    { id: "footprint", label: "Digital Footprint", icon: Fingerprint },
    { id: "blocked", label: "Blocked Users", icon: UserX },
    { id: "achievements", label: "Achievements", icon: Trophy },
    { id: "meshi", label: "Meshi (Beta)", icon: Sparkles },
    { id: "meshpro", label: "MeshPro", icon: Crown },
  ];

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("displayName", displayName);
    formData.set("bio", bio);
    formData.set("location", location);
    formData.set("website", website);
    formData.set("accentColor", accentColor);

    startTransition(async () => {
      const result = await updateProfile(formData);
      if (result && "error" in result) {
        showError(result.error || "Failed to update profile");
      } else {
        showSuccess("Profile updated successfully");
      }
    });
  };

  const handleSaveInterests = () => {
    startTransition(async () => {
      await updateUserInterests(selectedInterests);
      await updateUserLinks(links);
      showSuccess("Interests and links updated");
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("currentPassword", currentPassword);
    formData.set("newPassword", newPassword);
    formData.set("confirmPassword", confirmPassword);

    startTransition(async () => {
      const result = await changePassword(formData);
      if (result && "error" in result) {
        showError(result.error || "Failed to change password");
      } else {
        showSuccess("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  };

  const handleTogglePrivacy = (val: boolean) => {
    setIsPublic(val);
    const formData = new FormData();
    formData.set("isPublic", val.toString());
    startTransition(async () => {
      await updatePrivacy(formData);
      showSuccess("Privacy settings updated");
    });
  };

  const handleUnblock = (userId: string) => {
    startTransition(async () => {
      await toggleBlock(userId);
      setBlockedUsers((prev) => prev.filter((b) => b.blocked.id !== userId));
      showSuccess("User unblocked");
    });
  };

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut();
    });
  };

  const handleDeleteAccount = () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }
    startTransition(async () => {
      await deleteAccount();
    });
  };

  const addLink = () => {
    setLinks([...links, { label: "", url: "" }]);
  };

  const removeLink = (index: number) => {
    setLinks(links.filter((_, i) => i !== index));
  };

  const updateLinkField = (index: number, field: "label" | "url", value: string) => {
    setLinks(links.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  };

  const toggleInterest = (tag: string) => {
    setSelectedInterests((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 glass-surface rounded w-48" />
          <div className="h-64 glass-surface rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div data-meshi-zone="settings" className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-6 w-6" style={{ color: "var(--accent)" }} />
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Settings</h1>
      </div>

      <AnimatePresence mode="wait">
        {(success || error) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-6 text-sm rounded-xl px-4 py-3 flex items-center gap-2 ${
              success
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border border-red-500/20 text-red-400"
            }`}
          >
            {success ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {success || error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-8">
        {/* Sidebar */}
        <nav className="w-52 flex-shrink-0 hidden md:block">
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  activeTab === tab.id
                    ? tab.id === "meshpro"
                      ? "glass-surface font-medium" + " text-[var(--accent)]"
                      : "glass-surface text-[var(--text-primary)] font-medium"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <tab.icon className="h-4 w-4" style={tab.id === "meshpro" ? { color: "var(--accent)" } : undefined} />
                {tab.label}
                {tab.id === "meshpro" && (
                  <span className="ml-auto text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background: "var(--brand-gradient)" }}>PRO</span>
                )}
              </button>
            ))}
            <div className="pt-3 mt-3 border-t border-[var(--border-primary)]">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile tabs */}
          <div className="flex gap-1 mb-6 md:hidden overflow-x-auto pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "glass-surface text-[var(--text-primary)]"
                    : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleSaveProfile}
              className="space-y-5"
            >
              <MeshiSettingsTip tab="profile" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Edit profile</h2>

              <div className="flex items-center gap-4 mb-4">
                <Avatar src={settings?.avatarUrl} alt={displayName} size="lg" />
                <div>
                  <p className="text-sm text-[var(--text-secondary)] font-medium">@{settings?.username}</p>
                  <p className="text-xs text-[var(--text-muted)]">{settings?.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Display name</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your display name" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Bio</label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell people about yourself" rows={3} maxLength={160} />
                <p className="text-xs text-[var(--text-muted)] mt-1">{bio.length}/160</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Location</label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Website</label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yoursite.com" />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Accent color</label>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAccentColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        accentColor === color ? "border-white scale-110" : "border-transparent hover:scale-105"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <Button type="submit" variant="gradient" disabled={isPending}>
                {isPending ? "Saving..." : "Save changes"}
              </Button>
            </motion.form>
          )}

          {/* Interests & Links Tab */}
          {activeTab === "interests" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <MeshiSettingsTip tab="interests" />
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Interests</h2>
                <p className="text-sm text-[var(--text-muted)] mb-4">Select topics you&apos;re interested in to personalize your experience</p>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        selectedInterests.includes(tag)
                          ? "brand-button text-white"
                          : "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Social links</h2>
                  <button type="button" onClick={addLink} className="flex items-center gap-1 text-sm transition-colors" style={{ color: "var(--accent)" }}>
                    <Plus className="h-4 w-4" /> Add link
                  </button>
                </div>
                <div className="space-y-3">
                  {links.map((link, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 flex gap-2">
                        <Input value={link.label} onChange={(e) => updateLinkField(i, "label", e.target.value)} placeholder="Label (e.g. YouTube)" className="w-1/3" />
                        <Input value={link.url} onChange={(e) => updateLinkField(i, "url", e.target.value)} placeholder="https://..." className="flex-1" />
                      </div>
                      <button type="button" onClick={() => removeLink(i)} className="p-2 text-[var(--text-muted)] hover:text-red-400 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {links.length === 0 && (
                    <p className="text-sm text-[var(--text-muted)]">No links added yet. Add your social profiles, website, or other links.</p>
                  )}
                </div>
              </div>

              <Button onClick={handleSaveInterests} variant="gradient" disabled={isPending}>
                {isPending ? "Saving..." : "Save interests & links"}
              </Button>
            </motion.div>
          )}

          {/* Customize Tab */}
          {activeTab === "customize" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
              <MeshiSettingsTip tab="customize" />
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Customize your experience</h2>
                <p className="text-sm text-[var(--text-muted)] mb-6">Make mesh.me feel like yours</p>
              </div>

              {/* Theme selection */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <Paintbrush className="h-4 w-4" style={{ color: "var(--accent)" }} /> Theme
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {THEME_OPTIONS.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setSelectedTheme(theme.id)}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        selectedTheme === theme.id
                          ? "bg-[var(--bg-tertiary)]" + " border-[var(--accent)]"
                          : "glass-surface hover:border-[var(--glass-border)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.bg, border: "1px solid rgba(255,255,255,0.1)" }} />
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.accent }} />
                      </div>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{theme.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Feed layout preference */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <Layout className="h-4 w-4" style={{ color: "var(--accent)" }} /> Default feed layout
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {FEED_LAYOUTS.map((layout) => (
                    <button
                      key={layout.id}
                      onClick={() => setSelectedLayout(layout.id)}
                      className={`p-3 rounded-xl border-2 transition-all text-left ${
                        selectedLayout === layout.id
                          ? "bg-[var(--bg-tertiary)]" + " border-[var(--accent)]"
                          : "glass-surface hover:border-[var(--glass-border)]"
                      }`}
                    >
                      <span className="text-sm font-medium text-[var(--text-primary)] block">{layout.label}</span>
                      <span className="text-xs text-[var(--text-muted)]">{layout.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mesh density */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4" style={{ color: "var(--accent)" }} /> Background mesh
                </h3>
                <div className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
                  <div>
                    <span className="text-sm text-[var(--text-primary)] block font-medium">Show constellation mesh</span>
                    <span className="text-xs text-[var(--text-muted)]">Animated node background across the app</span>
                  </div>
                  <button type="button" className="relative w-11 h-6 bg-[var(--accent)] rounded-full transition-colors">
                    <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
                  <div>
                    <span className="text-sm text-[var(--text-primary)] block font-medium">Reduced motion</span>
                    <span className="text-xs text-[var(--text-muted)]">Minimize animations for accessibility</span>
                  </div>
                  <button type="button" className="relative w-11 h-6 bg-[var(--bg-hover)] rounded-full transition-colors">
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
              </div>

              <Button variant="gradient" disabled={isPending}>
                {isPending ? "Saving..." : "Save preferences"}
              </Button>
            </motion.div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <MeshiSettingsTip tab="notifications" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Notification preferences</h2>
              <p className="text-sm text-[var(--text-muted)] mb-6">Choose what notifications you want to receive</p>
              <div className="space-y-1">
                {[
                  { label: "New followers", desc: "When someone follows you", state: notifFollowers, setter: setNotifFollowers },
                  { label: "Likes on your posts", desc: "When someone likes your content", state: notifLikes, setter: setNotifLikes },
                  { label: "Comments & replies", desc: "When someone comments on your posts", state: notifComments, setter: setNotifComments },
                  { label: "Direct messages", desc: "When you receive a new message", state: notifMessages, setter: setNotifMessages },
                  { label: "Community activity", desc: "Updates from your communities", state: notifCommunity, setter: setNotifCommunity },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
                    <div>
                      <span className="text-sm text-[var(--text-primary)] block font-medium">{item.label}</span>
                      <span className="text-xs text-[var(--text-muted)]">{item.desc}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => item.setter(!item.state)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${item.state ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${item.state ? "right-0.5" : "left-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>

              {/* AI Smart Notifications */}
              <div className="mt-6 rounded-xl rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4" style={{ color: "var(--accent)" }} />
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">AI Smart Notifications</h3>
                </div>
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  Intelligently summarize and batch your notifications instead of individual alerts.
                  mesh.me AI will condense 47 notifications into one clean summary.
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">Enable AI summaries</span>
                  <button
                    type="button"
                    onClick={() => setNotifAISummary(!notifAISummary)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${notifAISummary ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${notifAISummary ? "right-0.5" : "left-0.5"}`} />
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Privacy Tab */}
          {activeTab === "privacy" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <MeshiSettingsTip tab="privacy" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Privacy & Safety</h2>
              <div className="space-y-1">
                <div className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
                  <div>
                    <span className="text-sm text-[var(--text-primary)] block font-medium">Public account</span>
                    <span className="text-xs text-[var(--text-muted)]">Anyone can see your posts and profile</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePrivacy(!isPublic)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${isPublic ? "right-0.5" : "left-0.5"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
                  <div>
                    <span className="text-sm text-[var(--text-primary)] block font-medium">Who can message you</span>
                    <span className="text-xs text-[var(--text-muted)]">Control who can send you direct messages</span>
                  </div>
                  <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>Everyone</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
                  <div>
                    <span className="text-sm text-[var(--text-primary)] block font-medium">Show in discovery</span>
                    <span className="text-xs text-[var(--text-muted)]">Allow others to find you through explore</span>
                  </div>
                  <button type="button" className="relative w-11 h-6 bg-[var(--accent)] rounded-full transition-colors">
                    <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
                  <div>
                    <span className="text-sm text-[var(--text-primary)] block font-medium">Hide activity status</span>
                    <span className="text-xs text-[var(--text-muted)]">Others won&apos;t see when you&apos;re online</span>
                  </div>
                  <button type="button" className="relative w-11 h-6 bg-[var(--bg-hover)] rounded-full transition-colors">
                    <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
                  <div>
                    <span className="text-sm text-[var(--text-primary)] block font-medium">Read receipts</span>
                    <span className="text-xs text-[var(--text-muted)]">Show when you&apos;ve read messages</span>
                  </div>
                  <button type="button" className="relative w-11 h-6 bg-[var(--accent)] rounded-full transition-colors">
                    <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
              </div>

              {/* Zero-Knowledge Privacy Commitment */}
              <div className="mt-8 bg-gradient-to-r from-emerald-500/5 to-blue-500/5 border border-emerald-500/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center">
                    <Shield className="h-3.5 w-3.5 text-white" />
                  </div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Our Privacy Commitment to You</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { title: "Zero-knowledge architecture", desc: "mesh.me is designed so we cannot read your private messages or access data you haven't explicitly shared. Your content is yours." },
                    { title: "No behavioral tracking", desc: "We don't track what you click, how long you scroll, or build profiles of your habits. No analytics on your behavior, ever." },
                    { title: "No data selling", desc: "Your data is never sold, shared with advertisers, or used to train AI models. mesh.me makes money only through MeshPro subscriptions." },
                    { title: "Minimal data storage", desc: "We store only what's necessary to run the platform. Nothing more. You can see exactly what we store in our transparency report." },
                    { title: "True deletion", desc: "When you delete something, it's gone. No soft-deletes that linger in our database. No 30-day retention periods on your content." },
                    { title: "Full data export", desc: "You own your data. Export everything at any time in a standard format. Your digital life should never be held hostage." },
                    { title: "End-to-end encrypted messaging", desc: "MeChat conversations are designed for E2E encryption. Not even mesh.me can read your messages in transit or at rest." },
                    { title: "Open transparency", desc: "We publish what data we collect, why we collect it, and how long we keep it. No buried terms, no legal tricks." },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-2.5">
                      <div className="h-4 w-4 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Lock className="h-2.5 w-2.5 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{item.title}</p>
                        <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-[var(--border-primary)]">
                <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Danger zone
                </h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">These actions are irreversible. Please be certain.</p>
                {deleteConfirm ? (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <p className="text-sm text-red-300 mb-3">Are you sure? This will permanently delete your account, posts, messages, and all associated data.</p>
                    <div className="flex gap-2">
                      <Button variant="danger" size="sm" onClick={handleDeleteAccount} disabled={isPending}>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        {isPending ? "Deleting..." : "Yes, delete my account"}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="danger" size="sm" onClick={handleDeleteAccount}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete my account
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* Mesh Privacy Tab */}
          {activeTab === "mesh-privacy" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <MeshiSettingsTip tab="privacy" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Mesh Privacy Controls</h2>
              <p className="text-sm text-[var(--text-muted)] mb-6">Control who can see your mesh, your connections, and your data. Privacy is our #1 priority.</p>

              {!meshPrivacyLoaded ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-6 w-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "var(--accent)" }} />
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Overall Mesh Visibility */}
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                      <Eye className="h-4 w-4" style={{ color: "var(--accent)" }} />
                      Overall Mesh Visibility
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mb-3">Who can see your mesh visualization and connections?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "private", label: "Private", desc: "Only you can see your mesh" },
                        { id: "friends", label: "Friends Only", desc: "Mutual followers can view" },
                        { id: "public", label: "Public", desc: "Anyone can see your mesh" },
                        { id: "partial", label: "Custom", desc: "Per-branch visibility below" },
                      ].map((opt) => (
                        <button
                          key={opt.id}
                          onClick={() => setMeshVisibility(opt.id)}
                          className={`p-3 rounded-xl text-left transition-all border ${meshVisibility === opt.id ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-primary)] hover:border-[var(--border-secondary)]"}`}
                        >
                          <p className={`text-sm font-medium ${meshVisibility === opt.id ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>{opt.label}</p>
                          <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Per-Branch Visibility (only if partial or public) */}
                  {(meshVisibility === "partial" || meshVisibility === "public") && (
                    <div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                        <Activity className="h-4 w-4" style={{ color: "var(--accent)" }} />
                        Per-Branch Visibility
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mb-3">Override visibility for each branch of your mesh.</p>
                      <div className="space-y-2">
                        {[
                          { key: "people", label: "People", icon: Users },
                          { key: "communities", label: "Communities", icon: Users },
                          { key: "interests", label: "Interests", icon: Heart },
                          { key: "platforms", label: "Connected Platforms", icon: Globe },
                        ].map((branch) => {
                          const Icon = branch.icon;
                          const current = branchOverrides[branch.key] || meshVisibility;
                          return (
                            <div key={branch.key} className="flex items-center justify-between py-2.5 px-3 rounded-xl border border-[var(--border-primary)]">
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4 text-[var(--text-muted)]" />
                                <span className="text-sm text-[var(--text-primary)]">{branch.label}</span>
                              </div>
                              <select
                                value={current}
                                onChange={(e) => setBranchOverrides((prev) => ({ ...prev, [branch.key]: e.target.value }))}
                                className="text-xs px-2 py-1 rounded-lg border border-[var(--border-primary)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                              >
                                <option value="private">Private</option>
                                <option value="friends">Friends</option>
                                <option value="public">Public</option>
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Additional Privacy Toggles */}
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Additional Controls</h3>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
                        <div>
                          <span className="text-sm text-[var(--text-primary)] block font-medium">Show connections</span>
                          <span className="text-xs text-[var(--text-muted)]">Let others see the lines between your mesh nodes</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowConnections(!showConnections)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${showConnections ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${showConnections ? "right-0.5" : "left-0.5"}`} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
                        <div>
                          <span className="text-sm text-[var(--text-primary)] block font-medium">Show stats</span>
                          <span className="text-xs text-[var(--text-muted)]">Display follower counts and mesh stats to viewers</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowStats(!showStats)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${showStats ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${showStats ? "right-0.5" : "left-0.5"}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Save Mesh Privacy */}
                  <Button
                    onClick={() => {
                      startTransition(async () => {
                        const result = await updateMeshPrivacy({
                          meshVisibility,
                          branchOverrides,
                          showConnections,
                          showStats,
                        });
                        if (result && "error" in result) {
                          showError(result.error || "Failed to update mesh privacy");
                        } else {
                          showSuccess("Mesh privacy settings saved");
                        }
                      });
                    }}
                    disabled={isPending}
                  >
                    {isPending ? "Saving..." : "Save Mesh Privacy"}
                  </Button>

                  {/* Global Mesh Section */}
                  <div className="pt-6 border-t border-[var(--border-primary)]">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                      <Globe className="h-4 w-4" style={{ color: "var(--accent)" }} />
                      Global Mesh
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mb-4">
                      Opt-in to share parts of your mesh with the world. Choose which branches are visible on the global mesh. You can withdraw anytime.
                    </p>

                    <div className="flex items-center justify-between py-3 mb-4 border-b border-[var(--border-primary)]">
                      <div>
                        <span className="text-sm text-[var(--text-primary)] block font-medium">Join Global Mesh</span>
                        <span className="text-xs text-[var(--text-muted)]">Share selected branches with everyone</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const newState = !globalMeshActive;
                          setGlobalMeshActive(newState);
                          startTransition(async () => {
                            if (newState) {
                              await optIntoGlobalMesh(globalMeshBranches);
                              showSuccess("Joined Global Mesh!");
                            } else {
                              await optOutOfGlobalMesh();
                              showSuccess("Left Global Mesh");
                            }
                          });
                        }}
                        className={`relative w-11 h-6 rounded-full transition-colors ${globalMeshActive ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`}
                      >
                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${globalMeshActive ? "right-0.5" : "left-0.5"}`} />
                      </button>
                    </div>

                    {globalMeshActive && (
                      <div className="space-y-2">
                        <p className="text-xs text-[var(--text-muted)] mb-2">Select which branches to share:</p>
                        {[
                          { key: "people", label: "People (connections)", icon: Users },
                          { key: "communities", label: "Communities", icon: Users },
                          { key: "interests", label: "Interests", icon: Heart },
                          { key: "platforms", label: "Connected Platforms", icon: Globe },
                        ].map((branch) => {
                          const Icon = branch.icon;
                          const isShared = globalMeshBranches.includes(branch.key);
                          return (
                            <button
                              key={branch.key}
                              onClick={() => {
                                const updated = isShared
                                  ? globalMeshBranches.filter((b) => b !== branch.key)
                                  : [...globalMeshBranches, branch.key];
                                setGlobalMeshBranches(updated);
                                startTransition(async () => {
                                  await updateGlobalMeshBranches(updated);
                                });
                              }}
                              className={`w-full flex items-center gap-3 py-2.5 px-3 rounded-xl border transition-all ${isShared ? "border-[var(--accent)] bg-[var(--accent)]/5" : "border-[var(--border-primary)] hover:border-[var(--border-secondary)]"}`}
                            >
                              <Icon className={`h-4 w-4 ${isShared ? "text-[var(--accent)]" : "text-[var(--text-muted)]"}`} />
                              <span className={`text-sm ${isShared ? "text-[var(--accent)] font-medium" : "text-[var(--text-secondary)]"}`}>{branch.label}</span>
                              {isShared && <Check className="h-3.5 w-3.5 ml-auto text-[var(--accent)]" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <motion.form
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onSubmit={handleChangePassword}
              className="space-y-5"
            >
              <MeshiSettingsTip tab="security" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Change password</h2>
              <p className="text-sm text-[var(--text-muted)] mb-4">Choose a strong password with at least 8 characters</p>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Current password</label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">New password</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1.5">Confirm new password</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
              </div>

              <Button type="submit" variant="gradient" disabled={isPending}>
                {isPending ? "Changing..." : "Change password"}
              </Button>
            </motion.form>
          )}

          {/* Blocked Users Tab */}
          {activeTab === "blocked" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <MeshiSettingsTip tab="blocked" />
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Blocked users</h2>
              <p className="text-sm text-[var(--text-muted)] mb-6">Blocked users cannot see your profile, posts, or message you.</p>
              {blockedUsers.length > 0 ? (
                <div className="space-y-2">
                  {blockedUsers.map((block) => (
                    <div key={block.id} className="flex items-center justify-between p-3 rounded-xl glass-surface">
                      <div className="flex items-center gap-3">
                        <Avatar src={block.blocked.avatarUrl} alt={block.blocked.displayName} size="sm" />
                        <div>
                          <span className="text-sm font-medium text-[var(--text-primary)]">{block.blocked.displayName}</span>
                          <span className="text-xs text-[var(--text-muted)] block">@{block.blocked.username}</span>
                        </div>
                      </div>
                      <Button variant="secondary" size="sm" onClick={() => handleUnblock(block.blocked.id)} disabled={isPending}>
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <UserX className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-3" />
                  <p className="text-sm text-[var(--text-muted)]">No blocked users</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Security Hub Tab */}
          {activeTab === "security-hub" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <MeshiSettingsTip tab="security-hub" />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-5 w-5" style={{ color: "var(--accent)" }} />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Security Hub</h2>
                </div>
                <p className="text-sm text-[var(--text-muted)]">
                  Manage and remove your content across all connected platforms from one place.
                </p>
              </div>

              {/* Cross-platform content management */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <FileText className="h-4 w-4" style={{ color: "var(--accent)" }} /> Content Management
                </h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Delete posts, comments, videos, or entire channels across your connected platforms directly from mesh.me.
                </p>
                <div className="space-y-3">
                  {[
                    { icon: FileText, label: "Posts & Photos", desc: "Review and delete posts across platforms", count: 0 },
                    { icon: Video, label: "Videos", desc: "Manage uploaded videos on YouTube, TikTok, etc.", count: 0 },
                    { icon: MessageSquare, label: "Comments & Replies", desc: "Find and remove your comments anywhere", count: 0 },
                  ].map((item) => (
                    <button key={item.label} className="w-full flex items-center gap-3 p-3 rounded-xl glass-surface hover:border-[var(--glass-border)] transition-all text-left group">
                      <div className="h-9 w-9 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center flex-shrink-0">
                        <item.icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-[var(--text-primary)] block">{item.label}</span>
                        <span className="text-xs text-[var(--text-muted)]">{item.desc}</span>
                      </div>
                      <ExternalLink className="h-4 w-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Active sessions */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Activity className="h-4 w-4" style={{ color: "var(--accent)" }} /> Active Sessions
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-xl glass-surface">
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-emerald-500" />
                      <div>
                        <span className="text-sm text-[var(--text-primary)] block">Current session</span>
                        <span className="text-xs text-[var(--text-muted)]">This device &middot; Active now</span>
                      </div>
                    </div>
                    <span className="text-xs text-emerald-400 font-medium">Current</span>
                  </div>
                </div>
                <Button variant="secondary" size="sm" className="mt-3 w-full">
                  Sign out all other sessions
                </Button>
              </div>

              {/* Data export */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                  <Scan className="h-4 w-4" style={{ color: "var(--accent)" }} /> Data Export
                </h3>
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  Download a complete copy of all your mesh.me data including posts, messages, and account info.
                </p>
                <Button variant="secondary" size="sm">Request data export</Button>
              </div>
            </motion.div>
          )}

          {/* Digital Footprint Tab */}
          {activeTab === "footprint" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <MeshiSettingsTip tab="footprint" />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Fingerprint className="h-5 w-5" style={{ color: "var(--accent)" }} />
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Digital Footprint</h2>
                  <span className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded-full" style={{ background: "var(--brand-gradient)" }}>PRO</span>
                </div>
                <p className="text-sm text-[var(--text-muted)]">
                  See your entire digital presence — the known and unknown. Find every account, mention, and trace linked to your identity.
                </p>
              </div>

              {/* Scanner */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <Search className="h-4 w-4" style={{ color: "var(--accent)" }} /> Identity Scanner
                </h3>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Scan the web for accounts and data associated with your email, phone number, name, and usernames. Similar to services like Incogni but more comprehensive.
                </p>
                <div className="space-y-3 mb-4">
                  {[
                    { icon: Mail, label: "Email addresses", desc: "Find accounts registered with your emails", status: "Not scanned" },
                    { icon: Phone, label: "Phone numbers", desc: "Discover accounts linked to your phone", status: "Not scanned" },
                    { icon: UserCheck, label: "Usernames & names", desc: "Search for your name and aliases across platforms", status: "Not scanned" },
                    { icon: Globe, label: "Data brokers", desc: "Check if your info appears on data broker sites", status: "Not scanned" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl glass-surface">
                      <div className="h-9 w-9 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center flex-shrink-0">
                        <item.icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-[var(--text-primary)] block">{item.label}</span>
                        <span className="text-xs text-[var(--text-muted)]">{item.desc}</span>
                      </div>
                      <span className="text-xs text-[var(--text-muted)] whitespace-nowrap">{item.status}</span>
                    </div>
                  ))}
                </div>
                <Button variant="gradient" className="w-full">
                  <Scan className="h-4 w-4 mr-2" /> Run Full Scan
                </Button>
              </div>

              {/* Footprint overview (placeholder for Pro) */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" style={{ color: "var(--accent)" }} /> Footprint Overview
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: "Known accounts", value: "--", icon: Users, color: "text-[var(--accent)]" },
                    { label: "Data exposures", value: "--", icon: AlertTriangle, color: "text-amber-400" },
                    { label: "Privacy score", value: "--", icon: Shield, color: "text-emerald-400" },
                    { label: "Risk level", value: "--", icon: Activity, color: "text-cyan-400" },
                  ].map((stat) => (
                    <div key={stat.label} className="p-3 rounded-xl glass-surface text-center">
                      <stat.icon className={`h-5 w-5 mx-auto mb-1 ${stat.color}`} />
                      <span className="text-lg font-bold text-[var(--text-primary)] block">{stat.value}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{stat.label}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-[var(--text-muted)] text-center">
                  Run a scan to populate your footprint overview
                </p>
              </div>

              {/* Cross-platform analytics */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" style={{ color: "var(--accent)" }} /> Cross-Platform Analytics
                </h3>
                <p className="text-xs text-[var(--text-muted)] mb-3">
                  In-depth stats on your digital presence across all connected platforms — engagement trends, follower growth, content performance, and audience demographics.
                </p>
                <div className="space-y-2">
                  {[
                    { label: "Total reach across platforms", value: "--" },
                    { label: "Engagement rate (avg)", value: "--" },
                    { label: "Content published (30 days)", value: "--" },
                    { label: "Follower growth (30 days)", value: "--" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-2 border-b border-[var(--border-primary)] last:border-0">
                      <span className="text-xs text-[var(--text-secondary)]">{item.label}</span>
                      <span className="text-sm font-medium text-[var(--text-primary)]">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Achievements Tab */}
          {activeTab === "achievements" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <MeshiSettingsTip tab="achievements" />
              <div>
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                  <Trophy className="h-5 w-5" style={{ color: "var(--accent)" }} />
                  Achievements & Titles
                </h2>
                <p className="text-sm text-[var(--text-muted)] mb-6">
                  Earn titles through milestones on mesh.me. Titles are displayed on your profile for others to see.
                </p>
              </div>

              {/* Active title selector */}
              <div className="glass-card rounded-2xl p-5 mb-6">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                  <Award className="h-4 w-4" style={{ color: "var(--accent)" }} /> Active Title
                </h3>
                <p className="text-xs text-[var(--text-muted)] mb-3">Choose a title to display on your profile</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { startTransition(async () => { await setActiveTitle(null); setUserActiveTitle(null); showSuccess("Title removed"); }); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!userActiveTitle ? "brand-button text-white" : "glass-surface text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}
                  >
                    None
                  </button>
                  {unlockedSlugs.length === 0 && !achievementLoading && (
                    <p className="text-xs text-[var(--text-muted)] py-1.5">Earn achievements to unlock titles!</p>
                  )}
                </div>
              </div>

              {/* Achievement list */}
              {achievementLoading ? (
                <div className="text-center py-8">
                  <div className="h-8 w-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "var(--accent)" }} />
                  <p className="text-sm text-[var(--text-muted)]">Checking achievements...</p>
                </div>
              ) : (
                <AchievementList unlockedSlugs={unlockedSlugs} />
              )}

              {/* Pioneer callout */}
              <div className="glass-card rounded-2xl p-5 border border-amber-400/20 bg-amber-400/5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400/20 to-yellow-600/20 flex items-center justify-center border-2 border-amber-400/40">
                    <Crown className="h-5 w-5 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-400">Pioneer — Limited Edition</h3>
                    <p className="text-xs text-[var(--text-muted)]">First 1,000,000 verified mesh.me users</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
                  The Pioneer title is a limited edition achievement awarded to the first 1 million fully verified mesh.me users.
                  Once all 1 million spots are claimed, this title can never be earned again. Verify your account to claim yours!
                </p>
              </div>
            </motion.div>
          )}

          {/* Meshi Customization Tab */}
          {activeTab === "meshi" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
              <MeshiSettingsTip tab="meshi" />
              <div className="text-center mb-6">
                <MeshiMascot size={80} mood={meshiFace} hat={meshiHat} color={meshiColor} speaking={false} />
                <h2 className="text-lg font-semibold text-[var(--text-primary)] mt-4 mb-1">Meshi <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-white ml-1" style={{ background: "var(--accent)" }}>Beta</span></h2>
                <p className="text-sm text-[var(--text-muted)]">Your AI assistant for navigating the mesh</p>
              </div>

              {/* Enable / Disable Meshi */}
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">Enable Meshi</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Show the floating Meshi assistant across the app</p>
                  </div>
                  <button
                    onClick={() => {
                      const newVal = !meshiEnabled;
                      setMeshiEnabled(newVal);
                      localStorage.setItem("meshiEnabled", String(newVal));
                      // Dispatch storage event for other components listening
                      window.dispatchEvent(new StorageEvent("storage", { key: "meshiEnabled", newValue: String(newVal) }));
                      showSuccess(newVal ? "Meshi enabled" : "Meshi disabled");
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      meshiEnabled ? "bg-[var(--accent)]" : "bg-[var(--bg-tertiary)]"
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      meshiEnabled ? "translate-x-6" : "translate-x-1"
                    }`} />
                  </button>
                </div>
              </div>

              {/* Customize section - only show when enabled */}
              {meshiEnabled && (
                <>
                <div className="text-center mb-2">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Customize Meshi</h3>
                  <p className="text-[10px] text-[var(--accent)] mt-1 flex items-center justify-center gap-1">
                    <Sparkles className="h-3 w-3" /> MeshPro feature
                  </p>
                </div>

              {/* Face style */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Expression</h3>
                <div className="grid grid-cols-4 gap-3">
                  {(["happy", "excited", "thinking", "sleepy", "surprised", "love", "cool", "wink"] as MeshiMood[]).map((face) => (
                    <button
                      key={face}
                      onClick={() => {
                        setMeshiFace(face);
                        startTransition(async () => {
                          await updateMeshiPreference({ faceStyle: face });
                          showSuccess("Expression updated!");
                        });
                      }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiFace === face ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                    >
                      <MeshiMascot size={36} mood={face} color={meshiColor} animate={false} showGlow={false} />
                      <span className="text-[10px] text-[var(--text-secondary)] capitalize">{face}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Hat style */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Hat</h3>
                <div className="grid grid-cols-4 gap-3">
                  {(["none", "tophat", "crown", "beanie", "cap", "party", "flower"] as MeshiHat[]).map((hat) => (
                    <button
                      key={hat}
                      onClick={() => {
                        setMeshiHat(hat);
                        startTransition(async () => {
                          await updateMeshiPreference({ hatStyle: hat });
                          showSuccess("Hat updated!");
                        });
                      }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiHat === hat ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                    >
                      <MeshiMascot size={36} mood={meshiFace} hat={hat} color={meshiColor} animate={false} showGlow={false} />
                      <span className="text-[10px] text-[var(--text-secondary)] capitalize">{hat}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color theme */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Color</h3>
                <div className="grid grid-cols-4 gap-3">
                  {(["blue", "purple", "pink", "green", "orange", "cyan", "gold", "rainbow"] as MeshiColor[]).map((color) => (
                    <button
                      key={color}
                      onClick={() => {
                        setMeshiColor(color);
                        startTransition(async () => {
                          await updateMeshiPreference({ colorTheme: color });
                          showSuccess("Color updated!");
                        });
                      }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all ${meshiColor === color ? "ring-2 ring-[var(--accent)] bg-[var(--accent-subtle)]" : "glass-surface hover:bg-[var(--bg-tertiary)]"}`}
                    >
                      <MeshiMascot size={36} mood={meshiFace} hat={meshiHat} color={color} animate={false} showGlow={false} />
                      <span className="text-[10px] text-[var(--text-secondary)] capitalize">{color}</span>
                    </button>
                  ))}
                </div>
              </div>
              </>
              )}
            </motion.div>
          )}

          {/* MeshPro Tab */}
          {activeTab === "meshpro" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <MeshiSettingsTip tab="meshpro" />
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-xl" style={{ background: "var(--brand-gradient)" }}>
                  <Crown className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">MeshPro</h2>
                <p className="text-sm text-[var(--text-tertiary)] max-w-sm mx-auto">
                  Go deeper into your digital world with premium insights, security, and customization
                </p>
              </div>

              {/* What's free callout */}
              <div className="mb-6 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-4">
                <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                  <Check className="h-4 w-4" /> Nearly everything is free
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  The Mesh, Custom Feed, MeChat, communities, search, notifications, connected accounts, profile customization, and all core features are 100% free forever. MeshPro just gives you extra tools to go deeper.
                </p>
              </div>

              {/* Pricing */}
              <div className="grid md:grid-cols-2 gap-4 mb-8">
                <div className="glass-card rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Monthly</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-3xl font-bold text-[var(--text-primary)]">$4.99</span>
                    <span className="text-sm text-[var(--text-muted)]">/month</span>
                  </div>
                  <Button variant="secondary" className="w-full">Subscribe</Button>
                </div>
                <div className="border-2 rounded-2xl p-6 relative" style={{ borderColor: "var(--accent-muted)", background: "var(--accent-subtle)" }}>
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full" style={{ background: "var(--brand-gradient)" }}>
                    BEST VALUE
                  </div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Yearly</h3>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold text-[var(--text-primary)]">$39.99</span>
                    <span className="text-sm text-[var(--text-muted)]">/year</span>
                  </div>
                  <p className="text-xs text-emerald-400 mb-4">Save 33% — that&apos;s $3.33/month</p>
                  <Button variant="gradient" className="w-full">Subscribe</Button>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">What you get with Pro</h3>
                {[
                  { icon: Fingerprint, title: "Digital Footprint Scanner", desc: "Find every account, data broker listing, and trace linked to your identity across the entire web" },
                  { icon: Sparkles, title: "Customize Meshi", desc: "Give Meshi hats, change expressions, and pick custom colors \u2014 make your guide uniquely yours" },
                  { icon: Palette, title: "Mesh Cosmetics", desc: "Add visual effects to your mesh that other users can see \u2014 glow trails, particle effects, and node styles" },
                  { icon: BarChart3, title: "Cross-platform analytics", desc: "In-depth stats on your digital presence \u2014 engagement, reach, follower growth, content performance" },
                  { icon: TrendingUp, title: "Audience insights", desc: "Understand who engages with your content across all platforms" },
                  { icon: ShieldCheck, title: "Advanced Security Hub", desc: "Manage and mass-delete content across connected platforms, monitor active sessions" },
                  { icon: Crown, title: "Verified badge", desc: "Stand out with a verified profile badge" },
                  { icon: Eye, title: "Profile analytics", desc: "See who views your profile and detailed post insights" },
                  { icon: Sparkles, title: "Advanced AI summaries", desc: "More detailed and personalized AI notification digests" },
                  { icon: Layout, title: "Extra feed layouts", desc: "Unlock additional feed layout options and customizations" },
                ].map((feature) => (
                  <div key={feature.title} className="flex items-start gap-3 p-3 rounded-xl glass-surface">
                    <div className="h-8 w-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center flex-shrink-0">
                      <feature.icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-[var(--text-primary)]">{feature.title}</h4>
                      <p className="text-xs text-[var(--text-muted)]">{feature.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* No ads promise */}
              <div className="mt-8 rounded-2xl p-6 text-center" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-muted)" }}>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Zero ads. Ever.</h3>
                <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
                  mesh.me will never show advertisements or sell your data. MeshPro subscriptions are the only way we fund the platform.
                  Your experience, your data, your space \u2014 always clean, always private.
                </p>
              </div>
            </motion.div>
          )}

          {/* Mobile sign out */}
          <div className="mt-8 pt-4 border-t border-[var(--border-primary)] md:hidden">
            <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
