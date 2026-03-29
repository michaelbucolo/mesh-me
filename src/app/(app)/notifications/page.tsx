import { getCurrentUser } from "@/lib/auth";
import { getNotifications } from "@/lib/queries";
import { NotificationsClient } from "./notifications-client";

function generateAISummary(notifications: Array<{ type: string; message: string; actor: { displayName: string } | null }>) {
  const grouped: Record<string, number> = {};
  notifications.forEach((n) => {
    grouped[n.type] = (grouped[n.type] || 0) + 1;
  });

  const parts: string[] = [];
  if (grouped.like) parts.push(`${grouped.like} new like${grouped.like > 1 ? "s" : ""} on your posts`);
  if (grouped.comment) parts.push(`${grouped.comment} new comment${grouped.comment > 1 ? "s" : ""}`);
  if (grouped.follow) parts.push(`${grouped.follow} new follower${grouped.follow > 1 ? "s" : ""}`);
  if (grouped.repost) parts.push(`${grouped.repost} repost${grouped.repost > 1 ? "s" : ""}`);
  if (grouped.mention) parts.push(`${grouped.mention} mention${grouped.mention > 1 ? "s" : ""}`);
  if (grouped.message) parts.push(`${grouped.message} new message${grouped.message > 1 ? "s" : ""}`);

  if (parts.length === 0) return null;
  return parts.join(", ") + " since your last visit.";
}

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { notifications, unreadCount } = await getNotifications();

  const unreadNotifications = notifications.filter((n) => !n.read);
  const aiSummary = unreadNotifications.length > 2
    ? generateAISummary(unreadNotifications.map((n) => ({ type: n.type, message: n.message || "", actor: n.actor })))
    : null;

  const categorized = {
    all: notifications,
    likes: notifications.filter((n) => n.type === "like"),
    comments: notifications.filter((n) => n.type === "comment"),
    follows: notifications.filter((n) => n.type === "follow"),
    messages: notifications.filter((n) => n.type === "message"),
    reposts: notifications.filter((n) => n.type === "repost" || n.type === "mention"),
  };

  return (
    <NotificationsClient
      categorized={{
        all: categorized.all.map((n) => ({ ...n, createdAt: String(n.createdAt) })),
        likes: categorized.likes.map((n) => ({ ...n, createdAt: String(n.createdAt) })),
        comments: categorized.comments.map((n) => ({ ...n, createdAt: String(n.createdAt) })),
        follows: categorized.follows.map((n) => ({ ...n, createdAt: String(n.createdAt) })),
        messages: categorized.messages.map((n) => ({ ...n, createdAt: String(n.createdAt) })),
        reposts: categorized.reposts.map((n) => ({ ...n, createdAt: String(n.createdAt) })),
      }}
      unreadCount={unreadCount}
      aiSummary={aiSummary}
    />
  );
}
