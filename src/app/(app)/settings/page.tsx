"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { updateProfile, signOut } from "@/lib/actions";
import { useState, useTransition, useEffect } from "react";
import { Settings, User, Shield, Bell, LogOut } from "lucide-react";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const tabs = [
    { id: "profile", label: "Profile", icon: User },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy & Safety", icon: Shield },
  ];

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    formData.set("displayName", displayName);
    formData.set("bio", bio);
    formData.set("location", location);
    formData.set("website", website);

    startTransition(async () => {
      await updateProfile(formData);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    });
  };

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut();
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <Settings className="h-6 w-6 text-indigo-400" />
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
      </div>

      <div className="flex gap-8">
        {/* Sidebar */}
        <nav className="w-48 flex-shrink-0 hidden md:block">
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
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Mobile tabs */}
          <div className="flex gap-1 mb-6 md:hidden overflow-x-auto">
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

          {activeTab === "profile" && (
            <form onSubmit={handleSave} className="space-y-5">
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Edit profile</h2>

              {success && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm rounded-xl px-4 py-3">
                  Profile updated successfully
                </div>
              )}

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

              <Button type="submit" variant="gradient" disabled={isPending}>
                {isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          )}

          {activeTab === "notifications" && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Notification preferences</h2>
              <div className="space-y-4">
                {["New followers", "Likes on your posts", "Comments on your posts", "Direct messages", "Community activity"].map((item) => (
                  <div key={item} className="flex items-center justify-between py-3 border-b border-zinc-800">
                    <span className="text-sm text-zinc-300">{item}</span>
                    <button className="relative w-10 h-5 bg-indigo-600 rounded-full transition-colors">
                      <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "privacy" && (
            <div>
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">Privacy & Safety</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                  <div>
                    <span className="text-sm text-zinc-300 block">Private account</span>
                    <span className="text-xs text-zinc-500">Only approved followers can see your posts</span>
                  </div>
                  <button className="relative w-10 h-5 bg-zinc-700 rounded-full transition-colors">
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform" />
                  </button>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                  <div>
                    <span className="text-sm text-zinc-300 block">Who can message you</span>
                    <span className="text-xs text-zinc-500">Control who can send you direct messages</span>
                  </div>
                  <span className="text-sm text-indigo-400">Everyone</span>
                </div>
                <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                  <div>
                    <span className="text-sm text-zinc-300 block">Show in discovery</span>
                    <span className="text-xs text-zinc-500">Allow others to find you through search and explore</span>
                  </div>
                  <button className="relative w-10 h-5 bg-indigo-600 rounded-full transition-colors">
                    <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform" />
                  </button>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-zinc-800">
                <h3 className="text-sm font-semibold text-red-400 mb-3">Danger zone</h3>
                <Button variant="danger" size="sm">Delete my account</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
