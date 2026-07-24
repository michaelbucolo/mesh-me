export const notificationCategories = [
  "all",
  "unread",
  "likes",
  "comments",
  "follows",
  "messages",
  "mentions",
  "communities",
  "security",
  "privacy",
  "shares",
] as const;

export type NotificationCategory = typeof notificationCategories[number];

type NotificationActor = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
} | null;

type NotificationPost = {
  id: string;
  content: string;
  community: {
    id: string;
    name: string;
    slug: string;
  } | null;
} | null;

export type NotificationRecord = {
  id: string;
  type: string;
  message: string | null;
  read: boolean;
  postId: string | null;
  createdAt: Date | string;
  actor: NotificationActor;
  post?: NotificationPost;
};

type SerializedNotification = {
  id: string;
  type: string;
  category: NotificationCategory;
  label: string;
  message: string;
  read: boolean;
  postId: string | null;
  href: string;
  createdAt: string;
  actor: NotificationActor;
  post: NotificationPost;
  priority: "high" | "normal";
};

export type NotificationGroup = {
  key: string;
  category: NotificationCategory;
  title: string;
  summary: string;
  href: string;
  count: number;
  unreadCount: number;
  priority: "high" | "normal";
  latestAt: string;
  actorNames: string[];
  notifications: SerializedNotification[];
};

type NotificationCategoryCount = {
  total: number;
  unread: number;
};

export type NotificationPreferenceSummary = {
  pushEnabled: boolean;
  emailDigest: string;
  messages: boolean;
  mentions: boolean;
  comments: boolean;
  follows: boolean;
  platformAlerts: boolean;
  securityAlerts: boolean;
  productUpdates: boolean;
};

export type NotificationCenterPayload = {
  notifications: SerializedNotification[];
  groups: NotificationGroup[];
  categories: Record<NotificationCategory, NotificationCategoryCount>;
  unreadCount: number;
  unreadGroupCount: number;
  importantCount: number;
  smartSummary: string;
  preferences: NotificationPreferenceSummary;
};

const defaultNotificationPreferenceSummary: NotificationPreferenceSummary = {
  pushEnabled: true,
  emailDigest: "weekly",
  messages: true,
  mentions: true,
  comments: true,
  follows: true,
  platformAlerts: true,
  securityAlerts: true,
  productUpdates: false,
};

const categoryLabels: Record<NotificationCategory, string> = {
  all: "All",
  unread: "Unread",
  likes: "Likes",
  comments: "Comments",
  follows: "Follows",
  messages: "Messages",
  mentions: "Mentions",
  communities: "Communities",
  security: "Security",
  privacy: "Privacy",
  shares: "Shares",
};

export function getNotificationCategoryLabel(category: NotificationCategory) {
  return categoryLabels[category];
}

// Map the authoritative notification `type` (a server-set enum) to a category.
const NOTIFICATION_TYPE_CATEGORY: Record<string, NotificationCategory> = {
  like: "likes",
  reaction: "likes",
  comment: "comments",
  reply: "comments",
  follow: "follows",
  friend: "follows",
  mesh_friend: "follows",
  message: "messages",
  meshi_delivery: "messages",
  mechat_session: "messages",
  mention: "mentions",
  repost: "shares",
  share: "shares",
  security_alert: "security",
};

function classifyNotificationType(type: string): NotificationCategory {
  const key = type.toLowerCase().trim();
  const mapped = NOTIFICATION_TYPE_CATEGORY[key];
  if (mapped) return mapped;

  // Fallback for unknown/system types: match on the authoritative `type` ONLY,
  // never the message — the message embeds the actor's user-controlled display
  // name, so keyword-matching it let a hostile name (e.g. "Security Alert")
  // forge a high-priority security/privacy category and misroute the link.
  if (/(security|login|password|passkey|two.?factor|2fa|session|device|recovery)/.test(key)) return "security";
  if (/(privacy|permission|data|export|delete|connected|sync|oauth|token)/.test(key)) return "privacy";
  if (/(community|space|group|room|member)/.test(key)) return "communities";
  if (/(mention|tagged)/.test(key)) return "mentions";
  if (/(message|mechat|dm|chat)/.test(key)) return "messages";
  if (/(comment|reply)/.test(key)) return "comments";
  if (/(follow|friend)/.test(key)) return "follows";
  if (/(repost|share)/.test(key)) return "shares";
  if (/(like|heart|reaction)/.test(key)) return "likes";
  return "privacy";
}

