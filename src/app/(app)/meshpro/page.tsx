import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { BarChart3, Check, CreditCard, Crown, Palette, ShieldCheck, Sparkles, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { BillingPortalButton, MeshProCheckoutButton } from "@/components/meshpro/mesh-pro-actions";
import { getCurrentUser } from "@/lib/auth";
import { MESH_PRO_ANALYTICS, MESH_PRO_CUSTOMIZATION, MESH_PRO_FEATURES, MESH_PRO_PRICING } from "@/lib/mesh-pro";
import { getMeshProBillingState, syncMeshProCheckoutSessionForUser } from "@/lib/stripe-billing";

type MeshProPageProps = {
  searchParams?: Promise<{
    payment?: string | string[];
    session_id?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Mesh Pro",
  description: "Mesh Pro pricing, billing, premium analytics, custom Mesh visuals, Meshi cosmetics, badges, and themes.",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function formatBillingDate(value: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value);
}

const meshProUnlocks: Array<{ title: string; body: string; href: string; icon: LucideIcon }> = [
  { title: "Algorithm Studio", body: "Five sliders in the Flow set the exact weights your feed ranks by. Your algorithm, literally.", href: "/flow", icon: BarChart3 },
  { title: "Your Year", body: "Your Trail across twelve months — the whole year as one thread.", href: "/trail?range=year", icon: Sparkles },
  { title: "Mesh Atmospheres", body: "Aurora, Ember, Ocean, and Dawn skies for your mesh — visitors see them too.", href: "/settings#mesh", icon: Palette },
  { title: "Analytics", body: "Pro insight cards appear in Analytics.", href: "/analytics", icon: BarChart3 },
  { title: "Mesh visuals", body: "Thread color, node style, and motion studio in Settings.", href: "/settings#mesh", icon: WandSparkles },
  { title: "Meshi cosmetics", body: "Premium hats, hair, badges, and outfits — plus a discreet gold hairline on your live Meshi.", href: "/settings", icon: Crown },
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
    <main className="simple-page grid gap-5">
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

      <header className="mesh-surface overflow-hidden rounded-lg p-4 md:p-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-center">
          <div>
            <Badge variant={isPro ? "success" : "accent"}>{isPro ? "Mesh Pro active" : "Optional upgrade"}</Badge>
            <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">Mesh Pro</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
              Your algorithm, your year, your world&apos;s look — real controls, not decorations. No ads, no data selling, ever.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {isPro ? (
                <>
                  <BillingPortalButton>Manage billing</BillingPortalButton>
                  <Button asChild variant="secondary">
                    <Link href="/settings">Customize Pro</Link>
                  </Button>
                </>
              ) : (
                <>
                  <MeshProCheckoutButton plan="yearly">Start yearly</MeshProCheckoutButton>
                  <Button asChild variant="secondary">
                    <Link href="#pricing">Compare plans</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="mesh-surface rounded-lg border border-[var(--ds-border)] bg-[var(--bg-primary)]/60 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[var(--accent-subtle)]">
                <MeshiMascot size={54} mood="happy" color="blue" animate showGlow={false} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">Current plan</p>
                <p className="text-xl font-bold text-[var(--text-primary)]">{isPro ? "Mesh Pro" : "Free"}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {isPro && renewalDate
                    ? `${billing?.cancelAtPeriodEnd ? "Access through" : "Renews"} ${renewalDate}`
                    : "Core Mesh.me stays useful for free."}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2">
              <MiniFact label="Billing" value={billing?.stripeCustomerId ? "Stripe linked" : "Not linked yet"} />
              <MiniFact label="Status" value={billing?.status ?? "free"} />
              <MiniFact label="No ads" value="Always" />
            </div>
          </div>
        </div>
      </header>

      <section id="pricing" className="grid gap-4 lg:grid-cols-2">
        {Object.values(MESH_PRO_PRICING).map((plan) => (
          <article key={plan.id} className={`mesh-surface rounded-lg p-4 md:p-5 ${plan.id === "yearly" ? "border-[var(--accent-muted)]" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold">{plan.label}</h2>
                  {plan.savings && <Badge variant="success">{plan.savings}</Badge>}
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{plan.detail}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold">{plan.price}</p>
                <p className="text-xs text-[var(--text-muted)]">per {plan.interval}</p>
              </div>
            </div>
            <div className="mt-5">
              {isPro ? (
                <BillingPortalButton className="w-full">Manage subscription</BillingPortalButton>
              ) : (
                <MeshProCheckoutButton plan={plan.id} className="w-full">
                  Subscribe {plan.label.toLowerCase()}
                </MeshProCheckoutButton>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <FeaturePanel icon={BarChart3} title="Premium analytics" items={MESH_PRO_ANALYTICS} />
        <FeaturePanel icon={Palette} title="Custom visuals" items={MESH_PRO_CUSTOMIZATION} />
        <FeaturePanel icon={ShieldCheck} title="Consumer-first model" items={MESH_PRO_FEATURES.slice(5)} />
      </section>

      <section className="mesh-surface rounded-lg p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <Crown size={20} aria-hidden="true" />
              What unlocks immediately
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Everything below is wired into the current app surfaces.</p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/billing">
              <CreditCard size={16} aria-hidden="true" />
              Account billing
            </Link>
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {meshProUnlocks.map(({ title, body, href, icon: Icon }) => (
            <Link key={title} href={title === "Profile badge" ? `/profile/${user.username}` : href} className="mesh-choice rounded-lg p-4 transition hover:-translate-y-0.5">
              <Icon className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-[var(--text-primary)]">{title}</p>
              <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{body}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--ds-border)] bg-[var(--ds-surface)] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-1 truncate text-sm font-bold capitalize">{value}</p>
    </div>
  );
}

function FeaturePanel({
  icon: Icon,
  title,
  items,
}: {
  icon: LucideIcon;
  title: string;
  items: readonly string[];
}) {
  return (
    <section className="mesh-surface rounded-lg p-4 md:p-5">
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Icon className="h-5 w-5 text-[var(--accent)]" aria-hidden="true" />
        {title}
      </h2>
      <ul className="mt-4 grid gap-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm leading-6 text-[var(--text-secondary)]">
            <Check className="mt-1 h-4 w-4 shrink-0 text-[var(--ds-success)]" aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
