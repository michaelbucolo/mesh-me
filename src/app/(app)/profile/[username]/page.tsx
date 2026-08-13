import type { Metadata } from "next";
import { InstagramProfileView } from "../profile-view";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;

  return {
    title: `@${username}`,
    description: "A unified Mesh.me identity that brings posts, links, relationships, privacy, and Meshi presence into one profile.",
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string; gift?: string }>;
}) {
  const { username } = await params;
  const { tab, gift } = await searchParams;
  // ?gift=sent is where Stripe lands the PURCHASER after a Gift MeshPro
  // checkout — the one quiet confirmation that the payment went through.
  return <InstagramProfileView username={username} tab={tab} giftSent={gift === "sent"} />;
}
