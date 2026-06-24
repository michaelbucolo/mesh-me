import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommunitySpace } from "@/components/communities/community-space";
import { getCommunitySpaceData } from "@/lib/community-hub";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getCommunitySpaceData(slug);

  if (!data || data.status === "missing") {
    return {
      title: "Community not found",
      description: "This Mesh.me community could not be found.",
    };
  }

  if (data.status === "locked") {
    return {
      title: "Private community",
      description: "This private Mesh.me community is visible only to members.",
    };
  }

  return {
    title: data.community.name,
    description: data.community.description || "A Mesh.me community space for posts, chat, rules, and members.",
  };
}

export default async function CommunityDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getCommunitySpaceData(slug);

  if (!data) redirect(`/login?next=/communities/${encodeURIComponent(slug)}`);
  if (data.status === "missing") notFound();

  if (data.status === "locked") {
    return (
      <main className="mx-auto grid min-h-[70vh] w-full max-w-xl place-items-center px-4 py-8">
        <section className="mesh-surface rounded-[28px] border border-[var(--ds-border)] p-8 text-center shadow-[var(--shadow-soft)]">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent)]">
            <Lock className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-[0] text-[var(--text-primary)]">Private community</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            This space is visible only to its members. Ask a member for an invite or discover public communities.
          </p>
          <Button asChild className="mt-5">
            <Link href="/communities">Back to communities</Link>
          </Button>
        </section>
      </main>
    );
  }

  return <CommunitySpace data={data} />;
}
