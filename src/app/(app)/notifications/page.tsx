import { getCurrentUser } from "@/lib/auth";
import { getNotifications } from "@/lib/queries";
import { markNotificationsRead } from "@/lib/actions";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { Bell, Heart, MessageCircle, UserPlus, Repeat, AtSign } from "lucide-react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/utils";
import { MarkReadButton } from "./mark-read-button";

const NOTIFICATION_ICONS: Record<string, typeof Heart> = {
  like: Heart,
  comment: MessageCircle,
  follow: UserPlus,
  repost: Repeat,
  mention: AtSign,
  message: MessageCircle,
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { notifications, unreadCount } = await getNotifications();

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-zinc-400 mt-1">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && <MarkReadButton />}
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-1">
          {notifications.map((notification) => {
            const Icon = NOTIFICATION_ICONS[notification.type] || Bell;
            const href = notification.postId
              ? `/feed/${notification.postId}`
              : notification.actor
              ? `/profile/${notification.actor.username}`
              : "#";

            return (
              <Link
                key={notification.id}
                href={href}
                className={`flex items-start gap-3 p-4 rounded-xl transition-colors ${
                  notification.read ? "hover:bg-zinc-800/30" : "bg-indigo-500/5 hover:bg-indigo-500/10"
                }`}
              >
                <div className="relative">
                  {notification.actor ? (
                    <Avatar src={notification.actor.avatarUrl} alt={notification.actor.displayName} size="sm" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center">
                      <Bell className="h-4 w-4 text-zinc-400" />
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-zinc-900 flex items-center justify-center">
                    <Icon className="h-3 w-3 text-indigo-400" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200">{notification.message}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
                {!notification.read && (
                  <div className="h-2 w-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                )}
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="When someone interacts with you, you'll see it here."
        />
      )}
    </div>
  );
}
