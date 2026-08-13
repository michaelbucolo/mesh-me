"use client";

import { useState, useTransition } from "react";
import { Landmark } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { Button } from "@/components/ui/button";

/**
 * One button. The seat number is deliberately NOT shown before checkout — it
 * is first revealed on the Stripe page, where it is already reserved, so the
 * site never runs a counter and never dangles a specific number it might not
 * be able to keep.
 */
export function CharterCheckoutButton() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startCharterCheckout() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ charter: true }),
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
      <Button type="button" onClick={startCharterCheckout} disabled={isPending}>
        {isPending ? <PaperWait size="sm" /> : <Landmark className="h-4 w-4" aria-hidden="true" />}
        Take a seat — $79, once
      </Button>
      {error && <p className="text-xs font-semibold text-[var(--ds-danger)]">{error}</p>}
    </div>
  );
}
