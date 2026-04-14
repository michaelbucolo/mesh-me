"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crown,
  Sparkles,
  Palette,
  Shield,
  Zap,
  Eye,
  Lock,
  Check,
  Waypoints,
  Users,
  BarChart3,
  Paintbrush,
  Fingerprint,
  Bell,
  BadgeCheck,
  Trash2,
  Scan,
  ShieldCheck,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { useMeshiPreferences } from "@/hooks/use-meshi-preferences";

// Highlight features — the top 3 value propositions shown prominently
const HIGHLIGHT_FEATURES = [
  {
    id: "identity-scanning",
    icon: Scan,
    title: "Identity Scanning",
    description: "Continuous monitoring of the web for your personal data. Find and remove your information from data brokers, people-search sites, and leaked databases. Like having a personal security team watching your digital identity 24/7.",
    gradient: "from-emerald-500 to-teal-400",
    bgGlow: "rgba(16, 185, 129, 0.08)",
  },
  {
    id: "cross-platform-analytics",
    icon: BarChart3,
    title: "Cross-Platform Analytics",
    description: "Unified engagement dashboard across every connected platform. Track follower growth, engagement trends, best posting times, and audience overlap — all in one place instead of jumping between apps.",
    gradient: "from-blue-500 to-cyan-400",
    bgGlow: "rgba(59, 130, 246, 0.08)",
  },
  {
    id: "content-manager",
    icon: Trash2,
    title: "Content Manager Pro",
    description: "Bulk manage, archive, or delete posts across all your connected platforms directly from your mesh. Clean up your digital footprint without logging into each app individually.",
    gradient: "from-violet-500 to-purple-400",
    bgGlow: "rgba(139, 92, 246, 0.08)",
  },
];

const PRO_FEATURES = [
  {
    id: "verified-badge",
    icon: BadgeCheck,
    title: "Verified Badge",
    description: "A distinctive verified badge on your profile showing you support mesh.me and its mission.",
    category: "Profile",
  },
  {
    id: "smart-notifications",
    icon: Bell,
    title: "Smart Notifications",
    description: "Intelligent notification summaries that condense and prioritize what matters most across all your platforms.",
    category: "Notifications",
  },
  {
    id: "meshi-cosmetics",
    icon: Sparkles,
    title: "Meshi Cosmetics",
    description: "Exclusive hats, accessories, animations, and color options to make your Meshi truly unique.",
    category: "Meshi",
  },
  {
    id: "custom-themes",
    icon: Palette,
    title: "Custom Themes",
    description: "Unlock exclusive color palettes, gradients, and visual themes for your profile and mesh.",
    category: "Appearance",
  },
  {
    id: "footprint-insights",
    icon: Fingerprint,
    title: "Footprint Insights",
    description: "Deep dive into your digital footprint — see where your data lives, who has access, and how your presence has grown over time.",
    category: "Privacy",
  },
  {
    id: "advanced-security",
    icon: ShieldCheck,
    title: "Advanced Security Tools",
    description: "Enhanced account protection with login alerts, session management, and breach detection across connected platforms.",
    category: "Security",
  },
  {
    id: "enhanced-mesh",
    icon: Waypoints,
    title: "Enhanced Mesh View",
    description: "Higher node limits, advanced filtering, heat maps, and deeper visualization options for your mesh.",
    category: "Mesh",
  },
  {
    id: "custom-feed-layouts",
    icon: Paintbrush,
    title: "Custom Feed Layouts",
    description: "Create and save custom feed layout presets with advanced filtering and sorting options.",
    category: "Feed",
  },
  {
    id: "mesh-export",
    icon: Download,
    title: "Mesh Data Export",
    description: "Export your complete mesh data, connections, analytics, and content archive in multiple formats.",
    category: "Data",
  },
  {
    id: "group-chats",
    icon: Users,
    title: "Group Chats",
    description: "Create group conversations with up to 50 members across connected platforms.",
    category: "Messages",
  },
  {
    id: "read-receipts",
    icon: Eye,
    title: "Read Receipts",
    description: "See when your messages have been read across all connected platforms.",
    category: "Messages",
  },
  {
    id: "priority-support",
    icon: Zap,
    title: "Early Access & Priority Support",
    description: "Be the first to try new features and get faster responses from our team.",
    category: "Support",
  },
];

