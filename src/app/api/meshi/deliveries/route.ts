import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { hasMeshPro } from "@/lib/mesh-pro";
import { parseDeliveryNotificationMessage } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest, readJsonObject } from "@/lib/request-guard";

const MAX_DELIVERY_IDS = 100;

// The notification row stores a truncated summary ("Meshi delivered a
// message: \"…\"") for the notifications feed. The arrival card hands over the
// sender's actual words, so unwrap the summary as a fallback when the real
// message body can't be found.
function unwrapDeliverySummary(summary: string): string {
  const match = summary.match(/^Meshi delivered a message: "([\s\S]*)"$/);
  return match ? match[1] : summary;
}

// GET: Fetch unread Meshi deliveries for the current user
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Find notifications of type "meshi_delivery" that are unread
    const deliveryNotifs = await prisma.notification.findMany({
      where: {
        recipientId: user.id,
        type: "meshi_delivery",
        read: false,
      },
      include: {
        actor: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isMeshPro: true,
            meshProGiftUntil: true,
            meshiPreference: {
              select: {
                colorTheme: true,
                hatStyle: true,
                hairStyle: true,
                hairColor: true,
                accessoryStyle: true,
                eyeStyle: true,
                badgeStyle: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Recover each delivery's full message body. New notifications carry the
    // EXACT message id as a machine prefix in the message column (see
    // src/lib/notifications.ts) — resolve it directly, scoped to messages
    // this actor sent in a thread the recipient belongs to, so the id can
    // never exfiltrate someone else's message. Legacy rows without the
    // prefix fall back to the old newest-message-in-window heuristic.
    const fullBodies = new Map<string, string>();
    await Promise.all(
      deliveryNotifs.map(async (n) => {
        if (!n.actorId) return;
        const { messageId } = parseDeliveryNotificationMessage(n.message);
        if (messageId) {
          const exact = await prisma.message.findFirst({
            where: {
              id: messageId,
              senderId: n.actorId,
              thread: { members: { some: { userId: user.id } } },
            },
            select: { content: true },
          });
          if (exact?.content) {
            fullBodies.set(n.id, exact.content);
            return;
          }
        }
        const carried = await prisma.message.findFirst({
          where: {
            senderId: n.actorId,
            createdAt: { lte: new Date(n.createdAt.getTime() + 5000) },
            // Scope to the 1:1 DM between the two users, not any shared thread —
            // otherwise a later message the actor posts to a shared *group* within
            // the 5s window overrides the actual delivered message.
            thread: {
              threadType: "direct",
              members: { every: { userId: { in: [user.id, n.actorId] } } },
              AND: [
                { members: { some: { userId: user.id } } },
                { members: { some: { userId: n.actorId } } },
              ],
            },
          },
          orderBy: { createdAt: "desc" },
          select: { content: true },
        });
        if (carried?.content) fullBodies.set(n.id, carried.content);
      }),
    );

    const deliveries = deliveryNotifs.map((n) => ({
      id: n.id,
      fromUser: n.actor?.displayName || "Someone",
      fromUsername: n.actor?.username || "unknown",
      message:
        fullBodies.get(n.id) ||
        unwrapDeliverySummary(parseDeliveryNotificationMessage(n.message).text),
      meshiColor: n.actor?.meshiPreference?.colorTheme || "blue",
      meshiHat: n.actor?.meshiPreference?.hatStyle || "none",
      meshiHair: n.actor?.meshiPreference?.hairStyle || "none",
      meshiHairColor: n.actor?.meshiPreference?.hairColor || "inherit",
      meshiAccessory: n.actor?.meshiPreference?.accessoryStyle || "none",
      meshiEyeStyle: n.actor?.meshiPreference?.eyeStyle || "regular",
      meshiBadge: n.actor?.meshiPreference?.badgeStyle || "none",
      // The sender's Meshi walks in wearing their own mark — hasMeshPro(),
      // never the raw column, which is unpatched for non-session rows.
      isPro: n.actor ? hasMeshPro(n.actor) : false,
      timestamp: n.createdAt.getTime(),
    }));

    // Don't mark as read here — the client will call POST after displaying each delivery
    return NextResponse.json({ deliveries });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

// POST: Mark specific deliveries as read after the client has displayed them
export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const deliveryBody = await readJsonObject(req);
    const { ids } = deliveryBody;
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }
    const idList = ids
      .filter((id): id is string => typeof id === "string")
      .slice(0, MAX_DELIVERY_IDS);
    if (idList.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    }

    // Only mark notifications that belong to this user
    await prisma.notification.updateMany({
      where: {
        id: { in: idList },
        recipientId: user.id,
        type: "meshi_delivery",
      },
      data: { read: true },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
