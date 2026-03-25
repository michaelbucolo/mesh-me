"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Bell, Heart, MessageCircle, UserPlus, Repeat, AtSign, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import { MarkReadButton } from "./mark-read-button";
import { motion, AnimatePresence } from "framer-motion";

const NOTIFICATION_ICONS: Record<string, typeof Heart> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  repost: Repeat,
  mention: AtSign,
  message: MessageCircle,
};

interface Notification {
  id: string;
  type: string;
  message: string | null;
  read: boolean;
  postId: string | null;
  createdAt: string;
  actor: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
}

type TabKey = "all" | "likes" | "comments" | "follows" | "messages" | "reposts";

interface NotificationsClientProps {
  categorized: Record<TabKey, Notification[]>;
  unreadCount: number;
  aiSummary: string | null;
}

const TABS: { id: TabKey; label: string; icon: typeof Heart }[] = [
  { id: "all", label: "All", icon: Bell },
  { id: "likes", label: "Likes", icon: Heart },
  { id: "comments", label: "Comments", icon: MessageCircle },
  { id: "follows", label: "Follows", icon: UserPlus },
  { id: "messages", label: "Messages", icon: MessageCircle },
  { id: "reposts", label: "Reposts", icon: Repeat },
];

export function NotificationsClient({ categorized, unreadCount, aiSummary }: NotificationsClientProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [showAISummary, setShowAISummary] = useState(!!aiSummary);

  const notifications = categorized[activeTab];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-zinc-400 mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && <MarkReadButton />}
      </div>

      {/* AI Summary Banner */}
      <AnimatePresence>
        {showAISummary && aiSummary && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-zinc-100">AI Summary</h3>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">Smart Digest</span>
                  </div>
                  <p className="text-sm text-zinc-300">{aiSummary}</p>
                </div>
                <button
                  onClick={() => setShowAISummary(false)}
                  className="p-1 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {TABS.map((tab) => {
          const count = categorized[tab.id].filter((n) => !n.read).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white"
                  : "text-zinc-400 bg-zinc-900 border border-zinc-800 hover:border-zinc-700"
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
              {count > 0 && (
                <span className={`h-4 min-w-4 px-1 rounded-full text-[10px] flex items-center justify-center ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-indigo-500/20 text-indigo-400"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notification List */}
      {notifications.length > 0 ? (
        <div className="space-y-1">
          {notifications.map((notification) => {
            const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
            const href = notification.postId
              ? `/feed/${notification.postId}`
              : notification.actor
              ? `/profile/${notification.actor.username}`
              : "#";

            return (
              <Link
                key={notification.id}
                href={href}
                className={`flex items-start gap-3 p-4 rounded-xl transition-colors ${
                  notification.read ? "hover:bg-zinc-800/30" : "bg-indigo-500/5 hover:bg-indigo-500/10"
                }`}
              >
                <div className="relative">
                  {notification.actor ? (
                    <Avatar src={notification.actor.avatarUrl} alt={notification.actor.displayName} size="sm" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                      <Bell className="h-4 w-4 text-zinc-400" />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-zinc-900 flex items-center justify-center">
                    <Icon className="h-3 w-3 text-indigo-400" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200">{notification.message}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
                {!notification.read && (
                  <div className="h-2 w-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title={activeTab === "all" ? "No notifications" : `No ${activeTab}`}
          description={activeTab === "all"
            ? "When someone interacts with you, you'll see it here."
            : `You don't have any ${activeTab} notifications yet.`
          }
        />
      )}
    </div>
  );
}
