"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  Link2,
  Settings2,
  Shield,
  RefreshCw,
  ExternalLink,
  Check,
  AlertCircle,
  X,
  Globe,
  ArrowUpRight,
  Loader2,
  Clock,
} from "lucide-react";
import { PLATFORM_LOGO_MAP } from "@/components/platform-logos";

interface ConnectedAccount {
  id: string;
  platform: string;
  platformUsername: string | null;
  isActive: boolean;
  createdAt: string;
  syncStatus?: string;
  syncError?: string | null;
  lastSyncAt?: string | null;
  _count?: {
    platformPosts: number;
    platformComments: number;
    platformFollowers: number;
    platformMedia: number;
  };
}

const PLATFORMS = [
  { id: "github", name: "GitHub", color: "#333333", icon: "GH", description: "Code and projects", method: "oauth" as const, comingSoon: false },
  { id: "discord", name: "Discord", color: "#5865F2", icon: "DC", description: "Communities and chat", method: "oauth" as const, comingSoon: false },
  { id: "spotify", name: "Spotify", color: "#1DB954", icon: "SP", description: "Music and podcasts", method: "oauth" as const, comingSoon: false },
  { id: "youtube", name: "YouTube", color: "#FF0000", icon: "YT", description: "Videos and shorts", method: "oauth" as const, comingSoon: false },
  { id: "twitter", name: "X / Twitter", color: "#1DA1F2", icon: "X", description: "Posts and conversations", method: "oauth" as const, comingSoon: false },
  { id: "tiktok", name: "TikTok", color: "#000000", icon: "TT", description: "Short-form video content", method: "oauth" as const, comingSoon: false },
  { id: "twitch", name: "Twitch", color: "#9146FF", icon: "TW", description: "Livestreaming", method: "oauth" as const, comingSoon: false },
  { id: "soundcloud", name: "SoundCloud", color: "#FF5500", icon: "SC", description: "Music sharing", method: "manual" as const, comingSoon: false },
  { id: "applemusic", name: "Apple Music", color: "#FA243C", icon: "AM", description: "Music streaming and library", method: "manual" as const, comingSoon: false },
  { id: "threads", name: "Threads", color: "#000000", icon: "TH", description: "Text-based conversations", method: "manual" as const, comingSoon: false },
  { id: "bluesky", name: "Bluesky", color: "#0085FF", icon: "BS", description: "Decentralized social", method: "manual" as const, comingSoon: false },
  { id: "mastodon", name: "Mastodon", color: "#6364FF", icon: "MD", description: "Federated social network", method: "manual" as const, comingSoon: false },
  { id: "patreon", name: "Patreon", color: "#FF424D", icon: "PT", description: "Creator memberships", method: "manual" as const, comingSoon: false },
  { id: "substack", name: "Substack", color: "#FF6719", icon: "SS", description: "Newsletters and publications", method: "manual" as const, comingSoon: false },
  { id: "medium", name: "Medium", color: "#12100E", icon: "ME", description: "Articles and blogs", method: "manual" as const, comingSoon: false },
  { id: "devto", name: "DEV Community", color: "#0A0A0A", icon: "DV", description: "Developer writing and discussions", method: "manual" as const, comingSoon: false },
  { id: "dribbble", name: "Dribbble", color: "#EA4C89", icon: "DB", description: "Design portfolio showcases", method: "manual" as const, comingSoon: false },
  { id: "behance", name: "Behance", color: "#1769FF", icon: "BH", description: "Creative portfolios and projects", method: "manual" as const, comingSoon: false },
  { id: "instagram", name: "Instagram", color: "#E4405F", icon: "IG", description: "Share photos and stories", method: "oauth" as const, comingSoon: true },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2", icon: "IN", description: "Professional network", method: "oauth" as const, comingSoon: true },
  { id: "reddit", name: "Reddit", color: "#FF4500", icon: "RD", description: "Communities and forums", method: "oauth" as const, comingSoon: true },
  { id: "facebook", name: "Facebook", color: "#1877F2", icon: "FB", description: "Social networking", method: "oauth" as const, comingSoon: true },
  { id: "pinterest", name: "Pinterest", color: "#BD081C", icon: "PN", description: "Visual discovery", method: "oauth" as const, comingSoon: true },
  { id: "snapchat", name: "Snapchat", color: "#FFFC00", icon: "SN", description: "Snaps and stories", method: "oauth" as const, comingSoon: true },
];

