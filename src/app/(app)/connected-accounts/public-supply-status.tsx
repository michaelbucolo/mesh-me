import { Check, Link2, MinusCircle, Sparkles } from "lucide-react";
import { browsableWithoutConnecting, PLATFORM_SUPPLY_STATUS } from "@/lib/public-supply/registry";
import type { AnonymousReadVerdict } from "@/lib/public-supply/types";

/**
 * THE HONEST ANSWER TO "WHAT CAN I SEE WITHOUT CONNECTING?"
 *
 * mesh.me's pitch is that you can browse every platform from here and connect
 * only when you want to interact. For some platforms that is completely true.
 * For others it is not true at all — they publish no official way for a
 * third-party app to read public content on behalf of someone who has not
 * linked an account, and no amount of engineering on this side changes that.
 *
 * The tempting version of this page lists every logo and lets people find out
 * by clicking. This one says which is which, up front, with the reason.
 * Someone who learns "Instagram needs connecting, and here is why" can decide
 * in five seconds. Someone who finds an empty Instagram tab concludes the
 * product is broken — and they are not wrong to.
 *
 * Every verdict is read from PLATFORM_SUPPLY_STATUS, the same registry the
 * fetchers are built from, so this page cannot drift into promising something
 * no lane implements. A gate asserts that (scripts/public-supply-check.ts §10).
 */

const VERDICT_ORDER: Record<AnonymousReadVerdict, number> = {
  permitted: 0,
  permitted_with_limits: 1,
  requires_connection: 2,
  unavailable: 3,
};

const VERDICT_COPY: Record<AnonymousReadVerdict, { label: string; hint: string }> = {
  permitted: { label: "Browse freely", hint: "Public content shows up in your Flow and Explore without connecting anything." },
  permitted_with_limits: { label: "Browse freely", hint: "Public content shows up without connecting. Some of it — private, regional, or unlisted — only a connected account can reach." },
  requires_connection: { label: "Connect to see", hint: "This platform has no official way for another app to read its public content on your behalf. Connecting your own account is the only route they offer." },
  unavailable: { label: "Not available", hint: "This platform publishes no content API a reader like mesh.me can use, even with an account connected." },
};

function VerdictIcon({ verdict }: { verdict: AnonymousReadVerdict }) {
  if (verdict === "permitted" || verdict === "permitted_with_limits") {
    return <Check size={15} className="text-[var(--success)]" aria-hidden="true" />;
  }
  if (verdict === "requires_connection") {
    return <Link2 size={15} className="text-[var(--text-tertiary)]" aria-hidden="true" />;
  }
  return <MinusCircle size={15} className="text-[var(--text-muted)]" aria-hidden="true" />;
}

export function PublicSupplyStatus() {
  const platforms = [...PLATFORM_SUPPLY_STATUS].sort(
    (a, b) => VERDICT_ORDER[a.anonymousRead] - VERDICT_ORDER[b.anonymousRead] || a.name.localeCompare(b.name),
  );
  // From the registry, not recomputed here — one definition of "browsable".
  const browsable = browsableWithoutConnecting();

  return (
    <section className="plate p-5">
      <header className="flex items-start gap-3">
        <Sparkles size={18} className="mt-0.5 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">What you can see without connecting</h2>
          <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">
            {browsable.length > 0 ? (
              <>
                {browsable.length} platform{browsable.length === 1 ? "" : "s"} already feed your Flow with nothing linked.
                Connecting an account is for <em>interacting</em> — liking, replying, posting back.
              </>
            ) : (
              <>
                Connecting an account is for <em>interacting</em> — liking, replying, posting back.
              </>
            )}
          </p>
        </div>
      </header>

      <ul className="mt-4 grid gap-2">
        {platforms.map((platform) => {
          const copy = VERDICT_COPY[platform.anonymousRead];
          return (
            <li
              key={platform.platform}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-1 rounded-lg border border-[var(--rule)] bg-[var(--paper-1)] px-3 py-2.5"
            >
              <span className="flex items-center gap-2">
                <VerdictIcon verdict={platform.anonymousRead} />
                <span className="text-sm font-semibold text-[var(--text-primary)]">{platform.name}</span>
              </span>
              <span className="text-micro font-semibold mesh-eyebrow text-[var(--text-tertiary)]">{copy.label}</span>
              <p className="w-full text-xs leading-5 text-[var(--text-secondary)]">
                {/* The registry's own reason when it has one — it is specific to
                    the platform's actual policy — otherwise the generic line. */}
                {platform.reason || copy.hint}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-micro leading-5 text-[var(--text-muted)]">
        Mesh.me only uses each platform&apos;s official API. It never scrapes, never asks for your password on another
        service, and never posts anywhere without you.
      </p>
    </section>
  );
}