function getNotificationHref(notification: Pick<SerializedNotification, "category" | "postId" | "actor" | "post">) {
  if (notification.postId) return `/feed/${notification.postId}`;
  if (notification.category === "messages") return "/messages";
  if (notification.category === "security") return "/settings?tab=security";
  if (notification.category === "privacy") return "/settings?tab=privacy";
  if (notification.category === "communities" && notification.post?.community?.slug) {
    return `/communities/${notification.post.community.slug}`;
  }
  if (notification.category === "communities") return "/communities";
  if (notification.actor?.username) return `/profile/${notification.actor.username}`;
  return "/notifications";
}

function serializeNotification(notification: NotificationRecord): SerializedNotification {
  const createdAt = notification.createdAt instanceof Date ? notification.createdAt.toISOString() : notification.createdAt;
  const message = notification.message?.trim() || fallbackMessage(notification);
  const category = classifyNotificationType(notification.type);
  const serialized: SerializedNotification = {
    id: notification.id,
    type: notification.type,
    category,
    label: labelForCategory(category),
    message,
    read: notification.read,
    postId: notification.postId,
    href: "/notifications",
    createdAt,
    actor: notification.actor,
    post: notification.post ?? null,
    priority: category === "security" || category === "privacy" ? "high" : "normal",
  };

  return {
    ...serialized,
    href: getNotificationHref(serialized),
  };
}

export function buildNotificationCenterPayload(
  notificationRecords: NotificationRecord[],
  unreadCount: number,
  preferences?: Partial<NotificationPreferenceSummary> | null,
): NotificationCenterPayload {
  const notifications = notificationRecords.map(serializeNotification);
  const categories = emptyCategoryCounts();
  const groupMap = new Map<string, SerializedNotification[]>();

  for (const notification of notifications) {
    categories.all.total += 1;
    categories[notification.category].total += 1;
    if (!notification.read) {
      categories.all.unread += 1;
      categories.unread.total += 1;
      categories.unread.unread += 1;
      categories[notification.category].unread += 1;
    }

    const key = groupKey(notification);
    groupMap.set(key, [...(groupMap.get(key) || []), notification]);
  }

  const groups = [...groupMap.entries()]
    .map(([key, items]) => buildNotificationGroup(key, items))
    .sort((a, b) => new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime());

  const unreadGroupCount = groups.filter((group) => group.unreadCount > 0).length;
  const importantCount = groups.filter((group) => group.priority === "high" && group.unreadCount > 0).length;

  return {
    notifications,
    groups,
    categories,
    unreadCount,
    unreadGroupCount,
    importantCount,
    smartSummary: buildSmartSummary(groups, unreadCount, importantCount),
    preferences: {
      ...defaultNotificationPreferenceSummary,
      ...(preferences ?? {}),
    },
  };
}

function emptyCategoryCounts(): Record<NotificationCategory, NotificationCategoryCount> {
  return Object.fromEntries(
    notificationCategories.map((category) => [category, { total: 0, unread: 0 }]),
  ) as Record<NotificationCategory, NotificationCategoryCount>;
}

function groupKey(notification: SerializedNotification) {
  const dateBucket = notification.createdAt.slice(0, 10);
  if (notification.postId && ["likes", "comments", "mentions", "shares"].includes(notification.category)) {
    return `${notification.category}:post:${notification.postId}:${dateBucket}`;
  }
  if (notification.category === "messages" && notification.actor?.id) {
    return `${notification.category}:actor:${notification.actor.id}:${dateBucket}`;
  }
  if (notification.category === "follows") {
    return `${notification.category}:${dateBucket}`;
  }
  return `${notification.category}:${notification.type}:${dateBucket}`;
}

