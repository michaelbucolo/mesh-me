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
} from "@/lib/actions";
import { useState, useTransition, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { INTEREST_TAGS } from "@/lib/utils";

const ACCENT_COLORS = [
  "#6366f1", "#8b5cf6", "#a855f7", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6", "#06b6d4",
  "#3b82f6", "#6d28d9",
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
  const [accentColor, setAccentColor] = useState("#6366f1");

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
          setAccentColor(data.settings.accentColor || "#6366f1");
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

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

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

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "interests", label: "Interests & Links", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy & Safety", icon: Shield },
    { id: "security", label: "Security", icon: Lock },
    { id: "blocked", label: "Blocked Users", icon: UserX },
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
          <div className="h-8 bg-zinc-800 rounded w-48" />
          <div className="h-64 bg-zinc-800/50 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-6 w-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
      </div>

      {(success || error) && (
        <div className={`mb-6 text-sm rounded-xl px-4 py-3 flex items-center gap-2 ${
          success
            ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
            : "bg-red-500/10 border border-red-500/20 text-red-400"
        }`}>
          {success ? <Check className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {success || error}
        </div>
      )}

      <div className="flex gap-8">
        {/* Sidebar */}
        <nav className="w-52 flex-shrink-0 hidden md:block">
          <div className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  activeTab === tab.id
                    ? "bg-zinc-800 text-zinc-100 font-medium"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
            <div className="pt-3 mt-3 border-t border-zinc-800">
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
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Profile Tab */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-5">
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Edit profile</h2>

              <div className="flex items-center gap-4 mb-4">
                <Avatar src={settings?.avatarUrl} alt={displayName} size="lg" />
                <div>
                  <p className="text-sm text-zinc-300 font-medium">@{settings?.username}</p>
                  <p className="text-xs text-zinc-500">{settings?.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Display name</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your display name" />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Bio</label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell people about yourself" rows={3} maxLength={160} />
                <p className="text-xs text-zinc-500 mt-1">{bio.length}/160</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Location</label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Website</label>
                <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://yoursite.com" />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Accent color</label>
                <div className="flex flex-wrap gap-2">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setAccentColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        accentColor === color ? "border-white scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <Button type="submit" variant="gradient" disabled={isPending}>
                {isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          )}

          {/* Interests & Links Tab */}
          {activeTab === "interests" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100 mb-2">Interests</h2>
                <p className="text-sm text-zinc-500 mb-4">Select topics you&apos;re interested in to personalize your experience</p>
                <div className="flex flex-wrap gap-2">
                  {INTEREST_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleInterest(tag)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        selectedInterests.includes(tag)
                          ? "bg-indigo-600 text-white"
                          : "bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-zinc-100">Social links</h2>
                  <button type="button" onClick={addLink} className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300">
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
                      <button type="button" onClick={() => removeLink(i)} className="p-2 text-zinc-500 hover:text-red-400 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  {links.length === 0 && (
                    <p className="text-sm text-zinc-500">No links added yet. Add your social profiles, website, or other links.</p>
                  )}
                </div>
              </div>

              <Button onClick={handleSaveInterests} variant="gradient" disabled={isPending}>
                {isPending ? "Saving..." : "Save interests & links"}
              </Button>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Notification preferences</h2>
              <p className="text-sm text-zinc-500 mb-6">Choose what notifications you want to receive</p>
              <div className="space-y-1">
                {[
                  { label: "New followers", desc: "When someone follows you", state: notifFollowers, setter: setNotifFollowers },
                  { label: "Likes on your posts", desc: "When someone likes your content", state: notifLikes, setter: setNotifLikes },
                  { label: "Comments & replies", desc: "When someone comments on your posts", state: notifComments, setter: setNotifComments },
                  { label: "Direct messages", desc: "When you receive a new message", state: notifMessages, setter: setNotifMessages },
                  { label: "Community activity", desc: "Updates from your communities", state: notifCommunity, setter: setNotifCommunity },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                    <div>
                      <span className="text-sm text-zinc-200 block font-medium">{item.label}</span>
                      <span className="text-xs text-zinc-500">{item.desc}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => item.setter(!item.state)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${item.state ? "bg-indigo-600" : "bg-zinc-700"}`}
                    >
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${item.state ? "right-0.5" : "left-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === "privacy" && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Privacy & Safety</h2>
              <div className="space-y-1">
                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                  <div>
                    <span className="text-sm text-zinc-200 block font-medium">Public account</span>
                    <span className="text-xs text-zinc-500">Anyone can see your posts and profile</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTogglePrivacy(!isPublic)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${isPublic ? "bg-indigo-600" : "bg-zinc-700"}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${isPublic ? "right-0.5" : "left-0.5"}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                  <div>
                    <span className="text-sm text-zinc-200 block font-medium">Who can message you</span>
                    <span className="text-xs text-zinc-500">Control who can send you direct messages</span>
                  </div>
                  <span className="text-sm text-indigo-400 font-medium">Everyone</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-zinc-800/50">
                  <div>
                    <span className="text-sm text-zinc-200 block font-medium">Show in discovery</span>
                    <span className="text-xs text-zinc-500">Allow others to find you through explore</span>
                  </div>
                  <button type="button" className="relative w-11 h-6 bg-indigo-600 rounded-full transition-colors">
                    <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-800">
                <h3 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Danger zone
                </h3>
                <p className="text-xs text-zinc-500 mb-4">These actions are irreversible. Please be certain.</p>
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
            </div>
          )}

          {/* Security Tab */}
          {activeTab === "security" && (
            <form onSubmit={handleChangePassword} className="space-y-5">
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Change password</h2>
              <p className="text-sm text-zinc-500 mb-4">Choose a strong password with at least 8 characters</p>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Current password</label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">New password</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Enter new password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">Confirm new password</label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
              </div>

              <Button type="submit" variant="gradient" disabled={isPending}>
                {isPending ? "Changing..." : "Change password"}
              </Button>
            </form>
          )}

          {/* Blocked Users Tab */}
          {activeTab === "blocked" && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Blocked users</h2>
              <p className="text-sm text-zinc-500 mb-6">Blocked users cannot see your profile, posts, or message you.</p>
              {blockedUsers.length > 0 ? (
                <div className="space-y-2">
                  {blockedUsers.map((block) => (
                    <div key={block.id} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                      <div className="flex items-center gap-3">
                        <Avatar src={block.blocked.avatarUrl} alt={block.blocked.displayName} size="sm" />
                        <div>
                          <span className="text-sm font-medium text-zinc-200">{block.blocked.displayName}</span>
                          <span className="text-xs text-zinc-500 block">@{block.blocked.username}</span>
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
                  <UserX className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
                  <p className="text-sm text-zinc-500">No blocked users</p>
                </div>
              )}
            </div>
          )}

          {/* Mobile sign out */}
          <div className="mt-8 pt-4 border-t border-zinc-800 md:hidden">
            <button onClick={handleSignOut} className="flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors">
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
