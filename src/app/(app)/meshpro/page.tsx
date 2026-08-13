import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { CalendarRange, Crown, Gift, Landmark, LineChart, Palette, SlidersHorizontal, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BillingPortalButton, MeshProCheckoutButton } from "@/components/meshpro/mesh-pro-actions";
import { getCurrentUser } from "@/lib/auth";
import { charterSeatsRemaining } from "@/lib/charter";
import { MESH_PRO_PRICING } from "@/lib/mesh-pro";
import { prisma } from "@/lib/prisma";
import { getMeshProBillingState, syncMeshProCheckoutSessionForUser } from "@/lib/stripe-billing";

type MeshProPageProps = {
  searchParams?: Promise<{
    payment?: string | string[];
    session_id?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "MeshPro",
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
//
// ── `enforcedIn` IS PART OF THE PROMISE ──────────────────────────────────────
//
// Every entry names the file that actually delivers it and a symbol inside
// that file, and scripts/meshpro-claims-check.ts asserts both exist. Adding a
// card without one does not compile; adding one that points at code which is
// not there fails `npm run check`.
//
// This exists because the page shipped claims nothing enforced. "A subtle gold
// aura" was sold for months while the only trace of it in the codebase was a
// CSS comment with no rule under it — `isPro` reached the browser through the
// presence pipeline and no renderer ever read it. "Deeper analytics: audience
// overlap, longer history, exportable reports" named three things, of which
// two were free to everyone and the third did not exist.
//
// A claim is cheap to write and invisible when it rots. This makes it cost a
// file path.
const unlocks: Array<{
  title: string;
  body: string;
  href: string;
  icon: LucideIcon;
  /** Where this is actually delivered, and a symbol proving it is still there. */
  enforcedIn: { file: string; symbol: string };
}> = [
  {
    title: "Algorithm Studio",
    body: "Five sliders that set the exact weights your Flow ranks by. Your algorithm, literally.",
    href: "/flow",
    icon: SlidersHorizontal,
    enforcedIn: { file: "src/lib/flow-ranking.ts", symbol: "resolveStudioWeights" },
  },
  {
    title: "Your Year",
    body: "Your Trail stretched across twelve months — the whole year as one thread.",
    href: "/trail?range=year",
    icon: CalendarRange,
    enforcedIn: { file: "src/app/api/trail/route.ts", symbol: "yearMode" },
  },
  {
    // Named for what the picker actually says. The four papers are defined as
    // aurora/ember/ocean/dawn in code (paint/papers.ts) but every label a
    // person can read says Botanical, Kraft, Blueprint and Sunlit — so this
    // card was selling four things nobody could find. "Skies" went the same
    // way: papers.ts states outright that the mesh is paper, not sky.
    title: "Papers",
    body: "Botanical, Kraft, Blueprint, and Sunlit stock under your mesh. Visitors see it too.",
    href: "/settings#mesh",
    icon: Palette,
    enforcedIn: { file: "src/components/mesh/paint/papers.ts", symbol: "MESH_PAPERS" },
  },
  {
    // Was "Deeper analytics — audience overlap across platforms, longer
    // history, exportable reports." All three were wrong as PAID claims.
    // Audience overlap is real and every free account already has it; the
    // export is the GDPR account dump, which is a right, not a perk; and
    // "longer history" did not exist in any form — CHART_DAYS and
    // METRIC_WINDOW_DAYS were flat constants with no plan branch.
    //
    // Overlap and export stay free, because paywalling something people
    // already have to make a sentence true is worse than the sentence. What
    // Pro buys is the one thing that was genuinely missing: more history.
    title: "A longer memory",
    body: "A year of your analytics instead of a fortnight — the trend, not the week.",
    href: "/analytics",
    icon: LineChart,
    enforcedIn: { file: "src/lib/analytics-dashboard.ts", symbol: "analyticsWindow" },
  },
  {
    title: "World styling",
    body: "Thread colors, node styles, and motion for your mesh.",
    href: "/settings#mesh",
    icon: WandSparkles,
    enforcedIn: { file: "src/components/settings/settings-control-center.tsx", symbol: "meshNodeStyles" },
  },
  {
    title: "Meshi wardrobe",
    // "gold aura" became "gold rim": the mesh's Meshis have weight and do not
    // glow (globals.css, .mesh-owner-meshi), so the mark is a hairline on the
    // silhouette. It is now drawn, which it was not before.
    body: "Premium hats, hair and hair colors, faces, and badges — plus a fine gold rim, live.",
    href: "/settings",
    icon: Crown,
    enforcedIn: { file: "src/lib/mesh-pro.ts", symbol: "FREE_MESHI_OPTIONS" },
  },
];

// Not an unlock — the one thing on this page you buy FOR someone else. Same
// contract as the cards above though: the claim names the code that delivers
// it, and scripts/meshpro-claims-check.ts asserts both halves exist.
const giftCard = {
  title: "Give MeshPro",
  body: "A month, a season, or a year for someone else. One payment, no subscription — their months just start, and stack on anything they have. Or a single wardrobe piece for their Meshi, theirs for good.",
  href: "/meshpro/gift",
  icon: Gift,
  enforcedIn: { file: "src/lib/stripe-billing.ts", symbol: "applyMeshProGiftSession" },
};

// The one purchase on this page that buys no capability at all — and says so.
// Renders ONLY while seats remain; at cap the section is simply gone (no
// tombstone, no counter). Same enforcedIn contract as everything else here.
const charterCard = {
  title: "Charter Member",
  body: "One hundred numbered seats. $79, once. It buys no features — it buys the number, worn quietly on your profile if you choose, and it keeps Mesh.me independent. When the hundredth seat is claimed, this card just goes away. No waitlist, no countdown.",
  href: "/meshpro/charter",
  icon: Landmark,
  enforcedIn: { file: "src/lib/charter.ts", symbol: "applyCharterSession" },
};

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

  const [billing, charterRemaining, charterSeat] = await Promise.all([
    getMeshProBillingState(user.id),
    charterSeatsRemaining(),
    user.charterNumber != null
      ? prisma.charterSeat.findUnique({ where: { number: user.charterNumber }, select: { claimedAt: true } })
      : Promise.resolve(null),
  ]);
  const isPro = Boolean(billing?.isMeshPro);
  const renewalDate = formatBillingDate(billing?.currentPeriodEnd ?? null);
  const hasSubscription = Boolean(billing?.stripeSubscriptionId);
  const giftedThrough = formatBillingDate(billing?.giftUntil ?? null);
  // A gifted member sees the plans too — subscribing while gifted is fair by
  // construction (checkout trials the subscription until the gift ends, so no
  // day is paid for twice), and hiding the grid would strand them at expiry.
  const showPricing = !isPro || (Boolean(billing?.giftUntil) && !hasSubscription);

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
        <p className="text-xs font-semibold mesh-eyebrow text-[var(--accent-text)]">MeshPro</p>
        <h1 className="mx-auto mt-3 max-w-xl text-3xl font-semibold leading-tight md:text-4xl">
          Real controls, not decorations
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--text-secondary)]">
          Your algorithm, your year, your world&apos;s look. Pro, small wardrobe gifts, and one
          hundred charter seats are the only ways Mesh.me makes money — so there are no ads and
          your data is never sold.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {isPro ? (
            <>
              {/* A pure gift recipient has no Stripe customer — a billing
                  portal button would only open an error for them. */}
              {billing?.stripeCustomerId && <BillingPortalButton>Manage billing</BillingPortalButton>}
              <Button asChild variant="secondary">
                <Link href="/settings">Customize</Link>
              </Button>
            </>
          ) : (
            <MeshProCheckoutButton plan="yearly">Get MeshPro</MeshProCheckoutButton>
          )}
        </div>
        {isPro && renewalDate && (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            {billing?.cancelAtPeriodEnd ? "Access through" : "Renews"} {renewalDate}
          </p>
        )}
        {giftedThrough && (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Gifted through {giftedThrough}.
            {!hasSubscription && " If you subscribe, paid time starts after that — no day is billed twice."}
          </p>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        {unlocks.map(({ title, body, href, icon: Icon }) => (
          <Link
            key={title}
            href={href}
            className="mesh-choice group rounded-xl p-5 transition"
          >
            <Icon className="h-5 w-5 text-[var(--accent-text)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-[var(--text-primary)]">{title}</p>
            <p className="mt-1 text-[0.78125rem] leading-5 text-[var(--text-secondary)]">{body}</p>
          </Link>
        ))}
      </section>

      <section>
        <Link href={giftCard.href} className="mesh-choice group flex items-start gap-4 rounded-xl p-5 transition">
          <giftCard.icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--text-primary)]">{giftCard.title}</span>
            <span className="mt-1 block text-[0.78125rem] leading-5 text-[var(--text-secondary)]">{giftCard.body}</span>
          </span>
        </Link>
      </section>

      {user.charterNumber != null ? (
        // The holder's quiet receipt — no button, nothing to do.
        <section className="rounded-xl border border-[var(--ds-border)] bg-[var(--ds-surface)] px-5 py-4 text-sm text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">Charter №{user.charterNumber}</span>
          {charterSeat?.claimedAt && <> — yours since {formatBillingDate(charterSeat.claimedAt)}</>}
        </section>
      ) : charterRemaining > 0 ? (
        <section>
          <Link href={charterCard.href} className="mesh-choice group flex items-start gap-4 rounded-xl p-5 transition">
            <charterCard.icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-text)]" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--text-primary)]">{charterCard.title}</span>
              <span className="mt-1 block text-[0.78125rem] leading-5 text-[var(--text-secondary)]">{charterCard.body}</span>
            </span>
          </Link>
        </section>
      ) : null}

      {showPricing && (
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
