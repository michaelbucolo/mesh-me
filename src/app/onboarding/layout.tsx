import { redirect } from "next/navigation";
import { getCurrentUserRedirectState } from "@/lib/auth";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUserRedirectState();

  if (!user) {
    redirect("/login");
  }

  if (user.onboarded) {
    redirect("/mesh");
  }

  return children;
}
