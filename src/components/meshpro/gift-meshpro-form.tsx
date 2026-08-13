"use client";

import { useState, useTransition } from "react";
import { Gift } from "lucide-react";
import { PaperWait } from "@/components/loading/paper-wait";
import { Button } from "@/components/ui/button";
import {
  MESH_PRO_GIFT_MESSAGE_MAX,
  MESH_PRO_GIFT_PRICING,
  type MeshProGiftPlan,
} from "@/lib/mesh-pro";

/**
 * The whole gift flow is this one calm form: who, how long, a few words.
 * Everything that must never happen (self-gifts, gifts across a block,
 * founders as recipients) is refused by the checkout route — the server is
 * the fence; this form just relays its answer verbatim.
 */
export function GiftMeshProForm({ initialUsername = "" }: { initialUsername?: string }) {
  const [username, setUsername] = useState(initialUsername);
  const [plan, setPlan] = useState<MeshProGiftPlan>("3m");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function startGiftCheckout() {
    startTransition(async () => {
      setError(null);
      try {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            giftPlan: plan,
            recipientUsername: username,
            ...(message.trim() ? { message: message.trim() } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error || "Could not start the gift checkout.");
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
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        startGiftCheckout();
      }}
    >
      <label className="grid gap-1.5">
        <span className="text-sm font-semibold text-[var(--text-primary)]">Who is it for?</span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-muted)]">
            @
          </span>
          <input
            type="text"
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(event) => setUsername(event.target.value.replace(/^@/, ""))}
            placeholder="username"
            className="simple-input w-full pl-8"
            aria-label="Recipient's username"
          />
        </div>
      </label>

      <fieldset className="grid gap-1.5">
        <legend className="text-sm font-semibold text-[var(--text-primary)]">How long?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {Object.values(MESH_PRO_GIFT_PRICING).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPlan(option.id)}
              aria-pressed={plan === option.id}
              className={`mesh-choice rounded-xl p-4 text-left transition ${
                plan === option.id ? "border-[var(--accent-muted)] bg-[var(--accent-bg)]" : ""
              }`}
            >
              <p className="text-sm font-semibold text-[var(--text-primary)]">{option.label}</p>
              <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{option.price}</p>
              <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{option.detail}</p>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-1.5">
        <span className="flex items-baseline justify-between text-sm">
          <span className="font-semibold text-[var(--text-primary)]">A few words (optional)</span>
          <span className="text-xs text-[var(--text-muted)]">
            {message.length}/{MESH_PRO_GIFT_MESSAGE_MAX}
          </span>
        </span>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value.slice(0, MESH_PRO_GIFT_MESSAGE_MAX))}
          maxLength={MESH_PRO_GIFT_MESSAGE_MAX}
          rows={3}
          placeholder="They'll see this with the gift."
          className="simple-input w-full resize-none leading-6"
        />
      </label>

      <div className="grid gap-2">
        <Button type="submit" disabled={isPending || username.trim().length === 0}>
          {isPending ? <PaperWait size="sm" /> : <Gift className="h-4 w-4" aria-hidden="true" />}
          Continue to payment
        </Button>
        {error && <p className="text-xs font-semibold text-[var(--ds-danger)]">{error}</p>}
        <p className="text-xs leading-5 text-[var(--text-muted)]">
          One payment — no subscription for either of you. Their months start the moment payment
          settles, and stack on top of anything they already have.
        </p>
      </div>
    </form>
  );
}
