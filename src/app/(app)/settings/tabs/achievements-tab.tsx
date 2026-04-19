"use client";

import { checkAndAwardAchievements, setActiveTitle } from "@/lib/actions";
import { useState, useTransition, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Award, Crown } from "lucide-react";
import { AchievementList } from "@/components/achievements/achievement-badges";
import { SettingsCard, SettingsCardHeader } from "./settings-primitives";

interface AchievementsTabProps {
  showSuccess: (msg: string) => void;
}

export function AchievementsTab({ showSuccess }: AchievementsTabProps) {
  const [, startTransition] = useTransition();
  const [unlockedSlugs, setUnlockedSlugs] = useState<string[]>([]);
  const [userActiveTitle, setUserActiveTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await checkAndAwardAchievements();
        const r = await fetch("/api/settings");
        const data = await r.json();
        if (cancelled) return;
        if (data.settings?.achievements) {
          setUnlockedSlugs(data.settings.achievements.map((a: { slug: string }) => a.slug));
        }
        if (data.settings?.activeTitle) {
          setUserActiveTitle(data.settings.activeTitle);
        }
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
          <Trophy className="h-5 w-5" style={{ color: "var(--accent)" }} />
          Achievements & Titles
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Earn titles through milestones on mesh.me. Titles are displayed on your profile for others to see.
        </p>
      </div>

      {/* Active title selector */}
      <SettingsCard className="mb-6">
        <SettingsCardHeader
          title="Active Title"
          icon={<Award className="h-4 w-4" style={{ color: "var(--accent)" }} />}
          description="Choose a title to display on your profile"
          className="mb-3"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => { startTransition(async () => { await setActiveTitle(null); setUserActiveTitle(null); showSuccess("Title removed"); }); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!userActiveTitle ? "brand-button text-white" : "glass-surface text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"}`}
          >
            None
          </button>
          {unlockedSlugs.length === 0 && !loading && (
            <p className="text-xs text-[var(--text-muted)] py-1.5">Earn achievements to unlock titles!</p>
          )}
        </div>
      </SettingsCard>

      {/* Achievement list */}
      {loading ? (
        <div className="text-center py-8">
          <div className="h-8 w-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: "var(--accent)" }} />
          <p className="text-sm text-[var(--text-muted)]">Checking achievements...</p>
        </div>
      ) : (
        <AchievementList unlockedSlugs={unlockedSlugs} />
      )}

      {/* Pioneer callout */}
      <SettingsCard className="border border-amber-400/20 bg-amber-400/5">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-amber-400/20 to-yellow-600/20 flex items-center justify-center border-2 border-amber-400/40">
            <Crown className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-amber-400">Pioneer — Limited Edition</h3>
            <p className="text-xs text-[var(--text-muted)]">First 1,000,000 verified mesh.me users</p>
          </div>
        </div>
        <p className="text-xs text-[var(--text-tertiary)] leading-relaxed">
          The Pioneer title is a limited edition achievement awarded to the first 1 million fully verified mesh.me users.
          Once all 1 million spots are claimed, this title can never be earned again. Verify your account to claim yours!
        </p>
      </SettingsCard>
    </motion.div>
  );
}
