"use client";

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "@/lib/actions";
import {
  Settings, User, Shield, Bell, Lock, LogOut, Palette, Paintbrush,
  Globe, Fingerprint, UserX, Crown, Sparkles, ShieldCheck, Trophy, Users,
  Check, AlertTriangle,
} from "lucide-react";
import {
  ProfileTab, InterestsTab, CustomizeTab, NotificationsTab,
  PrivacyTab, MeshPrivacyTab, SecurityTab, SecurityHubTab,
  FootprintTab, BlockedTab, AchievementsTab, MeshiTab,
  AlterEgosTab, MeshProTab, DeleteAccountTab,
  type SettingsData, type BlockedUser,
} from "./tabs";

const tabs = [
  { id: "profile", label: "Profile", icon: User },
  { id: "interests", label: "Interests & Links", icon: Palette },
  { id: "customize", label: "Customize", icon: Paintbrush },
  { id: "alter-egos", label: "Alter Egos", icon: Users },
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
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
];

const tabIds = tabs.map((t) => t.id);

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

  // Links & Interests
  const [links, setLinks] = useState<{ label: string; url: string }[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Privacy
  const [isPublic, setIsPublic] = useState(true);
  const [showInDiscovery, setShowInDiscovery] = useState(true);
  const [hideActivityStatus, setHideActivityStatus] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);

  // Notifications
  const [notifFollowers, setNotifFollowers] = useState(true);
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifCommunity, setNotifCommunity] = useState(true);
  const [notifSmartSummary, setNotifSmartSummary] = useState(true);

  // Customization
  const [selectedTheme, setSelectedTheme] = useState("midnight");
  const [selectedLayout, setSelectedLayout] = useState("card");

  // Feedback
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const searchParams = useSearchParams();

  const showSuccess = (msg: string) => { setSuccess(msg); setError(""); setTimeout(() => setSuccess(""), 3000); };
  const showError = (msg: string) => { setError(msg); setSuccess(""); setTimeout(() => setError(""), 5000); };

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
          setShowInDiscovery(data.settings.showInDiscovery !== false);
          setHideActivityStatus(data.settings.hideActivityStatus === true);
          setReadReceipts(data.settings.readReceipts !== false);
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

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && tabIds.includes(tabParam)) setActiveTab(tabParam);
  }, [searchParams]);

  const handleSignOut = () => { signOut(); };

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
    <div data-meshi-zone="settings" className="max-w-3xl mx-auto px-4 py-6 animate-page-enter">
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
                      ? "glass-surface font-medium text-[var(--accent)]"
                      : tab.id === "danger"
                        ? "bg-red-500/10 text-red-400 font-medium"
                        : "glass-surface text-[var(--text-primary)] font-medium"
                    : tab.id === "danger"
                      ? "text-red-400/80 hover:text-red-300 hover:bg-red-500/10"
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
                    ? tab.id === "danger"
                      ? "bg-red-500/10 text-red-400"
                      : "glass-surface text-[var(--text-primary)]"
                    : tab.id === "danger"
                      ? "text-red-400/80 hover:text-red-300"
                      : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === "profile" && (
            <ProfileTab
              settings={settings} setSettings={setSettings}
              displayName={displayName} setDisplayName={setDisplayName}
              bio={bio} setBio={setBio}
              location={location} setLocation={setLocation}
              website={website} setWebsite={setWebsite}
              accentColor={accentColor} setAccentColor={setAccentColor}
              showSuccess={showSuccess} showError={showError}
            />
          )}
          {activeTab === "interests" && (
            <InterestsTab
              selectedInterests={selectedInterests} setSelectedInterests={setSelectedInterests}
              links={links} setLinks={setLinks}
              showSuccess={showSuccess}
            />
          )}
          {activeTab === "customize" && (
            <CustomizeTab
              selectedTheme={selectedTheme} setSelectedTheme={setSelectedTheme}
              selectedLayout={selectedLayout} setSelectedLayout={setSelectedLayout}
            />
          )}
          {activeTab === "notifications" && (
            <NotificationsTab
              notifFollowers={notifFollowers} setNotifFollowers={setNotifFollowers}
              notifLikes={notifLikes} setNotifLikes={setNotifLikes}
              notifComments={notifComments} setNotifComments={setNotifComments}
              notifMessages={notifMessages} setNotifMessages={setNotifMessages}
              notifCommunity={notifCommunity} setNotifCommunity={setNotifCommunity}
              notifSmartSummary={notifSmartSummary} setNotifSmartSummary={setNotifSmartSummary}
            />
          )}
          {activeTab === "privacy" && (
            <PrivacyTab
              isPublic={isPublic} setIsPublic={setIsPublic}
              showInDiscovery={showInDiscovery} setShowInDiscovery={setShowInDiscovery}
              hideActivityStatus={hideActivityStatus} setHideActivityStatus={setHideActivityStatus}
              readReceipts={readReceipts} setReadReceipts={setReadReceipts}
              showSuccess={showSuccess} showError={showError}
            />
          )}
          {activeTab === "mesh-privacy" && (
            <MeshPrivacyTab showSuccess={showSuccess} showError={showError} />
          )}
          {activeTab === "security" && (
            <SecurityTab showSuccess={showSuccess} showError={showError} />
          )}
          {activeTab === "security-hub" && <SecurityHubTab />}
          {activeTab === "footprint" && <FootprintTab />}
          {activeTab === "blocked" && (
            <BlockedTab blockedUsers={blockedUsers} setBlockedUsers={setBlockedUsers} showSuccess={showSuccess} />
          )}
          {activeTab === "achievements" && <AchievementsTab showSuccess={showSuccess} />}
          {activeTab === "meshi" && <MeshiTab showSuccess={showSuccess} isMeshPro={settings?.isMeshPro === true} />}
          {activeTab === "alter-egos" && <AlterEgosTab showSuccess={showSuccess} />}
          {activeTab === "meshpro" && <MeshProTab />}
          {activeTab === "danger" && <DeleteAccountTab showError={showError} />}

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
