import type { Metadata } from "next";
import { MessagesIndexPane } from "@/components/messages/messages-index-pane";

export const metadata: Metadata = {
  title: "MeChat",
  description: "Unified private messaging for Mesh.me.",
};

export default function MessagesPage() {
  return <MessagesIndexPane />;
}
