"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  RefreshCw,
  Filter,
  Search,
  BarChart3,
  Users,
  MessageSquare,
  Heart,
  Eye,
  Share2,
  Trash2,
  ExternalLink,
  Clock,
  TrendingUp,
  Globe,
  ChevronDown,
  Play,
  Image as ImageIcon,
  FileText,
  Video,
  Send,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowUpRight,
  Zap,
  X,
  Edit3,
  Pin,
  EyeOff,
  UserPlus,
  UserMinus,
  MoreHorizontal,
  Reply,
} from "lucide-react";
import { PLATFORM_LOGO_MAP } from "@/components/platform-logos";

// ─── Types ──────────────────────────────────────────────────

interface PlatformAccount {
  id: string;
  platform: string;
  platformUsername: string | null;
  syncStatus: string;
  syncError: string | null;
  lastSyncAt: string | null;
  scopes: string | null;
  _count: {
    platformPosts: number;
    platformComments: number;
    platformFollowers: number;
    platformMedia: number;
  };
}

interface PlatformPostItem {
  id: string;
  platformPostId: string;
  content: string | null;
  title: string | null;
  url: string | null;
  postType: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  visibility: string;
  isFromMesh: boolean;
  publishedAt: string | null;
  thumbnailUrl: string | null;
  isPinned: boolean;
  connectedAccount: {
    platform: string;
    platformUsername: string | null;
  };
  media: Array<{ id: string; mediaType: string; url: string; thumbnailUrl: string | null }>;
  _count: { comments: number };
}

interface FollowerItem {
  id: string;
  platformUserId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
  isMutual: boolean;
  relationshipType: string;
  profileUrl: string | null;
  connectedAccount: { platform: string; id: string };
}

interface AnalyticsSummary {
  platform: string;
  platformUsername: string | null;
  lastSyncAt: string | null;
  syncStatus: string;
  postCount: number;
  followerCount: number;
  commentCount: number;
  totalViews: number;
  totalLikes: number;
  engagementRate: number | null;
}

interface SyncJob {
  id: string;
  syncType: string;
  status: string;
  progress: number;
  itemsSynced: number;
  totalItems: number | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  connectedAccount: { platform: string };
}

// ─── Platform Config ────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { name: string; color: string }> = {
  github: { name: "GitHub", color: "#333333" },
  discord: { name: "Discord", color: "#5865F2" },
  spotify: { name: "Spotify", color: "#1DB954" },
  youtube: { name: "YouTube", color: "#FF0000" },
  twitter: { name: "X / Twitter", color: "#1DA1F2" },
  tiktok: { name: "TikTok", color: "#000000" },
  twitch: { name: "Twitch", color: "#9146FF" },
  soundcloud: { name: "SoundCloud", color: "#FF5500" },
  threads: { name: "Threads", color: "#000000" },
  bluesky: { name: "Bluesky", color: "#0085FF" },
  instagram: { name: "Instagram", color: "#E4405F" },
  linkedin: { name: "LinkedIn", color: "#0A66C2" },
  reddit: { name: "Reddit", color: "#FF4500" },
  facebook: { name: "Facebook", color: "#1877F2" },
  pinterest: { name: "Pinterest", color: "#BD081C" },
  snapchat: { name: "Snapchat", color: "#FFFC00" },
};

// Render actual SVG platform logo or fallback to initials
function PlatformLogo({ platform, size = 16, className }: { platform: string; size?: number; className?: string }) {
  const LogoComponent = PLATFORM_LOGO_MAP[platform];
  if (LogoComponent) return <LogoComponent size={size} className={className} />;
  const config = PLATFORM_CONFIG[platform];
  return <span className={className} style={{ fontSize: size * 0.5, fontWeight: 700 }}>{config?.name?.slice(0, 2).toUpperCase() || "??"}</span>;
}

const POST_TYPE_ICONS: Record<string, typeof FileText> = {
  text: FileText,
  tweet: FileText,
  thread: FileText,
  article: FileText,
  image: ImageIcon,
  video: Video,
  reel: Play,
  short: Play,
  story: Play,
  pin: ImageIcon,
  snap: ImageIcon,
};

// ─── Tab Types ──────────────────────────────────────────────

type TabType = "overview" | "posts" | "analytics" | "followers" | "cross-post" | "sync";

// ─── Main Component ─────────────────────────────────────────

