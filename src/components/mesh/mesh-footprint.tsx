"use client";

import { motion } from "framer-motion";
import { X, Users, Heart, FileText, Link2, Shield, Lock } from "lucide-react";
import Link from "next/link";
import { MeshiMascot, type MeshiColor, type MeshiHat } from "@/components/meshi/meshi-mascot";

interface MeshFootprintProps {
  meshStats: {
    followingCount: number;
    followerCount: number;
    mutualCount: number;
    communityCount: number;
    postCount: number;
    interestCount: number;
    connectedPlatformCount: number;
  };
  meshiColor: MeshiColor;
  meshiHat: MeshiHat;
  onClose: () => void;
}

export function MeshFootprint({ meshStats, meshiColor, meshiHat, onClose }: MeshFootprintProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="absolute bottom-16 left-4 right-4 md:left-auto md:right-4 md:bottom-4 md:w-96 z-20 glass-dropdown rounded-2xl shadow-2xl overflow-hidden"
    >
      <div className="h-1.5 w-full" style={{ background: "var(--brand-gradient)" }} />
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MeshiMascot size={28} color={meshiColor} mood="happy" hat={meshiHat} animate showGlow={false} />
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Your Digital Footprint</h3>
              <p className="text-[10px] text-[var(--text-muted)]">Everything in your mesh at a glance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Following", value: meshStats.followingCount, color: "text-[var(--accent)]", icon: Users },
            { label: "Followers", value: meshStats.followerCount, color: "text-indigo-400", icon: Users },
            { label: "Mutuals", value: meshStats.mutualCount, color: "text-blue-400", icon: Heart },
            { label: "Posts", value: meshStats.postCount, color: "text-emerald-400", icon: FileText },
            { label: "Communities", value: meshStats.communityCount, color: "text-sky-400", icon: Users },
            { label: "Platforms", value: meshStats.connectedPlatformCount, color: "text-amber-400", icon: Link2 },
          ].map((stat) => (
            <div key={stat.label} className="glass-surface rounded-xl p-2.5 text-center">
              <stat.icon className={"h-3.5 w-3.5 mx-auto mb-1 " + stat.color} />
              <p className={"text-lg font-bold " + stat.color}>{stat.value}</p>
              <p className="text-[9px] text-[var(--text-muted)]">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Privacy summary */}
        <div className="glass-surface rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
            <p className="text-xs font-semibold text-[var(--text-primary)]">Privacy Status</p>
          </div>
          <div className="space-y-1.5">
            {[
              { label: "Profile visibility", value: "You control", icon: Lock },
              { label: "Data shared with mesh.me", value: "Minimal", icon: Shield },
              { label: "Third-party access", value: "None", icon: Lock },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--text-muted)]">{item.label}</span>
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <item.icon className="h-2.5 w-2.5" /> {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick manage links */}
        <div className="flex gap-2">
          <Link href="/settings" className="flex-1">
            <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium brand-button text-white transition-all active:scale-95 shadow-lg">
              <Shield className="h-3 w-3" /> Security Hub
            </button>
          </Link>
          <Link href="/connected-accounts" className="flex-1">
            <button className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium glass-surface text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all active:scale-95">
              <Link2 className="h-3 w-3" /> Accounts
            </button>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