function ConnectedAccountsContent() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [manualEntry, setManualEntry] = useState<string | null>(null);
  const [manualUsername, setManualUsername] = useState("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string; platform?: string } | null>(null);

  useEffect(() => {
    const connected = searchParams.get("connected");
    const error = searchParams.get("error");
    const platform = searchParams.get("platform");

    if (connected) {
      const platformInfo = PLATFORMS.find((p) => p.id === connected);
      setNotification({
        type: "success",
        message: `${platformInfo?.name || connected} connected successfully!`,
        platform: connected,
      });
      window.history.replaceState({}, "", "/connected-accounts");
    } else if (error) {
      setNotification({
        type: "error",
        message: error,
        platform: platform || undefined,
      });
      window.history.replaceState({}, "", "/connected-accounts");
    }
  }, [searchParams]);

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

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const [showImportDialog, setShowImportDialog] = useState<string | null>(null);
  const [importOptions, setImportOptions] = useState({ posts: true, likes: true, comments: true, followers: false });
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const handleSyncPlatform = async (accountId: string) => {
    setSyncing(accountId);
    try {
      const res = await fetch(`/api/connected-accounts/${accountId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncType: "full" }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: "success", message: `Synced ${data.itemsSynced || 0} items successfully` });
        await loadAccounts();
      } else {
        setNotification({ type: "error", message: data.error || "Sync failed" });
      }
    } catch {
      setNotification({ type: "error", message: "Sync failed. Please try again." });
    } finally {
      setSyncing(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    for (const account of accounts) {
      await handleSyncPlatform(account.id);
    }
    setSyncingAll(false);
  };

  const handleConnect = (platformId: string) => {
    const platform = PLATFORMS.find((p) => p.id === platformId);
    if (!platform) return;

    if (platform.method === "oauth") {
      setConnecting(platformId);
      window.location.href = `/api/auth/${platformId}`;
    } else {
      setManualEntry(platformId);
      setManualUsername("");
    }
  };

  const handleManualConnect = async () => {
    if (!manualEntry || !manualUsername.trim()) return;

    setConnecting(manualEntry);
    try {
      const res = await fetch("/api/connected-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: manualEntry, username: manualUsername.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setAccounts((prev) => [...prev, data.account]);
        const platformInfo = PLATFORMS.find((p) => p.id === manualEntry);
        setNotification({
          type: "success",
          message: `${platformInfo?.name || manualEntry} linked successfully!`,
          platform: manualEntry,
        });
        setShowImportDialog(manualEntry);
        setManualEntry(null);
        setManualUsername("");
      } else {
        const errData = await res.json();
        setNotification({ type: "error", message: errData.error || "Failed to link account" });
      }
    } catch {
      setNotification({ type: "error", message: "Connection failed. Please try again." });
    } finally {
      setConnecting(null);
    }
  };

  const handleImport = () => {
    setShowImportDialog(null);
    setImportOptions({ posts: true, likes: true, comments: true, followers: false });
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      const res = await fetch(`/api/connected-accounts/${accountId}`, { method: "DELETE" });
      if (res.ok) {
        setAccounts((prev) => prev.filter((a) => a.id !== accountId));
        setNotification({ type: "success", message: "Account disconnected" });
      }
    } catch {
      setNotification({ type: "error", message: "Failed to disconnect" });
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
    <div data-meshi-zone="connected-accounts" className="max-w-3xl mx-auto px-4 py-6 animate-page-enter">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`mb-4 rounded-xl p-3 flex items-center gap-3 ${
              notification.type === "success"
                ? "bg-green-500/10 border border-green-500/20"
                : "bg-red-500/10 border border-red-500/20"
            }`}
          >
            {notification.type === "success" ? (
              <Check className="h-4 w-4 text-green-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
            )}
            <p className={`text-sm flex-1 ${notification.type === "success" ? "text-green-400" : "text-red-400"}`}>
              {notification.message}
            </p>
            <button onClick={() => setNotification(null)} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* Content Hub Link */}
      {accounts.length > 0 && (
        <a
          href="/content-hub"
          className="mb-4 rounded-xl p-4 flex items-center gap-3 glass-card hover-lift transition-all block"
        >
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-gradient)" }}>
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Content Hub</h3>
            <p className="text-xs text-[var(--text-muted)]">Manage all your content, analytics, and audience from one place</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-[var(--text-muted)]" />
        </a>
      )}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--text-tertiary)]">
          <span className="text-[var(--text-primary)] font-semibold">{accounts.filter(a => !PLATFORMS.find(p => p.id === a.platform)?.comingSoon).length}</span> of {PLATFORMS.filter(p => !p.comingSoon).length} platforms connected
        </p>
        {accounts.length > 0 && (
          <button
            onClick={handleSyncAll}
            disabled={syncing !== null || syncingAll}
            className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1.5 font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${syncingAll ? "animate-spin" : ""}`} />
            {syncingAll ? "Syncing..." : "Sync all"}
          </button>
        )}
      </div>

      <div className="grid gap-3">
        {PLATFORMS.map((platform, index) => {
          const connected = connectedPlatforms.has(platform.id);
          const account = accounts.find((a) => a.platform === platform.id);
          const isConnecting = connecting === platform.id;
          const isManualEntry = manualEntry === platform.id;

          return (
            <motion.div
              key={platform.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`flex flex-col rounded-xl border transition-all ${
                connected
                  ? "glass-card"
                  : platform.comingSoon
                    ? "glass-surface opacity-60"
                    : "glass-surface hover:border-[var(--glass-border)]"
              }`}
            >
              <div className="flex items-center gap-4 p-4">
                {(() => {
                  const LogoComponent = PLATFORM_LOGO_MAP[platform.id];
                  return (
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: platform.color }}
                    >
                      {LogoComponent ? <LogoComponent size={20} /> : <span className="font-bold text-xs">{platform.icon}</span>}
                    </div>
                  );
                })()}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{platform.name}</h3>
                    {connected && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-400 border-green-500/20">
                        Connected
                      </Badge>
                    )}
                    {platform.comingSoon && !connected && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                        Coming Soon
                      </Badge>
                    )}
                    {platform.method === "oauth" && !connected && !platform.comingSoon && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        OAuth
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {connected && account?.platformUsername
                      ? `@${account.platformUsername}`
                      : platform.description}
                  </p>
                  {connected && account?._count && (account._count.platformPosts > 0 || account._count.platformFollowers > 0) && (
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {account._count.platformPosts} posts
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {account._count.platformFollowers} followers
                      </span>
                      {account.lastSyncAt && (
                        <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(account.lastSyncAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  )}
                  {connected && account?.syncStatus === "error" && account?.syncError && (
                    <p className="text-[10px] text-red-400 mt-0.5 flex items-center gap-0.5">
                      <AlertCircle className="h-2.5 w-2.5" />
                      {account.syncError}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {connected ? (
                    <>
                      <button
                        onClick={() => account && handleSyncPlatform(account.id)}
                        disabled={syncing === account?.id || syncingAll}
                        className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors disabled:opacity-50"
                        title="Sync platform data"
                      >
                        {syncing === account?.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--accent)" }} />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </button>
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
                  ) : platform.comingSoon ? (
                    <span className="px-4 py-1.5 rounded-lg text-xs font-medium text-[var(--text-muted)] bg-[var(--bg-tertiary)] cursor-default select-none">
                      Coming Soon
                    </span>
                  ) : (
                    <button
                      onClick={() => handleConnect(platform.id)}
                      disabled={isConnecting}
                      className="px-4 py-1.5 rounded-lg text-xs font-medium text-white brand-button transition-all disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isConnecting ? (
                        <span className="flex items-center gap-1.5">
                          <div className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          Connecting...
                        </span>
                      ) : (
                        <>
                          {platform.method === "oauth" && <ExternalLink className="h-3 w-3" />}
                          Connect
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              <AnimatePresence>
                {isManualEntry && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-0">
                      <div className="rounded-xl p-3" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-primary)" }}>
                        <p className="text-xs text-[var(--text-muted)] mb-2">
                          Enter your {platform.name} username to link your account
                        </p>
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">@</span>
                            <input
                              type="text"
                              value={manualUsername}
                              onChange={(e) => setManualUsername(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleManualConnect()}
                              placeholder="username"
                              autoFocus
                              className="w-full pl-7 pr-3 py-2 rounded-lg text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                            />
                          </div>
                          <button
                            onClick={handleManualConnect}
                            disabled={!manualUsername.trim()}
                            className="px-4 py-2 rounded-lg text-xs font-semibold text-white brand-button disabled:opacity-50 transition-all"
                          >
                            Link
                          </button>
                          <button
                            onClick={() => { setManualEntry(null); setManualUsername(""); }}
                            className="px-3 py-2 rounded-lg text-xs text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 grid md:grid-cols-3 gap-4">
        {[
          { title: "Unified Feed", desc: "Every platform, one beautiful feed \u2014 yours to customize", icon: "\ud83d\udcf0" },
          { title: "MeChat", desc: "Every conversation, every platform, one inbox", icon: "\ud83d\udcac" },
          { title: "Cross-Interact", desc: "Like, comment, and follow across the internet \u2014 all from the mesh", icon: "\ud83d\udd17" },
        ].map((feature) => (
          <div key={feature.title} className="glass-surface rounded-xl p-4 text-center">
            <span className="text-2xl mb-2 block">{feature.icon}</span>
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{feature.title}</h4>
            <p className="text-xs text-[var(--text-muted)]">{feature.desc}</p>
          </div>
        ))}
      </div>

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
                  {(() => {
                    const LogoComponent = PLATFORM_LOGO_MAP[platform.id];
                    return (
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: platform.color }}>
                        {LogoComponent ? <LogoComponent size={20} /> : <span className="font-bold text-sm">{platform.icon}</span>}
                      </div>
                    );
                  })()}
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

export default function ConnectedAccountsPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
      </div>
    }>
      <ConnectedAccountsContent />
    </Suspense>
  );
}