export default function MeshProPage() {
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  const [expandedHighlight, setExpandedHighlight] = useState<string | null>(null);
  const meshiPrefs = useMeshiPreferences();

  const monthlyPrice = 4.99;
  const yearlyPrice = 39.99;
  const yearlySavings = Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-page-enter">
      {/* Hero */}
      <div className="text-center mb-14">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative mx-auto mb-6 w-fit"
        >
          <div className="absolute inset-0 blur-3xl opacity-20 rounded-full" style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)" }} />
          <div className="relative inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full"
            style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(234,179,8,0.08))", border: "1px solid rgba(251,191,36,0.25)" }}
          >
            <Crown className="h-5 w-5 text-amber-400" />
            <span className="text-sm font-bold text-amber-400 tracking-wide">MeshPro</span>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] mb-4 tracking-tight"
        >
          Your digital life,<br />
          <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">fully in your control</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-base text-[var(--text-muted)] max-w-xl mx-auto leading-relaxed"
        >
          Deeper analytics, identity protection, and premium customization.
          Support the future of mesh.me — zero ads, ever.
        </motion.p>
      </div>

      {/* Highlight features — big cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="grid md:grid-cols-3 gap-4 mb-14"
      >
        {HIGHLIGHT_FEATURES.map((feature, index) => {
          const isExpanded = expandedHighlight === feature.id;
          return (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + index * 0.08 }}
              onClick={() => setExpandedHighlight(isExpanded ? null : feature.id)}
              className="relative group rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02]"
              style={{
                background: feature.bgGlow,
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br ${feature.gradient}`}>
                <feature.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] mb-2">{feature.title}</h3>
              <AnimatePresence mode="wait">
                {isExpanded ? (
                  <motion.p
                    key="expanded"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-[var(--text-secondary)] leading-relaxed"
                  >
                    {feature.description}
                  </motion.p>
                ) : (
                  <motion.p
                    key="collapsed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-[var(--text-muted)] line-clamp-2 leading-relaxed"
                  >
                    {feature.description}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="mt-3 text-[9px] text-[var(--text-muted)] uppercase tracking-wider">
                {isExpanded ? "Click to collapse" : "Click to learn more"}
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Pricing section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-16"
      >
        {/* Toggle */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-1 p-1 rounded-xl glass-surface">
            <button
              onClick={() => setSelectedPlan("monthly")}
              className={"px-5 py-2.5 rounded-lg text-sm font-medium transition-all " + (
                selectedPlan === "monthly"
                  ? "bg-[var(--accent)] text-white shadow-lg"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setSelectedPlan("yearly")}
              className={"px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 " + (
                selectedPlan === "yearly"
                  ? "bg-[var(--accent)] text-white shadow-lg"
                  : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              )}
            >
              Yearly
              <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                Save {yearlySavings}%
              </Badge>
            </button>
          </div>
        </div>

        {/* Pricing card */}
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl overflow-hidden relative" style={{ border: "1px solid rgba(251,191,36,0.25)", background: "linear-gradient(180deg, rgba(251,191,36,0.04) 0%, transparent 60%)" }}>
            {/* Glow accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.5), transparent)" }} />

            <div className="p-8 text-center">
              {/* Meshi with crown */}
              <div className="mb-4">
                <MeshiMascot size={48} mood="excited" color="gold" animate showGlow hat={meshiPrefs.hat} />
              </div>

              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-5xl font-bold text-[var(--text-primary)]">
                  ${selectedPlan === "monthly" ? monthlyPrice : (yearlyPrice / 12).toFixed(2)}
                </span>
                <span className="text-sm text-[var(--text-muted)]">/month</span>
              </div>
              {selectedPlan === "yearly" && (
                <p className="text-xs text-[var(--text-muted)] mb-1">
                  Billed ${yearlyPrice}/year
                </p>
              )}
              <p className="text-xs text-emerald-400 mb-6">
                {selectedPlan === "yearly" ? `Save $${(monthlyPrice * 12 - yearlyPrice).toFixed(2)}/year` : "Cancel anytime"}
              </p>

              <button className="w-full py-3.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.97] shadow-lg hover:shadow-xl hover:brightness-110"
                style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)" }}
              >
                Coming Soon
              </button>
              <p className="text-[10px] text-[var(--text-muted)] mt-3">
                MeshPro is launching soon. Be among the first to know.
              </p>
            </div>

            {/* Quick feature list inside card */}
            <div className="px-8 pb-6">
              <div className="h-px w-full bg-[var(--border-primary)] mb-4" />
              <div className="space-y-2.5">
                {[
                  "Identity scanning & data removal",
                  "Cross-platform analytics dashboard",
                  "Bulk content management & deletion",
                  "Verified badge on your profile",
                  "Smart notification summaries",
                  "Exclusive Meshi cosmetics",
                  "Custom themes & layouts",
                  "Advanced security alerts",
                  "Priority support & early access",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-xs text-[var(--text-secondary)]">
                    <Check className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* All features grid */}
      <div className="mb-14">
        <h2 className="text-xl font-bold text-[var(--text-primary)] text-center mb-2">Everything in MeshPro</h2>
        <p className="text-sm text-[var(--text-muted)] text-center mb-8">Premium perks that make your mesh experience even better</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PRO_FEATURES.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + index * 0.03 }}
              className="group relative p-4 rounded-xl glass-surface hover:bg-[var(--bg-hover)] transition-all duration-300 cursor-default"
            >
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(234,179,8,0.06))" }}
                >
                  <feature.icon className="h-4 w-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-0.5">{feature.title}</h3>
                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{feature.description}</p>
                  <Badge variant="secondary" className="mt-2 text-[9px]">{feature.category}</Badge>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Promise section — what's always free */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl overflow-hidden mb-8"
        style={{ border: "1px solid var(--border-primary)", background: "linear-gradient(180deg, rgba(16,185,129,0.03) 0%, transparent 100%)" }}
      >
        <div className="p-8 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Shield className="h-5 w-5 text-emerald-400" />
            <h3 className="text-lg font-bold text-[var(--text-primary)]">mesh.me is free forever</h3>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-6 max-w-lg mx-auto leading-relaxed">
            Every core feature of mesh.me is and will always be completely free.
            No core features are locked behind MeshPro — it&apos;s for power users who want
            extra tools and want to support the platform. Zero ads, always.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            {[
              "Unlimited connections",
              "Full mesh visualization",
              "Meshi companion",
              "Cross-platform feed",
              "MeChat messaging",
              "Communities",
              "Privacy controls",
              "Connected accounts",
              "Content management",
              "Profile customization",
            ].map((feature) => (
              <span key={feature} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-surface text-xs text-[var(--text-secondary)]">
                <Check className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                {feature}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* No ads promise */}
      <div className="text-center pb-4">
        <p className="text-[11px] text-[var(--text-muted)] flex items-center justify-center gap-1.5">
          <Lock className="h-3 w-3" />
          No ads. No data selling. Your privacy is our promise.
        </p>
      </div>
    </div>
  );
}
