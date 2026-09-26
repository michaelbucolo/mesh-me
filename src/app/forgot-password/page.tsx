import type { Metadata } from "next";
import { MeshEntryExperience } from "@/components/auth/mesh-entry-experience";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reset your password",
  description: "Recover access to your Mesh.me account.",
};

export default function ForgotPasswordPage() {
  return <MeshEntryExperience initialStage="reset" />;
}
