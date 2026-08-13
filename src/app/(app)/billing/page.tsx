import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { CalendarClock, CheckCircle2, CreditCard, Crown, ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CharterChipToggle } from "@/components/meshpro/charter-chip-toggle";
import { BillingPortalButton } from "@/components/meshpro/mesh-pro-actions";
import { getCurrentUser } from "@/lib/auth";
import { getMeshProBillingState } from "@/lib/stripe-billing";

export const metadata: Metadata = {
  title: "Billing",
  description: "Manage MeshPro billing, subscription status, and Stripe account portal access.",
};

function formatDate(value: Date | null) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(value);
}

function formatAmount(amount: number | null, currency: string | null) {
  if (!amount || !currency) return "Configured in Stripe";
  return new Intl.NumberFormat("en", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
}

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/billing");
  if (!user.onboarded) redirect("/onboarding");

  const billing = await getMeshProBillingState(user.id);
  if (!billing) redirect("/settings");

  const isPro = billing.isMeshPro;

  return (
    <main className="simple-page grid gap-5">
      <header className="mesh-surface rounded-lg p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {/* The topbar states "Billing" — this header used to repeat the
                word at 48px. The plan badge is the information. */}
            <Badge variant={isPro ? "success" : "secondary"}>{isPro ? "MeshPro active" : "Free plan"}</Badge>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Manage MeshPro payments through Stripe. Mesh.me does not store card numbers and never sells user data.
            </p>
          </div>
          {billing.stripeCustomerId ? (
            <BillingPortalButton>Open Stripe portal</BillingPortalButton>
          ) : (
            <Button asChild>
              <Link href="/meshpro">Upgrade to MeshPro</Link>
            </Button>
          )}
        </div>
      </header>

      {billing.stripeError && (
        <section className="rounded-lg border border-[var(--ds-warning-border)] bg-[var(--ds-warning-bg)] p-4 text-sm text-[var(--ds-warning)]">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{billing.stripeError}</p>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BillingStat icon={Crown} label="Plan" value={isPro ? "MeshPro" : "Free"} detail={isPro ? "Premium features enabled" : "Core features enabled"} />
        <BillingStat icon={CreditCard} label="Price" value={formatAmount(billing.amount, billing.currency)} detail={billing.planInterval ? `per ${billing.planInterval}` : "Checkout selects plan"} />
        <BillingStat icon={CalendarClock} label={billing.cancelAtPeriodEnd ? "Access ends" : "Next renewal"} value={formatDate(billing.currentPeriodEnd)} detail={billing.status} />
        <BillingStat icon={ShieldCheck} label="Payment processor" value={billing.stripeCustomerId ? "Stripe" : "Not linked"} detail={billing.isConfigured ? "Configured" : "Not configured"} />
      </section>

      {user.charterNumber != null && (
        <section className="mesh-surface flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3">
          <p className="text-sm text-[var(--text-secondary)]">
            <span className="font-semibold text-[var(--text-primary)]">Charter Member</span>
            {" · "}№{user.charterNumber} of 100
          </p>
          <CharterChipToggle initialShown={user.showCharterNumber} />
        </section>
      )}

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="mesh-surface rounded-lg p-4 md:p-5">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <CheckCircle2 className="h-5 w-5 text-[var(--ds-success)]" aria-hidden="true" />
            Subscription controls
          </h2>
          <div className="mt-4 grid gap-3">
            <ControlRow title="Checkout" body="Start a monthly or yearly MeshPro subscription from the pricing page." href="/meshpro" label="Open pricing" />
            <ControlRow title="Billing portal" body="Update payment method, view invoices, cancel, or resume inside Stripe." action={billing.stripeCustomerId ? <BillingPortalButton variant="outline">Manage in Stripe</BillingPortalButton> : undefined} href={billing.stripeCustomerId ? undefined : "/meshpro"} label={billing.stripeCustomerId ? undefined : "Subscribe first"} />
            <ControlRow title="Pro customization" body="Meshi cosmetics, Mesh visuals, badges, and custom themes are managed in Settings." href="/settings" label="Open settings" />
          </div>
        </div>

        <aside className="mesh-surface rounded-lg p-4 md:p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="h-5 w-5 text-[var(--accent-text)]" aria-hidden="true" />
            Billing safety
          </h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-[var(--text-secondary)]">
            <li>Cards and invoices are handled by Stripe Checkout and the Stripe customer portal.</li>
            <li>MeshPro unlocks optional upgrades; the free app remains useful.</li>
            <li>No ads, no feed-selling, and no hidden data resale model.</li>
          </ul>
          <Button asChild variant="secondary" className="mt-4 w-full">
            <Link href="/trust">
              <ExternalLink size={16} aria-hidden="true" />
              Trust center
            </Link>
          </Button>
        </aside>
      </section>
    </main>
  );
}

function BillingStat({ icon: Icon, label, value, detail }: { icon: LucideIcon; label: string; value: string; detail: string }) {
  return (
    <section className="mesh-surface rounded-lg p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold mesh-eyebrow text-[var(--text-muted)]">{label}</p>
        <Icon className="h-4 w-4 text-[var(--accent-text)]" aria-hidden="true" />
      </div>
      <p className="mt-3 truncate text-xl font-semibold text-[var(--text-primary)]">{value}</p>
      <p className="mt-1 truncate text-xs capitalize text-[var(--text-secondary)]">{detail}</p>
    </section>
  );
}

function ControlRow({
  title,
  body,
  href,
  label,
  action,
}: {
  title: string;
  body: string;
  href?: string;
  label?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{body}</p>
        </div>
        {action}
        {href && label && (
          <Button asChild variant="secondary" size="sm">
            <Link href={href}>{label}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
