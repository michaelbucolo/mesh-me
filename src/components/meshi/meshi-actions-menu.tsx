"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  X, Sparkles, MessageCircle, Search,
  ChevronRight, Palette, Settings, HelpCircle,
  PenSquare, Compass, Users, Link2, Crown, MessageSquarePlus,
} from "lucide-react";
import { MeshiMascot, type MeshiMood, type MeshiColor, type MeshiHat } from "./meshi-mascot";

interface MeshiActionsMenuProps {
  meshiColor: MeshiColor;
  meshiHat: MeshiHat;
  onClose: () => void;
  onAskMeshi: () => void;
  onSearchMesh: () => void;
  onOpenChat: () => void;
}

export function MeshiActionsMenu({
  meshiColor, meshiHat, onClose, onAskMeshi, onSearchMesh, onOpenChat,
}: MeshiActionsMenuProps) {
  const router = useRouter();

  const navigate = (path: string) => { onClose(); router.push(path); };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed bottom-[72px] lg:bottom-[72px] right-4 z-50 w-[280px] max-w-[calc(100vw-2rem)] max-h-[60vh] glass-dropdown rounded-2xl shadow-2xl overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-primary)]" style={{ background: "var(--bg-secondary)" }}>
        <MeshiMascot size={28} mood="happy" color={meshiColor} hat={meshiHat} showGlow={false} animate={false} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Meshi</p>
          <p className="text-[10px] text-[var(--text-muted)]">Your mesh.me companion</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Menu Items */}
      <div className="p-2 space-y-0.5 overflow-y-auto flex-1">
        <p className="px-3 pt-1 pb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Quick Actions</p>
        <MenuItem icon={MessageCircle} iconColor="var(--accent)" label="Ask Meshi" onClick={onAskMeshi} />
        <MenuItem icon={PenSquare} iconColor="#22c55e" label="Create Post" onClick={() => navigate("/feed?compose=true")} />
        <MenuItem icon={Search} iconColor="#f59e0b" label="Search Mesh" onClick={onSearchMesh} />

        <p className="px-3 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Navigate</p>
        <MenuItem icon={Compass} iconColor="#0ea5e9" label="Explore" onClick={() => navigate("/explore")} />
        <MenuItem icon={MessageCircle} iconColor="#10b981" label="Messages" onClick={() => navigate("/messages")} />
        <MenuItem icon={Users} iconColor="#f472b6" label="Communities" onClick={() => navigate("/communities")} />
        <MenuItem icon={Link2} iconColor="#a78bfa" label="Connected Accounts" onClick={() => navigate("/connected-accounts")} />

        <p className="px-3 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Settings & More</p>
        <MenuItem icon={Palette} iconColor="#06b6d4" label="Customize Meshi" onClick={() => navigate("/settings?tab=meshi")} />
        <MenuItem icon={Settings} iconColor="#38bdf8" label="Settings" onClick={() => navigate("/settings")} />
        <MenuItem icon={Crown} iconColor="#f59e0b" label="MeshPro" onClick={() => navigate("/meshpro")} />
        <MenuItem icon={MessageSquarePlus} iconColor="#8b5cf6" label="Send Feedback" onClick={() => navigate("/feedback")} />
        <MenuItem icon={HelpCircle} iconColor="#ec4899" label="Full Chat with Meshi" onClick={onOpenChat} />
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[var(--border-primary)] flex items-center justify-between" style={{ background: "var(--bg-secondary)" }}>
        <div className="flex items-center gap-1 text-[9px] text-emerald-500 font-medium">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Zero data stored
        </div>
        <span className="text-[9px] text-[var(--text-muted)]">
          <Sparkles className="h-3 w-3 inline" /> mesh.me
        </span>
      </div>
    </motion.div>
  );
}

function MenuItem({ icon: Icon, iconColor, label, onClick }: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  iconColor: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-left hover:bg-[var(--bg-hover)] transition-colors"
      style={{ color: "var(--text-primary)" }}
    >
      <Icon className="h-4 w-4" style={{ color: iconColor }} />
      <span className="flex-1">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-[var(--text-muted)]" />
    </button>
  );
}
