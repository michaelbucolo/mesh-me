"use client";

import { motion } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Search, Users, Hash, FileText, Link2, Globe, MessageCircle,
  Shield, Fingerprint, PenSquare,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { MeshNode } from "./mesh-types";

interface MeshCommandPaletteProps {
  nodes: MeshNode[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onClose: () => void;
  onSelectNode: (node: MeshNode) => void;
  onShowFootprint: () => void;
  centerRef: React.RefObject<{ x: number; y: number }>;
  zoomRef: React.RefObject<number>;
  panRef: React.RefObject<{ x: number; y: number }>;
  onPanChange: (pan: { x: number; y: number }) => void;
}

export function MeshCommandPalette({
  nodes, searchQuery, onSearchChange, onClose, onSelectNode,
  onShowFootprint, centerRef, zoomRef, panRef, onPanChange,
}: MeshCommandPaletteProps) {
  const router = useRouter();

  const handleSelect = (node: MeshNode) => {
    onSelectNode(node);
    onClose();
    onSearchChange("");
    // Pan to node
    if (centerRef.current && zoomRef.current !== undefined) {
      const newPan = {
        x: -(node.x - centerRef.current.x) * zoomRef.current,
        y: -(node.y - centerRef.current.y) * zoomRef.current,
      };
      onPanChange(newPan);
    }
  };

  const filteredNodes = nodes
    .filter((n) => n.type !== "self" && (
      n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (n.sublabel && n.sublabel.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (n.content && n.content.toLowerCase().includes(searchQuery.toLowerCase()))
    ))
    .slice(0, 10);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-start justify-center pt-24 bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 400 }}
        className="w-full max-w-md glass-dropdown rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="p-3 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              autoFocus
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search your mesh... people, posts, communities"
              className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none"
              onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            />
            <kbd className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)] font-mono">ESC</kbd>
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredNodes.map((node) => (
            <button
              key={node.id}
              onClick={() => handleSelect(node)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[var(--bg-tertiary)] transition-all group"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: node.color }}>
                {node.avatarUrl ? (
                  <Avatar src={node.avatarUrl} alt={node.label} size="sm" />
                ) : (
                  node.type === "community" ? <Users className="h-4 w-4" /> :
                  node.type === "tag" ? <Hash className="h-4 w-4" /> :
                  node.type === "post" ? <FileText className="h-4 w-4" /> :
                  node.type === "platform" ? <Link2 className="h-4 w-4" /> :
                  node.label[0]
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">{node.label}</p>
                {node.sublabel && <p className="text-[10px] text-[var(--text-muted)] truncate">{node.sublabel}</p>}
              </div>
              <Badge variant="secondary" className="text-[9px] capitalize flex-shrink-0">{node.type}</Badge>
            </button>
          ))}
          {searchQuery && filteredNodes.length === 0 && (
            <div className="text-center py-6">
              <p className="text-xs text-[var(--text-muted)]">No results found in your mesh</p>
            </div>
          )}
          {!searchQuery && (
            <div className="space-y-1">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider px-3 pt-2 pb-1">Quick Actions</p>
              {[
                { label: "Create new post", icon: PenSquare, href: "/feed?compose=true" },
                { label: "Explore mesh.me", icon: Globe, href: "/explore" },
                { label: "Open MeChat", icon: MessageCircle, href: "/messages" },
                { label: "Security Hub", icon: Shield, href: "/settings" },
                { label: "Connected Accounts", icon: Link2, href: "/connected-accounts" },
                { label: "View your footprint", icon: Fingerprint, action: () => { onShowFootprint(); onClose(); } },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() => {
                    if ("action" in action && action.action) {
                      action.action();
                    } else if ("href" in action && action.href) {
                      router.push(action.href);
                      onClose();
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-[var(--bg-tertiary)] transition-all"
                >
                  <action.icon className="h-4 w-4 text-[var(--text-muted)]" />
                  <span className="text-sm text-[var(--text-secondary)]">{action.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
