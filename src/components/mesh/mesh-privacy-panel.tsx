"use client";

import { motion } from "framer-motion";
import { Eye, EyeOff, LockKeyhole, Settings, X, Shield } from "lucide-react";
import Link from "next/link";

interface MeshPrivacyPanelProps {
  hiddenNodes: Set<string>;
  hiddenBranches: Set<string>;
  onToggleBranchHidden: (branchType: string) => void;
  onHideAllBranches: () => void;
  onShowAll: () => void;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  user: "People",
  "alter-ego": "Identities",
  community: "Communities",
  tag: "Interests",
  post: "Posts",
  platform: "Platforms",
  activity: "Activity",
};

const TYPE_COLORS: Record<string, string> = {
  user: "text-blue-400",
  "alter-ego": "text-violet-400",
  community: "text-sky-400",
  tag: "text-cyan-400",
  post: "text-emerald-400",
  platform: "text-amber-400",
  activity: "text-sky-400",
};

export function MeshPrivacyPanel({
  hiddenNodes, hiddenBranches, onToggleBranchHidden, onHideAllBranches, onShowAll, onClose,
}: MeshPrivacyPanelProps) {
  const isPrivateView = hiddenBranches.size >= 7;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute top-20 left-4 z-20 w-72 glass-dropdown rounded-2xl shadow-2xl overflow-hidden"
    >
      <div className="h-1 w-full bg-gradient-to-r from-emerald-500 to-teal-400" />
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Mesh Privacy</h3>
          </div>
        <button type="button" onClick={onClose} aria-label="Close Mesh privacy controls" className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
          <X className="h-4 w-4" />
        </button>
        </div>
        <p className="text-[10px] text-[var(--text-muted)] mb-3">
          Control what is visible in this Mesh view. Public profile rules live in Settings.
        </p>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onHideAllBranches}
            aria-pressed={isPrivateView}
            className="flex min-h-[4.4rem] flex-col justify-between rounded-xl border border-emerald-400/18 bg-emerald-500/10 p-3 text-left text-xs transition-all hover:bg-emerald-500/15 active:scale-[0.98]"
          >
            <LockKeyhole className="h-4 w-4 text-emerald-300" aria-hidden="true" />
            <span className="font-bold text-[var(--text-primary)]">Private view</span>
            <span className="text-[10px] text-[var(--text-muted)]">Hide branches</span>
          </button>
          <button
            type="button"
            onClick={onShowAll}
            className="flex min-h-[4.4rem] flex-col justify-between rounded-xl border border-[var(--border-primary)] bg-[var(--bg-secondary)] p-3 text-left text-xs transition-all hover:bg-[var(--bg-hover)] active:scale-[0.98]"
          >
            <Eye className="h-4 w-4 text-[var(--accent)]" aria-hidden="true" />
            <span className="font-bold text-[var(--text-primary)]">Show all</span>
            <span className="text-[10px] text-[var(--text-muted)]">Restore view</span>
          </button>
        </div>

        {/* Branch toggles */}
        <div className="space-y-1.5 mb-3">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Hide entire branches</p>
          {["user", "alter-ego", "community", "tag", "post", "platform", "activity"].map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onToggleBranchHidden(type)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs hover:bg-[var(--bg-tertiary)] transition-all"
            >
              <span className={"font-medium " + (TYPE_COLORS[type] || "")}>{TYPE_LABELS[type] || type}</span>
              <span className={"text-[10px] px-2 py-0.5 rounded-full " + (
                hiddenBranches.has(type)
                  ? "bg-red-500/15 text-red-400"
                  : "bg-emerald-500/15 text-emerald-400"
              )}>
                {hiddenBranches.has(type) ? "Hidden" : "Visible"}
              </span>
            </button>
          ))}
        </div>

        {/* Individual hidden nodes */}
        {hiddenNodes.size > 0 && (
          <div className="mb-3">
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
              {hiddenNodes.size} hidden node{hiddenNodes.size !== 1 ? "s" : ""}
            </p>
            <button type="button" onClick={onShowAll} className="text-[10px] text-[var(--accent)] hover:underline">
              Show all nodes
            </button>
          </div>
        )}

        <Link href="/settings?tab=privacy" className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
          <Settings className="h-3 w-3" />
          Account privacy
        </Link>
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[var(--bg-secondary)] px-2.5 py-2 text-[10px] text-[var(--text-muted)]">
          <EyeOff className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
          Hidden Mesh items stay out of your public Mesh previews.
        </div>
      </div>
    </motion.div>
  );
}
