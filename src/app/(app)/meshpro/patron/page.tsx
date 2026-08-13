import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PatronCheckoutButton } from "@/components/meshpro/patron-checkout-button";
import { getCurrentUser } from "@/lib/auth";
import { getActivePatronStint, syncPatronCheckoutSessionForUser } from "@/lib/patron";

type PatronPageProps = {
  searchParams?: Promise<{
    payment?: string | string[];
    session_id?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Patron",
  description: "A standing monthly contribution that deliberately buys nothing.",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PatronPage({ searchParams }: PatronPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/meshpro/patron");
  if (!user.onboarded) redirect("/onboarding");

  const params = searchParams ? await searchParams : undefined;
  const payment = firstParam(params?.payment);
  const sessionId = firstParam(params?.session_id);
  // The success param reconciles immediately so the thank-you survives
  // webhook lag; the webhook remains authoritative.
  const syncResult = payment === "success" && sessionId
    ? await syncPatronCheckoutSessionForUser(sessionId, user.id).catch((error) => ({
        ok: false as const,
        message: error instanceof Error ? error.message : "Could not verify checkout yet.",
      }))
    : null;

  const stint = await getActivePatronStint(user.id);
  const since = user.patronSince
    ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(user.patronSince)
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
        </section>
      )}

      {payment === "cancelled" && (
        <section className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
          Checkout was cancelled. Nothing was charged.
        </section>
      )}

      <header className="pt-4 text-center">
        <p className="text-xs font-semibold mesh-eyebrow text-[var(--accent-text)]">Patron</p>
        <h1 className="mx-auto mt-3 max-w-md text-3xl font-semibold leading-tight">
          Keep it independent
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
          A standing monthly contribution that deliberately buys no features — it&apos;s what keeps
          Mesh.me free of ads and data sales.
        </p>
      </header>

      {stint ? (
        <section className="mesh-surface rounded-xl p-6 text-center">
          <p className="text-2xl font-semibold text-[var(--text-primary)]">
            Patron · ${Math.round(stint.monthlyCents / 100)} monthly
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            {since ? `Since ${since}. ` : ""}Cancel any time from{" "}
            <Link href="/billing" className="underline underline-offset-2">billing</Link> — it just
            stops, and the record of having been a patron stays yours.
          </p>
        </section>
      ) : (
        <section className="mesh-surface rounded-xl p-6">
          <ul className="grid gap-3 text-sm leading-6 text-[var(--text-secondary)]">
            <li>
              <span className="font-semibold text-[var(--text-primary)]">A quiet profile chip</span>{" — "}
              &ldquo;Patron&rdquo; beside your name, with an off switch, drawn from the year you first
              contributed. Status.
            </li>
            <li>
              <span className="font-semibold text-[var(--text-primary)]">A Meshi pin</span>{" — "}a small
              sprout, worn if you choose. Status.
            </li>
            <li>
              <span className="font-semibold text-[var(--text-primary)]">Nothing else — deliberately.</span>{" "}
              Patronage that came with features would eventually be a plan, and a plan can be repriced.
              A record of having supported the thing can&apos;t.
            </li>
          </ul>
          <div className="mt-5">
            <PatronCheckoutButton />
          </div>
          {user.patronSince && (
            <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
              You&apos;ve been a patron before{since ? ` (since ${since})` : ""} — the record never
              left. Contributing again simply resumes.
            </p>
          )}
        </section>
      )}

      <div className="grid gap-2 text-center text-xs leading-5 text-[var(--text-muted)]">
        <p>Cancelling stops future charges and removes nothing. Only a full refund erases the record.</p>
        <p>
          Looking for the features?{" "}
          <Link href="/meshpro" className="underline underline-offset-2 hover:text-[var(--text-secondary)]">
            That&apos;s MeshPro
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
