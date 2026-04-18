import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getInnovationBrief } from "@/lib/innovation";
import { InnovationStudio } from "@/components/innovation/innovation-studio";

export const metadata: Metadata = {
  title: "Innovation Studio",
};

export default async function InnovationPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const brief = await getInnovationBrief(user.id);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
      <InnovationStudio brief={brief} displayName={user.displayName} />
    </main>
  );
}
