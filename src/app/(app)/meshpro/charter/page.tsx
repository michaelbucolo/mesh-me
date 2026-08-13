import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CharterCheckoutButton } from "@/components/meshpro/charter-checkout-button";
import { getCurrentUser } from "@/lib/auth";
import { charterSeatsRemaining, CHARTER_SEAT_CAP, syncCharterCheckoutSessionForUser } from "@/lib/charter";
import { prisma } from "@/lib/prisma";

type CharterPageProps = {
  searchParams?: Promise<{
    payment?: string | string[];
    session_id?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Charter",
  description: "One hundred numbered seats. A number, not a feature.",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function CharterPage({ searchParams }: CharterPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/meshpro/charter");
  if (!user.onboarded) redirect("/onboarding");

  const params = searchParams ? await searchParams : undefined;
  const payment = firstParam(params?.payment);
  const sessionId = firstParam(params?.session_id);
  // The success param reconciles immediately so "№41 is yours" survives
  // webhook lag; the webhook remains authoritative.
  const syncResult = payment === "success" && sessionId
    ? await syncCharterCheckoutSessionForUser(sessionId, user.id).catch((error) => ({
        ok: false as const,
        message: error instanceof Error ? error.message : "Could not verify checkout yet.",
      }))
    : null;

  // Re-read after a possible claim above.
  const holder = await prisma.user.findUnique({
    where: { id: user.id },
    select: { charterNumber: true },
  });
  const heldNumber = holder?.charterNumber ?? null;
  const remaining = await charterSeatsRemaining();

  // Post-cap, this page exists only as the holder's receipt.
  if (heldNumber == null && remaining <= 0) redirect("/meshpro");

  const seat = heldNumber != null
    ? await prisma.charterSeat.findUnique({ where: { number: heldNumber }, select: { claimedAt: true } })
    : null;
  const claimedSince = seat?.claimedAt
    ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric" }).format(seat.claimedAt)
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
          Checkout was cancelled. Nothing was charged, and the seat went back on the shelf.
        </section>
      )}

      <header className="pt-4 text-center">
        <p className="text-xs font-semibold mesh-eyebrow text-[var(--accent-text)]">Charter</p>
        <h1 className="mx-auto mt-3 max-w-md text-3xl font-semibold leading-tight">
          A number, not a feature
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
          {CHARTER_SEAT_CAP} numbered seats, for the people who want Mesh.me to exist. $79, once.
        </p>
      </header>

      {heldNumber != null ? (
        <section className="mesh-surface rounded-xl p-6 text-center">
          <p className="text-2xl font-semibold text-[var(--text-primary)]">Charter №{heldNumber}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Yours{claimedSince ? ` since ${claimedSince}` : ""}. Worn on your profile if you choose —
            the switch lives in <Link href="/billing" className="underline underline-offset-2">billing</Link>.
          </p>
        </section>
      ) : (
        <section className="mesh-surface rounded-xl p-6">
          <ul className="grid gap-3 text-sm leading-6 text-[var(--text-secondary)]">
            <li>
              <span className="font-semibold text-[var(--text-primary)]">Your number</span>{" — "}the lowest
              unclaimed of {CHARTER_SEAT_CAP}, reserved the moment checkout opens and printed on the receipt. Status.
            </li>
            <li>
              <span className="font-semibold text-[var(--text-primary)]">A quiet profile chip</span>{" — "}&ldquo;Charter
              №41&rdquo; beside your name, with an off switch. Status.
            </li>
            <li>
              <span className="font-semibold text-[var(--text-primary)]">A Meshi pin</span>{" — "}owned outright,
              wearable with or without Pro. Status.
            </li>
            <li>
              <span className="font-semibold text-[var(--text-primary)]">Nothing else — deliberately.</span>{" "}A
              seat that included Pro would eventually be a discount, and a discount can be repriced. A number
              can&apos;t.
            </li>
          </ul>
          <div className="mt-5">
            <CharterCheckoutButton />
          </div>
        </section>
      )}

      <div className="grid gap-2 text-center text-xs leading-5 text-[var(--text-muted)]">
        <p>If a seat is ever refunded, its number retires — never resold.</p>
        <p>When seat one hundred is claimed, this page is gone. No waitlist, no countdown.</p>
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
