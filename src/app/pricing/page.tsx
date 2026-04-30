import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Mesh Pro Pricing",
  description: "Mesh Pro pricing redirects into the authenticated Mesh Pro subscription page.",
};

export default async function PricingPage() {
  const user = await getCurrentUser();
  redirect(user ? "/meshpro" : "/login?next=/meshpro");
}
