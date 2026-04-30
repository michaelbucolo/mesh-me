import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommunityCreateForm } from "@/components/communities/community-create-form";

export const metadata: Metadata = {
  title: "Create Community",
  description: "Create a privacy-first Mesh.me community connected to shared feeds, MeChat, and collaborative sessions.",
};

export default function CreateCommunityPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/communities">
          <ArrowLeft className="h-4 w-4" />
          Back to communities
        </Link>
      </Button>
      <CommunityCreateForm />
    </main>
  );
}
