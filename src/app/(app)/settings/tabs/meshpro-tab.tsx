"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { redeemCode } from "@/lib/actions";
import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Check, Sparkles, Eye, Palette, Fingerprint, BarChart3, TrendingUp, ShieldCheck, Layout, Gift, CreditCard, X } from "lucide-react";

type PaymentPlan = "monthly" | "yearly" | null;

function PaymentModal({ plan, onClose }: { plan: PaymentPlan; onClose: () => void }) {
  const [paymentMethod, setPaymentMethod] = useState<"card" | "apple" | "google" | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!plan) return null;

  const price = plan === "monthly" ? "$4.99" : "$39.99";
  const period = plan === "monthly" ? "month" : "year";

  const formatCardNumber = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 16);
    return digits.replace(/(.{4})/g, "$1 ").trim();
  };

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits;
  };

  const handlePayment = async () => {
    setProcessing(true);
    // Simulate payment processing — in production this calls Stripe
    await new Promise((r) => setTimeout(r, 2000));
    setProcessing(false);
    setSuccess(true);
  };

  if (success) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
        onClick={onClose}>
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm rounded-3xl p-8 text-center"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}
          onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 mb-4">
            <Check className="h-8 w-8 text-emerald-500" />
          </div>
          <h3 className="text-xl font-bold text-[var(--text-primary)] mb-2">Welcome to MeshPro!</h3>
          <p className="text-sm text-[var(--text-muted)] mb-6">Your premium features are now active.</p>
          <Button onClick={onClose} variant="gradient" className="w-full">Done</Button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-3xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-primary)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">Subscribe to MeshPro</h3>
            <p className="text-sm text-[var(--text-muted)]">{price}/{period}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--bg-hover)] transition-colors">
            <X className="h-4 w-4 text-[var(--text-muted)]" />
          </button>
        </div>

        {/* Quick pay options */}
        <div className="space-y-2 mb-6">
          <button
            onClick={() => { setPaymentMethod("apple"); handlePayment(); }}
            disabled={processing}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold bg-white text-black transition-all hover:opacity-90 disabled:opacity-50"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            Pay
          </button>
          <button
            onClick={() => { setPaymentMethod("google"); handlePayment(); }}
            disabled={processing}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border-primary)" }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Pay
          </button>
        </div>

        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-[var(--border-primary)]" />
          <span className="text-xs text-[var(--text-muted)]">or pay with card</span>
          <div className="flex-1 h-px bg-[var(--border-primary)]" />
        </div>

        {/* Card form */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Name on card</label>
            <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Card number</label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
              <Input value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="1234 5678 9012 3456" className="pl-10" maxLength={19} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Expiry</label>
              <Input value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                placeholder="MM/YY" maxLength={5} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">CVC</label>
              <Input value={cardCvc} onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="123" maxLength={4} type="password" />
            </div>
          </div>
          <Button
            onClick={() => { setPaymentMethod("card"); handlePayment(); }}
            variant="gradient" className="w-full mt-2"
            disabled={processing || !cardNumber || !cardExpiry || !cardCvc || !cardName}
          >
            {processing ? "Processing..." : `Pay ${price}`}
          </Button>
        </div>

        <p className="text-[10px] text-[var(--text-muted)] text-center mt-4">
          Payments are securely processed. Cancel anytime from Settings.
        </p>
      </motion.div>
    </motion.div>
  );
}

export function MeshProTab() {
  const [isPending, startTransition] = useTransition();
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemStatus, setRedeemStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PaymentPlan>(null);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
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
