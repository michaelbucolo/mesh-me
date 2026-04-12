import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MeshBackground } from "@/components/mesh-background";
import { MeshEntry } from "@/components/mesh-entry";

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user?.onboarded) redirect("/mesh");

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-primary)]">
      <MeshBackground density={95} />

      {/* Ambient glow orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[10%] left-[15%] w-[500px] h-[500px] rounded-full float-orb" style={{ background: "radial-gradient(circle, rgba(45,127,249,0.12) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[15%] right-[10%] w-[400px] h-[400px] rounded-full float-orb-delayed" style={{ background: "radial-gradient(circle, rgba(0,198,251,0.1) 0%, transparent 70%)" }} />
        <div className="absolute top-[50%] left-[60%] w-[300px] h-[300px] rounded-full float-orb-slow" style={{ background: "radial-gradient(circle, rgba(45,127,249,0.08) 0%, transparent 70%)" }} />
      </div>

      {/* Full-screen single-page auth experience */}
      <div className="relative z-10">
        <MeshEntry />
      </div>
    </div>
  );
}
