"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ZoomIn, ZoomOut, Maximize2, Minimize2, SlidersHorizontal,
  Search, Fingerprint, Plus, Layers, Shield, EyeOff,
  Users, Hash, Globe, MessageCircle, FileText, Link2, Sparkles,
  BarChart3, Eye, RefreshCw, Activity,
} from "lucide-react";
import type { MeshNode, MeshEdge, FilterType } from "./mesh-types";

// --- Filter Bar ---

export interface MeshPlatformFilterOption {
  id: string;
  label: string;
  platform: string;
  color: string;
  count: number;
}

interface FilterBarProps {
  filter: FilterType;
  nodes: MeshNode[];
  platformOptions?: MeshPlatformFilterOption[];
  platformFilter?: string | null;
  onFilterChange: (filter: FilterType) => void;
  onPlatformFilterChange?: (platformId: string | null) => void;
  onSearchOpen: () => void;
  showFootprint: boolean;
  onToggleFootprint: () => void;
  className?: string;
}

const FILTER_OPTIONS: { id: FilterType; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All", icon: Globe },
  { id: "user", label: "People", icon: Users },
  { id: "alter-ego", label: "IDs", icon: Sparkles },
  { id: "community", label: "Groups", icon: MessageCircle },
  { id: "tag", label: "Interests", icon: Hash },
  { id: "post", label: "Posts", icon: FileText },
  { id: "platform", label: "Apps", icon: Link2 },
  { id: "activity", label: "Activity", icon: Activity },
];

