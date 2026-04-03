"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText, Users, Globe, Bell, Waypoints, ArrowRight,
  TrendingUp, Heart, MessageCircle, Link2, Clock, Sparkles,
} from "lucide-react";
import { MeshiLogo } from "@/components/meshi/meshi-mascot";
import { Avatar } from "@/components/ui/avatar";

interface DashboardClientProps {
  user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
  };
  stats: {
    posts: number;
    followers: number;
    following: number;
    platforms: number;
    unreadNotifs: number;
  };
  connectedAccounts: Array<{
    platform: string;
    username: string | null;
    lastSync: string | null;
  }>;
  recentPosts: Array<{
    id: string;
    content: string;
    createdAt: string;
    comments: number;
    reactions: number;
  }>;
}

const statCards = [
  { key: "posts", label: "Posts", icon: FileText, color: "#2d7ff9", href: "/feed" },
  { key: "followers", label: "Followers", icon: Users, color: "#a855f7", href: null },
  { key: "following", label: "Following", icon: Users, color: "#22c55e", href: null },
  { key: "platforms", label: "Platforms", icon: Link2, color: "#f59e0b", href: "/connected-accounts" },
] as const;

const quickActions = [
  { label: "Create Post", icon: FileText, href: "/feed", color: "var(--accent)" },
  { label: "View Mesh", icon: Waypoints, href: "/mesh", color: "#a855f7" },
  { label: "Content Hub", icon: Globe, href: "/content-hub", color: "#22c55e" },
  { label: "Platforms", icon: Link2, href: "/connected-accounts", color: "#f59e0b" },
];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DashboardClient({ user, stats, connectedAccounts, recentPosts }: DashboardClientProps) {
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-page-enter">
      {/* Welcome Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <Avatar src={user.avatarUrl} alt={user.displayName} size="lg" />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
              {greeting}, {user.displayName.split(" ")[0]}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "var(--text-secondary)" }}>
              Welcome back to your digital universe
            </p>
          </div>
        </div>
        {stats.unreadNotifs > 0 && (
          <Link
            href="/notifications"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:scale-105"
            style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
          >
            <Bell className="h-4 w-4" />
            {stats.unreadNotifs} new
          </Link>
        )}
      </div>

      {/* Meshi Greeting Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-2xl mb-6 flex items-center gap-4"
        style={{
          background: "linear-gradient(135deg, var(--accent-muted), var(--bg-secondary))",
          border: "1px solid var(--accent-muted)",
        }}
      >
        <MeshiLogo size={40} color="blue" mood="happy" />
        <div className="flex-1">
          <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            <Sparkles className="h-3.5 w-3.5 inline mr-1" style={{ color: "var(--accent)" }} />
            Meshi says:
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            {connectedAccounts.length === 0
              ? "Connect your first platform to start building your mesh! Head to Platforms to get started."
              : recentPosts.length === 0
                ? `You have ${connectedAccounts.length} platform${connectedAccounts.length !== 1 ? "s" : ""} connected. Create your first post to share with your network!`
                : `Looking good! You have ${stats.posts} posts across ${connectedAccounts.length} platforms. Keep building your mesh!`}
          </p>
        </div>
        <Link
          href={connectedAccounts.length === 0 ? "/connected-accounts" : "/feed"}
          className="text-xs font-medium flex items-center gap-1 px-3 py-1.5 rounded-lg whitespace-nowrap"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {connectedAccounts.length === 0 ? "Connect" : "Create Post"}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statCards.map((card, i) => {
          const value = stats[card.key];
          const CardIcon = card.icon;
          const inner = (
            <>
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg" style={{ background: card.color + "15" }}>
                  <CardIcon className="h-4 w-4" style={{ color: card.color }} />
                </div>
                {card.href && <ArrowRight className="h-3.5 w-3.5" style={{ color: "var(--text-muted)" }} />}
              </div>
              <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{card.label}</p>
            </>
          );
          return (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              {card.href ? (
                <Link href={card.href} className="block p-4 rounded-xl glass-surface transition-all hover:scale-[1.02]">
                  {inner}
                </Link>
              ) : (
                <div className="block p-4 rounded-xl glass-surface transition-all hover:scale-[1.02]">
                  {inner}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--text-secondary)" }}>Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-3 p-3 rounded-xl glass-surface transition-all hover:scale-[1.02] group"
            >
              <div className="p-2 rounded-lg" style={{ background: action.color + "15" }}>
                <action.icon className="h-4 w-4" style={{ color: action.color }} />
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="glass-surface rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Posts</h2>
            <Link href="/feed" className="text-xs font-medium" style={{ color: "var(--accent)" }}>
              View all
            </Link>
          </div>
          {recentPosts.length > 0 ? (
            <div className="space-y-3">
              {recentPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/feed/${post.id}`}
                  className="block p-3 rounded-lg transition-all hover:bg-[var(--bg-hover)]"
                >
                  <p className="text-sm line-clamp-2" style={{ color: "var(--text-primary)" }}>{post.content}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      <Heart className="h-3 w-3" /> {post.reactions}
                    </span>
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-muted)" }}>
                      <MessageCircle className="h-3 w-3" /> {post.comments}
                    </span>
                    <span className="flex items-center gap-1 text-xs ml-auto" style={{ color: "var(--text-muted)" }}>
                      <Clock className="h-3 w-3" /> {timeAgo(post.createdAt)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <FileText className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No posts yet</p>
              <Link href="/feed" className="text-xs mt-1 inline-block" style={{ color: "var(--accent)" }}>
                Create your first post
              </Link>
            </div>
          )}
        </div>

        {/* Connected Platforms */}
        <div className="glass-surface rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Connected Platforms</h2>
            <Link href="/connected-accounts" className="text-xs font-medium" style={{ color: "var(--accent)" }}>
              Manage
            </Link>
          </div>
          {connectedAccounts.length > 0 ? (
            <div className="space-y-2">
              {connectedAccounts.slice(0, 6).map((account) => (
                <div
                  key={account.platform}
                  className="flex items-center gap-3 p-2.5 rounded-lg"
                  style={{ background: "var(--bg-tertiary)" }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white" style={{ background: "var(--accent)" }}>
                    {account.platform.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize truncate" style={{ color: "var(--text-primary)" }}>
                      {account.platform.replace(/_/g, " ")}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-muted)" }}>
                      {account.username || "Connected"}
                    </p>
                  </div>
                  {account.lastSync && (
                    <span className="text-[10px] flex-shrink-0" style={{ color: "var(--text-muted)" }}>
                      {timeAgo(account.lastSync)}
                    </span>
                  )}
                </div>
              ))}
              {connectedAccounts.length > 6 && (
                <p className="text-xs text-center pt-1" style={{ color: "var(--text-muted)" }}>
                  +{connectedAccounts.length - 6} more platforms
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <Link2 className="h-8 w-8 mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No platforms connected</p>
              <Link href="/connected-accounts" className="text-xs mt-1 inline-block" style={{ color: "var(--accent)" }}>
                Connect your first platform
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
