import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, MailWarning } from "lucide-react";
import { verifyEmailToken } from "@/lib/actions";
import { AuthShell } from "@/components/auth/auth-shell";
import { MeshiMascot } from "@/components/meshi/meshi-mascot";
import { meshBrand } from "@/lib/brand";

type VerifyEmailPageProps = {
  searchParams?: Promise<{ token?: string | string[] }>;
};

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verify email",
  description: `Verify your ${meshBrand.name} email address.`,
};

function getToken(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const token = getToken(params?.token);
  const result = token ? await verifyEmailToken(token) : { error: "Invalid verification link. Please request a new one." };
  const success = "success" in result && result.success;

  return (
    <AuthShell
      title={success ? "Email verified" : "Verification needed"}
      description={success ? "Your Mesh.me identity is safer now." : "This link could not be used."}
    >
      <section className="mx-auto w-full max-w-md rounded-2xl border border-[var(--glass-card-border)] bg-[var(--glass-card-bg)] p-6 text-center shadow-[var(--shadow-lg)] sm:p-8">
        <div className="mx-auto mb-5 flex justify-center">
          <MeshiMascot size={68} mood={success ? "celebrating" : "thinking"} animate />
        </div>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          {success ? <CheckCircle2 className="h-6 w-6 text-emerald-500" /> : <MailWarning className="h-6 w-6 text-amber-500" />}
        </div>
        <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
          {success ? "Email verified" : "That link did not work"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
          {success
            ? `${result.email} is now verified on your Mesh.me account.`
            : result.error}
        </p>
        <Link href={success ? "/mesh" : "/login"} className="brand-button mt-6 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white">
          {success ? "Enter Mesh.me" : "Back to sign in"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </AuthShell>
  );
}
