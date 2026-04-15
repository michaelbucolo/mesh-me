"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { redeemCode } from "@/lib/actions";
import { useState, useTransition, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Check, Sparkles, Eye, Palette, Fingerprint, BarChart3, TrendingUp, ShieldCheck, Layout, Gift, X, Loader2 } from "lucide-react";

type PaymentPlan = "monthly" | "yearly" | null;

function PaymentModal({ plan, onClose }: { plan: PaymentPlan; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!plan) return null;

  const price = plan === "monthly" ? "$4.99" : "$39.99";
  const period = plan === "monthly" ? "month" : "year";

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Could not start checkout. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-3xl p-6"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Subscribe to MeshPro</h3>
            <p className="text-sm text-[var(--text-muted)]">{price}/{period}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--bg-hover)] transition-colors" disabled={loading}>
            <X className="h-4 w-4 text-[var(--text-muted)]" />
          </button>
        </div>

        <div className="space-y-4">
          {/* What you get */}
          <div className="rounded-xl p-4" style={{ background: "var(--accent-subtle)", border: "1px solid var(--accent-muted)" }}>
            <p className="text-xs text-[var(--text-secondary)] mb-2 font-medium">Your MeshPro subscription includes:</p>
            <ul className="space-y-1.5">
              {["Digital Footprint Scanner", "Cross-platform analytics", "Advanced Security Hub", "Verified badge", "Mesh Cosmetics", "Meshi customization"].map((item) => (
                <li key={item} className="flex items-center gap-2 text-xs text-[var(--text-primary)]">
                  <Check className="h-3 w-3 flex-shrink-0" style={{ color: "var(--accent)" }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Checkout button — redirects to Stripe */}
          <Button
            onClick={handleCheckout}
            variant="gradient"
            className="w-full py-4 text-base"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting to checkout...
              </span>
            ) : (
              `Continue to payment — ${price}/${period}`
            )}
          </Button>

          <p className="text-[10px] text-[var(--text-muted)] text-center">
            You&apos;ll be redirected to our secure payment page. Apple Pay, Google Pay, and all major cards accepted. Cancel anytime.
          </p>

          {error && (
            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-400 text-center bg-red-500/10 rounded-xl px-4 py-3 border border-red-500/20">
              {error}
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function PaymentSuccessBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mb-6 rounded-2xl p-6 text-center"
      style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(99,102,241,0.15))", border: "1px solid rgba(16,185,129,0.3)" }}>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 mb-3">
        <Check className="h-7 w-7 text-emerald-500" />
      </div>
      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">Welcome to MeshPro!</h3>
      <p className="text-sm text-[var(--text-muted)] mb-4">Your premium features are now active. Enjoy your enhanced mesh experience.</p>
      <Button onClick={onDismiss} variant="secondary" size="sm">Got it</Button>
    </motion.div>
  );
}

export function MeshProTab() {
  const [isPending, startTransition] = useTransition();
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemStatus, setRedeemStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan>(null);
  const [showSuccess, setShowSuccess] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("payment") === "success";
  });

  useEffect(() => {
    if (showSuccess) {
      // Clean up the URL without triggering re-render
      const url = new URL(window.location.href);
      url.searchParams.delete("payment");
      window.history.replaceState({}, "", url.toString());
    }
  }, [showSuccess]);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <AnimatePresence>
        {showSuccess && <PaymentSuccessBanner onDismiss={() => setShowSuccess(false)} />}
      </AnimatePresence>

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
          <Button variant="secondary" className="w-full" onClick={() => setSelectedPlan("monthly")}>Subscribe</Button>
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
          <Button variant="gradient" className="w-full" onClick={() => setSelectedPlan("yearly")}>Subscribe</Button>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-4">What you get with Pro</h3>
        {[
          { icon: Fingerprint, title: "Digital Footprint Scanner", desc: "Find every account, data broker listing, and trace linked to your identity across the entire web" },
          { icon: Sparkles, title: "Customize Meshi", desc: "Give Meshi hats, change expressions, and pick custom colors — make your guide uniquely yours" },
          { icon: Palette, title: "Mesh Cosmetics", desc: "Add visual effects to your mesh that other users can see — glow trails, particle effects, and node styles" },
          { icon: BarChart3, title: "Cross-platform analytics", desc: "In-depth stats on your digital presence — engagement, reach, follower growth, content performance" },
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

      {/* Payment Modal */}
      <AnimatePresence>
        {selectedPlan && <PaymentModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
      </AnimatePresence>
    </motion.div>
  );
}
