"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Crown,
  Sparkles,
  Palette,
  Shield,
  Zap,
  Eye,
  Globe,
  Lock,
  Check,
  Waypoints,
  Users,
  MessageCircle,
  BarChart3,
  Paintbrush,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PRO_FEATURES = [
  {
    id: "custom-themes",
    icon: Palette,
    title: "Custom Themes",
    description: "Unlock exclusive color palettes, gradients, and visual themes for your profile and mesh.",
    category: "Appearance",
  },
  {
    id: "meshi-cosmetics",
    icon: Sparkles,
    title: "Meshi Cosmetics",
    description: "Exclusive hats, accessories, and color options for your Meshi companion.",
    category: "Meshi",
  },
  {
    id: "mesh-analytics",
    icon: BarChart3,
    title: "Mesh Analytics",
    description: "Deep insights into your mesh growth, connection patterns, and engagement trends.",
    category: "Insights",
  },
  {
    id: "priority-support",
    icon: Zap,
    title: "Priority Support",
    description: "Get faster responses from our team and early access to new features.",
    category: "Support",
  },
  {
    id: "advanced-privacy",
    icon: Shield,
    title: "Advanced Privacy Controls",
    description: "Granular control over who sees your mesh, connections, and activity.",
    category: "Privacy",
  },
  {
    id: "custom-feed-layouts",
    icon: Paintbrush,
    title: "Custom Feed Layouts",
    description: "Create and save custom feed layout presets with advanced filtering.",
    category: "Feed",
  },
  {
    id: "profile-badges",
    icon: Crown,
    title: "Pro Badge",
    description: "A distinctive Pro badge on your profile that shows your support for mesh.me.",
    category: "Profile",
  },
  {
    id: "mesh-export",
    icon: Globe,
    title: "Mesh Data Export",
    description: "Export your complete mesh data, connections, and analytics in multiple formats.",
    category: "Data",
  },
  {
    id: "enhanced-mesh",
    icon: Waypoints,
    title: "Enhanced Mesh View",
    description: "Higher node limits, 3D mesh visualization, and advanced filtering in your mesh.",
    category: "Mesh",
  },
  {
    id: "group-chats",
    icon: Users,
    title: "Group Chats",
    description: "Create group conversations with up to 50 members across platforms.",
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
    id: "meshi-plus",
    icon: MessageCircle,
    title: "Meshi+",
    description: "Enhanced capabilities for Meshi with deeper context awareness and actions.",
    category: "Meshi",
  },
];

export default function MeshProPage() {
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  const monthlyPrice = 4.99;
  const yearlyPrice = 39.99;
  const yearlySavings = Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-page-enter">
      {/* Hero */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
          style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(234,179,8,0.1))", border: "1px solid rgba(251,191,36,0.3)" }}
        >
          <Crown className="h-5 w-5 text-amber-400" />
          <span className="text-sm font-semibold text-amber-400">MeshPro</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl font-bold text-[var(--text-primary)] mb-3"
        >
          Upgrade your mesh experience
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-[var(--text-muted)] max-w-xl mx-auto"
        >
          Unlock premium features, deeper insights, and exclusive cosmetics. Support the future of mesh.me.
        </motion.p>
      </div>

      {/* Pricing Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-center mb-10"
      >
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
      </motion.div>

      {/* Pricing Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="max-w-md mx-auto mb-16"
      >
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(251,191,36,0.3)", background: "linear-gradient(180deg, rgba(251,191,36,0.05) 0%, transparent 100%)" }}>
          <div className="p-8 text-center">
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

            <button className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all active:scale-[0.97] shadow-lg hover:shadow-xl"
              style={{ background: "linear-gradient(135deg, #fbbf24, #f59e0b)" }}
            >
              Coming Soon
            </button>
            <p className="text-[10px] text-[var(--text-muted)] mt-3">
              MeshPro is not yet available. Join the waitlist to be notified.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Features Grid */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-[var(--text-primary)] text-center mb-8">Everything in MeshPro</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PRO_FEATURES.map((feature, index) => (
            <motion.div
              key={feature.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
              className="group relative p-5 rounded-xl glass-surface hover:glass-card transition-all duration-300 cursor-default"
            >
              <div className="flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.15), rgba(234,179,8,0.1))" }}
                >
                  <feature.icon className="h-4.5 w-4.5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{feature.title}</h3>
                    <Lock className="h-3 w-3 text-amber-400/60" />
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">{feature.description}</p>
                  <Badge variant="secondary" className="mt-2 text-[9px]">{feature.category}</Badge>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* What you get free */}
      <div className="rounded-2xl glass-surface p-8 text-center">
        <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">mesh.me is free forever</h3>
        <p className="text-sm text-[var(--text-muted)] mb-6 max-w-lg mx-auto">
          The core mesh.me experience will always be free. MeshPro is for power users who want extra features
          and want to support the platform. No core features are locked behind a paywall.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            "Unlimited connections",
            "Full mesh visualization",
            "Meshi companion",
            "Cross-platform feed",
            "MeChat messaging",
            "Communities",
            "Privacy controls",
            "Connected accounts",
          ].map((feature) => (
            <span key={feature} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-surface text-xs text-[var(--text-secondary)]">
              <Check className="h-3 w-3 text-emerald-400" />
              {feature}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
