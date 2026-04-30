"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface MeshPostComposerProps {
  connectedPlatforms: { id: string; label: string; color: string }[];
  onClose: () => void;
}

export function MeshPostComposer({ connectedPlatforms, onClose }: MeshPostComposerProps) {
  const router = useRouter();
  const [postContent, setPostContent] = useState("");

  const handlePublish = async () => {
    if (!postContent.trim()) return;
    router.push("/feed?compose=true");
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-lg mx-4 glass-dropdown rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 via-sky-500 to-cyan-400" />
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-[var(--text-primary)]">Create Post</h3>
          <button type="button" onClick={onClose} aria-label="Close post composer" className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors">
            <X className="h-4 w-4" />
          </button>
          </div>

          <textarea
            value={postContent}
            onChange={(e) => setPostContent(e.target.value)}
            placeholder="What's on your mind? Post it to Mesh.me..."
            className="w-full h-32 p-3 rounded-xl bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition-all"
            autoFocus
          />

          {/* Connected source status */}
          {connectedPlatforms.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-2 flex items-center gap-1">
                <Share2 className="h-3 w-3" /> Connected sources
              </p>
              <div className="flex flex-wrap gap-1.5">
                {connectedPlatforms.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-[var(--border-primary)] text-[var(--text-muted)] opacity-80"
                    title="External publishing is disabled until this source grants official publishing API access."
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-[var(--text-muted)]">
                External publishing only appears when the source platform grants official posting permissions.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mt-4">
            <p className="text-[10px] text-[var(--text-muted)]">
              {postContent.length}/500 characters
            </p>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={!postContent.trim()}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white brand-button shadow-lg hover:shadow-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
