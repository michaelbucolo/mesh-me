import type { Metadata } from "next";
import { InstagramProfileView } from "../profile-view";

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;

  return {
    title: `@${username}`,
    description: "A unified Mesh.me identity that brings posts, links, relationships, privacy, and Meshi presence into one profile.",
  };
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <InstagramProfileView username={username} />;
}
