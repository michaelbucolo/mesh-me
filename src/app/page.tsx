import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MeshBackground } from "@/components/mesh-background";
import { MeshEntry } from "@/components/mesh-entry";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user?.onboarded) redirect("/feed");

  return (
    <div className="relative min-h-screen bg-[var(--bg-primary)] overflow-hidden">
      {/* Constellation mesh background */}
      <MeshBackground interactive density={80} mouseInfluence={180} />

      {/* Subtle radial gradient overlay for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 0%, rgba(9,9,11,0.4) 70%, rgba(9,9,11,0.8) 100%)",
        }}
      />

      {/* Single-page entry experience */}
      <MeshEntry />
    </div>
  );
}
