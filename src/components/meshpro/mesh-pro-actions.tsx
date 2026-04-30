"use client";

import { useState, useTransition } from "react";
import { CreditCard, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MeshProPlan } from "@/lib/stripe";

type CheckoutButtonProps = {
  plan: MeshProPlan;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
};

type PortalButtonProps = {
  children?: React.ReactNode;
  className?: string;
  variant?: "default" | "secondary" | "outline" | "glass";
};

export function MeshProCheckoutButton({ plan, children, className, disabled }: CheckoutButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startCheckout() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not start checkout.");
          return;
        }
        if (typeof data.url !== "string") {
          setError("Stripe did not return a checkout URL.");
          return;
        }
        window.location.href = data.url;
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant={plan === "yearly" ? "default" : "secondary"}
        className={className}
        onClick={startCheckout}
        disabled={disabled || isPending}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
        {children}
      </Button>
      {error && <p className="text-xs font-semibold text-[var(--ds-danger)]">{error}</p>}
    </div>
  );
}

export function BillingPortalButton({ children = "Manage billing", className, variant = "secondary" }: PortalButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openPortal() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/stripe/portal", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not open billing.");
          return;
        }
        if (typeof data.url !== "string") {
          setError("Stripe did not return a billing URL.");
          return;
        }
        window.location.href = data.url;
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  return (
    <div className="grid gap-2">
      <Button type="button" variant={variant} className={className} onClick={openPortal} disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
        {children}
      </Button>
      {error && <p className="text-xs font-semibold text-[var(--ds-danger)]">{error}</p>}
    </div>
  );
}
