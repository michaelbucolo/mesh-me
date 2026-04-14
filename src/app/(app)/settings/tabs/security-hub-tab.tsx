"use client";

import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ShieldCheck, FileText, Video, MessageSquare, ExternalLink, Activity, Scan } from "lucide-react";
import { MeshiSettingsTip } from "@/components/meshi/meshi-guide";

export function SecurityHubTab() {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <MeshiSettingsTip tab="security-hub" />
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-5 w-5" style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">Security Hub</h2>
        </div>
        <p className="text-sm text-[var(--text-muted)]">
          Manage and remove your content across all connected platforms from one place.
        </p>
      </div>

      {/* Cross-platform content management */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <FileText className="h-4 w-4" style={{ color: "var(--accent)" }} /> Content Management
        </h3>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Delete posts, comments, videos, or entire channels across your connected platforms directly from mesh.me.
        </p>
        <div className="space-y-3">
          {[
            { icon: FileText, label: "Posts & Photos", desc: "Review and delete posts across platforms", count: 0 },
            { icon: Video, label: "Videos", desc: "Manage uploaded videos on YouTube, TikTok, etc.", count: 0 },
            { icon: MessageSquare, label: "Comments & Replies", desc: "Find and remove your comments anywhere", count: 0 },
          ].map((item) => (
            <button key={item.label} className="w-full flex items-center gap-3 p-3 rounded-xl glass-surface hover:border-[var(--glass-border)] transition-all text-left group">
              <div className="h-9 w-9 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center flex-shrink-0">
                <item.icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-[var(--text-primary)] block">{item.label}</span>
                <span className="text-xs text-[var(--text-muted)]">{item.desc}</span>
              </div>
              <ExternalLink className="h-4 w-4 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>

      {/* Active sessions */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Activity className="h-4 w-4" style={{ color: "var(--accent)" }} /> Active Sessions
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-xl glass-surface">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <div>
                <span className="text-sm text-[var(--text-primary)] block">Current session</span>
                <span className="text-xs text-[var(--text-muted)]">This device &middot; Active now</span>
              </div>
            </div>
            <span className="text-xs text-emerald-400 font-medium">Current</span>
          </div>
        </div>
        <Button variant="secondary" size="sm" className="mt-3 w-full">
          Sign out all other sessions
        </Button>
      </div>

      {/* Data export */}
      <div className="glass-card rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
          <Scan className="h-4 w-4" style={{ color: "var(--accent)" }} /> Data Export
        </h3>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          Download a complete copy of all your mesh.me data including posts, messages, and account info.
        </p>
        <Button variant="secondary" size="sm">Request data export</Button>
      </div>
    </motion.div>
  );
}
