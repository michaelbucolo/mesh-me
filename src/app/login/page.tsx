import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { MeshEntryExperience } from "@/components/auth/mesh-entry-experience";
import { getCurrentUserRedirectState } from "@/lib/auth";
import { getConfiguredIdentityProviders } from "@/lib/identity-auth";
import { meshBrand } from "@/lib/brand";

type LoginPageProps = {
  searchParams?: Promise<{ next?: string | string[]; error?: string | string[] }>;
};

export const metadata: Metadata = {
  title: "Enter your world",
  description: `Sign in to ${meshBrand.name}. ${meshBrand.motto}.`,
};

function getSafeNextPath(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  try {
    const parsed = new URL(raw, "https://mesh.me");
    if (parsed.origin !== "https://mesh.me") return null;
    if (parsed.pathname === "/login" || parsed.pathname === "/signup" || parsed.pathname === "/reset-password") {
      return null;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const nextPath = getSafeNextPath(params?.next);
  const errorParam = Array.isArray(params?.error) ? params?.error[0] : params?.error;
  const initialError = errorParam ? errorParam.slice(0, 160) : null;
  const user = await getCurrentUserRedirectState();
  if (user?.onboarded) redirect(nextPath || "/mesh");
  if (user && !user.onboarded) redirect("/onboarding");

  return (
    <MeshEntryExperience
      nextPath={nextPath}
      oauthProviders={getConfiguredIdentityProviders()}
      initialError={initialError}
    />
  );
}
