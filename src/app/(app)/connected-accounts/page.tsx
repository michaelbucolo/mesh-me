"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Link2,
  Settings2,
  Shield,
  RefreshCw,
} from "lucide-react";

interface ConnectedAccount {
  id: string;
  platform: string;
  platformUsername: string | null;
  isActive: boolean;
  createdAt: string;
}

const PLATFORMS = [
  { id: "instagram", name: "Instagram", color: "#E4405F", icon: "IG", description: "Share photos and stories" },
  { id: "youtube", name: "YouTube", color: "#FF0000", icon: "YT", description: "Videos and shorts" },
  { id: "tiktok", name: "TikTok", color: "#000000", icon: "TT", description: "Short-form video content" },
  { id: "twitter", name: "X / Twitter", color: "#1DA1F2", icon: "X", description: "Posts and conversations" },
  { id: "twitch", name: "Twitch", color: "#9146FF", icon: "TW", description: "Livestreaming" },
  { id: "spotify", name: "Spotify", color: "#1DB954", icon: "SP", description: "Music and podcasts" },
  { id: "soundcloud", name: "SoundCloud", color: "#FF5500", icon: "SC", description: "Music sharing" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2", icon: "IN", description: "Professional network" },
  { id: "github", name: "GitHub", color: "#333333", icon: "GH", description: "Code and projects" },
  { id: "discord", name: "Discord", color: "#5865F2", icon: "DC", description: "Communities and chat" },
  { id: "snapchat", name: "Snapchat", color: "#FFFC00", icon: "SN", description: "Snaps and stories" },
  { id: "pinterest", name: "Pinterest", color: "#BD081C", icon: "PN", description: "Visual discovery" },
  { id: "reddit", name: "Reddit", color: "#FF4500", icon: "RD", description: "Communities and forums" },
  { id: "facebook", name: "Facebook", color: "#1877F2", icon: "FB", description: "Social networking" },
  { id: "threads", name: "Threads", color: "#000000", icon: "TH", description: "Text-based conversations" },
  { id: "bluesky", name: "Bluesky", color: "#0085FF", icon: "BS", description: "Decentralized social" },
];

export default function ConnectedAccountsPage() {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    async function loadAccounts() {
      try {
        const res = await fetch("/api/connected-accounts");
        if (res.ok) {
          const data = await res.json();
          setAccounts(data.accounts || []);
        }
      } catch {
        // failed to load
      } finally {
        setLoading(false);
      }
    }
    loadAccounts();
  }, []);

  const [showImportDialog, setShowImportDialog] = useState<string | null>(null);
  const [importOptions, setImportOptions] = useState({ posts: true, likes: true, comments: true, followers: false });

  const handleConnect = async (platformId: string) => {
    setConnecting(platformId);
    try {
      const res = await fetch("/api/connected-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platformId }),
      });
      if (res.ok) {
        const data = await res.json();
        setAccounts((prev) => [...prev, data.account]);
        // Show import dialog after successful connection
        setShowImportDialog(platformId);
      }
    } catch {
      // connection failed
    } finally {
      setConnecting(null);
    }
  };

  const handleImport = () => {
    // Import would sync data from the platform — all imported data is private by default
    setShowImportDialog(null);
    setImportOptions({ posts: true, likes: true, comments: true, followers: false });
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      const res = await fetch(`/api/connected-accounts/${accountId}`, { method: "DELETE" });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      }
    } catch {
      // disconnect failed
    }
  };

  const connectedPlatforms = new Set(accounts.map((a) => a.platform));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-gradient)" }}>
            <Link2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Connected Accounts</h1>
            <p className="text-sm text-[var(--text-muted)]">Bring your world into the mesh</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
            <div className="rounded-2xl p-4 mb-6 flex items-start gap-3" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-muted)" }}>
              <Shield className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
        <div>
          <p className="text-sm text-[var(--text-secondary)]">
            Connecting your accounts lets you view content from all platforms in your Custom Feed,
            send messages through MeChat, and interact with posts across platforms directly from mesh.me.
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            mesh.me connects through each platform&apos;s official OAuth API. Your credentials are encrypted and you can disconnect at any time. Cross-platform features are subject to each platform&apos;s API availability and terms.
          </p>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            mesh.me is not affiliated with, endorsed by, or sponsored by any third-party platform. All platform names and trademarks belong to their respective owners.
          </p>
        </div>
      </div>

      {/* Connected count */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--text-tertiary)]">
          <span className="text-[var(--text-primary)] font-semibold">{accounts.length}</span> of {PLATFORMS.length} platforms connected
        </p>
        {accounts.length > 0 && (
          <button className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] flex items-center gap-1 transition-colors">
            <RefreshCw className="h-3 w-3" />
            Sync all
          </button>
        )}
      </div>

      {/* Platform Grid */}
      <div className="grid gap-3">
        {PLATFORMS.map((platform, index) => {
          const connected = connectedPlatforms.has(platform.id);
          const account = accounts.find((a) => a.platform === platform.id);
          const isConnecting = connecting === platform.id;

          return (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                connected
                  ? "glass-card"
                  : "glass-surface hover:border-[var(--glass-border)]"
              }`}
            >
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                style={{ backgroundColor: platform.color }}
              >
                {platform.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">{platform.name}</h3>
                  {connected && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-400 border-green-500/20">
                      Connected
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  {connected && account?.platformUsername
                    ? `@${account.platformUsername}`
                    : platform.description}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {connected ? (
                  <>
                    <button className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
                      <Settings2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => account && handleDisconnect(account.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => handleConnect(platform.id)}
                    disabled={isConnecting}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-white brand-button transition-all disabled:opacity-50"
                  >
                    {isConnecting ? (
                      <span className="flex items-center gap-1.5">
                        <div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        Connecting...
                      </span>
                    ) : (
                      "Connect"
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Cross-platform Features Info */}
      <div className="mt-8 grid md:grid-cols-3 gap-4">
        {[
          { title: "Unified Feed", desc: "Every platform, one beautiful feed — yours to customize", icon: "📰" },
          { title: "MeChat", desc: "Every conversation, every platform, one inbox", icon: "💬" },
          { title: "Cross-Interact", desc: "Like, comment, and follow across the internet — all from the mesh", icon: "🔗" },
        ].map((feature) => (
          <div key={feature.title} className="glass-surface rounded-xl p-4 text-center">
            <span className="text-2xl mb-2 block">{feature.icon}</span>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{feature.title}</h4>
            <p className="text-xs text-[var(--text-muted)]">{feature.desc}</p>
          </div>
        ))}
      </div>

      {/* Import Dialog — shown after connecting a platform */}
      {showImportDialog && (() => {
        const platform = PLATFORMS.find((p) => p.id === showImportDialog);
        if (!platform) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setShowImportDialog(null); }}>
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="w-full max-w-md mx-4 rounded-2xl overflow-hidden glass-dropdown shadow-2xl"
            >
              <div className="h-1.5 w-full" style={{ background: platform.color }} />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: platform.color }}>
                    {platform.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[var(--text-primary)]">{platform.name} Connected!</h3>
                    <p className="text-xs text-[var(--text-muted)]">Would you like to import your existing data?</p>
                  </div>
                </div>

                <div className="rounded-xl p-3 mb-4 flex items-start gap-2" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-muted)" }}>
                  <Shield className="h-4 w-4 flex-shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    All imported data will be <strong>visible only to you</strong> by default. You choose what to make public. mesh.me never shares your imported data without your explicit consent.
                  </p>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">What to import</p>
                  {[
                    { key: "posts" as const, label: "Posts & content", desc: "Import all your existing posts" },
                    { key: "likes" as const, label: "Likes & reactions", desc: "Import your liked content" },
                    { key: "comments" as const, label: "Comments", desc: "Import your comment history" },
                    { key: "followers" as const, label: "Followers & following", desc: "Sync your connections" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => setImportOptions((prev) => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[var(--bg-tertiary)] transition-all"
                    >
                      <div className="text-left">
                        <p className="text-xs font-medium text-[var(--text-primary)]">{opt.label}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">{opt.desc}</p>
                      </div>
                      <div className={"w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all " + (
                        importOptions[opt.key]
                          ? "border-[var(--accent)] bg-[var(--accent)]"
                          : "border-[var(--border-primary)]"
                      )}>
                        {importOptions[opt.key] && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowImportDialog(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all"
                  >
                    Skip for now
                  </button>
                  <button
                    onClick={handleImport}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-semibold text-white brand-button shadow-lg hover:shadow-xl transition-all active:scale-95"
                  >
                    Import Selected
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </div>
  );
}
