"use client";

import { motion } from "framer-motion";
import { X, Shield } from "lucide-react";
import Link from "next/link";

interface MeshPrivacyPanelProps {
  hiddenNodes: Set<string>;
  hiddenBranches: Set<string>;
  onToggleBranchHidden: (branchType: string) => void;
  onShowAll: () => void;
  onClose: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  user: "People",
  community: "Communities",
  tag: "Interests",
  post: "Posts",
  platform: "Platforms",
};

const TYPE_COLORS: Record<string, string> = {
  user: "text-blue-400",
  community: "text-sky-400",
  tag: "text-cyan-400",
  post: "text-emerald-400",
  platform: "text-amber-400",
};

export function MeshPrivacyPanel({
  hiddenNodes, hiddenBranches, onToggleBranchHidden, onShowAll, onClose,
}: MeshPrivacyPanelProps) {
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
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[10px] text-[var(--text-muted)] mb-3">
          Control what&apos;s visible on your mesh. Hidden items are only hidden for you and won&apos;t appear on your public mesh.
        </p>

        {/* Branch toggles */}
        <div className="space-y-1.5 mb-3">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">Hide entire branches</p>
          {["user", "community", "tag", "post", "platform"].map((type) => (
            <button
              key={type}
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
            <button onClick={onShowAll} className="text-[10px] text-[var(--accent)] hover:underline">
              Show all nodes
            </button>
          </div>
        )}

        <Link href="/settings">
          <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
            <Shield className="h-3 w-3" /> Advanced Privacy Settings
          </button>
        </Link>
      </div>
    </motion.div>
  );
}
