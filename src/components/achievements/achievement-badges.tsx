"use client";

import { motion } from "framer-motion";
import { Trophy, Star, Users, MessageCircle, Zap, Shield, Globe, Heart, Crown, Sparkles, Award, Target } from "lucide-react";

// Achievement definitions — these match the seeded achievements in the database
export const ACHIEVEMENT_DEFINITIONS = [
  // Limited edition
  { slug: "pioneer", name: "Pioneer", description: "Among the first 1 million verified mesh.me users", icon: "crown", category: "limited", title: "Pioneer", isLimited: true, maxHolders: 1000000 },

  // Milestone achievements
  { slug: "first-post", name: "First Words", description: "Created your first post on mesh.me", icon: "zap", category: "posts", title: "Creator" },
  { slug: "ten-posts", name: "Getting Started", description: "Created 10 posts", icon: "star", category: "posts", title: "Active Creator", threshold: 10 },
  { slug: "hundred-posts", name: "Prolific", description: "Created 100 posts", icon: "trophy", category: "posts", title: "Prolific Creator", threshold: 100 },

  { slug: "first-follower", name: "Connected", description: "Got your first follower", icon: "users", category: "social", title: "Connected" },
  { slug: "ten-followers", name: "Growing Network", description: "Reached 10 followers", icon: "users", category: "social", title: "Networker", threshold: 10 },
  { slug: "hundred-followers", name: "Community Builder", description: "Reached 100 followers", icon: "globe", category: "social", title: "Community Builder", threshold: 100 },
  { slug: "thousand-followers", name: "Influencer", description: "Reached 1,000 followers", icon: "star", category: "social", title: "Influencer", threshold: 1000 },

  { slug: "first-community", name: "Community Member", description: "Joined your first community", icon: "message-circle", category: "communities", title: "Member" },
  { slug: "community-creator", name: "Community Creator", description: "Created a community", icon: "globe", category: "communities", title: "Founder" },

  { slug: "platform-linker", name: "Platform Linker", description: "Connected your first external platform", icon: "globe", category: "platforms", title: "Multi-Platform" },
  { slug: "mesh-master", name: "Mesh Master", description: "Connected 5+ platforms to your mesh", icon: "target", category: "platforms", title: "Mesh Master", threshold: 5 },

  { slug: "verified", name: "Verified", description: "Verified your mesh.me account", icon: "shield", category: "account", title: "Verified" },
  { slug: "customizer", name: "Customizer", description: "Personalized your profile", icon: "sparkles", category: "account", title: "Customizer" },

  { slug: "helper", name: "Helping Hand", description: "Liked 50 posts from other users", icon: "heart", category: "engagement", title: "Helper", threshold: 50 },
  { slug: "conversationalist", name: "Conversationalist", description: "Left 25 comments", icon: "message-circle", category: "engagement", title: "Conversationalist", threshold: 25 },
];

const ICON_MAP: Record<string, React.ElementType> = {
  trophy: Trophy,
  star: Star,
  users: Users,
  "message-circle": MessageCircle,
  zap: Zap,
  shield: Shield,
  globe: Globe,
  heart: Heart,
  crown: Crown,
  sparkles: Sparkles,
  award: Award,
  target: Target,
};

interface AchievementBadgeProps {
  slug: string;
  unlocked: boolean;
  unlockedAt?: Date;
  size?: "sm" | "md" | "lg";
  showTitle?: boolean;
}

export function AchievementBadge({ slug, unlocked, unlockedAt, size = "md", showTitle = false }: AchievementBadgeProps) {
  const def = ACHIEVEMENT_DEFINITIONS.find((a) => a.slug === slug);
  if (!def) return null;

  const IconComp = ICON_MAP[def.icon] || Award;
  const sizes = {
    sm: { badge: "w-8 h-8", icon: "h-3.5 w-3.5", text: "text-[9px]", title: "text-[10px]" },
    md: { badge: "w-12 h-12", icon: "h-5 w-5", text: "text-[10px]", title: "text-xs" },
    lg: { badge: "w-16 h-16", icon: "h-7 w-7", text: "text-xs", title: "text-sm" },
  };
  const s = sizes[size];

  return (
    <div className="flex flex-col items-center gap-1">
      <motion.div
        className={`${s.badge} rounded-full flex items-center justify-center relative ${
          unlocked
            ? def.isLimited
              ? "bg-gradient-to-br from-amber-400/20 to-yellow-600/20 border-2 border-amber-400/50"
              : "bg-[var(--accent)]/10 border-2 border-[var(--accent)]/30"
            : "bg-[var(--bg-tertiary)] border-2 border-[var(--border-primary)] opacity-40"
        }`}
        whileHover={{ scale: 1.1 }}
        title={`${def.name}: ${def.description}${unlockedAt ? ` (Unlocked ${new Date(unlockedAt).toLocaleDateString()})` : ""}`}
      >
        <IconComp
          className={`${s.icon} ${
            unlocked
              ? def.isLimited
                ? "text-amber-400"
                : "text-[var(--accent)]"
              : "text-[var(--text-muted)]"
          }`}
        />
        {unlocked && def.isLimited && (
          <motion.div
            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-amber-400 flex items-center justify-center"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Star className="h-2 w-2 text-amber-900" />
          </motion.div>
        )}
      </motion.div>
      {showTitle && (
        <div className="text-center">
          <p className={`${s.text} font-medium ${unlocked ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>
            {def.name}
          </p>
          {unlocked && def.title && (
            <p className={`${s.title} font-semibold ${def.isLimited ? "text-amber-400" : "text-[var(--accent)]"}`}>
              {def.title}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Title badge shown on profiles
export function UserTitle({ title, isLimited = false, className = "" }: { title: string; isLimited?: boolean; className?: string }) {
  if (!title) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
        isLimited
          ? "bg-gradient-to-r from-amber-400/20 to-yellow-600/20 text-amber-400 border border-amber-400/30"
          : "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20"
      } ${className}`}
    >
      {isLimited && <Crown className="h-2.5 w-2.5" />}
      {title}
    </span>
  );
}

// Achievement list for profile/settings
interface AchievementListProps {
  unlockedSlugs: string[];
  unlockedMap?: Record<string, Date>;
}

export function AchievementList({ unlockedSlugs, unlockedMap = {} }: AchievementListProps) {
  const categories = [
    { id: "limited", label: "Limited Edition" },
    { id: "posts", label: "Posts" },
    { id: "social", label: "Social" },
    { id: "communities", label: "Communities" },
    { id: "platforms", label: "Platforms" },
    { id: "account", label: "Account" },
    { id: "engagement", label: "Engagement" },
  ];

  return (
    <div className="space-y-6">
      {categories.map((cat) => {
        const achievements = ACHIEVEMENT_DEFINITIONS.filter((a) => a.category === cat.id);
        if (achievements.length === 0) return null;

        return (
          <div key={cat.id}>
            <h4 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">{cat.label}</h4>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
              {achievements.map((achievement) => (
                <AchievementBadge
                  key={achievement.slug}
                  slug={achievement.slug}
                  unlocked={unlockedSlugs.includes(achievement.slug)}
                  unlockedAt={unlockedMap[achievement.slug]}
                  size="md"
                  showTitle
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
