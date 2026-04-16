"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ZoomIn, ZoomOut, Maximize2, Eye, EyeOff, Info,
  Search, Fingerprint, Plus, Layers, Shield,
  Users, Hash, Globe, MessageCircle, FileText, Link2, Sparkles,
} from "lucide-react";
import type { MeshNode, MeshEdge, FilterType } from "./mesh-types";

// --- Filter Bar ---

interface FilterBarProps {
  filter: FilterType;
  nodes: MeshNode[];
  onFilterChange: (filter: FilterType) => void;
  onSearchOpen: () => void;
  showFootprint: boolean;
  onToggleFootprint: () => void;
}

const FILTER_OPTIONS: { id: FilterType; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "Everything", icon: Globe },
  { id: "user", label: "People", icon: Users },
  { id: "alter-ego", label: "Alter Egos", icon: Sparkles },
  { id: "community", label: "Communities", icon: MessageCircle },
  { id: "tag", label: "Interests", icon: Hash },
  { id: "post", label: "Posts", icon: FileText },
  { id: "platform", label: "Platforms", icon: Link2 },
];

export function MeshFilterBar({ filter, nodes, onFilterChange, onSearchOpen, showFootprint, onToggleFootprint }: FilterBarProps) {
  const getCounts = (type: FilterType) => {
    if (type === "all") return nodes.length;
    return nodes.filter((n) => n.type === type).length;
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-10 p-2 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-2xl p-1 bg-black/30 backdrop-blur-xl border border-white/[0.06] overflow-x-auto scrollbar-hide">
          {FILTER_OPTIONS.filter((fItem) => getCounts(fItem.id) > 0 || fItem.id === "all").map((fItem) => {
            const IconComp = fItem.icon;
            const isActive = filter === fItem.id;
            const count = getCounts(fItem.id);
            return (
              <button
                key={fItem.id}
                onClick={() => onFilterChange(fItem.id)}
                className={"flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold transition-all duration-200 whitespace-nowrap " + (
                  isActive
                    ? "bg-white/15 text-white shadow-sm"
                    : "text-white/50 hover:text-white/80 hover:bg-white/[0.06]"
                )}
                title={fItem.label}
              >
                <IconComp className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{fItem.label}</span>
                {isActive && count > 0 && fItem.id !== "all" && (
                  <span className="text-[9px] bg-white/20 px-1.5 py-0.5 rounded-full">{count}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onSearchOpen} className="p-2.5 rounded-xl bg-black/30 backdrop-blur-xl border border-white/[0.06] text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200" title="Search mesh (Cmd+K)">
            <Search className="h-4 w-4" />
          </button>
          <button
            onClick={onToggleFootprint}
            className={"p-2.5 rounded-xl backdrop-blur-xl border transition-all duration-200 " + (
              showFootprint
                ? "bg-indigo-500/30 border-indigo-400/30 text-indigo-300"
                : "bg-black/30 border-white/[0.06] text-white/60 hover:text-white hover:bg-white/10"
            )}
            title="Digital Footprint"
          >
            <Fingerprint className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Zoom Controls ---

interface ZoomControlsProps {
  showLabels: boolean;
  showStats: boolean;
  onZoom: (delta: number) => void;
  onReset: () => void;
  onToggleLabels: () => void;
  onToggleStats: () => void;
}

export function MeshZoomControls({ showLabels, showStats, onZoom, onReset, onToggleLabels, onToggleStats }: ZoomControlsProps) {
  return (
    <div className="absolute top-1/2 -translate-y-1/2 right-2 sm:right-3 z-10 flex flex-col gap-1 bg-black/30 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-1.5">
      <button onClick={() => onZoom(0.3)} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all duration-200" title="Zoom in"><ZoomIn className="h-4 w-4" /></button>
      <button onClick={() => onZoom(-0.3)} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all duration-200" title="Zoom out"><ZoomOut className="h-4 w-4" /></button>
      <button onClick={onReset} className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all duration-200" title="Reset view"><Maximize2 className="h-4 w-4" /></button>
    </div>
  );
}

// --- Stats Bar ---

interface StatsBarProps {
  nodes: MeshNode[];
  zoom: number;
  visible: boolean;
}

export function MeshStatsBar({ nodes, zoom, visible }: StatsBarProps & { edges?: MeshEdge[] }) {
  const people = nodes.filter((n) => n.type === "user");
  const communities = nodes.filter((n) => n.type === "community");
  const interests = nodes.filter((n) => n.type === "tag");
  const posts = nodes.filter((n) => n.type === "post");
  const platforms = nodes.filter((n) => n.type === "platform");
  const mutuals = people.filter((n) => n.isMutual);
  const onlineCount = people.filter((n) => n.status === "online").length;

  // Compute total reach (sum of all user follower counts)
  const totalReach = people.reduce((sum, n) => sum + (n.followerCount || 0), 0);

  const stats = [
    { label: "people", count: people.length, color: "text-indigo-400" },
    { label: "mutuals", count: mutuals.length, color: "text-violet-400" },
    { label: "communities", count: communities.length, color: "text-pink-400" },
    { label: "interests", count: interests.length, color: "text-cyan-400" },
    { label: "posts", count: posts.length, color: "text-emerald-400" },
    { label: "platforms", count: platforms.length, color: "text-amber-400" },
  ].filter((s) => s.count > 0);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-16 sm:bottom-[4.5rem] left-2 sm:left-4 z-10 flex flex-col gap-1.5 max-w-[calc(100vw-6rem)]"
        >
          {/* Mesh insights row */}
          <div className="flex gap-1.5 flex-wrap">
            <div className="bg-black/40 backdrop-blur-xl border border-indigo-500/20 rounded-xl px-3 py-1.5 text-[11px] text-white/60">
              <span className="font-bold text-indigo-300">{nodes.length}</span> nodes in mesh
            </div>
            {totalReach > 0 && (
              <div className="bg-black/40 backdrop-blur-xl border border-violet-500/20 rounded-xl px-3 py-1.5 text-[11px] text-white/60">
                <span className="font-bold text-violet-300">{totalReach.toLocaleString()}</span> total reach
              </div>
            )}
            {onlineCount > 0 && (
              <div className="bg-black/40 backdrop-blur-xl border border-emerald-500/20 rounded-xl px-3 py-1.5 text-[11px] text-white/60">
                <span className="font-bold text-emerald-300">{onlineCount}</span> online
              </div>
            )}
          </div>
          {/* Node type breakdown */}
          <div className="flex gap-1.5 flex-wrap">
            {stats.map((s) => (
              <div key={s.label} className="bg-black/30 backdrop-blur-xl border border-white/[0.06] rounded-xl px-2.5 py-1.5 text-[11px] text-white/50">
                <span className={"font-bold " + s.color}>{s.count}</span> {s.label}
              </div>
            ))}
            <div className="bg-black/30 backdrop-blur-xl border border-white/[0.06] rounded-xl px-2.5 py-1.5 text-[11px] text-white/40">
              {Math.round(zoom * 100)}%
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// --- Action Bar ---

interface ActionBarProps {
  showContentHub: boolean;
  showNodePrivacy: boolean;
  hiddenCount: number;
  onCreatePost: () => void;
  onToggleContentHub: () => void;
  onTogglePrivacy: () => void;
}

export function MeshActionBar({ showContentHub, showNodePrivacy, hiddenCount, onCreatePost, onToggleContentHub, onTogglePrivacy }: ActionBarProps) {
  return (
    <div className="absolute bottom-3 sm:bottom-4 left-2 sm:left-4 z-10 flex gap-2">
      <button onClick={onCreatePost} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-semibold text-white transition-all duration-200 active:scale-95 shadow-lg bg-indigo-500 hover:bg-indigo-400 hover:shadow-indigo-500/30">
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Create Post</span>
      </button>
      <button
        onClick={onToggleContentHub}
        className={"flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-medium transition-all duration-200 active:scale-95 backdrop-blur-xl border " + (
          showContentHub ? "bg-cyan-500/20 border-cyan-400/30 text-cyan-300" : "bg-black/30 border-white/[0.06] text-white/60 hover:text-white hover:bg-white/10"
        )}
      >
        <Layers className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Content Hub</span>
      </button>
      <button
        onClick={onTogglePrivacy}
        className={"flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-medium transition-all duration-200 active:scale-95 backdrop-blur-xl border " + (
          showNodePrivacy ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300" : "bg-black/30 border-white/[0.06] text-white/60 hover:text-white hover:bg-white/10"
        )}
      >
        <Shield className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Privacy</span>
        {hiddenCount > 0 && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/25 text-amber-300 font-bold">{hiddenCount}</span>
        )}
      </button>
    </div>
  );
}
