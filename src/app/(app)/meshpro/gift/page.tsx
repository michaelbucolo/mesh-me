import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GiftModes, type GiftMode } from "@/components/meshpro/gift-modes";
import { getCurrentUser } from "@/lib/auth";
import { syncMeshiItemSessionForUser } from "@/lib/meshi-item";

type GiftPageProps = {
  searchParams?: Promise<{
    to?: string | string[];
    mode?: string | string[];
    payment?: string | string[];
    session_id?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Gift",
  description: "Months of MeshPro, or a single wardrobe piece their Meshi keeps forever. One payment, no strings.",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GiftPage({ searchParams }: GiftPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/meshpro/gift");
  if (!user.onboarded) redirect("/onboarding");

  const params = searchParams ? await searchParams : undefined;
  // Prefill from ?to= (the profile entry point). Sanitized to username shape —
  // it only seeds a text field, but there is no reason to carry anything else.
  const to = (firstParam(params?.to) || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
  const mode: GiftMode = firstParam(params?.mode) === "piece" ? "piece" : "months";
  const payment = firstParam(params?.payment);
  const sessionId = firstParam(params?.session_id);

  // Only wardrobe self-purchases return here with a session id (months-gift
  // success lands on the recipient's profile). Reconcile immediately so "it's
  // in your wardrobe" survives webhook lag; the webhook stays authoritative.
  const syncResult = payment === "success" && sessionId
    ? await syncMeshiItemSessionForUser(sessionId, user.id).catch((error) => ({
        ok: false as const,
        message: error instanceof Error ? error.message : "Could not verify checkout yet.",
      }))
    : null;

  return (
    <main className="simple-page mx-auto grid w-full max-w-lg gap-8 pb-16">
      {syncResult && (
        <section className={`rounded-lg border px-4 py-3 text-sm font-semibold ${
          syncResult.ok
            ? "border-[var(--ds-success-border)] bg-[var(--ds-success-bg)] text-[var(--ds-success)]"
            : "border-[var(--ds-warning-border)] bg-[var(--ds-warning-bg)] text-[var(--ds-warning)]"
        }`}>
          {syncResult.message}
          {syncResult.ok && (
            <>
              {" "}
              <Link href="/settings" className="underline underline-offset-2">
                Put it on
              </Link>
              .
            </>
          )}
        </section>
      )}

      {payment === "cancelled" && (
        <section className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
          Checkout was cancelled. Nothing was charged.
        </section>
      )}

      <header className="pt-4 text-center">
        <p className="text-xs font-semibold mesh-eyebrow text-[var(--accent-text)]">A gift</p>
        <h1 className="mx-auto mt-3 max-w-md text-3xl font-semibold leading-tight">
          Give something they keep
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
          Months of MeshPro — the wardrobe, the rim, the real controls — or one wardrobe piece
          their Meshi owns outright. One payment; nobody gets a subscription.
        </p>
      </header>

      <section className="mesh-surface rounded-xl p-6">
        <GiftModes initialMode={mode} initialUsername={to} />
      </section>

      <p className="text-center text-xs text-[var(--text-muted)]">
        Wondering what they&apos;ll get?{" "}
        <Link href="/meshpro" className="underline underline-offset-2 hover:text-[var(--text-secondary)]">
          Everything MeshPro unlocks
        </Link>
        .
      </p>
    </main>
  );
}