export function MeshFilterBar({
  filter,
  nodes,
  platformOptions = [],
  platformFilter = null,
  onFilterChange,
  onPlatformFilterChange,
  onSearchOpen,
  showFootprint,
  onToggleFootprint,
  className,
}: FilterBarProps) {
  const getCounts = (type: FilterType) => {
    if (type === "all") return nodes.length;
    return nodes.filter((n) => n.type === type).length;
  };

  const hasPlatformFilters = platformOptions.length > 0 && typeof onPlatformFilterChange === "function";

  return (
    <div className={"mesh-filter-bar absolute left-0 right-0 z-10 p-2 sm:p-4 " + (className || "top-0")}>
      <div className="flex min-w-0 items-start justify-between gap-2 sm:gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="scrollbar-hide flex min-w-0 gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-black/35 p-1.5 shadow-lg shadow-black/20 backdrop-blur-2xl">
            {FILTER_OPTIONS.filter((fItem) => getCounts(fItem.id) > 0 || fItem.id === "all").map((fItem) => {
              const IconComp = fItem.icon;
              const isActive = filter === fItem.id;
              const count = getCounts(fItem.id);
              return (
                <button
                  type="button"
                  key={fItem.id}
                  onClick={() => onFilterChange(fItem.id)}
                  aria-pressed={isActive}
                  aria-label={`Show ${fItem.label} in the Mesh${count > 0 ? `, ${count} available` : ""}`}
                  className={"flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-semibold transition-all duration-300 whitespace-nowrap " + (
                    isActive
                      ? "bg-white/15 text-white shadow-sm shadow-white/5"
                      : "text-white/45 hover:text-white/85 hover:bg-white/[0.07] active:scale-95"
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

          {hasPlatformFilters && (
            <div className="scrollbar-hide flex min-w-0 gap-1 overflow-x-auto rounded-2xl border border-white/[0.08] bg-black/25 p-1.5 shadow-lg shadow-black/15 backdrop-blur-2xl" aria-label="Connected platform Mesh filters">
              <button
                type="button"
                onClick={() => onPlatformFilterChange?.(null)}
                aria-pressed={!platformFilter}
                aria-label="Show all connected platforms in the Mesh"
                className={"flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-[10px] font-bold transition-all duration-300 active:scale-95 " + (
                  !platformFilter
                    ? "bg-white/14 text-white shadow-sm shadow-white/5"
                    : "text-white/45 hover:bg-white/[0.07] hover:text-white/85"
                )}
              >
                <Globe className="h-3 w-3" />
                All apps
              </button>
              {platformOptions.map((option) => {
                const isActive = platformFilter === option.id;
                return (
                  <button
                    type="button"
                    key={option.id}
                    onClick={() => onPlatformFilterChange?.(option.id)}
                    aria-pressed={isActive}
                    aria-label={`Filter Mesh to ${option.label}`}
                    className={"flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-[10px] font-bold transition-all duration-300 active:scale-95 " + (
                      isActive
                        ? "bg-white/14 text-white shadow-sm shadow-white/5"
                        : "text-white/45 hover:bg-white/[0.07] hover:text-white/85"
                    )}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: option.color }} aria-hidden="true" />
                    <span>{option.label}</span>
                    {option.count > 0 && (
                      <span className="rounded-full bg-white/12 px-1.5 py-0.5 text-[9px] text-white/65">{option.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onSearchOpen} className="p-2.5 rounded-xl bg-black/35 backdrop-blur-2xl border border-white/[0.08] text-white/55 hover:text-white hover:bg-white/12 transition-all duration-300 active:scale-95 shadow-lg shadow-black/20" title="Search mesh (Cmd+K)" aria-label="Search your Mesh">
            <Search className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggleFootprint}
            aria-pressed={showFootprint}
            aria-label={showFootprint ? "Hide digital footprint" : "Show digital footprint"}
            className={"p-2.5 rounded-xl backdrop-blur-2xl border transition-all duration-300 active:scale-95 shadow-lg shadow-black/20 " + (
              showFootprint
                ? "bg-indigo-500/30 border-indigo-400/30 text-indigo-300"
                : "bg-black/35 border-white/[0.08] text-white/55 hover:text-white hover:bg-white/12"
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
  advancedView: boolean;
  advancedOpen: boolean;
  isFullscreen: boolean;
  onZoom: (delta: number) => void;
  onReset: () => void;
  onToggleLabels: () => void;
  onToggleStats: () => void;
  onToggleView: () => void;
  onToggleAdvanced: () => void;
  onToggleFullscreen: () => void;
}

export function MeshZoomControls({
  showLabels,
  showStats,
  advancedView,
  advancedOpen,
  isFullscreen,
  onZoom,
  onReset,
  onToggleLabels,
  onToggleStats,
  onToggleView,
  onToggleAdvanced,
  onToggleFullscreen,
}: ZoomControlsProps) {
  const controlClass = "p-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/12 transition-all duration-300 active:scale-90";
  const activeClass = "p-2.5 rounded-xl bg-white/14 text-white shadow-sm shadow-white/10 transition-all duration-300 active:scale-90";

  return (
    <div className="mesh-zoom-controls absolute right-2 sm:right-3 z-10 flex flex-col gap-1.5 bg-black/35 backdrop-blur-2xl border border-white/[0.08] rounded-2xl p-1.5 shadow-lg shadow-black/20 top-[max(8rem,calc(4.5rem+env(safe-area-inset-top)))] md:top-1/2 md:-translate-y-1/2">
      <button type="button" onClick={() => onZoom(0.3)} className={controlClass} title="Zoom in" aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
      <div className="h-px bg-white/[0.06] mx-1" />
      <button type="button" onClick={() => onZoom(-0.3)} className={controlClass} title="Zoom out" aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
      <div className="h-px bg-white/[0.06] mx-1" />
      <button type="button" onClick={onReset} className={controlClass} title="Fit to view" aria-label="Fit Mesh to view"><Maximize2 className="h-4 w-4" /></button>
      <div className="h-px bg-white/[0.06] mx-1" />
      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-pressed={isFullscreen}
        className={isFullscreen ? activeClass : controlClass}
        title={isFullscreen ? "Exit full screen" : "Full screen"}
        aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
      <div className="h-px bg-white/[0.06] mx-1" />
      <button
        type="button"
        onClick={onToggleAdvanced}
        aria-pressed={advancedOpen}
        className={advancedOpen ? activeClass : controlClass}
        title={advancedOpen ? "Hide advanced controls" : "Advanced controls"}
        aria-label={advancedOpen ? "Hide advanced Mesh controls" : "Show advanced Mesh controls"}
      >
        <SlidersHorizontal className="h-4 w-4" />
      </button>

      {advancedOpen && (
        <>
          <div className="h-px bg-white/[0.06] mx-1" />
          <button
            onClick={onToggleLabels}
            type="button"
            aria-pressed={showLabels}
            className={showLabels ? activeClass : controlClass}
            title={showLabels ? "Hide labels" : "Show labels"}
            aria-label={showLabels ? "Hide labels" : "Show labels"}
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            onClick={onToggleStats}
            type="button"
            aria-pressed={showStats}
            className={showStats ? activeClass : controlClass}
            title={showStats ? "Hide stats" : "Show stats"}
            aria-label={showStats ? "Hide stats" : "Show stats"}
          >
            <BarChart3 className="h-4 w-4" />
          </button>
          <button
            onClick={onToggleView}
            type="button"
            aria-pressed={advancedView}
            className={advancedView ? activeClass : controlClass}
            title={advancedView ? "Switch to Simplified view" : "Switch to Advanced view"}
            aria-label={advancedView ? "Switch to Simplified view (show key nodes only)" : "Switch to Advanced view (show all nodes)"}
          >
            <Layers className="h-4 w-4" />
          </button>
        </>
      )}
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
  const activities = nodes.filter((n) => n.type === "activity");
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
    { label: "activity", count: activities.length, color: "text-sky-400" },
  ].filter((s) => s.count > 0);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
          className="mesh-stats-bar absolute bottom-[calc(7.5rem+env(safe-area-inset-bottom))] md:bottom-[4.5rem] left-2 sm:left-4 z-10 flex flex-col gap-1.5 max-w-[calc(100vw-6rem)]"
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
  ghostMode: boolean;
  hiddenCount: number;
  isSyncingAll?: boolean;
  onCreatePost: () => void;
  onConnectAccounts: () => void;
  onSyncAll: () => void;
  onToggleContentHub: () => void;
  onTogglePrivacy: () => void;
  onToggleGhostMode: () => void;
}

export function MeshActionBar({
  showContentHub,
  showNodePrivacy,
  ghostMode,
  hiddenCount,
  isSyncingAll,
  onCreatePost,
  onConnectAccounts,
  onSyncAll,
  onToggleContentHub,
  onTogglePrivacy,
  onToggleGhostMode,
}: ActionBarProps) {
  return (
    <div data-testid="mesh-action-bar" className="mesh-action-bar absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 left-2 right-2 sm:left-4 sm:right-auto z-10 flex gap-2 overflow-x-auto pb-1">
      <button type="button" onClick={onCreatePost} aria-label="Create a Mesh post" className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[11px] font-semibold text-white transition-all duration-300 active:scale-95 shadow-lg shadow-indigo-500/20 bg-indigo-500 hover:bg-indigo-400 hover:shadow-indigo-500/30">
        <Plus className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Post</span>
      </button>
      <button
        type="button"
        onClick={onSyncAll}
        disabled={isSyncingAll}
        aria-label="Sync all connected platforms"
        className="flex items-center gap-1.5 rounded-xl border border-sky-400/25 bg-sky-500/18 px-3 py-2.5 text-[11px] font-semibold text-sky-200 shadow-lg shadow-black/20 backdrop-blur-2xl transition-all duration-300 active:scale-95 disabled:opacity-60"
      >
        <RefreshCw className={"h-3.5 w-3.5 " + (isSyncingAll ? "animate-spin" : "")} />
        <span className="hidden sm:inline">{isSyncingAll ? "Syncing" : "Sync all"}</span>
      </button>
      <button
        type="button"
        onClick={onConnectAccounts}
        aria-label="Connect or manage platforms"
        className="flex items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/35 px-3 py-2.5 text-[11px] font-medium text-white/60 shadow-lg shadow-black/20 backdrop-blur-2xl transition-all duration-300 hover:bg-white/12 hover:text-white active:scale-95"
      >
        <Link2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Connect</span>
      </button>
      <button
        type="button"
        onClick={onToggleContentHub}
        aria-pressed={showContentHub}
        aria-label={showContentHub ? "Hide Mesh content hub" : "Show Mesh content hub"}
        className={"flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-medium transition-all duration-300 active:scale-95 backdrop-blur-2xl border shadow-lg shadow-black/20 " + (
          showContentHub ? "bg-cyan-500/20 border-cyan-400/30 text-cyan-300" : "bg-black/35 border-white/[0.08] text-white/55 hover:text-white hover:bg-white/12"
        )}
      >
        <Layers className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Content</span>
      </button>
      <button
        type="button"
        onClick={onToggleGhostMode}
        aria-pressed={ghostMode}
        aria-label={ghostMode ? "Disable ghost mode" : "Enable ghost mode"}
        className={"flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-medium transition-all duration-300 active:scale-95 backdrop-blur-2xl border shadow-lg shadow-black/20 " + (
          ghostMode ? "bg-purple-500/20 border-purple-400/30 text-purple-300" : "bg-black/35 border-white/[0.08] text-white/55 hover:text-white hover:bg-white/12"
        )}
      >
        <EyeOff className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{ghostMode ? "Ghost" : "Ghost"}</span>
      </button>
      <button
        type="button"
        onClick={onTogglePrivacy}
        aria-pressed={showNodePrivacy}
        aria-label={showNodePrivacy ? "Hide Mesh privacy controls" : "Show Mesh privacy controls"}
        className={"flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-medium transition-all duration-300 active:scale-95 backdrop-blur-2xl border shadow-lg shadow-black/20 " + (
          showNodePrivacy ? "bg-emerald-500/20 border-emerald-400/30 text-emerald-300" : "bg-black/35 border-white/[0.08] text-white/55 hover:text-white hover:bg-white/12"
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
