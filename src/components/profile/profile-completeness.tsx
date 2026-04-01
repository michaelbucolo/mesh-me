"use client";

import { motion } from "framer-motion";

interface ProfileCompletenessProps {
  profile: {
    avatarUrl?: string | null;
    bannerUrl?: string | null;
    bio?: string | null;
    location?: string | null;
    website?: string | null;
    interests: number;
    links: number;
    connectedAccounts: number;
  };
}

const COMPLETENESS_ITEMS = [
  { key: "avatar", label: "Profile photo", check: (p: ProfileCompletenessProps["profile"]) => !!p.avatarUrl },
  { key: "banner", label: "Cover image", check: (p: ProfileCompletenessProps["profile"]) => !!p.bannerUrl },
  { key: "bio", label: "Bio", check: (p: ProfileCompletenessProps["profile"]) => !!p.bio },
  { key: "location", label: "Location", check: (p: ProfileCompletenessProps["profile"]) => !!p.location },
  { key: "website", label: "Website", check: (p: ProfileCompletenessProps["profile"]) => !!p.website },
  { key: "interests", label: "Interests (3+)", check: (p: ProfileCompletenessProps["profile"]) => p.interests >= 3 },
  { key: "links", label: "Links", check: (p: ProfileCompletenessProps["profile"]) => p.links >= 1 },
  { key: "platforms", label: "Connected platform", check: (p: ProfileCompletenessProps["profile"]) => p.connectedAccounts >= 1 },
];

export function ProfileCompleteness({ profile }: ProfileCompletenessProps) {
  const completed = COMPLETENESS_ITEMS.filter((item) => item.check(profile)).length;
  const total = COMPLETENESS_ITEMS.length;
  const percentage = Math.round((completed / total) * 100);

  if (percentage === 100) return null; // Hide when complete

  return (
    <div className="rounded-2xl glass-card p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Complete your profile</h3>
        <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>{percentage}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-[var(--bg-tertiary)] mb-3 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--brand-gradient)" }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-2 gap-1.5">
        {COMPLETENESS_ITEMS.map((item) => {
          const done = item.check(profile);
          return (
            <div key={item.key} className="flex items-center gap-2 text-xs">
              <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                done ? "bg-emerald-500/20 text-emerald-400" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
              }`}>
                {done ? (
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-current" />
                )}
              </div>
              <span className={done ? "text-[var(--text-muted)] line-through" : "text-[var(--text-secondary)]"}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