function buildNotificationGroup(key: string, items: SerializedNotification[]): NotificationGroup {
  const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latest = sorted[0];
  const unreadCount = sorted.filter((item) => !item.read).length;
  const actorNames = unique(sorted.map((item) => item.actor?.displayName).filter(Boolean) as string[]).slice(0, 4);

  return {
    key,
    category: latest.category,
    title: groupTitle(latest, sorted.length, actorNames),
    summary: groupSummary(latest, sorted.length, actorNames),
    href: latest.href,
    count: sorted.length,
    unreadCount,
    priority: sorted.some((item) => item.priority === "high") ? "high" : "normal",
    latestAt: latest.createdAt,
    actorNames,
    notifications: sorted,
  };
}

function groupTitle(notification: SerializedNotification, count: number, actorNames: string[]) {
  const actor = actorNames[0] || notification.actor?.displayName;
  if (count === 1) return notification.message;

  if (notification.category === "likes") return `${count} likes on your post`;
  if (notification.category === "comments") return `${count} comments on your post`;
  if (notification.category === "shares") return `${count} shares of your post`;
  if (notification.category === "mentions") return `${count} mentions connected to you`;
  if (notification.category === "messages") return `${count} messages${actor ? ` from ${actor}` : ""}`;
  if (notification.category === "follows") return `${count} new follows`;
  if (notification.category === "communities") return `${count} community alerts`;
  if (notification.category === "security") return `${count} security alerts`;
  if (notification.category === "privacy") return `${count} privacy alerts`;
  return `${count} notifications`;
}

function groupSummary(notification: SerializedNotification, count: number, actorNames: string[]) {
  const postPreview = notification.post?.content ? `Post: ${truncate(notification.post.content, 88)}` : "";
  const actorPreview = actorNames.length > 0 ? actorNames.join(", ") : "";
  if (count > 1 && actorPreview && postPreview) return `${actorPreview}. ${postPreview}`;
  if (count > 1 && actorPreview) return actorPreview;
  if (postPreview) return postPreview;
  return notification.message;
}

function buildSmartSummary(groups: NotificationGroup[], unreadCount: number, importantCount: number) {
  if (unreadCount === 0) return "You are caught up. Security and privacy alerts are clear.";
  const unreadGroups = groups.filter((group) => group.unreadCount > 0);
  const first = unreadGroups[0];
  const important = importantCount > 0 ? `${importantCount} high-priority alert${importantCount === 1 ? "" : "s"}. ` : "";
  return `${important}${unreadCount} unread notification${unreadCount === 1 ? "" : "s"} grouped into ${unreadGroups.length} clear thread${unreadGroups.length === 1 ? "" : "s"}. Start with ${first?.title || "the newest alert"}.`;
}

function fallbackMessage(notification: NotificationRecord) {
  const actorName = notification.actor?.displayName || "Someone";
  const category = classifyNotificationType(notification.type);
  if (category === "likes") return `${actorName} liked your post`;
  if (category === "comments") return `${actorName} commented on your post`;
  if (category === "follows") return `${actorName} started following you`;
  if (category === "messages") return `${actorName} sent you a message`;
  if (category === "mentions") return `${actorName} mentioned you`;
  if (category === "communities") return "Community activity needs your attention";
  if (category === "security") return "Security alert";
  if (category === "privacy") return "Privacy alert";
  if (category === "shares") return `${actorName} shared your post`;
  return "Mesh.me notification";
}

function labelForCategory(category: NotificationCategory) {
  if (category === "likes") return "Like";
  if (category === "comments") return "Comment";
  if (category === "follows") return "Follow";
  if (category === "messages") return "Message";
  if (category === "mentions") return "Mention";
  if (category === "communities") return "Community";
  if (category === "security") return "Security";
  if (category === "privacy") return "Privacy";
  if (category === "shares") return "Share";
  return "Notification";
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 3)}...` : value;
}
