"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { MeshiSettingsTip } from "@/components/meshi/meshi-guide";

interface NotificationsTabProps {
  notifFollowers: boolean;
  setNotifFollowers: (v: boolean) => void;
  notifLikes: boolean;
  setNotifLikes: (v: boolean) => void;
  notifComments: boolean;
  setNotifComments: (v: boolean) => void;
  notifMessages: boolean;
  setNotifMessages: (v: boolean) => void;
  notifCommunity: boolean;
  setNotifCommunity: (v: boolean) => void;
  notifSmartSummary: boolean;
  setNotifSmartSummary: (v: boolean) => void;
}

export function NotificationsTab({
  notifFollowers, setNotifFollowers, notifLikes, setNotifLikes,
  notifComments, setNotifComments, notifMessages, setNotifMessages,
  notifCommunity, setNotifCommunity, notifSmartSummary, setNotifSmartSummary,
}: NotificationsTabProps) {
  const items = [
    { label: "New followers", desc: "When someone follows you", state: notifFollowers, setter: setNotifFollowers },
    { label: "Likes on your posts", desc: "When someone likes your content", state: notifLikes, setter: setNotifLikes },
    { label: "Comments & replies", desc: "When someone comments on your posts", state: notifComments, setter: setNotifComments },
    { label: "Direct messages", desc: "When you receive a new message", state: notifMessages, setter: setNotifMessages },
    { label: "Community activity", desc: "Updates from your communities", state: notifCommunity, setter: setNotifCommunity },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <MeshiSettingsTip tab="notifications" />
      <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Notification preferences</h2>
      <p className="text-sm text-[var(--text-muted)] mb-6">Choose what notifications you want to receive</p>
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between py-3 border-b border-[var(--border-primary)]">
            <div>
              <span className="text-sm text-[var(--text-primary)] block font-medium">{item.label}</span>
              <span className="text-xs text-[var(--text-muted)]">{item.desc}</span>
            </div>
            <button
              type="button"
              onClick={() => item.setter(!item.state)}
              className={`relative w-11 h-6 rounded-full transition-colors ${item.state ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${item.state ? "right-0.5" : "left-0.5"}`} />
            </button>
          </div>
        ))}
      </div>

      {/* Smart Notifications */}
      <div className="mt-6 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4" style={{ color: "var(--accent)" }} />
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Smart Notifications</h3>
        </div>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Intelligently summarize and batch your notifications instead of individual alerts.
          mesh.me will condense 47 notifications into one clean summary.
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[var(--text-secondary)]">Enable smart summaries</span>
          <button
            type="button"
            onClick={() => setNotifSmartSummary(!notifSmartSummary)}
            className={`relative w-11 h-6 rounded-full transition-colors ${notifSmartSummary ? "bg-[var(--accent)]" : "bg-[var(--bg-hover)]"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-sm ${notifSmartSummary ? "right-0.5" : "left-0.5"}`} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
