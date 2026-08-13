import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GiftMeshProForm } from "@/components/meshpro/gift-meshpro-form";
import { getCurrentUser } from "@/lib/auth";

type GiftPageProps = {
  searchParams?: Promise<{
    to?: string | string[];
    payment?: string | string[];
  }>;
};

export const metadata: Metadata = {
  title: "Gift MeshPro",
  description: "A month, a season, or a year of MeshPro for someone else. One payment, no strings.",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GiftMeshProPage({ searchParams }: GiftPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/meshpro/gift");
  if (!user.onboarded) redirect("/onboarding");

  const params = searchParams ? await searchParams : undefined;
  // Prefill from ?to= (the profile entry point). Sanitized to username shape —
  // it only seeds a text field, but there is no reason to carry anything else.
  const to = (firstParam(params?.to) || "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
  const cancelled = firstParam(params?.payment) === "cancelled";

  return (
    <main className="simple-page mx-auto grid w-full max-w-lg gap-8 pb-16">
      {cancelled && (
        <section className="rounded-lg border border-[var(--ds-border)] bg-[var(--ds-surface)] px-4 py-3 text-sm font-semibold text-[var(--text-secondary)]">
          Checkout was cancelled. Nothing was charged.
        </section>
      )}

      <header className="pt-4 text-center">
        <p className="text-xs font-semibold mesh-eyebrow text-[var(--accent-text)]">MeshPro</p>
        <h1 className="mx-auto mt-3 max-w-md text-3xl font-semibold leading-tight">
          Give someone the gold rim
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
          A month, a season, or a year of MeshPro — the wardrobe, the rim their friends see, the
          real controls. They get the months; nobody gets a subscription.
        </p>
      </header>

      <section className="mesh-surface rounded-xl p-6">
        <GiftMeshProForm initialUsername={to} />
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
