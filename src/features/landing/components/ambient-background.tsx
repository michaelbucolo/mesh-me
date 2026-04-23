import { MeshBackground } from "@/components/mesh-background";

export function AmbientBackground() {
  return (
    <>
      <MeshBackground density={95} />

      <div className="pointer-events-none absolute inset-0">
        <div className="float-orb absolute left-[10%] top-[15%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(45,127,249,0.12),transparent_60%)]" />
        <div className="float-orb-delayed absolute right-[5%] top-[8%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(0,198,251,0.1),transparent_55%)]" />
        <div className="float-orb-slow absolute bottom-[10%] left-[30%] h-[450px] w-[450px] rounded-full bg-[radial-gradient(circle,rgba(45,127,249,0.08),transparent_50%)]" />
      </div>
    </>
  );
}
