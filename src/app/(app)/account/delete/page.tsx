import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import { DeleteAccountTab } from "@/app/(app)/settings/tabs";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Delete Account",
  description: "Permanently delete your Mesh.me account.",
};

export default async function DeleteAccountPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=%2Faccount%2Fdelete");
  }

  if (!user.onboarded) {
    redirect("/onboarding");
  }

  // Accounts created through Google or Apple have no password — identity-auth
  // stores an unusable random hash so password sign-in can never succeed. The
  // form used to require one anyway, which made its own delete button
  // permanently un-pressable for them. Same signal the server uses.
  const federatedIdentities = await prisma.authIdentity.count({ where: { userId: user.id } });
  const hasPassword = federatedIdentities === 0;

  return (
    <main className="simple-page grid gap-5">
      <header className="mesh-surface rounded-lg p-4 md:p-5">
        <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)] transition hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to settings
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-semibold mesh-eyebrow text-red-100">
              <ShieldAlert className="h-4 w-4" aria-hidden="true" />
              Permanent account removal
            </div>
            <h1 className="mt-3 text-3xl font-semibold leading-tight md:text-5xl">Delete your Mesh.me account</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] md:text-base">
              This is the formal account removal flow. It removes your Mesh.me profile, sessions, posts, messages, settings, Meshi preferences, and connected-account records from Mesh.me.
            </p>
          </div>
          <div className="mesh-surface rounded-lg p-4 text-sm leading-6 text-[var(--text-secondary)]">
            <p className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
              <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              Before you delete
            </p>
            <p className="mt-2">
              Export your data from Settings first if you want a copy. This action cannot be undone.
            </p>
          </div>
        </div>
      </header>

      <section className="mesh-surface rounded-lg p-4 md:p-5">
        <DeleteAccountTab hasPassword={hasPassword} />
      </section>
    </main>
  );
}
