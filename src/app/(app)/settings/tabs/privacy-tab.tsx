"use client";

import { Button } from "@/components/ui/button";
import { updatePrivacy, deleteAccount, signOut } from "@/lib/actions";
import { useTransition, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Lock, Eye, X, AlertTriangle, Trash2, Activity, Check } from "lucide-react";
import { getPrivacyTransparencyData } from "@/lib/queries";
import type { TransparencyData } from "./types";

interface PrivacyTabProps {
  isPublic: boolean;
  setIsPublic: (v: boolean) => void;
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
}

export function PrivacyTab({ isPublic, setIsPublic, showSuccess, showError }: PrivacyTabProps) {
  const [isPending, startTransition] = useTransition();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [transparencyData, setTransparencyData] = useState<TransparencyData>(null);
  const [transparencyLoaded, setTransparencyLoaded] = useState(false);

  useEffect(() => {
    if (!transparencyLoaded) {
      getPrivacyTransparencyData().then((data) => {
        setTransparencyData(data);
        setTransparencyLoaded(true);
      }).catch(() => setTransparencyLoaded(true));
    }
  }, [transparencyLoaded]);

  const handleTogglePrivacy = (val: boolean) => {
    setIsPublic(val);
    const formData = new FormData();
    formData.set("isPublic", val.toString());
    startTransition(async () => {
      await updatePrivacy(formData);
      showSuccess("Privacy settings updated");
    });
  };

  const handleSignOut = () => { startTransition(async () => { await signOut(); }); };

  const handleDeleteAccount = () => {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    startTransition(async () => { await deleteAccount(); });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
            { title: "No data selling", desc: "Your data is never sold, shared with advertisers, or used to train models. mesh.me makes money only through MeshPro subscriptions." },
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

      {/* Data Transparency Dashboard */}
      <div className="mt-6 glass-card rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Eye className="h-3.5 w-3.5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Your Data Transparency Report</h3>
            <p className="text-[10px] text-[var(--text-muted)]">Everything mesh.me knows about you — no hidden data</p>
          </div>
        </div>

        {transparencyData ? (
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Content You Created</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Posts", count: transparencyData.dataStored.posts },
                  { label: "Comments", count: transparencyData.dataStored.comments },
                  { label: "Reactions", count: transparencyData.dataStored.reactions },
                  { label: "Messages sent", count: transparencyData.dataStored.messages },
                  { label: "Saved posts", count: transparencyData.dataStored.savedPosts },
                  { label: "Interests", count: transparencyData.dataStored.interests },
                ].map((item) => (
                  <div key={item.label} className="glass-surface rounded-lg px-3 py-2 text-center">
                    <p className="text-lg font-bold text-[var(--text-primary)]">{item.count}</p>
                    <p className="text-[9px] text-[var(--text-muted)]">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Social Graph</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="glass-surface rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-[var(--text-primary)]">{transparencyData.connections.followers}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">Followers</p>
                </div>
                <div className="glass-surface rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-[var(--text-primary)]">{transparencyData.connections.following}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">Following</p>
                </div>
                <div className="glass-surface rounded-lg px-3 py-2 text-center">
                  <p className="text-lg font-bold text-[var(--text-primary)]">{transparencyData.connections.communities}</p>
                  <p className="text-[9px] text-[var(--text-muted)]">Communities</p>
                </div>
              </div>
            </div>

            {transparencyData.platforms.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Connected Platforms</p>
                <div className="space-y-1.5">
                  {transparencyData.platforms.map((p) => (
                    <div key={p.name} className="flex items-center justify-between glass-surface rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${p.active ? "bg-emerald-500" : "bg-gray-500"}`} />
                        <span className="text-xs font-medium text-[var(--text-primary)] capitalize">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.scopes && (
                          <span className="text-[9px] text-[var(--text-muted)] bg-[var(--bg-tertiary)] rounded px-1.5 py-0.5">
                            {typeof p.scopes === "string" ? p.scopes.split(",").length : 0} permissions
                          </span>
                        )}
                        <span className="text-[9px] text-[var(--text-muted)]">{p.active ? "Active" : "Inactive"}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-[var(--text-muted)] mt-2">
                  {transparencyData.dataStored.platformPosts} synced posts from connected platforms
                </p>
              </div>
            )}

            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
              <p className="text-[11px] font-semibold text-emerald-400 mb-2">What mesh.me does NOT collect</p>
              <div className="grid grid-cols-2 gap-1.5">
                {["Browsing history", "Device fingerprints", "Location tracking", "Behavioral analytics", "Ad preferences", "Third-party cookies", "Contact lists", "App usage patterns"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5">
                    <X className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                    <span className="text-[10px] text-[var(--text-muted)]">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between glass-surface rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-[var(--accent)]" />
                <span className="text-xs text-[var(--text-primary)]">Active sessions</span>
              </div>
              <span className="text-xs font-medium text-[var(--text-primary)]">{transparencyData.sessions}</span>
            </div>
          </div>
        ) : transparencyLoaded ? (
          <p className="text-xs text-[var(--text-muted)]">Unable to load transparency data.</p>
        ) : (
          <div className="flex items-center justify-center py-8">
            <div className="h-5 w-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
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
  );
}
