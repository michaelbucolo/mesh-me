import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { CalendarRange, Crown, LineChart, Palette, SlidersHorizontal, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BillingPortalButton, MeshProCheckoutButton } from "@/components/meshpro/mesh-pro-actions";
import { getCurrentUser } from "@/lib/auth";
import { MESH_PRO_PRICING } from "@/lib/mesh-pro";
import { getMeshProBillingState, syncMeshProCheckoutSessionForUser } from "@/lib/stripe-billing";

type MeshProPageProps = {
  searchParams?: Promise<{
    payment?: string | string[];
    session_id?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Mesh Pro",
  description: "Real controls, not decorations: your algorithm, your year, your world's look. No ads, ever.",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatBillingDate(value: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value);
}

// The complete Pro catalogue — each card links to the surface where the
// feature actually lives. One list, told once.
const unlocks: Array<{ title: string; body: string; href: string; icon: LucideIcon }> = [
  {
    title: "Algorithm Studio",
    body: "Five sliders that set the exact weights your Flow ranks by. Your algorithm, literally.",
    href: "/flow",
    icon: SlidersHorizontal,
  },
  {
    title: "Your Year",
    body: "Your Trail stretched across twelve months — the whole year as one thread.",
    href: "/trail?range=year",
    icon: CalendarRange,
  },
  {
    title: "Atmospheres",
    body: "Aurora, Ember, Ocean, and Dawn skies over your mesh. Visitors see them too.",
    href: "/settings#mesh",
    icon: Palette,
  },
  {
    title: "Deeper analytics",
    body: "Audience overlap across platforms, longer history, exportable reports.",
    href: "/analytics",
    icon: LineChart,
  },
  {
    title: "World styling",
    body: "Thread colors, node styles, and motion for your mesh.",
    href: "/settings#mesh",
    icon: WandSparkles,
  },
  {
    title: "Meshi wardrobe",
    body: "Premium hats, hair, badges, and outfits — plus a subtle gold aura, live.",
    href: "/settings",
    icon: Crown,
  },
];

export default async function MeshProPage({ searchParams }: MeshProPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/meshpro");
  if (!user.onboarded) redirect("/onboarding");

  const params = searchParams ? await searchParams : undefined;
  const payment = firstParam(params?.payment);
  const sessionId = firstParam(params?.session_id);
  const syncResult = payment === "success" && sessionId
    ? await syncMeshProCheckoutSessionForUser(sessionId, user.id).catch((error) => ({
        ok: false,
        message: error instanceof Error ? error.message : "Could not verify checkout yet.",
      }))
    : null;

  const billing = await getMeshProBillingState(user.id);
  const isPro = Boolean(billing?.isMeshPro);
  const renewalDate = formatBillingDate(billing?.currentPeriodEnd ?? null);

  return (
    <main className="simple-page mx-auto grid w-full max-w-3xl gap-10 pb-16">
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
          Checkout was cancelled. Your free Mesh.me account is unchanged.
        </section>
      )}

      <header className="pt-4 text-center">
        <p className="text-xs font-semibold mesh-eyebrow text-[var(--accent)]">Mesh Pro</p>
        <h1 className="mx-auto mt-3 max-w-xl text-3xl font-semibold leading-tight md:text-4xl">
          Real controls, not decorations
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
          Your algorithm, your year, your world&apos;s look. Pro is the only way Mesh.me makes
          money — so there are no ads and your data is never sold.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {isPro ? (
            <>
              <BillingPortalButton>Manage billing</BillingPortalButton>
              <Button asChild variant="secondary">
                <Link href="/settings">Customize</Link>
              </Button>
            </>
          ) : (
            <MeshProCheckoutButton plan="yearly">Get Mesh Pro</MeshProCheckoutButton>
          )}
        </div>
        {isPro && renewalDate && (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {billing?.cancelAtPeriodEnd ? "Access through" : "Renews"} {renewalDate}
          </p>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {unlocks.map(({ title, body, href, icon: Icon }) => (
          <Link
            key={title}
            href={href}
            className="mesh-choice group rounded-xl p-5 transition hover:-translate-y-0.5"
          >
            <Icon className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{title}</p>
            <p className="mt-1 text-[13px] leading-5 text-[var(--text-secondary)]">{body}</p>
          </Link>
        ))}
      </section>

      {!isPro && (
        <section id="pricing" className="grid gap-3 sm:grid-cols-2">
          {Object.values(MESH_PRO_PRICING).map((plan) => (
            <article
              key={plan.id}
              className={`mesh-surface rounded-xl p-5 ${plan.id === "yearly" ? "border-[var(--accent-muted)]" : ""}`}
            >
              <div className="flex items-baseline justify-between">
                <h2 className="text-base font-semibold">{plan.label}</h2>
                {plan.savings && (
                  <span className="text-xs font-semibold text-[var(--ds-success)]">{plan.savings}</span>
                )}
              </div>
              <p className="mt-2 text-3xl font-semibold">
                {plan.price}
                <span className="ml-1 text-sm font-medium text-[var(--text-muted)]">/{plan.interval}</span>
              </p>
              <MeshProCheckoutButton plan={plan.id} className="mt-4 w-full">
                {plan.id === "yearly" ? "Get yearly" : "Get monthly"}
              </MeshProCheckoutButton>
            </article>
          ))}
        </section>
      )}

      <p className="text-center text-xs text-[var(--text-muted)]">
        Everything else on Mesh.me stays complete and free. Cancel anytime
        {isPro ? (
          <>
            {" "}from <Link href="/billing" className="underline underline-offset-2 hover:text-[var(--text-secondary)]">billing</Link>.
          </>
        ) : (
          "."
        )}
      </p>
    </main>
  );
}
