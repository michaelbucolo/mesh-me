import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/signup-form";
import { IdentityProviderButtons } from "@/components/auth/identity-provider-buttons";
import { AuthShell } from "@/components/auth/auth-shell";
import { getCurrentUserRedirectState } from "@/lib/auth";
import { getConfiguredIdentityProviders } from "@/lib/identity-auth";
import { meshBrand } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Create your Mesh",
  description: `Create your ${meshBrand.name} account and shape your digital world with ${meshBrand.meshi.name}.`,
};

export default async function SignupPage() {
  const user = await getCurrentUserRedirectState();
  if (user?.onboarded) redirect("/mesh");
  if (user && !user.onboarded) redirect("/onboarding");

  const oauthProviders = getConfiguredIdentityProviders();

  return (
    <AuthShell
      title="Create your account."
      description={`Set up ${meshBrand.name} in a few steps.`}
    >
      <section className="mx-auto w-full max-w-full rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-5 shadow-[var(--shadow-lg)] sm:w-full sm:max-w-md sm:p-8">
        <div className="mb-5 sm:mb-6">
          <Link href="/" className="brand-wordmark text-xl text-[var(--text-primary)]">
            mesh<span className="brand-wordmark-accent">.me</span>
          </Link>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:mt-4">Create account</h1>
        </div>

        <SignupForm />
        {oauthProviders.length ? (
          <IdentityProviderButtons providers={oauthProviders} className="mt-6" />
        ) : null}
      </section>
    </AuthShell>
  );
}