export default function ContentHubPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [posts, setPosts] = useState<PlatformPostItem[]>([]);
  const [followers, setFollowers] = useState<FollowerItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [totalPosts, setTotalPosts] = useState(0);
  const [totalFollowers, setTotalFollowers] = useState(0);
  const [page, setPage] = useState(1);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterPostType, setFilterPostType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCrossPost, setShowCrossPost] = useState(false);
  const [crossPostContent, setCrossPostContent] = useState("");
  const [crossPostPlatforms, setCrossPostPlatforms] = useState<string[]>([]);
  const [crossPosting, setCrossPosting] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncPulseActive, setSyncPulseActive] = useState(false);
  const initialLoadDone = useRef(false);

  // Load sync status and accounts
  const loadSyncData = useCallback(async () => {
    try {
      const res = await fetch("/api/sync");
      if (res.ok) {
        const data = await res.json();
        setAccounts(data.accounts || []);
        setSyncJobs(data.jobs || []);
      }
    } catch {
      // Failed to load
    }
  }, []);

  // Load posts
  const loadPosts = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterPlatform !== "all") params.set("platform", filterPlatform);
      if (filterPostType !== "all") params.set("postType", filterPostType);
      const res = await fetch(`/api/platform-content?${params}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
        setTotalPosts(data.total || 0);
      }
    } catch {
      // Failed to load
    }
  }, [page, filterPlatform, filterPostType]);

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch("/api/platform-content?view=analytics");
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data.analytics || []);
      }
    } catch {
      // Failed to load
    }
  }, []);

  // Load followers
  const loadFollowers = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (filterPlatform !== "all") params.set("platform", filterPlatform);
      const res = await fetch(`/api/platform-content?view=followers&${params}`);
      if (res.ok) {
        const data = await res.json();
        setFollowers(data.followers || []);
        setTotalFollowers(data.total || 0);
      }
    } catch {
      // Failed to load
    }
  }, [page, filterPlatform]);

  // Initial load (only shows full-page spinner once)
  useEffect(() => {
    if (initialLoadDone.current) return;
    async function init() {
      setLoading(true);
      await Promise.all([loadSyncData(), loadPosts(), loadAnalytics()]);
      setLoading(false);
      initialLoadDone.current = true;
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload posts when filters/pagination change (after initial load)
  useEffect(() => {
    if (initialLoadDone.current && activeTab === "posts") loadPosts();
  }, [page, filterPlatform, filterPostType, loadPosts, activeTab]);

  // Load tab-specific data when tab changes
  useEffect(() => {
    if (activeTab === "followers") loadFollowers();
    if (activeTab === "analytics") loadAnalytics();
    if (activeTab === "sync") loadSyncData();
  }, [activeTab, loadFollowers, loadAnalytics, loadSyncData]);

  // Notification auto-dismiss
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Trigger sync
  const handleSync = async (accountId: string, syncType = "full") => {
    setSyncing(accountId);
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectedAccountId: accountId, syncType }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: "success", message: `Synced ${data.itemsSynced || 0} items successfully` });
        // Trigger sync pulse animation
        setSyncPulseActive(true);
        setTimeout(() => setSyncPulseActive(false), 1500);
        await loadSyncData();
        await loadPosts();
        await loadAnalytics();
      } else {
        setNotification({ type: "error", message: data.error || "Sync failed" });
      }
    } catch {
      setNotification({ type: "error", message: "Sync failed" });
    } finally {
      setSyncing(null);
    }
  };

  // Sync all
  const handleSyncAll = async () => {
    setSyncingAll(true);
    for (const account of accounts) {
      await handleSync(account.id);
    }
    setSyncingAll(false);
  };

  // Delete post
  const handleDeletePost = async (postId: string) => {
    try {
      const res = await fetch("/api/platform-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", postId }),
      });
      const data = await res.json();
      if (data.success) {
        setPosts((prev) => prev.filter((p) => p.id !== postId));
        setNotification({ type: "success", message: "Post deleted" });
      } else {
        setNotification({ type: "error", message: data.error || "Delete failed" });
      }
    } catch {
      setNotification({ type: "error", message: "Delete failed" });
    }
  };

  // ─── Full Platform Control Actions ────────────────────────────

  const handlePostAction = async (action: string, postId: string, extra?: Record<string, string>) => {
    try {
      const res = await fetch("/api/platform-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, postId, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh posts after action
        await loadPosts();
        const labels: Record<string, string> = {
          like: "Liked", unlike: "Unliked", pin: "Pinned", unpin: "Unpinned",
          share: "Shared", edit: "Updated", visibility: "Visibility changed",
          reply: "Reply posted",
        };
        setNotification({ type: "success", message: labels[action] || "Done" });
      } else {
        setNotification({ type: "error", message: data.error || "Action failed" });
      }
    } catch {
      setNotification({ type: "error", message: "Action failed" });
    }
  };

  const handleFollowerAction = async (action: "follow" | "unfollow", connectedAccountId: string, platformUserId: string) => {
    try {
      const res = await fetch("/api/platform-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, connectedAccountId, platformUserId }),
      });
      const data = await res.json();
      if (data.success) {
        setNotification({ type: "success", message: action === "follow" ? "Followed" : "Unfollowed" });
        await loadFollowers();
      } else {
        setNotification({ type: "error", message: data.error || `${action} failed` });
      }
    } catch {
      setNotification({ type: "error", message: `${action} failed` });
    }
  };

  // Cross-post
  const handleCrossPost = async () => {
    if (!crossPostContent.trim() || crossPostPlatforms.length === 0) return;
    setCrossPosting(true);
    try {
      const res = await fetch("/api/platform-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cross-post", content: crossPostContent, platforms: crossPostPlatforms }),
      });
      const data = await res.json();
      if (data.results) {
        const succeeded = Object.values(data.results).filter((r: unknown) => (r as { success: boolean }).success).length;
        const failed = Object.values(data.results).length - succeeded;
        setNotification({
          type: succeeded > 0 ? "success" : "error",
          message: `Published to ${succeeded} platform${succeeded !== 1 ? "s" : ""}${failed > 0 ? `, ${failed} failed` : ""}`,
        });
        setCrossPostContent("");
        setCrossPostPlatforms([]);
        setShowCrossPost(false);
        await loadPosts();
      } else {
        setNotification({ type: "error", message: data.error || "Cross-post failed" });
      }
    } catch {
      setNotification({ type: "error", message: "Cross-post failed" });
    } finally {
      setCrossPosting(false);
    }
  };

  // ─── Computed Values ────────────────────────────────────────

  const totalSyncedPosts = accounts.reduce((sum, a) => sum + a._count.platformPosts, 0);
  const totalSyncedFollowers = accounts.reduce((sum, a) => sum + a._count.platformFollowers, 0);
  const totalSyncedComments = accounts.reduce((sum, a) => sum + a._count.platformComments, 0);
  const connectedCount = accounts.length;

  const filteredPosts = searchQuery
    ? posts.filter((p) =>
        (p.content || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.title || "").toLowerCase().includes(searchQuery.toLowerCase())
      )
    : posts;

  // ─── Tabs ─────────────────────────────────────────────────

  const tabs: { id: TabType; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "posts", label: "Content", icon: FileText },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "followers", label: "Audience", icon: Users },
    { id: "cross-post", label: "Publish", icon: Send },
    { id: "sync", label: "Sync", icon: RefreshCw },
  ];

  // ─── Loading State ────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--accent)" }} />
          <p className="text-sm text-[var(--text-muted)]">Loading your content universe...</p>
        </div>
      </div>
    );
  }

  if (connectedCount === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="h-16 w-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: "var(--brand-gradient)" }}>
          <Globe className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Your Content Universe Awaits</h1>
        <p className="text-[var(--text-secondary)] mb-8 max-w-md mx-auto">
          Connect your social accounts to manage all your content, analytics, followers, and posts from one powerful hub.
        </p>
        <a
          href="/connected-accounts"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white brand-button"
        >
          <Zap className="h-4 w-4" />
          Connect Your Accounts
        </a>
      </div>
    );
  }

  return (
    <div data-meshi-zone="content-hub" className="max-w-6xl mx-auto px-4 py-6 animate-page-enter">
      {/* Notification */}
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
              <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0" />
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

      {/* Sync pulse animation overlay */}
      <AnimatePresence>
        {syncPulseActive && (
          <motion.div
            className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              className="rounded-full border-2 border-indigo-500/40"
              initial={{ width: 0, height: 0, opacity: 0.6 }}
              animate={{ width: 600, height: 600, opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
            />
            <motion.div
              className="absolute rounded-full border border-purple-500/30"
              initial={{ width: 0, height: 0, opacity: 0.4 }}
              animate={{ width: 400, height: 400, opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut", delay: 0.15 }}
            />
            <motion.div
              className="absolute rounded-full bg-indigo-500/5"
              initial={{ width: 0, height: 0, opacity: 0.8 }}
              animate={{ width: 200, height: 200, opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-gradient)" }}>
            <Globe className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">Content Hub</h1>
            <p className="text-sm text-[var(--text-muted)]">Manage your entire digital presence</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncAll}
            disabled={syncing !== null || syncingAll}
            className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all text-white brand-button disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncingAll || syncing ? "animate-spin" : ""}`} />
            {syncingAll ? "Syncing..." : "Sync All"}
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Platforms", value: connectedCount, icon: Globe, color: "var(--accent)" },
          { label: "Total Posts", value: totalSyncedPosts, icon: FileText, color: "#22c55e" },
          { label: "Followers", value: totalSyncedFollowers, icon: Users, color: "#f59e0b" },
          { label: "Comments", value: totalSyncedComments, icon: MessageSquare, color: "#8b5cf6" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl p-4 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}15` }}>
              <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-lg font-bold text-[var(--text-primary)]">{formatNumber(stat.value)}</p>
              <p className="text-xs text-[var(--text-muted)]">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto scrollbar-hide" style={{ background: "var(--bg-secondary)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setPage(1); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "text-white shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
            }`}
            style={activeTab === tab.id ? { background: "var(--accent)" } : undefined}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "overview" && (
            <OverviewTab
              accounts={accounts}
              analytics={analytics}
              posts={posts}
              syncing={syncing}
              onSync={handleSync}
              onTabChange={setActiveTab}
            />
          )}
          {activeTab === "posts" && (
            <PostsTab
              posts={filteredPosts}
              totalPosts={searchQuery ? filteredPosts.length : totalPosts}
              page={page}
              filterPlatform={filterPlatform}
              filterPostType={filterPostType}
              searchQuery={searchQuery}
              accounts={accounts}
              onPageChange={setPage}
              onFilterPlatform={setFilterPlatform}
              onFilterPostType={setFilterPostType}
              onSearchChange={setSearchQuery}
              onDelete={handleDeletePost}
              onPostAction={handlePostAction}
              onSync={(accountId) => handleSync(accountId, "posts")}
            />
          )}
          {activeTab === "analytics" && (
            <AnalyticsTab analytics={analytics} accounts={accounts} />
          )}
          {activeTab === "followers" && (
            <FollowersTab
              followers={followers}
              totalFollowers={totalFollowers}
              page={page}
              filterPlatform={filterPlatform}
              accounts={accounts}
              onPageChange={setPage}
              onFilterPlatform={setFilterPlatform}
              onSync={(accountId) => handleSync(accountId, "followers")}
              onFollowerAction={handleFollowerAction}
            />
          )}
          {activeTab === "cross-post" && (
            <CrossPostTab
              accounts={accounts}
              content={crossPostContent}
              selectedPlatforms={crossPostPlatforms}
              posting={crossPosting}
              showForm={showCrossPost}
              onContentChange={setCrossPostContent}
              onTogglePlatform={(p) => setCrossPostPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])}
              onPost={handleCrossPost}
              onShowForm={setShowCrossPost}
            />
          )}
          {activeTab === "sync" && (
            <SyncTab
              accounts={accounts}
              syncJobs={syncJobs}
              syncing={syncing}
              syncingAll={syncingAll}
              onSync={handleSync}
              onSyncAll={handleSyncAll}
              onRefresh={loadSyncData}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────

function OverviewTab({ accounts, analytics, posts, syncing, onSync, onTabChange }: {
  accounts: PlatformAccount[];
  analytics: AnalyticsSummary[];
  posts: PlatformPostItem[];
  syncing: string | null;
  onSync: (id: string) => void;
  onTabChange: (tab: TabType) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Platform Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Connected Platforms</h2>
          <a href="/connected-accounts" className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1">
            Manage <ArrowUpRight className="h-3 w-3" />
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accounts.map((account) => {
            const config = PLATFORM_CONFIG[account.platform] || { name: account.platform, color: "#666" };
            const analyticsItem = analytics.find((a) => a.platform === account.platform);
            return (
              <div key={account.id} className="glass-card rounded-xl p-4 hover-lift">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: config.color }}
                  >
                    <PlatformLogo platform={account.platform} size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] truncate">{config.name}</h3>
                    <p className="text-xs text-[var(--text-muted)] truncate">
                      {account.platformUsername ? `@${account.platformUsername}` : "Connected"}
                    </p>
                  </div>
                  <button
                    onClick={() => onSync(account.id)}
                    disabled={syncing === account.id}
                    className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-all"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncing === account.id ? "animate-spin" : ""}`} />
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{formatNumber(account._count.platformPosts)}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Posts</p>
                  </div>
                  <div className="text-center p-2 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{formatNumber(analyticsItem?.followerCount || account._count.platformFollowers)}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Followers</p>
                  </div>
                  <div className="text-center p-2 rounded-lg" style={{ background: "var(--bg-secondary)" }}>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{formatNumber(account._count.platformComments)}</p>
                    <p className="text-[10px] text-[var(--text-muted)]">Comments</p>
                  </div>
                </div>
                {account.lastSyncAt && (
                  <p className="text-[10px] text-[var(--text-muted)] mt-2 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Last synced {timeAgo(account.lastSyncAt)}
                  </p>
                )}
                {account.syncStatus === "error" && account.syncError && (
                  <p className="text-[10px] text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {account.syncError}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Content */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Recent Content</h2>
          <button onClick={() => onTabChange("posts")} className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] flex items-center gap-1">
            View All <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        {posts.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <FileText className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-[var(--text-secondary)]">No content synced yet</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">Click &quot;Sync All&quot; to import your content from connected platforms</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {posts.slice(0, 5).map((post) => (
              <PostCard key={post.id} post={post} compact />
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Cross-Post", icon: Send, tab: "cross-post" as TabType, color: "var(--accent)" },
          { label: "View Analytics", icon: BarChart3, tab: "analytics" as TabType, color: "#22c55e" },
          { label: "Manage Audience", icon: Users, tab: "followers" as TabType, color: "#f59e0b" },
          { label: "Sync Status", icon: RefreshCw, tab: "sync" as TabType, color: "#8b5cf6" },
        ].map((action) => (
          <button
            key={action.label}
            onClick={() => onTabChange(action.tab)}
            className="glass-card rounded-xl p-4 text-left hover-lift group transition-all"
          >
            <div className="h-9 w-9 rounded-lg flex items-center justify-center mb-2" style={{ background: `${action.color}15` }}>
              <action.icon className="h-4 w-4" style={{ color: action.color }} />
            </div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{action.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Posts Tab ──────────────────────────────────────────────

function PostsTab({ posts, totalPosts, page, filterPlatform, filterPostType, searchQuery, accounts, onPageChange, onFilterPlatform, onFilterPostType, onSearchChange, onDelete, onPostAction, onSync }: {
  posts: PlatformPostItem[];
  totalPosts: number;
  page: number;
  filterPlatform: string;
  filterPostType: string;
  searchQuery: string;
  accounts: PlatformAccount[];
  onPageChange: (p: number) => void;
  onFilterPlatform: (p: string) => void;
  onFilterPostType: (p: string) => void;
  onSearchChange: (q: string) => void;
  onDelete: (id: string) => void;
  onPostAction: (action: string, postId: string, extra?: Record<string, string>) => void;
  onSync: (accountId: string) => void;
}) {
  const totalPages = Math.ceil(totalPosts / 20);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search content..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <select
            value={filterPlatform}
            onChange={(e) => { onFilterPlatform(e.target.value); onPageChange(1); }}
            className="pl-9 pr-8 py-2.5 rounded-xl text-xs font-medium bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
          >
            <option value="all">All Platforms</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.platform}>{PLATFORM_CONFIG[a.platform]?.name || a.platform}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)] pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={filterPostType}
            onChange={(e) => { onFilterPostType(e.target.value); onPageChange(1); }}
            className="px-4 py-2.5 rounded-xl text-xs font-medium bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] appearance-none cursor-pointer pr-8"
          >
            <option value="all">All Types</option>
            <option value="text">Text</option>
            <option value="image">Images</option>
            <option value="video">Videos</option>
            <option value="reel">Reels</option>
            <option value="tweet">Tweets</option>
            <option value="article">Articles</option>
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)] pointer-events-none" />
        </div>
      </div>

      {/* Sync prompt if no posts */}
      {posts.length === 0 && totalPosts === 0 && (
        <div className="glass-card rounded-xl p-8 text-center">
          <FileText className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">No Content Yet</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">Sync your connected platforms to import all your posts, videos, and more.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {accounts.map((a) => {
              const config = PLATFORM_CONFIG[a.platform] || { name: a.platform, color: "#666" };
              return (
                <button
                  key={a.id}
                  onClick={() => onSync(a.id)}
                  className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all hover:opacity-80"
                  style={{ background: `${config.color}20`, color: config.color }}
                >
                  <RefreshCw className="h-3 w-3" />
                  Sync {config.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Posts List */}
      <div className="space-y-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} onDelete={onDelete} onPostAction={onPostAction} />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && !searchQuery && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-[var(--text-muted)]">
            Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, totalPosts)} of {totalPosts}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-xs font-medium glass-surface disabled:opacity-50 transition-all"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-xs font-medium glass-surface disabled:opacity-50 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Analytics Tab ──────────────────────────────────────────

function AnalyticsTab({ analytics }: {
  analytics: AnalyticsSummary[];
  accounts: PlatformAccount[];
}) {
  const totalFollowers = analytics.reduce((s, a) => s + a.followerCount, 0);
  const totalViews = analytics.reduce((s, a) => s + a.totalViews, 0);
  const totalLikes = analytics.reduce((s, a) => s + a.totalLikes, 0);
  const totalPostCount = analytics.reduce((s, a) => s + a.postCount, 0);

  return (
    <div className="space-y-6">
      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Reach", value: totalFollowers, icon: Users, color: "#6366f1", sub: "Across all platforms" },
          { label: "Total Views", value: totalViews, icon: Eye, color: "#22c55e", sub: "Lifetime impressions" },
          { label: "Total Likes", value: totalLikes, icon: Heart, color: "#ef4444", sub: "Engagement received" },
          { label: "Total Content", value: totalPostCount, icon: FileText, color: "#f59e0b", sub: "Published items" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}15` }}>
                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
              </div>
              <span className="text-xs text-[var(--text-muted)]">{stat.label}</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)]">{formatNumber(stat.value)}</p>
            <p className="text-[10px] text-[var(--text-muted)] mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Per-Platform Breakdown */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Platform Breakdown</h2>
        <div className="space-y-3">
          {analytics.length === 0 ? (
            <div className="glass-card rounded-xl p-8 text-center">
              <BarChart3 className="h-8 w-8 text-[var(--text-muted)] mx-auto mb-3" />
              <p className="text-sm text-[var(--text-secondary)]">No analytics data yet</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">Sync your platforms to see detailed analytics</p>
            </div>
          ) : (
            analytics.map((item) => {
              const config = PLATFORM_CONFIG[item.platform] || { name: item.platform, color: "#666" };
              const maxFollowers = Math.max(...analytics.map((a) => a.followerCount), 1);
              return (
                <div key={item.platform} className="glass-card rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white"
                      style={{ backgroundColor: config.color }}
                    >
                      <PlatformLogo platform={item.platform} size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-[var(--text-primary)]">{config.name}</h3>
                      <p className="text-xs text-[var(--text-muted)]">@{item.platformUsername || "connected"}</p>
                    </div>
                    {item.lastSyncAt && (
                      <p className="text-[10px] text-[var(--text-muted)]">Synced {timeAgo(item.lastSyncAt)}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-3 mb-3">
                    <MetricCell label="Followers" value={item.followerCount} icon={Users} />
                    <MetricCell label="Posts" value={item.postCount} icon={FileText} />
                    <MetricCell label="Views" value={item.totalViews} icon={Eye} />
                    <MetricCell label="Likes" value={item.totalLikes} icon={Heart} />
                    <MetricCell label="Comments" value={item.commentCount} icon={MessageSquare} />
                  </div>
                  {/* Follower bar */}
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(item.followerCount / maxFollowers) * 100}%`,
                        background: config.color,
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Followers Tab ──────────────────────────────────────────

function FollowersTab({ followers, totalFollowers, page, filterPlatform, accounts, onPageChange, onFilterPlatform, onSync, onFollowerAction }: {
  followers: FollowerItem[];
  totalFollowers: number;
  page: number;
  filterPlatform: string;
  accounts: PlatformAccount[];
  onPageChange: (p: number) => void;
  onFilterPlatform: (p: string) => void;
  onSync: (accountId: string) => void;
  onFollowerAction: (action: "follow" | "unfollow", connectedAccountId: string, platformUserId: string) => void;
}) {
  const totalPages = Math.ceil(totalFollowers / 20);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
          <select
            value={filterPlatform}
            onChange={(e) => { onFilterPlatform(e.target.value); onPageChange(1); }}
            className="pl-9 pr-8 py-2.5 rounded-xl text-xs font-medium bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] appearance-none cursor-pointer"
          >
            <option value="all">All Platforms</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.platform}>{PLATFORM_CONFIG[a.platform]?.name || a.platform}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)] pointer-events-none" />
        </div>
        <p className="text-xs text-[var(--text-muted)]">{totalFollowers} total</p>
      </div>

      {followers.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <Users className="h-10 w-10 text-[var(--text-muted)] mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">No Followers Synced</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-4">Sync your platforms to import your audience data.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {accounts.map((a) => {
              const config = PLATFORM_CONFIG[a.platform] || { name: a.platform, color: "#666" };
              return (
                <button
                  key={a.id}
                  onClick={() => onSync(a.id)}
                  className="px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 transition-all hover:opacity-80"
                  style={{ background: `${config.color}20`, color: config.color }}
                >
                  <RefreshCw className="h-3 w-3" />
                  Sync {config.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {followers.map((f) => {
            const config = PLATFORM_CONFIG[f.connectedAccount.platform] || { name: f.connectedAccount.platform, color: "#666" };
            return (
              <div key={f.id} className="glass-card rounded-xl p-4 flex items-center gap-3 hover-lift">
                <div className="relative">
                  {f.avatarUrl ? (
                    <img src={f.avatarUrl} alt={f.displayName || f.username || ""} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "var(--bg-tertiary)" }}>
                      <Users className="h-4 w-4 text-[var(--text-muted)]" />
                    </div>
                  )}
                  <div
                    className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center text-white border border-[var(--bg-primary)]"
                    style={{ backgroundColor: config.color }}
                  >
                    <PlatformLogo platform={f.connectedAccount.platform} size={10} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{f.displayName || f.username || "Unknown"}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate">
                    {f.username ? `@${f.username}` : f.relationshipType}
                    {f.followerCount ? ` · ${formatNumber(f.followerCount)} followers` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {f.isMutual ? (
                    <button
                      onClick={() => onFollowerAction("unfollow", f.connectedAccount.id, f.platformUserId)}
                      className="text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 bg-green-500/10 text-green-400 hover:bg-red-500/10 hover:text-red-400 transition-colors group/btn"
                    >
                      <UserMinus className="h-3 w-3 hidden group-hover/btn:block" />
                      <UserPlus className="h-3 w-3 group-hover/btn:hidden" />
                      <span className="group-hover/btn:hidden">Mutual</span>
                      <span className="hidden group-hover/btn:inline">Unfollow</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => onFollowerAction("follow", f.connectedAccount.id, f.platformUserId)}
                      className="text-[10px] px-2 py-1 rounded-lg flex items-center gap-1 bg-[var(--accent-subtle)] text-[var(--accent)] hover:bg-[var(--accent-muted)] transition-colors"
                    >
                      <UserPlus className="h-3 w-3" />
                      Follow Back
                    </button>
                  )}
                  {f.profileUrl && (
                    <a href={f.profileUrl} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-xs text-[var(--text-muted)]">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg text-xs font-medium glass-surface disabled:opacity-50">Previous</button>
            <button onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg text-xs font-medium glass-surface disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Cross-Post Tab ─────────────────────────────────────────

function CrossPostTab({ accounts, content, selectedPlatforms, posting, onContentChange, onTogglePlatform, onPost }: {
  accounts: PlatformAccount[];
  content: string;
  selectedPlatforms: string[];
  posting: boolean;
  showForm: boolean;
  onContentChange: (v: string) => void;
  onTogglePlatform: (p: string) => void;
  onPost: () => void;
  onShowForm: (v: boolean) => void;
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "var(--brand-gradient)" }}>
            <Send className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[var(--text-primary)]">Cross-Post to Multiple Platforms</h2>
            <p className="text-xs text-[var(--text-muted)]">Write once, publish everywhere</p>
          </div>
        </div>

        {/* Content editor */}
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="What's on your mind? Write your post here..."
          rows={6}
          className="w-full p-4 rounded-xl text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] resize-none"
        />

        <div className="flex items-center justify-between mt-2 mb-4">
          <p className="text-xs text-[var(--text-muted)]">{content.length} characters</p>
          {content.length > 280 && (
            <p className="text-xs text-amber-400">Some platforms may truncate at 280 chars</p>
          )}
        </div>

        {/* Platform selector */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Select Platforms</p>
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => {
              const config = PLATFORM_CONFIG[a.platform] || { name: a.platform, color: "#666" };
              const selected = selectedPlatforms.includes(a.platform);
              return (
                <button
                  key={a.id}
                  onClick={() => onTogglePlatform(a.platform)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    selected ? "border-transparent text-white" : "border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--border-hover)]"
                  }`}
                  style={selected ? { backgroundColor: config.color } : undefined}
                >
                  <span className={`h-5 w-5 rounded flex items-center justify-center ${selected ? "bg-white/20 text-white" : ""}`}
                    style={!selected ? { backgroundColor: `${config.color}20`, color: config.color } : undefined}
                  >
                    <PlatformLogo platform={a.platform} size={12} />
                  </span>
                  {config.name}
                  {selected && <CheckCircle2 className="h-3 w-3" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Publish */}
        <button
          onClick={onPost}
          disabled={!content.trim() || selectedPlatforms.length === 0 || posting}
          className="w-full py-3 rounded-xl text-sm font-semibold text-white brand-button disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
        >
          {posting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Publishing...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              Publish to {selectedPlatforms.length} Platform{selectedPlatforms.length !== 1 ? "s" : ""}
            </>
          )}
        </button>
      </div>

      {/* Tips */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Cross-Posting Tips</h3>
        <ul className="space-y-1.5 text-xs text-[var(--text-muted)]">
          <li className="flex items-start gap-2"><TrendingUp className="h-3 w-3 mt-0.5 flex-shrink-0 text-[var(--accent)]" /> Best time to post: weekdays 10am-2pm and 7pm-9pm local time</li>
          <li className="flex items-start gap-2"><TrendingUp className="h-3 w-3 mt-0.5 flex-shrink-0 text-[var(--accent)]" /> Use hashtags for Twitter, TikTok, and Instagram for wider reach</li>
          <li className="flex items-start gap-2"><TrendingUp className="h-3 w-3 mt-0.5 flex-shrink-0 text-[var(--accent)]" /> Keep text under 280 chars for Twitter compatibility</li>
          <li className="flex items-start gap-2"><TrendingUp className="h-3 w-3 mt-0.5 flex-shrink-0 text-[var(--accent)]" /> Add visual media to boost engagement by up to 150%</li>
        </ul>
      </div>
    </div>
  );
}

// ─── Sync Tab ───────────────────────────────────────────────

function SyncTab({ accounts, syncJobs, syncing, syncingAll, onSync, onSyncAll, onRefresh }: {
  accounts: PlatformAccount[];
  syncJobs: SyncJob[];
  syncing: string | null;
  syncingAll: boolean;
  onSync: (id: string, type?: string) => void;
  onSyncAll: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Sync Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Sync Management</h2>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
            <RefreshCw className="h-4 w-4" />
          </button>
          <button onClick={onSyncAll} disabled={syncing !== null || syncingAll} className="px-4 py-2 rounded-xl text-xs font-semibold text-white brand-button disabled:opacity-50 flex items-center gap-2">
            <Zap className="h-3.5 w-3.5" />
            Sync All Platforms
          </button>
        </div>
      </div>

      {/* Per-platform sync */}
      <div className="space-y-3">
        {accounts.map((account) => {
          const config = PLATFORM_CONFIG[account.platform] || { name: account.platform, color: "#666" };
          const isSyncing = syncing === account.id || account.syncStatus === "syncing";
          return (
            <div key={account.id} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-4">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                  style={{ backgroundColor: config.color }}
                >
                  <PlatformLogo platform={account.platform} size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{config.name}</h3>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      isSyncing ? "bg-blue-500/10 text-blue-400" :
                      account.syncStatus === "error" ? "bg-red-500/10 text-red-400" :
                      "bg-green-500/10 text-green-400"
                    }`}>
                      {isSyncing ? "Syncing..." : account.syncStatus === "error" ? "Error" : "Ready"}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    {account._count.platformPosts} posts · {account._count.platformFollowers} followers · {account._count.platformComments} comments
                  </p>
                  {account.lastSyncAt && (
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">Last sync: {timeAgo(account.lastSyncAt)}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {["posts", "followers", "analytics"].map((type) => (
                    <button
                      key={type}
                      onClick={() => onSync(account.id, type)}
                      disabled={isSyncing}
                      className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium border border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-all disabled:opacity-50 capitalize"
                    >
                      {type}
                    </button>
                  ))}
                  <button
                    onClick={() => onSync(account.id)}
                    disabled={isSyncing}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white brand-button disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {isSyncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Full
                  </button>
                </div>
              </div>
              {account.syncError && (
                <p className="text-[10px] text-red-400 mt-2 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {account.syncError}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Recent Sync Jobs */}
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-3">Sync History</h2>
        {syncJobs.length === 0 ? (
          <div className="glass-card rounded-xl p-6 text-center">
            <Clock className="h-6 w-6 text-[var(--text-muted)] mx-auto mb-2" />
            <p className="text-sm text-[var(--text-secondary)]">No sync history yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {syncJobs.map((job) => {
              const config = PLATFORM_CONFIG[job.connectedAccount.platform] || { name: job.connectedAccount.platform, color: "#666" };
              return (
                <div key={job.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "var(--bg-secondary)" }}>
                  <div
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: config.color }}
                  >
                    <PlatformLogo platform={job.connectedAccount.platform} size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[var(--text-primary)]">
                      {config.name} — {job.syncType} sync
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {job.itemsSynced} items · {timeAgo(job.createdAt)}
                    </p>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    job.status === "completed" ? "bg-green-500/10 text-green-400" :
                    job.status === "failed" ? "bg-red-500/10 text-red-400" :
                    job.status === "running" ? "bg-blue-500/10 text-blue-400" :
                    "bg-amber-500/10 text-amber-400"
                  }`}>
                    {job.status}
                  </span>
                  {job.status === "running" && (
                    <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-tertiary)" }}>
                      <div className="h-full rounded-full" style={{ width: `${job.progress}%`, background: "var(--accent)" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Post Card Component ────────────────────────────────────

function PostCard({ post, compact, onDelete, onPostAction }: {
  post: PlatformPostItem;
  compact?: boolean;
  onDelete?: (id: string) => void;
  onPostAction?: (action: string, postId: string, extra?: Record<string, string>) => void;
}) {
  const config = PLATFORM_CONFIG[post.connectedAccount.platform] || { name: post.connectedAccount.platform, color: "#666" };
  const TypeIcon = POST_TYPE_ICONS[post.postType] || FileText;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState(post.content || "");
  const [replyMode, setReplyMode] = useState(false);
  const [replyContent, setReplyContent] = useState("");

  return (
    <div className={`glass-card rounded-xl ${compact ? "p-3" : "p-4"} hover-lift group`}>
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        {post.thumbnailUrl && !compact && (
          <div className="h-16 w-24 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--bg-tertiary)]">
            <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="h-5 w-5 rounded flex items-center justify-center text-white"
              style={{ backgroundColor: config.color }}
            >
              <PlatformLogo platform={post.connectedAccount.platform} size={12} />
            </div>
            <span className="text-[10px] text-[var(--text-muted)]">{config.name}</span>
            <TypeIcon className="h-3 w-3 text-[var(--text-muted)]" />
            <span className="text-[10px] text-[var(--text-muted)] capitalize">{post.postType}</span>
            {post.visibility !== "public" && (
              <span className="text-[10px] px-1.5 py-0 rounded-full bg-amber-500/10 text-amber-400">{post.visibility}</span>
            )}
            {post.isFromMesh && (
              <span className="text-[10px] px-1.5 py-0 rounded-full bg-[var(--accent-muted)] text-[var(--accent)]">from mesh.me</span>
            )}
            {post.isPinned && (
              <span className="text-[10px] px-1.5 py-0 rounded-full bg-blue-500/10 text-blue-400 flex items-center gap-0.5">
                <Pin className="h-2.5 w-2.5" /> Pinned
              </span>
            )}
          </div>

          {post.title && (
            <h3 className={`font-semibold text-[var(--text-primary)] ${compact ? "text-xs" : "text-sm"} line-clamp-1 mb-0.5`}>
              {post.title}
            </h3>
          )}

          {/* Editable content */}
          {editMode ? (
            <div className="mt-1 space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full rounded-lg p-2 text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] resize-none focus:outline-none focus:border-[var(--accent)]"
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { onPostAction?.("edit", post.id, { content: editContent }); setEditMode(false); }}
                  className="px-3 py-1 rounded-lg text-[10px] font-medium text-white bg-[var(--accent)] hover:opacity-80 transition-opacity"
                >
                  Save
                </button>
                <button onClick={() => { setEditMode(false); setEditContent(post.content || ""); }} className="px-3 py-1 rounded-lg text-[10px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            post.content && (
              <p className={`text-[var(--text-secondary)] ${compact ? "text-xs line-clamp-1" : "text-sm line-clamp-2"}`}>
                {post.content}
              </p>
            )
          )}

          {/* Interactive Metrics — clickable like, comment, share */}
          <div className={`flex items-center gap-3 ${compact ? "mt-1" : "mt-2"}`}>
            {post.viewCount > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                <Eye className="h-3 w-3" />
                {formatNumber(post.viewCount)}
              </span>
            )}
            <button
              onClick={() => onPostAction?.("like", post.id)}
              className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-pink-400 transition-colors"
            >
              <Heart className="h-3 w-3" />
              {formatNumber(post.likeCount)}
            </button>
            <button
              onClick={() => setReplyMode(!replyMode)}
              className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-blue-400 transition-colors"
            >
              <MessageSquare className="h-3 w-3" />
              {formatNumber(post.commentCount)}
            </button>
            <button
              onClick={() => onPostAction?.("share", post.id)}
              className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-green-400 transition-colors"
            >
              <Share2 className="h-3 w-3" />
              {post.shareCount > 0 ? formatNumber(post.shareCount) : "Share"}
            </button>
            {post.publishedAt && (
              <span className="text-[10px] text-[var(--text-muted)]">
                {timeAgo(post.publishedAt)}
              </span>
            )}
          </div>

          {/* Reply input */}
          {replyMode && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 rounded-lg px-3 py-1.5 text-xs bg-[var(--bg-secondary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && replyContent.trim()) {
                    onPostAction?.("reply", post.id, { content: replyContent });
                    setReplyContent("");
                    setReplyMode(false);
                  }
                }}
              />
              <button
                onClick={() => { if (replyContent.trim()) { onPostAction?.("reply", post.id, { content: replyContent }); setReplyContent(""); setReplyMode(false); } }}
                disabled={!replyContent.trim()}
                className="px-3 py-1.5 rounded-lg text-[10px] font-medium text-white bg-[var(--accent)] disabled:opacity-50 hover:opacity-80 transition-opacity"
              >
                <Reply className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>

        {/* Actions Menu */}
        {!compact && (
          <div className="flex items-center gap-1 relative">
            {post.url && (
              <a href={post.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[var(--accent-subtle)] transition-colors">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}

            {/* More actions dropdown */}
            <button
              onClick={() => setShowActions(!showActions)}
              className="p-2 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>

            {showActions && (
              <div className="absolute right-0 top-10 z-30 min-w-[160px] rounded-xl glass-dropdown shadow-xl border border-[var(--border-primary)] py-1">
                <button
                  onClick={() => { setEditMode(true); setShowActions(false); }}
                  className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => { onPostAction?.(post.isPinned ? "unpin" : "pin", post.id); setShowActions(false); }}
                  className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <Pin className="h-3.5 w-3.5" /> {post.isPinned ? "Unpin" : "Pin"}
                </button>
                <button
                  onClick={() => {
                    const next = post.visibility === "public" ? "private" : "public";
                    onPostAction?.("visibility", post.id, { visibility: next });
                    setShowActions(false);
                  }}
                  className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
                >
                  {post.visibility === "public" ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {post.visibility === "public" ? "Make Private" : "Make Public"}
                </button>
                <div className="border-t border-[var(--border-primary)] my-1" />
                {onDelete && (
                  confirmDelete ? (
                    <div className="px-3 py-2 flex items-center gap-2">
                      <button
                        onClick={() => { onDelete(post.id); setConfirmDelete(false); setShowActions(false); }}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                      >
                        Confirm Delete
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="px-2 py-1 rounded-lg text-[10px] font-medium text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="w-full px-3 py-2 text-left text-xs flex items-center gap-2 text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Metric Cell ────────────────────────────────────────────

function MetricCell({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Eye }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1 mb-0.5">
        <Icon className="h-3 w-3 text-[var(--text-muted)]" />
        <span className="text-xs font-bold text-[var(--text-primary)]">{formatNumber(value)}</span>
      </div>
      <p className="text-[10px] text-[var(--text-muted)]">{label}</p>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
