import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { ContentInventoryCard } from "@/components/analytics/content-inventory-card";
import { ProInsights } from "@/components/analytics/pro-insights";
import { getCurrentUserRedirectState } from "@/lib/auth";
import { getAnalyticsDashboardData } from "@/lib/analytics-dashboard";
import { getContentInventory } from "@/lib/content-inventory";
import { getProAnalytics } from "@/lib/pro-analytics";
import { hasAnalyticsConsent } from "@/lib/consent";

export const metadata: Metadata = { title: "Analytics" };

// Analytics as a first-class destination — one of the five tabs — rather than
// a tab buried inside Profile. The dashboard component already knows how to be
// a whole page (no `embedded`); the proxy gates the route for guests.
export default async function AnalyticsPage() {
  const user = await getCurrentUserRedirectState();
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");

  // Both loaders gate on the same Analytics consent and both return null when
  // it is withdrawn, so they are fetched together rather than sequenced: the
  // Pro insights are an additional READ of the same activity, not a different
  // permission.
  // The lifetime inventory rides the same Analytics consent as everything else
  // on this page — it is a read of your own activity, so it belongs behind the
  // same permission and is not fetched when that permission is withdrawn.
  const [data, pro] = await Promise.all([getAnalyticsDashboardData(), getProAnalytics()]);
  if (data) {
    const inventory = await getContentInventory(user.id);
    return (
      <>
        <AnalyticsDashboard data={data} />
        <div className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6">
          <ContentInventoryCard inventory={inventory} />
        </div>
        {pro && (
          <div className="mx-auto w-full max-w-7xl px-4 pb-6 sm:px-6">
            <ProInsights data={pro} />
          </div>
        )}
      </>
    );
  }

  // The loader returns null both for a real failure and for a withdrawn
  // Analytics consent. Only the second case has a truthful explanation, so
  // resolve it here rather than telling someone who switched analytics off
  // to "try again" — that would be a false assurance.
  const withheldByConsent = !(await hasAnalyticsConsent(user.id));

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
      {withheldByConsent ? (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-[var(--mesh-text)]">Analytics is switched off</h2>
          <p className="max-w-md text-sm text-[var(--mesh-text-secondary)]">
            Your privacy rules say Mesh.me may not process your activity into analytics, so we are not building this dashboard. Change the Analytics rule to turn it back on.
          </p>
          <Link href="/privacy-controls" className="text-sm font-semibold text-[var(--accent-text)] underline underline-offset-4">
            Open privacy controls
          </Link>
        </section>
      ) : (
        <section className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--mesh-border)] bg-[var(--mesh-bg-elevated)] px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-[var(--mesh-text)]">Analytics unavailable</h2>
          <p className="text-sm text-[var(--mesh-text-secondary)]">We couldn&apos;t load your analytics right now. Please try again.</p>
        </section>
      )}
    </main>
  );
}
