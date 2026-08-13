"use client";

import { useState, useTransition } from "react";
import { HandHeart } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { Button } from "@/components/ui/button";

const TIERS = [
  { id: "2" as const, label: "$2" },
  { id: "5" as const, label: "$5" },
  { id: "10" as const, label: "$10" },
];

/**
 * Three fixed amounts and one button. $2 is preselected — never the largest:
 * a default that reaches for the big number is an upsell, and this is a
 * contribution, not a funnel. The server is the fence; this form relays.
 */
export function PatronCheckoutButton() {
  const [tier, setTier] = useState<"2" | "5" | "10">("2");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startPatronCheckout() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ patron: tier }),
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
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2">
        {TIERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setTier(option.id)}
            aria-pressed={tier === option.id}
            className={`mesh-choice rounded-xl p-3 text-center transition ${
              tier === option.id ? "border-[var(--accent-muted)] bg-[var(--accent-bg)]" : ""
            }`}
          >
            <span className="block text-lg font-semibold text-[var(--text-primary)]">{option.label}</span>
            <span className="block text-xs text-[var(--text-secondary)]">a month</span>
          </button>
        ))}
      </div>
      <Button type="button" onClick={startPatronCheckout} disabled={isPending}>
        {isPending ? <PaperWait size="sm" /> : <HandHeart className="h-4 w-4" aria-hidden="true" />}
        Become a patron
      </Button>
      {error && <p className="text-xs font-semibold text-[var(--ds-danger)]">{error}</p>}
    </div>
  );
}
