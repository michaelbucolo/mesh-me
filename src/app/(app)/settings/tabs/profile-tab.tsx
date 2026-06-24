"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { updateProfile } from "@/lib/actions";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Camera, X, ImageIcon } from "lucide-react";
import { ACCENT_COLORS, type SettingsData } from "./types";

interface ProfileTabProps {
  settings: SettingsData | null;
  setSettings: React.Dispatch<React.SetStateAction<SettingsData | null>>;
  displayName: string;
  setDisplayName: (v: string) => void;
  bio: string;
  setBio: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  website: string;
  setWebsite: (v: string) => void;
  accentColor: string;
  setAccentColor: (v: string) => void;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export function ProfileTab({
  settings, setSettings, displayName, setDisplayName, bio, setBio,
  location, setLocation, website, setWebsite, accentColor, setAccentColor,
  showSuccess, showError,
}: ProfileTabProps) {
  const [isPending, startTransition] = useTransition();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);

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

  return (
    <motion.form initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onSubmit={handleSaveProfile} className="space-y-5">
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Edit profile</h2>

      {/* Banner upload */}
      <div className="relative w-full h-32 rounded-xl overflow-hidden mb-4 group">
        <div
          className="w-full h-full bg-gradient-to-r from-blue-600/30 to-cyan-500/30"
          style={{
            backgroundImage: bannerPreview || settings?.bannerUrl ? `url(${bannerPreview || settings?.bannerUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <label className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
          <div className="flex items-center gap-2 text-white text-sm font-medium">
            <ImageIcon className="h-5 w-5" />
            {settings?.bannerUrl || bannerPreview ? "Change banner" : "Add banner"}
          </div>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 4 * 1024 * 1024) { showError("Banner must be under 4MB"); return; }
              setBannerUploading(true);
              const preview = URL.createObjectURL(file);
              setBannerPreview(preview);
              const fd = new FormData();
              fd.append("banner", file);
              try {
                const res = await fetch("/api/banner", { method: "POST", body: fd });
                const data = await res.json().catch(() => ({ error: "Invalid response" }));
                if (data.error) { showError(data.error); setBannerPreview(null); }
                else { showSuccess("Banner updated"); setSettings((prev) => prev ? { ...prev, bannerUrl: data.bannerUrl } : prev); }
              } catch { showError("Failed to upload banner"); setBannerPreview(null); }
              finally { setBannerUploading(false); }
            }}
          />
        </label>
        {bannerUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {(settings?.bannerUrl || bannerPreview) && (
          <button
            type="button"
            onClick={async () => {
              setBannerUploading(true);
              try { await fetch("/api/banner", { method: "DELETE" }); setBannerPreview(null); setSettings((prev) => prev ? { ...prev, bannerUrl: null } : prev); showSuccess("Banner removed"); }
              catch { showError("Failed to remove banner"); }
              finally { setBannerUploading(false); }
            }}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-white hover:bg-red-500/80 transition-colors opacity-0 group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-4">
        <div className="relative group">
          <Avatar src={avatarPreview || settings?.avatarUrl} alt={displayName} size="lg" />
          <label className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
            <Camera className="h-5 w-5 text-white" />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 2 * 1024 * 1024) { showError("Image must be under 2MB"); return; }
                setAvatarUploading(true);
                const preview = URL.createObjectURL(file);
                setAvatarPreview(preview);
                const fd = new FormData();
                fd.append("avatar", file);
                try {
                  const res = await fetch("/api/avatar", { method: "POST", body: fd });
                  const data = await res.json().catch(() => ({ error: "Invalid response" }));
                  if (data.error) { showError(data.error); setAvatarPreview(null); }
                  else { showSuccess("Profile picture updated"); setSettings((prev) => prev ? { ...prev, avatarUrl: data.avatarUrl } : prev); }
                } catch { showError("Failed to upload image"); setAvatarPreview(null); }
                finally { setAvatarUploading(false); }
              }}
            />
          </label>
          {avatarUploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
        <div>
          <p className="text-sm text-[var(--text-secondary)] font-medium">@{settings?.username}</p>
          <p className="text-xs text-[var(--text-muted)]">{settings?.email}</p>
          <button type="button" onClick={() => setAvatarPreview(null)} className="text-xs text-[var(--accent)] hover:underline mt-1">
            Change photo
          </button>
          {settings?.avatarUrl && (
            <button
              type="button"
              onClick={async () => {
                setAvatarUploading(true);
                try { await fetch("/api/avatar", { method: "DELETE" }); setAvatarPreview(null); setSettings((prev) => prev ? { ...prev, avatarUrl: null } : prev); showSuccess("Profile picture removed"); }
                catch { showError("Failed to remove image"); }
                finally { setAvatarUploading(false); }
              }}
              className="text-xs text-red-400 hover:underline mt-1 ml-2"
            >
              Remove
            </button>
          )}
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
              className={`w-8 h-8 rounded-full border-2 transition-all ${accentColor === color ? "border-white scale-110" : "border-transparent hover:scale-105"}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <Button type="submit" variant="gradient" disabled={isPending}>
        {isPending ? "Saving..." : "Save changes"}
      </Button>
    </motion.form>
  );
}
