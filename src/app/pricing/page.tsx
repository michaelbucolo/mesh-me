import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { hasSessionCookieHint } from "@/lib/auth";

export const metadata: Metadata = {
  title: "MeshPro Pricing",
  description: "MeshPro pricing redirects into the authenticated MeshPro subscription page.",
};

export default async function PricingPage() {
  // Redirect-only route: cookie presence is enough to pick a destination, and
  // /meshpro re-validates the session anyway — no database hit needed here.
  const signedIn = await hasSessionCookieHint();
  redirect(signedIn ? "/meshpro" : "/login?next=/meshpro");
}
