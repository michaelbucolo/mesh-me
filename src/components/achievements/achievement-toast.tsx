"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Crown, X } from "lucide-react";
import { ACHIEVEMENT_DEFINITIONS } from "./achievement-badges";
import { checkAndAwardAchievements } from "@/lib/actions";

interface AchievementToast {
  slug: string;
  name: string;
  description: string;
  title?: string;
  isLimited?: boolean;
}

export function AchievementChecker() {
  const [toasts, setToasts] = useState<AchievementToast[]>([]);
  const [checked, setChecked] = useState(false);

  const dismissToast = useCallback((slug: string) => {
    setToasts((prev) => prev.filter((t) => t.slug !== slug));
  }, []);

  useEffect(() => {
    if (checked) return;
    const timer = setTimeout(() => {
      setChecked(true);
    }, 0);

    // Check achievements after a short delay to avoid blocking initial render
    const checkTimer = setTimeout(async () => {
      try {
        const result = await checkAndAwardAchievements();
        if (result && "awarded" in result && result.awarded && result.awarded.length > 0) {
          const newToasts: AchievementToast[] = result.awarded.map((slug: string) => {
            const def = ACHIEVEMENT_DEFINITIONS.find((a) => a.slug === slug);
            return {
              slug,
              name: def?.name || slug,
              description: def?.description || "Achievement unlocked!",
              title: def?.title,
              isLimited: def?.isLimited,
            };
          });
          setToasts(newToasts);

          // Auto-dismiss after 6 seconds
          newToasts.forEach((toast) => {
            setTimeout(() => dismissToast(toast.slug), 6000);
          });
        }
      } catch {
        // Silently fail — achievement checks are non-critical
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearTimeout(checkTimer);
    };
  }, [checked, dismissToast]);

  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.slug}
            initial={{ opacity: 0, x: 100, scale: 0.8 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.8 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="pointer-events-auto"
          >
            <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border ${
              toast.isLimited
                ? "bg-gradient-to-r from-amber-950/90 to-yellow-950/90 border-amber-500/30"
                : "bg-gradient-to-r from-blue-950/90 to-indigo-950/90 border-blue-500/30"
            }`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                toast.isLimited ? "bg-amber-500/20" : "bg-blue-500/20"
              }`}>
                {toast.isLimited ? (
                  <Crown className="h-5 w-5 text-amber-400" />
                ) : (
                  <Trophy className="h-5 w-5 text-blue-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white/60 uppercase tracking-wider">Achievement Unlocked!</p>
                <p className="text-sm font-semibold text-white truncate">{toast.name}</p>
                <p className="text-xs text-white/50 truncate">{toast.description}</p>
                {toast.title && (
                  <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                    toast.isLimited
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/20"
                      : "bg-blue-500/20 text-blue-300 border border-blue-500/20"
                  }`}>
                    <Star className="h-2 w-2" />
                    Title: {toast.title}
                  </span>
                )}
              </div>
              <button
                onClick={() => dismissToast(toast.slug)}
                className="p-1 rounded-lg text-white/40 hover:text-white/80 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
