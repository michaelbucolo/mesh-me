"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserPlus, Globe, Check, X, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FollowPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    displayName: string;
    username: string;
    avatarUrl: string | null;
    connectedPlatforms: string[];
  };
  sourcePlatform?: string;
  onFollowChoice: (choice: "everywhere" | "platform" | "mesh-only", platforms?: string[]) => void;
}

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  youtube: "#FF0000",
  tiktok: "#000000",
  twitter: "#1DA1F2",
  twitch: "#9146FF",
  spotify: "#1DB954",
  soundcloud: "#FF5500",
  linkedin: "#0A66C2",
  github: "#333333",
  discord: "#5865F2",
  snapchat: "#FFFC00",
  pinterest: "#BD081C",
  reddit: "#FF4500",
  facebook: "#1877F2",
  threads: "#000000",
  bluesky: "#0085FF",
};

export function FollowPromptDialog({ isOpen, onClose, targetUser, sourcePlatform, onFollowChoice }: FollowPromptDialogProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  };

  const handleChoice = async (choice: "everywhere" | "platform" | "mesh-only") => {
    setLoading(true);
    try {
      if (choice === "everywhere") {
        await onFollowChoice("everywhere", targetUser.connectedPlatforms);
      } else if (choice === "platform" && sourcePlatform) {
        await onFollowChoice("platform", [sourcePlatform]);
      } else {
        await onFollowChoice("mesh-only");
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 text-center border-b border-zinc-800">
              <Avatar src={targetUser.avatarUrl} alt={targetUser.displayName} size="lg" className="mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-zinc-100">Follow {targetUser.displayName}?</h2>
              <p className="text-sm text-zinc-500 mt-1">@{targetUser.username} is on {targetUser.connectedPlatforms.length + 1} platforms</p>
            </div>

            {/* Options */}
            <div className="p-4 space-y-2">
              {/* Follow Everywhere */}
              <button
                onClick={() => handleChoice("everywhere")}
                disabled={loading}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-blue-600/10 to-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-all text-left"
              >
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <Globe className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-100">Follow everywhere</p>
                  <p className="text-xs text-zinc-500">Follow on mesh.me + all {targetUser.connectedPlatforms.length} connected platforms</p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-500" />
              </button>

              {/* Follow on Source Platform Only */}
              {sourcePlatform && (
                <button
                  onClick={() => handleChoice("platform")}
                  disabled={loading}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/50 hover:border-zinc-600 transition-all text-left"
                >
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
                    style={{ backgroundColor: PLATFORM_COLORS[sourcePlatform] || "#666" }}
                  >
                    {sourcePlatform.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-zinc-100 capitalize">Follow on {sourcePlatform}</p>
                    <p className="text-xs text-zinc-500">Only follow on the platform this post is from</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-zinc-500" />
                </button>
              )}

              {/* Follow on mesh.me Only */}
              <button
                onClick={() => handleChoice("mesh-only")}
                disabled={loading}
                className="w-full flex items-center gap-3 p-3 rounded-xl bg-zinc-800/30 border border-zinc-700/50 hover:border-zinc-600 transition-all text-left"
              >
                <div className="h-10 w-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                  <UserPlus className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-zinc-100">Follow on mesh.me only</p>
                  <p className="text-xs text-zinc-500">Just follow their mesh.me profile</p>
                </div>
                <ChevronRight className="h-4 w-4 text-zinc-500" />
              </button>
            </div>

            {/* Cancel */}
            <div className="p-4 pt-0">
              <button
                onClick={onClose}
                className="w-full py-2.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
