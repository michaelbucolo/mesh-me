"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { redeemCode } from "@/lib/actions";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Crown, Check, Sparkles, Eye, Palette, Fingerprint, BarChart3, TrendingUp, ShieldCheck, Layout, Gift } from "lucide-react";
import { MeshiSettingsTip } from "@/components/meshi/meshi-guide";

export function MeshProTab() {
  const [isPending, startTransition] = useTransition();
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemStatus, setRedeemStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <MeshiSettingsTip tab="meshpro" />
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-xl" style={{ background: "var(--brand-gradient)" }}>
          <Crown className="h-8 w-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-2">MeshPro</h2>
        <p className="text-sm text-[var(--text-tertiary)] max-w-sm mx-auto">
          Go deeper into your digital world with premium insights, security, and customization
        </p>
      </div>

      {/* What's free callout */}
      <div className="mb-6 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-emerald-400 mb-2 flex items-center gap-2">
          <Check className="h-4 w-4" /> Nearly everything is free
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          The Mesh, Custom Feed, MeChat, communities, search, notifications, connected accounts, profile customization, and all core features are 100% free forever. MeshPro just gives you extra tools to go deeper.
        </p>
      </div>

      {/* Pricing */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Monthly</h3>
          <div className="flex items-baseline gap-1 mb-4">
            <span className="text-3xl font-bold text-[var(--text-primary)]">$4.99</span>
            <span className="text-sm text-[var(--text-muted)]">/month</span>
          </div>
          <Button variant="secondary" className="w-full">Subscribe</Button>
        </div>
        <div className="border-2 rounded-2xl p-6 relative" style={{ borderColor: "var(--accent-muted)", background: "var(--accent-subtle)" }}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full" style={{ background: "var(--brand-gradient)" }}>
            BEST VALUE
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Yearly</h3>
          <div className="flex items-baseline gap-1 mb-1">
            <span className="text-3xl font-bold text-[var(--text-primary)]">$39.99</span>
            <span className="text-sm text-[var(--text-muted)]">/year</span>
          </div>
          <p className="text-xs text-emerald-400 mb-4">Save 33% — that&apos;s $3.33/month</p>
          <Button variant="gradient" className="w-full">Subscribe</Button>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">What you get with Pro</h3>
        {[
          { icon: Fingerprint, title: "Digital Footprint Scanner", desc: "Find every account, data broker listing, and trace linked to your identity across the entire web" },
          { icon: Sparkles, title: "Customize Meshi", desc: "Give Meshi hats, change expressions, and pick custom colors \u2014 make your guide uniquely yours" },
          { icon: Palette, title: "Mesh Cosmetics", desc: "Add visual effects to your mesh that other users can see \u2014 glow trails, particle effects, and node styles" },
          { icon: BarChart3, title: "Cross-platform analytics", desc: "In-depth stats on your digital presence \u2014 engagement, reach, follower growth, content performance" },
          { icon: TrendingUp, title: "Audience insights", desc: "Understand who engages with your content across all platforms" },
          { icon: ShieldCheck, title: "Advanced Security Hub", desc: "Manage and mass-delete content across connected platforms, monitor active sessions" },
          { icon: Crown, title: "Verified badge", desc: "Stand out with a verified profile badge" },
          { icon: Eye, title: "Profile analytics", desc: "See who views your profile and detailed post insights" },
          { icon: Sparkles, title: "Advanced summaries", desc: "More detailed and personalized notification digests" },
          { icon: Layout, title: "Extra feed layouts", desc: "Unlock additional feed layout options and customizations" },
        ].map((feature) => (
          <div key={feature.title} className="flex items-start gap-3 p-3 rounded-xl glass-surface">
            <div className="h-8 w-8 rounded-lg bg-[var(--accent-subtle)] flex items-center justify-center flex-shrink-0">
              <feature.icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <h4 className="text-sm font-medium text-[var(--text-primary)]">{feature.title}</h4>
              <p className="text-xs text-[var(--text-muted)]">{feature.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* No ads promise */}
      <div className="mt-8 rounded-2xl p-6 text-center" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-muted)" }}>
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Zero ads. Ever.</h3>
        <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">
          mesh.me will never show advertisements or sell your data. MeshPro subscriptions are the only way we fund the platform.
          Your experience, your data, your space — always clean, always private.
        </p>
      </div>

      {/* Redeem Code */}
      <div className="mt-8 glass-card rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 flex items-center gap-2">
          <Gift className="h-4 w-4" style={{ color: "var(--accent)" }} /> Redeem a Code
        </h3>
        <p className="text-xs text-[var(--text-muted)] mb-4">Have a special code? Enter it below to unlock exclusive rewards.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!redeemInput.trim()) return;
            setRedeemStatus(null);
            startTransition(async () => {
              const result = await redeemCode(redeemInput);
              if ("error" in result && result.error) {
                setRedeemStatus({ type: "error", message: result.error });
              } else if ("success" in result && result.success && "reward" in result && result.reward) {
                setRedeemStatus({ type: "success", message: `Unlocked: ${result.reward.label}!` });
                setRedeemInput("");
              }
            });
          }}
          className="flex gap-2"
        >
          <Input value={redeemInput} onChange={(e) => setRedeemInput(e.target.value)} placeholder="Enter code..." className="flex-1" />
          <Button type="submit" variant="gradient" disabled={isPending || !redeemInput.trim()}>Redeem</Button>
        </form>
        {redeemStatus && (
          <p className={`text-xs mt-3 ${redeemStatus.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
            {redeemStatus.message}
          </p>
        )}
      </div>
    </motion.div>
  );
}
